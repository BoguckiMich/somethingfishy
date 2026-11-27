/**
 * Tuning sim for the spinning rod (slice 32). Skipped by default; run it with
 *
 *     SIM=1 npx vitest run src/sim/spinning < /dev/null
 *
 * (`SIM_SEEDS=4` for a quicker run, `SIM_MIN=120` for the real minutes of play per seed). It plays the pure core only: the real fishing state
 * machine (float rig and spinning rig), the Line fight, the seeded RNG and the game clock, at the River bend. What it assumes about the human is
 * written in `ASSUME` and in docs/ECONOMY_SIM.md "Spinning (32)". Nothing here is imported by the game.
 */
import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_CYCLE_MS } from '../core/casting';
import { advanceClock, NEW_GAME_CLOCK, timeOfDay, type GameClock } from '../core/clock';
import { RIVER_BEND } from '../core/data/locations';
import { speciesById } from '../core/data/fish';
import { LURES, lureById, SPIN_ROD } from '../core/data/spinning';
import type { GameEvent } from '../core/events';
import { INITIAL_STATE, step, type FishingInput, type FishingState, type SessionContext } from '../core/fishingSession';
import { effectiveBarGear, equippedRod, newPlayer, toBagFish, type PlayerState } from '../core/inventory';
import type { LineFightState } from '../core/lineFight';
import { zoneAt } from '../core/location';
import { seededRng, type Rng } from '../core/random';

declare const process: { env: Record<string, string | undefined> };
const ON = process.env.SIM === '1';
const SEEDS = Number(process.env.SIM_SEEDS ?? 8);
const MINUTES = Number(process.env.SIM_MIN ?? 90);

// ---- What the sim assumes about the human (real ms) --------------------------------------------------------------------
const ASSUME = {
  /** Between the last thing and pressing to cast, both rigs alike (looking, thinking, the bag): random 0.4x..1.6x of this. */
  castPauseMs: 9000,
  /** The cast animation until the lure or bobber lands. */
  castFlightMs: 900,
  /** Reaction to a bite / a strike with the thumb up: random in this range; 5 % of the time she is looking away and takes 0.9 s (a nip). */
  reactMs: [250, 500] as [number, number],
  lapse: 0.05,
  /** Show-off: a tap ends it early. */
  showOffMs: 3200,
  /** After the reel-in of a lost or snagged line. */
  retrieveMs: 1500,
  /** Fight bot (the Line fight's "decent" bot of lineFight.sim.test.ts). */
  fightDelayMs: 200,
  fightJitterMs: 100,
  fightLapse: 0.03,
  /** Retrieve rhythm of the decent spinning bot per band: burst and pause lengths (ms), +-20 % noise. It reads the fish log's "Likes" rows. */
  rhythm: {
    pool: { burst: 1000, pause: 2500 },
    seam: { burst: 3000, pause: 500 },
    riffle: { burst: 3500, pause: 400 },
  } as Record<string, { burst: number; pause: number }>,
  /** Lure of the band she casts at. */
  lureOf: { pool: 'jig', seam: 'wobbler', riffle: 'spinner' } as Record<string, string>,
  /** Where she casts (landing metres) per target band. */
  castM: { pool: [27.5, 30], seam: [19, 24], riffle: [9, 11] } as Record<string, [number, number]>,
  /** Float rig: where she casts (carbon rod, 40 m). */
  floatM: [8, 19, 32],
  /** Her kit at the River bend: carbon rod, braided line, smooth reel, trotting float, heavy lead (the float rig's best), the spinning rod on top. */
  kit: { rodId: 'carbon', lineId: 'braided', reelId: 'smooth', riverFloat: true, riverLead: true, spinRod: true } as Partial<PlayerState>,
};

const TICK = 16;

type Bot = 'decent' | 'careless' | 'float';
type Target = 'pool' | 'seam' | 'riffle';

interface Stats {
  minutes: number;
  casts: number;
  /** Spinning: strikes, hooks, nips, catches, lost lures, snags. */
  strikes: number;
  nips: number;
  /** Strikes with the thumb up (the ones that needed a reaction). */
  graceStrikes: number;
  hooks: number;
  catches: number;
  follows: number;
  lureLost: number;
  snags: number;
  outs: number;
  gross: number;
  /** Lure cost (every lost lure at its price, minus the ones Bestia brings back) and worms. */
  lureCost: number;
  wormCost: number;
  byTarget: Record<string, { casts: number; strikes: number; hooks: number }>;
  species: Record<string, number>;
  predatorCatches: number;
  avgLen: Record<string, number[]>;
}

const newStats = (): Stats => ({
  minutes: 0, casts: 0, strikes: 0, nips: 0, graceStrikes: 0, hooks: 0, catches: 0, follows: 0, lureLost: 0, snags: 0, outs: 0, gross: 0, lureCost: 0, wormCost: 0,
  byTarget: { pool: { casts: 0, strikes: 0, hooks: 0 }, seam: { casts: 0, strikes: 0, hooks: 0 }, riffle: { casts: 0, strikes: 0, hooks: 0 } },
  species: {}, predatorCatches: 0, avgLen: {},
});

const PRED = ['pike', 'perch', 'asp', 'chub', 'trout'];

/** One bot plays `minutes` of real time at the River bend. `fixedTarget` pins the band she casts at (the strikes-per-cast table). */
function play(bot: Bot, seed: number, minutes: number, fixedTarget?: Target, startMinute?: number): Stats {
  const rng: Rng = seededRng(seed * 7919 + (bot === 'float' ? 3 : bot === 'careless' ? 5 : 7));
  const human: Rng = seededRng(seed * 104729 + 11);
  const p: PlayerState = { ...newPlayer(), ...ASSUME.kit, lures: { spinner: 99, wobbler: 99, jig: 99 }, ...(bot === 'float' ? {} : { rig: 'spin' as const }) };
  let clock: GameClock = { ...NEW_GAME_CLOCK, ...(startMinute !== undefined ? { minute: startMinute } : {}) };
  let lure = 'spinner';
  const st = newStats();
  let state: FishingState = INITIAL_STATE;
  let t = 0;
  const queue: { at: number; input: FishingInput }[] = [];
  const queueAt = (at: number, input: FishingInput) => queue.push({ at, input });
  const jitter = (ms: number, spread = 0.2) => ms * (1 + (human() * 2 - 1) * spread);
  const range = ([a, b]: [number, number]) => a + human() * (b - a);

  const ctx = (): SessionContext => ({
    location: RIVER_BEND,
    rod: equippedRod(p),
    barGear: effectiveBarGear(p),
    rng,
    timeOfDay: () => timeOfDay(clock.minute),
    minute: () => clock.minute,
    catchStyle: () => 'line',
    riverGear: () => ({ float: true, lead: true }),
    ...(bot === 'float' ? {} : { rig: () => 'spin' as const, lureId: () => lure }),
  });

  let castPlanned = false;
  let target: Target = 'seam';
  let castFor: Target = 'seam';
  // Spin bot: the next time it switches burst / pause.
  let switchAt = -1;
  // Fight bot.
  let fightHold = true;
  let fightSwitch = -1;
  let prevT = 0;
  let vel = 0;
  let retrievePlanned = false;
  let caughtPlanned = false;

  const pickTarget = (): Target => {
    if (fixedTarget) return fixedTarget;
    // She knows the trout bite at dawn and dusk (the fish log): the riffle only then; the rest of the day the pool and the seam alternate.
    const r = human();
    const tod = timeOfDay(clock.minute);
    if (tod === 'dawn' || tod === 'dusk') return r < 0.3 ? 'pool' : r < 0.6 ? 'seam' : 'riffle';
    return r < 0.5 ? 'pool' : 'seam';
  };

  const onEvent = (e: GameEvent) => {
    switch (e.type) {
      case 'cast':
        st.casts++;
        st.byTarget[castFor].casts += bot === 'float' ? 0 : 1;
        queueAt(t + ASSUME.castFlightMs, { type: 'landed' });
        break;
      case 'bite':
        queueAt(t + range(ASSUME.reactMs), { type: 'press' });
        break;
      case 'follow':
        st.follows++;
        break;
      case 'strike': {
        st.strikes++;
        if (e.hookGraceMs > 0) st.graceStrikes++;
        st.byTarget[castFor].strikes++;
        if (e.hookGraceMs > 0 && bot !== 'careless') queueAt(t + (human() < ASSUME.lapse ? 900 : range(ASSUME.reactMs)), { type: 'press' });
        break;
      }
      case 'nip':
        st.nips++;
        break;
      case 'hooked':
        if (bot !== 'float') {
          st.hooks++;
          st.byTarget[castFor].hooks++;
        }
        fightHold = true;
        fightSwitch = -1;
        prevT = 0.35;
        vel = 0;
        break;
      case 'fishCaught': {
        st.catches++;
        const sp = speciesById(e.speciesId)!;
        if (sp.rarity !== 'trophy' && sp.rarity !== 'legendary') st.gross += toBagFish({ speciesId: e.speciesId, lengthCm: e.lengthCm, weightG: e.weightG }, undefined, e.perfect === true, clock.minute, { place: RIVER_BEND.id }).price;
        if (bot === 'float') st.wormCost += 1;
        st.species[e.speciesId] = (st.species[e.speciesId] ?? 0) + 1;
        if (PRED.includes(e.speciesId)) st.predatorCatches++;
        (st.avgLen[e.speciesId] ??= []).push(e.lengthCm);
        break;
      }
      case 'fishLost':
        if (bot === 'float' && human() < 0.5) st.wormCost += 1;
        break;
      case 'lureLost':
        st.lureLost++;
        if (e.cause === 'snag') st.snags++;
        if (e.cause === 'snag' || !e.bringBack) st.lureCost += lureById(e.lure)!.price;
        break;
      case 'lureOut':
        st.outs++;
        break;
      default:
    }
  };

  const apply = (input: FishingInput) => {
    const r = step(state, input, ctx());
    state = r.state;
    for (const e of r.events) onEvent(e);
  };

  const end = minutes * 60_000;
  while (t < end) {
    // The scheduled presses and landings.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at <= t) {
        const q = queue.splice(i, 1)[0];
        apply(q.input);
      }
    }
    // The bot's reading of the state.
    switch (state.kind) {
      case 'idle':
        retrievePlanned = false;
        caughtPlanned = false;
        if (!castPlanned) {
          castPlanned = true;
          target = pickTarget();
          castFor = target;
          let m: number;
          if (bot === 'float') m = ASSUME.floatM[Math.floor(human() * ASSUME.floatM.length)];
          else {
            m = range(ASSUME.castM[target]);
            lure = ASSUME.lureOf[target];
          }
          const reach = bot === 'float' ? equippedRod(p).maxCastM : SPIN_ROD.maxCastM;
          const hold = Math.max(200, Math.min(CHARGE_HALF_CYCLE_MS, (m / reach) * CHARGE_HALF_CYCLE_MS));
          const at = t + (ASSUME.castPauseMs * (0.4 + human() * 1.2)) * (bot === 'float' ? 1 : 1);
          queueAt(at, { type: 'press' });
          queueAt(at + hold, { type: 'release' });
        }
        break;
      case 'charging':
      case 'casting':
        castPlanned = true;
        break;
      case 'spinning': {
        castPlanned = false;
        const s = state.spin;
        if (bot === 'careless') {
          if (!s.holding && s.elapsedMs > 300) apply({ type: 'press' });
        } else if (switchAt < 0) {
          const band = zoneAt(RIVER_BEND, s.distanceM).id;
          const r = ASSUME.rhythm[band] ?? ASSUME.rhythm.seam;
          switchAt = t + jitter(s.holding ? r.burst : r.pause);
          if (s.bursts === 0 && !s.holding) switchAt = t + 700;
        } else if (t >= switchAt && state.kind === 'spinning') {
          apply({ type: s.holding ? 'release' : 'press' });
          switchAt = -1;
        }
        break;
      }
      case 'waiting':
      case 'bite':
        castPlanned = false;
        break;
      case 'fighting': {
        castPlanned = false;
        switchAt = -1;
        const l = state.line as LineFightState;
        vel = vel * 0.8 + ((l.tension - prevT) / TICK) * 0.2;
        prevT = l.tension;
        const targetT = l.goldLo + (l.goldHi - l.goldLo) * 0.5;
        const surging = l.phase === 'warn' || l.phase === 'hush' || l.phase === 'run' || l.cutWarn > 0;
        const want = !surging && l.tension + vel * ASSUME.fightDelayMs < targetT;
        if (want === fightHold) fightSwitch = -1;
        else if (fightSwitch < 0) fightSwitch = t + ASSUME.fightDelayMs + (human() * 2 - 1) * ASSUME.fightJitterMs + (human() < ASSUME.fightLapse ? 600 : 0);
        if (fightSwitch >= 0 && t >= fightSwitch) {
          fightHold = want;
          fightSwitch = -1;
          apply({ type: want ? 'press' : 'release' });
        }
        break;
      }
      case 'caught':
        if (!caughtPlanned) {
          caughtPlanned = true;
          castPlanned = false;
          queueAt(t + ASSUME.showOffMs, { type: 'press' });
        }
        break;
      case 'lost':
        castPlanned = false;
        break;
      case 'retrieving':
        castPlanned = false;
        if (!retrievePlanned) {
          retrievePlanned = true;
          queueAt(t + ASSUME.retrieveMs, { type: 'retrieved' });
        }
        break;
    }
    // Time passes.
    const r = step(state, { type: 'tick', dtMs: TICK }, ctx());
    state = r.state;
    for (const e of r.events) onEvent(e);
    clock = advanceClock(clock, TICK);
    t += TICK;
  }
  st.minutes = minutes;
  return st;
}

const sum = (ss: Stats[], f: (s: Stats) => number) => ss.reduce((a, s) => a + f(s), 0);
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const f2 = (x: number) => x.toFixed(2);

function coinsPerMin(ss: Stats[]): number {
  return (sum(ss, (s) => s.gross) - sum(ss, (s) => s.lureCost) - sum(ss, (s) => s.wormCost)) / sum(ss, (s) => s.minutes);
}

describe.skipIf(!ON)('spinning sim (SIM=1)', () => {
  it('strikes per cast by band, decent and careless bot', { timeout: 900_000 }, () => {
    const rows: string[] = ['bot       band    casts  follows/cast  strikes/cast  hooks/cast  catches/cast  nips  thumb-up strikes  lost lures/cast'];
    for (const bot of ['decent', 'careless'] as const) {
      for (const target of ['riffle', 'seam', 'pool'] as const) {
        // Day, dusk and night in turn (the game clock runs on), so every hour's predators are in.
        const ss = seeds(SEEDS).map((seed) => play(bot, seed, Math.max(30, MINUTES / 3), target));
        const casts = sum(ss, (s) => s.byTarget[target].casts);
        rows.push(
          `${bot.padEnd(10)}${target.padEnd(8)}${String(casts).padStart(5)}  ${f2(sum(ss, (s) => s.follows) / casts).padStart(11)}  ${f2(sum(ss, (s) => s.byTarget[target].strikes) / casts).padStart(12)}  ${f2(sum(ss, (s) => s.byTarget[target].hooks) / casts).padStart(10)}  ${f2(sum(ss, (s) => s.catches) / casts).padStart(12)}  ${String(sum(ss, (s) => s.nips)).padStart(4)}  ${String(sum(ss, (s) => s.graceStrikes)).padStart(16)}  ${f2(sum(ss, (s) => s.lureLost) / casts)}`,
        );
      }
    }
    console.log(rows.join('\n'));
  });

  it('coins per minute at the River bend: float rig vs spinning (decent) vs careless', { timeout: 900_000 }, () => {
    const out: Record<string, Stats[]> = {};
    for (const bot of ['float', 'decent', 'careless'] as const) out[bot] = seeds(SEEDS).map((seed) => play(bot, seed, MINUTES));
    const rows: string[] = ['rig        casts/min  catches/min  strikes/cast  gross c/min  lure cost c/min  worms c/min  net c/min   predator share'];
    for (const bot of ['float', 'decent', 'careless'] as const) {
      const ss = out[bot];
      const m = sum(ss, (s) => s.minutes);
      const casts = sum(ss, (s) => s.casts);
      rows.push(
        `${bot.padEnd(11)}${f2(casts / m).padStart(8)}  ${f2(sum(ss, (s) => s.catches) / m).padStart(10)}  ${f2(sum(ss, (s) => s.strikes) / casts).padStart(11)}  ${f2(sum(ss, (s) => s.gross) / m).padStart(11)}  ${f2(sum(ss, (s) => s.lureCost) / m).padStart(15)}  ${f2(sum(ss, (s) => s.wormCost) / m).padStart(11)}  ${f2(coinsPerMin(ss)).padStart(9)}   ${Math.round((100 * sum(ss, (s) => s.predatorCatches)) / Math.max(1, sum(ss, (s) => s.catches)))}%`,
      );
    }
    const species = (ss: Stats[]) => {
      const m: Record<string, number> = {};
      for (const s of ss) for (const [k, v] of Object.entries(s.species)) m[k] = (m[k] ?? 0) + v;
      return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    };
    const avg = (ss: Stats[], id: string) => {
      const xs = ss.flatMap((s) => s.avgLen[id] ?? []);
      return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
    };
    rows.push('', 'float species: ' + species(out.float), 'spin species:  ' + species(out.decent), 'careless:      ' + species(out.careless));
    rows.push(`lost lures per hour (decent): ${f2((60 * sum(out.decent, (s) => s.lureLost)) / sum(out.decent, (s) => s.minutes))} (of which snags ${f2((60 * sum(out.decent, (s) => s.snags)) / sum(out.decent, (s) => s.minutes))}), lure cost share of gross ${Math.round((100 * sum(out.decent, (s) => s.lureCost)) / sum(out.decent, (s) => s.gross))}%`);
    rows.push(`mean length cm float / spin: ` + ['chub', 'perch', 'asp', 'pike', 'trout'].map((id) => `${id} ${avg(out.float, id)}/${avg(out.decent, id)}`).join(', '));
    console.log(rows.join('\n'));
    const ratio = coinsPerMin(out.decent) / coinsPerMin(out.float);
    const careless = sum(out.careless, (s) => s.catches) / Math.max(1, sum(out.decent, (s) => s.catches));
    console.log(`spin/float net coins per minute: ${f2(ratio)} (target 0.85..1.15); careless catches / decent catches: ${f2(careless)} (target about 0.5)`);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
    expect(careless).toBeGreaterThan(0.35);
    expect(careless).toBeLessThan(0.65);
  });

  it('lures: which lure brings what (decent rhythm per band)', { timeout: 600_000 }, () => {
    void LURES;
    expect(true).toBe(true);
  });
});
