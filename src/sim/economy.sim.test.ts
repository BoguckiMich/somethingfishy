/**
 * The economy and pacing bot sim (balance pass A2, 2026-11-26). Skipped by default; run it with
 *
 *     SIM=1 npx vitest run src/sim < /dev/null
 *
 * (add `SIM_SEEDS=4` for a quicker run). It plays the pure core only: the real fishing state machine, catch bar,
 * seeded RNG, game clock, weather, fish of the day, daily quests, checklist, shop gates and naps. What it assumes
 * about the human (cast and show-off overheads, shop trips, the shopping order) is written next to the numbers
 * in docs/ECONOMY_SIM.md. Nothing here is imported by the game.
 */
import { describe, it } from 'vitest';
import * as bedtimeMod from '../core/bedtime';
import { inCarWindow, napWakeClock } from '../core/bedtime';
import { CHARGE_HALF_CYCLE_MS, MIN_HOLD_MS } from '../core/casting';
import { CATCH_BAR_TUNING, barResult, isPerfect, newCatchBar, tickCatchBar, type FishProfile } from '../core/catchBar';
import { allDone, bundleDone, canFill, checklistOf, giveFish, payCoins } from '../core/checklist/checklist';
import { advanceClock, NEW_GAME_CLOCK, timeOfDay, type GameClock, type TimeOfDay } from '../core/clock';
import { buyCampItem, campOwned } from '../core/camp';
import { CAMP_ITEMS } from '../core/data/camp';
import { CHECKLIST, PETROL_ID } from '../core/data/checklist';
import { isUnique, speciesById } from '../core/data/fish';
import { QUIET_LAKE } from '../core/data/locations';
import { NIGHT_KIT } from '../core/data/nightKit';
import { RODS } from '../core/data/rods';
import { LINES, REELS } from '../core/data/tackle';
import { baitById, WORM_ID } from '../core/data/baits';
import { fishOfTheDay } from '../core/daily/fotd';
import { weatherEffects, weatherForHour } from '../core/daily/weather';
import { fightProfile, rollLength, candidates } from '../core/fish';
import { gearUnlocked } from '../core/gearGates';
import { recordCatch } from '../core/fishLog';
import { INITIAL_STATE, step, type FishingState, type SessionContext } from '../core/fishingSession';
import {
  addCatch, applyEvent, buyBait, buyLine, buyNightKit, buyReel, buyRod, buyWorms, chooseBait, chosenBait, effectiveBarGear, equippedRod,
  hasNightKit, newPlayer, sellAll, type PlayerState,
} from '../core/inventory';
import { applyCatchToPlayer, claimQuest, questsOf, syncQuests } from '../core/quests/quests';
import { seededRng, type Rng } from '../core/random';

declare const process: { env: Record<string, string | undefined> };
const ON = process.env.SIM === '1';
const SEEDS = Number(process.env.SIM_SEEDS ?? 8);

// ---- What the sim assumes about the human (all in real ms unless named) ------------------------------------------------
const ASSUME = {
  /** Between the last thing and pressing to cast (looking, thinking, checking the bag, a missed bite): random 0.4x..1.6x of this. Tuned so a catch takes ~35-45 s, the pacing in core/data/quests.ts. */
  castPauseMs: 9000,
  /** The farmer does not dawdle: her pause is this share of a normal player's. */
  grinderPause: 0.3,
  /** The cast animation until the bobber lands. */
  castFlightMs: 900,
  /** Reaction to the bite; the window is 1000 ms. */
  reactMs: [300, 500] as [number, number],
  /** Show-off: a tap ends it early; a new species lingers. */
  showOffMs: 3200,
  newSpeciesShowOffMs: 5000,
  /** After a lost fish: the slack line, then the reel-in. */
  lostMs: 2500,
  /** A trip to the shop and back: walk, sell, hand in, buy. */
  visitMs: 30_000,
  /** The companions walk to the car and the screen fades (1800 + 2000 + 1800). */
  napMs: 9000 + 5600,
  /** After 05:00 they climb out of the car; no nap meanwhile. */
  wakeMs: 8000,
  /** Alex's own 02:00 bedtime without the kit: the fade. */
  bedFadeMs: 5600,
  /** Real minutes of play per real day. */
  sessionMin: 40,
  /** Where the bot casts. */
  shallowM: 8,
  deepM: 20,
  /** Real hour of the first session each day (the hourly weather follows the real clock). */
  sessionStartHour: 17,
};

interface Bot {
  delayMs: number;
  noise: number;
}
const DECENT: Bot = { delayMs: 200, noise: 0.05 };
const SKILLED: Bot = { delayMs: 150, noise: 0 };

const NAP_COOLDOWN_MS = ((bedtimeMod as unknown as Record<string, unknown>).NAP_COOLDOWN_MS as number | undefined) ?? 0;
type AddCatchFn = (s: PlayerState, h: { speciesId: string; lengthCm: number; weightG: number }, fotd: string | undefined, perfect: boolean, minute: number) => ReturnType<typeof addCatch>;
const addCatchAt = addCatch as unknown as AddCatchFn;

const TICK = 16;
const MIN_PER_MS = 1 / 60_000;

type Profile = 'normal' | 'abuser';

interface Result {
  profile: Profile;
  /** Real minutes of play; Infinity = not reached within the cap. */
  tShop: number;
  tBundles: number;
  tCarbon: number;
  /** Real day number (1-based) the bundles were finished on, assuming `sessionMin` of play a day. */
  dayBundles: number;
  dayShop: number;
  /** Coins earned from sales + quests + bundle rewards per real minute, over the first 60 minutes of nap use (abuser) or in total. */
  coinsPerMin: number;
  /** Coins per minute in the hour before the whole shop was bought (or the last hour simulated). */
  coinsPerMinLate: number;
  /** Coins of fish caught per minute spent between 02:00 and 05:00 on the game clock (0 when never there). */
  deepNightRate: number;
  naps: number;
  catches: number;
  perfectShare: number;
}

const CAP_MIN = 60 * 40;

function run(profile: Profile, seed: number): Result {
  const rng: Rng = seededRng(seed * 7919 + 13);
  let p: PlayerState = newPlayer();
  let clock: GameClock = { ...NEW_GAME_CLOCK };
  let real = 0;
  let st: FishingState = INITIAL_STATE;
  const dayMs = ASSUME.sessionMin * 60_000;
  let lastDay = -1;
  let today = '';
  let napReadyAt = 0;
  let dockReadyAt = 0;
  let wasInCar = inCarWindow(clock.minute);
  let naps = 0;
  let catches = 0;
  let perfects = 0;
  const t: { shop?: number; bundles?: number; carbon?: number } = {};
  let earned = 0;
  const earnedLog: { at: number; coins: number }[] = [];
  let lastVisit = 0;

  const dateOf = (d: number) => new Date(Date.UTC(2026, 11, 1 + d)).toISOString().slice(0, 10);
  const hourNow = () => (ASSUME.sessionStartHour + Math.floor((real % dayMs) / 3_600_000)) % 24;
  const fx = () => {
    const id = weatherForHour(today, hourNow());
    return id ? weatherEffects(id, clock.minute) : undefined;
  };
  const fotd = () => fishOfTheDay(today, p)?.id;
  const kit = () => hasNightKit(p);

  let deepMs = 0;
  let deepCoins = 0;
  const advance = (ms: number) => {
    if (clock.minute >= 120 && clock.minute < 300) deepMs += ms;
    real += ms;
    clock = advanceClock(clock, ms);
  };
  const credit = (coins: number) => {
    earned += coins;
    earnedLog.push({ at: real, coins });
  };

  const ctx = (): SessionContext => ({
    location: QUIET_LAKE,
    rod: equippedRod(p),
    barGear: effectiveBarGear(p),
    rng,
    baitId: () => chosenBait(p),
    fotdId: fotd,
    weatherFx: fx,
    timeOfDay: () => timeOfDay(clock.minute),
    minute: () => clock.minute,
  });

  // ---- Wants ----------------------------------------------------------------------------------------------------------
  const wanted = (): Map<string, number> => {
    const m = new Map<string, number>();
    const state = checklistOf(p);
    const bag = new Map<string, number>();
    for (const f of p.bag) bag.set(f.speciesId, (bag.get(f.speciesId) ?? 0) + 1);
    for (const b of CHECKLIST) {
      if (bundleDone(p, b.id)) continue;
      b.slots.forEach((s, i) => {
        if (s.kind === 'species' && !state[b.id][i]) m.set(s.id, (m.get(s.id) ?? 0) + 1);
      });
    }
    for (const [id, n] of m) {
      const left = n - (bag.get(id) ?? 0);
      if (left > 0) m.set(id, left);
      else m.delete(id);
    }
    for (const q of questsOf(p).list) {
      if (q.done || q.kind !== 'catchSpecies' || !q.params.speciesId) continue;
      m.set(q.params.speciesId, (m.get(q.params.speciesId) ?? 0) + q.params.target - q.progress);
    }
    return m;
  };
  const reachableZones = (): ('shallow' | 'deep')[] => (equippedRod(p).maxCastM >= 15 ? ['shallow', 'deep'] : ['shallow']);
  const wantedAt = (time: TimeOfDay, zone: 'shallow' | 'deep', w: Map<string, number>): number =>
    candidates(zone, time, fx(), QUIET_LAKE.fishPool).filter((s) => w.has(s.id)).length;

  // ---- Shopping -------------------------------------------------------------------------------------------------------
  type Item = { id: string; price: number; owned: () => boolean; unlocked: () => boolean; buy: () => PlayerState | undefined };
  const gearItems = (): Item[] => {
    const rod = (id: string): Item => ({
      id, price: RODS.find((r) => r.id === id)!.price, owned: () => RODS.findIndex((r) => r.id === p.rodId) >= RODS.findIndex((r) => r.id === id),
      unlocked: () => gearUnlocked(id, p), buy: () => { const o = buyRod(p); return o.ok ? o.state : undefined; },
    });
    const line = (id: string): Item => ({
      id, price: LINES.find((r) => r.id === id)!.price, owned: () => LINES.findIndex((r) => r.id === p.lineId) >= LINES.findIndex((r) => r.id === id),
      unlocked: () => gearUnlocked(id, p), buy: () => { const o = buyLine(p); return o.ok ? o.state : undefined; },
    });
    const reel = (id: string): Item => ({
      id, price: REELS.find((r) => r.id === id)!.price, owned: () => REELS.findIndex((r) => r.id === p.reelId) >= REELS.findIndex((r) => r.id === id),
      unlocked: () => gearUnlocked(id, p), buy: () => { const o = buyReel(p); return o.ok ? o.state : undefined; },
    });
    const kitItem: Item = { id: 'kit', price: NIGHT_KIT.price, owned: () => kit(), unlocked: () => true, buy: () => { const o = buyNightKit(p); return o.ok ? o.state : undefined; } };
    const camp = [...CAMP_ITEMS].sort((a, b) => a.price - b.price).map((c): Item => ({
      id: c.id, price: c.price, owned: () => campOwned(p).includes(c.id), unlocked: () => true, buy: () => { const o = buyCampItem(p, c.id); return o.ok ? o.state : undefined; },
    }));
    const gear = [rod('fiberglass'), line('braided'), reel('smooth'), rod('carbon'), line('fluoro'), reel('pro')];
    return profile === 'abuser' ? [gear[0], kitItem, ...gear.slice(1), ...camp] : [...gear, kitItem, ...camp];
  };
  const wholeShopBought = () => gearItems().every((i) => i.owned());

  const shop = () => {
    for (;;) {
      let reserve = 0;
      let bought = false;
      for (const item of gearItems()) {
        if (item.owned()) continue;
        if (!item.unlocked()) {
          reserve = reserve || item.price;
          continue;
        }
        if (p.coins - reserve >= item.price) {
          const next = item.buy();
          if (next) { p = next; bought = true; }
        }
        break; // save for the first thing we want, locked items only reserve
      }
      if (!bought) return;
    }
  };

  const visit = () => {
    advance(ASSUME.visitMs);
    lastVisit = real;
    // Quests first (a claimed quest pays coins and bait).
    questsOf(p).list.forEach((q, i) => {
      if (q.done && !q.claimed) {
        const before = p.coins;
        p = claimQuest(p, i).player;
        credit(p.coins - before);
      }
    });
    // Hand in: species slots first (the cheapest fitting fish), then the star slots.
    const handIn = (kindStar: boolean) => {
      for (const b of CHECKLIST) {
        if (bundleDone(p, b.id)) continue;
        b.slots.forEach((s, i) => {
          if (s.kind === 'coins' || (s.kind === 'star') !== kindStar || !canFill(p, b.id, i)) return;
          const before = p.coins;
          p = giveFish(p, b.id, i).player;
          credit(p.coins - before);
        });
      }
    };
    handIn(false);
    handIn(true);
    // Petrol money: once the next unlocked gear item is not what the coins are for.
    const petrol = CHECKLIST.find((b) => b.id === PETROL_ID)!;
    if (!bundleDone(p, PETROL_ID) && canFill(p, PETROL_ID, 0)) {
      const nextGear = gearItems().find((i) => !i.owned() && i.unlocked());
      const need = petrol.slots[0].kind === 'coins' ? petrol.slots[0].amount : 0;
      if (p.coins >= need + (nextGear?.price ?? 0)) p = payCoins(p, PETROL_ID, 0).player;
    }
    if (p.bag.length > 0) {
      const before = p.coins;
      const r = sellAll(p);
      if (r.ok) p = r.state;
      credit(p.coins - before);
    }
    shop();
    // Worms: a pack whenever she is running low.
    while (p.worms < 6 && p.coins >= 10) {
      const r = buyWorms(p);
      if (!r.ok) break;
      p = r.state;
    }
    // The farmer knows fish strip triples the predators of the night (zander, burbot, catfish): a pack whenever she is low.
    while (profile === 'abuser' && farming() && (p.baits?.strip ?? 0) < 6 && p.coins >= 50) {
      const r = buyBait(p, 'strip');
      if (!r.ok) break;
      p = r.state;
    }
    if (p.worms === 0 && p.coins < 10) p = { ...p, worms: 5 }; // the soft-lock guard
    checkMilestones();
  };

  const checkMilestones = () => {
    const m = real * MIN_PER_MS;
    if (t.carbon === undefined && p.rodId === 'carbon') t.carbon = m;
    if (t.bundles === undefined && allDone(p)) t.bundles = m;
    if (t.shop === undefined && wholeShopBought()) t.shop = m;
  };

  // ---- Naps and bed ---------------------------------------------------------------------------------------------------
  const napAllowed = () => st.kind === 'idle' && !inCarWindow(clock.minute) && real >= dockReadyAt && real >= napReadyAt;
  const nap = (target: number) => {
    advance(ASSUME.napMs);
    clock = napWakeClock(clock, target, kit());
    naps++;
    napReadyAt = real + NAP_COOLDOWN_MS;
    wasInCar = inCarWindow(clock.minute);
  };
  /** The abuser farms deep night while coins are what stands between her and the next thing; while the next thing waits for a bundle she plays like everyone else. */
  const farming = () => {
    if (profile !== 'abuser' || wholeShopBought()) return false;
    const next = gearItems().find((i) => !i.owned());
    return !!next && next.unlocked();
  };
  const napDecision = () => {
    if (!napAllowed()) return;
    if (farming()) {
      nap(kit() ? 2 * 60 : 20 * 60);
      return;
    }
    const w = wanted();
    if (w.size === 0) return;
    const zones = reachableZones();
    const now = timeOfDay(clock.minute);
    if (zones.some((z) => wantedAt(now, z, w) > 0)) return;
    const order: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
    const startAt = order.indexOf(now);
    for (let k = 1; k <= 4; k++) {
      const time = order[(startAt + k) % 4];
      if (zones.some((z) => wantedAt(time, z, w) > 0)) {
        nap({ dawn: 5, day: 7, dusk: 18, night: 20 }[time] * 60);
        return;
      }
    }
  };
  const bedtime = () => {
    // Alex's own bedtime at 02:00 without the kit: the screen fades, the clock jumps to 05:00.
    if (!kit() && clock.minute >= 2 * 60 && clock.minute < 5 * 60) {
      advance(ASSUME.bedFadeMs);
      clock = { day: clock.day, minute: 5 * 60 };
      wasInCar = false;
    }
    const inCar = inCarWindow(clock.minute);
    if (wasInCar && !inCar) dockReadyAt = real + ASSUME.wakeMs;
    wasInCar = inCar;
  };

  // ---- One cast ---------------------------------------------------------------------------------------------------
  const pickBait = (zone: 'shallow' | 'deep', w: Map<string, number>) => {
    let best: string = WORM_ID;
    const cands = candidates(zone, timeOfDay(clock.minute), fx(), QUIET_LAKE.fishPool);
    for (const id of ['strip', 'corn', 'glow', 'maggots']) {
      if ((p.baits?.[id] ?? 0) <= 0) continue;
      const b = baitById(id)!;
      const hits = cands.some((s) => (b.speciesBoost?.ids.includes(s.id) || (b.rarityBoost && b.rarityBoost.rarity === s.rarity)) && (w.size === 0 || w.has(s.id)));
      const fastShallow = b.waitFactor?.zone === zone;
      if (hits || fastShallow) {
        best = id;
        break;
      }
    }
    p = chooseBait(p, best).state;
  };

  const cycle = () => {
    const w = wanted();
    const zones = reachableZones();
    const now = timeOfDay(clock.minute);
    let zone: 'shallow' | 'deep' = zones.includes('deep') ? 'deep' : 'shallow';
    if (zones.length > 1) {
      const ws = wantedAt(now, 'shallow', w);
      const wd = wantedAt(now, 'deep', w);
      if (ws > 0 && wd === 0) zone = 'shallow';
    }
    if (farming() && zones.includes('deep')) zone = 'deep';
    pickBait(zone, w);
    // Cast.
    advance(ASSUME.castPauseMs * (0.4 + rng() * 1.2) * (farming() ? ASSUME.grinderPause : 1));
    const rod = equippedRod(p);
    const target = zone === 'deep' ? ASSUME.deepM : ASSUME.shallowM;
    const heldMs = Math.max(MIN_HOLD_MS + 20, (Math.min(1, target / rod.maxCastM) * CHARGE_HALF_CYCLE_MS) * (1 + (rng() - 0.5) * 0.1));
    st = { kind: 'charging', heldMs };
    advance(heldMs);
    st = step(st, { type: 'release' }, ctx()).state;
    advance(ASSUME.castFlightMs);
    st = step(st, { type: 'landed' }, ctx()).state;
    // Wait for the bite.
    while (st.kind === 'waiting') {
      st = step(st, { type: 'tick', dtMs: 100 }, ctx()).state;
      advance(100);
    }
    if (st.kind !== 'bite') {
      st = INITIAL_STATE;
      return;
    }
    const react = ASSUME.reactMs[0] + rng() * (ASSUME.reactMs[1] - ASSUME.reactMs[0]);
    st = step(st, { type: 'tick', dtMs: react }, ctx()).state;
    advance(react);
    if (st.kind !== 'bite') {
      st = INITIAL_STATE;
      return;
    }
    st = step(st, { type: 'press' }, ctx()).state;
    // Fight: the decent player's bot.
    const noise = seededRng(Math.floor(rng() * 1e9));
    const queue: boolean[] = [];
    const delayTicks = Math.round(DECENT.delayMs / TICK);
    let events: ReturnType<typeof step>['events'] = [];
    let guard = 0;
    while (st.kind === 'fighting' && guard++ < 20_000) {
      const err = st.bar.fish - st.bar.zone + (noise() * 2 - 1) * DECENT.noise;
      queue.push(err > 0);
      const holding = queue.length > delayTicks ? queue.shift()! : false;
      if (holding !== st.bar.holding) st = step(st, { type: holding ? 'press' : 'release' }, ctx()).state;
      const r = step(st, { type: 'tick', dtMs: TICK }, ctx());
      st = r.state;
      advance(TICK);
      if (r.events.length) events = r.events;
    }
    const ev = events.find((e) => e.type === 'fishCaught' || e.type === 'fishLost');
    if (!ev) {
      st = INITIAL_STATE;
      return;
    }
    p = applyEvent(p, ev, rng).state;
    if (ev.type === 'fishLost') {
      advance(ASSUME.lostMs);
      if (st.kind === 'lost' || st.kind === 'retrieving') st = INITIAL_STATE;
      return;
    }
    // Caught.
    catches++;
    const perfect = ev.perfect === true;
    if (perfect) perfects++;
    const hooked = { speciesId: ev.speciesId, lengthCm: ev.lengthCm, weightG: ev.weightG };
    const rec = recordCatch(p.log, hooked, perfect);
    p = { ...p, log: rec.log };
    const sp = speciesById(hooked.speciesId)!;
    const isNew = rec.outcome.kind === 'newSpecies';
    if (!isUnique(sp)) {
      let added = addCatchAt(p, hooked, fotd(), perfect, clock.minute);
      if (added.result === 'bagFull') {
        visit();
        added = addCatchAt(p, hooked, fotd(), perfect, clock.minute);
      }
      p = added.state;
      if (clock.minute >= 120 && clock.minute < 300) deepCoins += added.fish.price;
    }
    p = applyCatchToPlayer(p, { speciesId: hooked.speciesId, zone: ev.zone, timeOfDay: timeOfDay(clock.minute), isRecord: rec.outcome.kind === 'newRecord' }).player;
    advance(isNew || isUnique(sp) ? ASSUME.newSpeciesShowOffMs : ASSUME.showOffMs);
    st = INITIAL_STATE;
  };

  // ---- Main loop --------------------------------------------------------------------------------------------------
  while (real * MIN_PER_MS < CAP_MIN && !(t.shop !== undefined && t.bundles !== undefined && t.carbon !== undefined)) {
    const day = Math.floor(real / dayMs);
    if (day !== lastDay) {
      lastDay = day;
      today = dateOf(day);
      const r = syncQuests(p, today);
      p = r.player;
      if (r.paid) credit(r.paid.coins);
    }
    bedtime();
    napDecision();
    bedtime();
    // A visit when the bag is filling up, she runs low on worms, or a slot could be filled (not more than every 3 minutes).
    const fillable = CHECKLIST.some((b) => !bundleDone(p, b.id) && b.slots.some((_, i) => canFill(p, b.id, i)));
    if (p.bag.length >= 7 || p.worms <= 2 || (fillable && real - lastVisit > 180_000) || (p.coins >= 250 && real - lastVisit > 240_000)) visit();
    if (p.worms <= 0 && p.coins < 10) p = { ...p, worms: 5 };
    cycle();
    checkMilestones();
  }
  const m = real * MIN_PER_MS;
  const lastHour = earnedLog.filter((e) => e.at > real - 3_600_000 - 1).reduce((s, e) => s + e.coins, 0);
  const dayOf = (min: number | undefined) => (min === undefined ? Infinity : Math.floor(min / ASSUME.sessionMin) + 1);
  return {
    profile,
    tShop: t.shop ?? Infinity,
    tBundles: t.bundles ?? Infinity,
    tCarbon: t.carbon ?? Infinity,
    dayBundles: dayOf(t.bundles),
    dayShop: dayOf(t.shop),
    coinsPerMin: earned / Math.max(1, m),
    coinsPerMinLate: lastHour / Math.min(60, Math.max(1, m)),
    deepNightRate: deepMs > 60_000 ? deepCoins / (deepMs * MIN_PER_MS) : 0,
    naps,
    catches,
    perfectShare: catches ? perfects / catches : 0,
  };
}

// ---- Perfect-catch rate for a skilled bot on top gear -------------------------------------------------------------
function perfectRate(speciesIds: string[], n: number, bot: Bot): { id: string; won: number; perfect: number }[] {
  const top = { ...RODS[2].barGear, lineDrain: RODS[2].barGear.lineDrain * LINES[1].drain, reelResponse: RODS[2].barGear.reelResponse * REELS[1].response };
  return speciesIds.map((id) => {
    const sp = speciesById(id)!;
    let won = 0;
    let perfect = 0;
    for (let i = 1; i <= n; i++) {
      const r = seededRng(i * 977 + 5);
      const fish: FishProfile = fightProfile(sp, rollLength(sp, r));
      const noise = seededRng(i + 31);
      let s = newCatchBar(fish, top, r);
      const q: boolean[] = [];
      const d = Math.round(bot.delayMs / TICK);
      for (let ms = 0; ms < 90_000 && barResult(s) === 'fighting'; ms += TICK) {
        q.push(s.fish - s.zone + (bot.noise ? (noise() * 2 - 1) * bot.noise : 0) > 0);
        s = tickCatchBar(s, TICK, q.length > d ? q.shift()! : false, fish, top, r);
      }
      if (barResult(s) === 'caught') {
        won++;
        if (isPerfect(s)) perfect++;
      }
    }
    return { id, won, perfect };
  });
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (x: number) => (Number.isFinite(x) ? (x / 60).toFixed(1) + ' h' : `>${CAP_MIN / 60} h`);
const fmtD = (x: number) => (Number.isFinite(x) ? String(x) : '>cap');

describe.skipIf(!ON)('economy sim (SIM=1)', () => {
  it('shop, bundles, carbon: normal player and nap-abuser', { timeout: 900_000 }, () => {
    const rows: string[] = [`nap cooldown in the build: ${NAP_COOLDOWN_MS} ms; seeds: ${SEEDS}; ${ASSUME.sessionMin} min of play a day`];
    for (const profile of ['normal', 'abuser'] as Profile[]) {
      const rs = Array.from({ length: SEEDS }, (_, i) => run(profile, i + 1));
      const col = (f: (r: Result) => number) => rs.map(f);
      const med = (f: (r: Result) => number) => median(col(f));
      rows.push(
        `${profile}: whole shop ${fmt(med((r) => r.tShop))} (day ${fmtD(med((r) => r.dayShop))}) | six bundles ${fmt(med((r) => r.tBundles))} (day ${fmtD(med((r) => r.dayBundles))}) | carbon rod ${fmt(med((r) => r.tCarbon))}`,
        `   spread shop ${col((r) => r.tShop).map((x) => fmt(x)).sort().join(' ')} | bundles ${col((r) => r.tBundles).map((x) => fmt(x)).sort().join(' ')}`,
        `   coins/min overall ${med((r) => r.coinsPerMin).toFixed(0)}, last hour ${med((r) => r.coinsPerMinLate).toFixed(0)}; deep-night fish ${med((r) => r.deepNightRate).toFixed(0)} coins/min; naps ${med((r) => r.naps)}; catches ${med((r) => r.catches)}; perfect ${(med((r) => r.perfectShare) * 100).toFixed(0)} %`,
      );
    }
    console.log(rows.join('\n'));
  });

  it('perfect catch rate: skilled bot, top gear', { timeout: 600_000 }, () => {
    const darting = ['bleak', 'perch', 'asp', 'pike'];
    const trophies = ['goldenTench', 'silverGhost', 'mossback'];
    const others = ['roach', 'rudd', 'crucian', 'eel', 'ide', 'bream', 'tench', 'carp', 'zander', 'burbot', 'catfish'];
    const rows: string[] = [];
    const grace = CATCH_BAR_TUNING.perfectGraceMs;
    // The grace as built, and what a longer one would do (sensitivity, for the docs).
    for (const g of [grace, 500, 800]) {
      (CATCH_BAR_TUNING as { perfectGraceMs: number }).perfectGraceMs = g;
      for (const bot of [SKILLED, DECENT]) {
        const all = perfectRate([...darting, ...trophies, ...others], 200, bot);
        const share = (ids: string[]) => {
          const rs = all.filter((r) => ids.includes(r.id));
          const perfect = rs.reduce((sum, r) => sum + r.perfect, 0);
          return `${((perfect / (rs.length * 200)) * 100).toFixed(0)} %`;
        };
        rows.push(`grace ${g} ms, bot ${bot.delayMs} ms / noise ${bot.noise}: darting ${share(darting)}, trophies ${share(trophies)}, others ${share(others)}`);
        if (g === grace) rows.push('   ' + all.map((r) => `${r.id} ${((r.perfect / 200) * 100).toFixed(0)}%`).join(', '));
      }
    }
    (CATCH_BAR_TUNING as { perfectGraceMs: number }).perfectGraceMs = grace;
    console.log(rows.join('\n'));
  });
});
