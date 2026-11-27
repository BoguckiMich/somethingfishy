import type { TimeOfDay } from '../clock';
import { isValidDate } from '../daily/dates';
import { isUnique, POOL_SPECIES, speciesById, type Species } from '../data/fish';
import { locationById } from '../data/locations';
import { QUEST_TUNING as T } from '../data/quests';
import { RODS } from '../data/rods';
import { SHOP_BAITS, baitById } from '../data/baits';
import { addBait, type PlayerState } from '../inventory';
import { canBiteWithin, reachableFishZones, type ZoneId } from '../location';
import { randInt, seededRng, type Rng } from '../random';
import { speciesCaught } from '../fishLog';
import { article } from '../../i18n/en';

/**
 * Daily quests (slice 13b). Pure: "today" is injected as `today` (YYYY-MM-DD) and every roll is
 * seeded from the date, so the same day (and gear) always gives the same quests. The list is
 * stored in the save, so buying a rod mid-day never changes today's quests.
 */
/** `catchOnLure` (slice 32): a predator on a lure, any place; only rolled once she owns the spinning rod. */
export type QuestKind = 'catchSpecies' | 'catchAny' | 'catchAtTime' | 'catchDeep' | 'sellCoins' | 'beatRecord' | 'catchOnLure';
export const QUEST_KINDS: readonly QuestKind[] = ['catchSpecies', 'catchAny', 'catchAtTime', 'catchDeep', 'sellCoins', 'beatRecord', 'catchOnLure'];
export type QuestTime = Exclude<TimeOfDay, 'day'>;
export const QUEST_TIMES: readonly QuestTime[] = ['dawn', 'dusk', 'night'];

export interface QuestReward {
  coins: number;
  worms: number;
  /** Sometimes a few of a special bait too (slice 15c); missing in older saves. */
  bait?: { id: string; n: number };
}

/** What a day change paid out for finished, unclaimed quests: coins, worms and the baits summed by id. */
export interface QuestPaid {
  coins: number;
  worms: number;
  baits: Record<string, number>;
}

export interface Quest {
  kind: QuestKind;
  params: {
    /** How much is asked: fish, coins or records. */
    target: number;
    /** catchSpecies only. */
    speciesId?: string;
    /** catchAtTime only. */
    timeOfDay?: QuestTime;
  };
  progress: number;
  done: boolean;
  claimed: boolean;
  reward: QuestReward;
}

export interface QuestsState {
  /** The day the list was rolled for; null before the first roll. */
  date: string | null;
  /** The one free reroll of the day is spent. */
  rerollUsed: boolean;
  list: Quest[];
}

export const newQuests = (): QuestsState => ({ date: null, rerollUsed: false, list: [] });
export const questsOf = (p: PlayerState): QuestsState => p.quests ?? newQuests();

/** FNV-1a: a small string hash, for seeding the daily rolls. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---- Gear and what is possible ---------------------------------------------------------------

const rodOf = (p: PlayerState) => RODS.find((r) => r.id === p.rodId) ?? RODS[0];
/** How far the equipped rod casts, in meters. */
export const rodReach = (p: PlayerState): number => rodOf(p).maxCastM;
/** The depth classes the equipped rod can reach at the place she is at (Quiet Lake unless she travelled, slice 25a). */
export function reachableZones(p: PlayerState): ZoneId[] {
  return reachableFishZones(locationById(p.place), rodOf(p).maxCastM);
}
const reachesDeep = (p: PlayerState): boolean => rodOf(p).maxCastM >= T.deepMinCastM && reachableZones(p).includes('deep');

/** The kinds that make sense with this gear and log. */
export function availableKinds(p: PlayerState): QuestKind[] {
  return QUEST_KINDS.filter((k) => {
    if (k === 'catchDeep') return reachesDeep(p);
    if (k === 'beatRecord') return speciesCaught(p.log) >= T.beatRecordMinSpecies;
    if (k === 'catchOnLure') return p.spinRod === true;
    return true;
  });
}

// ---- Building one quest ----------------------------------------------------------------------

type Range = readonly [number, number];
const pickInRange = (rng: Rng, r: Range): number => randInt(rng, r[0], r[1]);
/** 0 at the low end of the range, 1 at the high end (0.5 for a one-value range). */
const share = (target: number, r: Range): number => (r[1] === r[0] ? 0.5 : (target - r[0]) / (r[1] - r[0]));

function rewardFor(key: keyof typeof T.rewards, s: number): QuestReward {
  const r = T.rewards[key];
  const lerp = (x: Range) => Math.round(x[0] + (x[1] - x[0]) * s);
  return { coins: lerp(r.coins), worms: lerp(r.worms) };
}

const make = (kind: QuestKind, params: Quest['params'], reward: QuestReward): Quest => ({ kind, params, progress: 0, done: false, claimed: false, reward });

function pickWeighted<A>(rng: Rng, items: A[], weight: (a: A) => number): A {
  const total = items.reduce((sum, a) => sum + weight(a), 0);
  let roll = rng() * total;
  for (const a of items) {
    roll -= weight(a);
    if (roll < 0) return a;
  }
  return items[items.length - 1];
}

/** Rolls one quest of the given kind for this gear. */
export function rollQuest(kind: QuestKind, p: PlayerState, rng: Rng): Quest {
  switch (kind) {
    case 'catchSpecies': {
      // Only a fish that can bite where her rod lands at this place (a river species at the river, a lake one at the lake).
      const here = locationById(p.place);
      const reach = rodOf(p).maxCastM;
      const pool: Species[] = POOL_SPECIES.filter((s) => canBiteWithin(here, s, reach));
      const sp = pickWeighted(rng, pool, (s) => T.speciesWeight[s.rarity]);
      const range = T.catchSpecies[sp.rarity as 'common' | 'uncommon' | 'rare'];
      const target = pickInRange(rng, range);
      return make(kind, { target, speciesId: sp.id }, rewardFor(`catchSpecies.${sp.rarity as 'common' | 'uncommon' | 'rare'}`, share(target, range)));
    }
    case 'catchAny': {
      const target = pickInRange(rng, T.catchAny);
      return make(kind, { target }, rewardFor('catchAny', share(target, T.catchAny)));
    }
    case 'catchAtTime': {
      const timeOfDay = QUEST_TIMES[randInt(rng, 0, QUEST_TIMES.length - 1)];
      const range = T.catchAtTime[timeOfDay];
      const target = pickInRange(rng, range);
      return make(kind, { target, timeOfDay }, rewardFor('catchAtTime', share(target, range)));
    }
    case 'catchDeep': {
      const target = pickInRange(rng, T.catchDeep);
      return make(kind, { target }, rewardFor('catchDeep', share(target, T.catchDeep)));
    }
    case 'sellCoins': {
      const range = reachesDeep(p) ? T.sellCoins.deepRod : T.sellCoins.shallowRod;
      // Round to a tidy multiple of 10.
      const target = Math.round(pickInRange(rng, range) / 10) * 10;
      return make(kind, { target }, rewardFor('sellCoins', share(target, range)));
    }
    case 'beatRecord':
      return make(kind, { target: 1 }, rewardFor('beatRecord', 0.5));
    case 'catchOnLure': {
      const target = pickInRange(rng, T.catchOnLure);
      return make(kind, { target }, rewardFor('catchOnLure', share(target, T.catchOnLure)));
    }
  }
}

function shuffle<A>(rng: Rng, items: A[]): A[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The three quests of a day: different kinds, seeded from the date, shaped by the current gear. */
export function rollDay(today: string, p: PlayerState): Quest[] {
  const rng = seededRng(hashString(today));
  const kinds = shuffle(rng, availableKinds(p)).slice(0, T.perDay);
  // The bait part is rolled from its own seed per slot, so it never shifts the rolls above.
  return kinds.map((k, i) => withBaitReward(rollQuest(k, p, rng), seededRng(hashString(`${today}bait${i}`))));
}

/** About 1 quest in 4 also pays 3-5 of a shop bait, and rarely 1 glow bait (tunables in data/quests.ts). */
export function withBaitReward(quest: Quest, rng: Rng): Quest {
  const B = T.baitReward;
  if (rng() >= B.chance) return quest;
  const glow = rng() < B.glowShare;
  const shop = SHOP_BAITS[randInt(rng, 0, SHOP_BAITS.length - 1)];
  const n = randInt(rng, B.shopN[0], B.shopN[1]);
  return { ...quest, reward: { ...quest.reward, bait: glow ? { id: 'glow', n: 1 } : { id: shop.id, n } } };
}

/** Pays one reward into the purse: coins, worms and the bait. */
export function payReward(p: PlayerState, r: QuestReward): PlayerState {
  const paid = { ...p, coins: p.coins + r.coins, worms: p.worms + r.worms };
  return r.bait && baitById(r.bait.id) ? addBait(paid, r.bait.id, r.bait.n) : paid;
}

// ---- Day change ------------------------------------------------------------------------------

const payable = (list: Quest[]): QuestPaid =>
  list.reduce<QuestPaid>((sum, q) => {
    if (!q.done || q.claimed) return sum;
    const b = q.reward.bait;
    const baits = b ? { ...sum.baits, [b.id]: (sum.baits[b.id] ?? 0) + b.n } : sum.baits;
    return { coins: sum.coins + q.reward.coins, worms: sum.worms + q.reward.worms, baits };
  }, { coins: 0, worms: 0, baits: {} });

/**
 * Makes sure the stored quests are today's. On a later date: every done-but-unclaimed quest is
 * paid into the purse first (nothing earned is lost), then three new quests are rolled. On the
 * same day, an earlier date (the device clock was set back) or an invalid `today`, nothing changes.
 */
export function syncQuests(player: PlayerState, today: string): { player: PlayerState; paid: QuestPaid | null; rolled: boolean } {
  const q = questsOf(player);
  if (!isValidDate(today)) return { player, paid: null, rolled: false };
  if (q.date !== null && isValidDate(q.date) && today <= q.date) return { player, paid: null, rolled: false };
  const owed = payable(q.list);
  const paid = owed.coins > 0 || owed.worms > 0 || Object.keys(owed.baits).length > 0 ? owed : null;
  let paidPlayer: PlayerState = { ...player, coins: player.coins + owed.coins, worms: player.worms + owed.worms };
  for (const [id, n] of Object.entries(owed.baits)) paidPlayer = addBait(paidPlayer, id, n);
  return {
    player: { ...paidPlayer, quests: { date: today, rerollUsed: false, list: rollDay(today, paidPlayer) } },
    paid,
    rolled: true,
  };
}

/**
 * Quests are rolled once a day, but she may drive to another place: an unfinished species quest for a fish that cannot bite where her
 * rod lands at the place she is at now is swapped for one that can (seeded from the date and slot, so it is stable). Others stay.
 */
export function retargetQuests(player: PlayerState): PlayerState {
  const q = questsOf(player);
  const here = locationById(player.place);
  const reach = rodReach(player);
  let changed = false;
  const list = q.list.map((quest, i) => {
    if (quest.kind !== 'catchSpecies' || quest.done) return quest;
    const sp = speciesById(String(quest.params.speciesId));
    if (sp && canBiteWithin(here, sp, reach)) return quest;
    changed = true;
    const seed = `${q.date}retarget${i}`;
    return withBaitReward(rollQuest('catchSpecies', player, seededRng(hashString(seed))), seededRng(hashString(`${seed}bait`)));
  });
  return changed ? { ...player, quests: { ...q, list } } : player;
}

// ---- Progress --------------------------------------------------------------------------------

export interface CatchInfo {
  speciesId: string;
  zone: ZoneId;
  /** The game clock's period when the fish was caught. */
  timeOfDay: TimeOfDay;
  /** A strictly longer fish of a species that was already in the log (a first catch is not one). */
  isRecord: boolean;
  /** Caught on a lure (slice 32, the event's `lure`): only the spinning rig brings predators, so this counts "a predator on a lure". */
  lure?: boolean;
}

export interface ProgressResult {
  quests: QuestsState;
  /** Indexes of the quests that just became done. */
  completed: number[];
}

function advance(q: QuestsState, step: (quest: Quest) => number): ProgressResult {
  const completed: number[] = [];
  const list = q.list.map((quest, i) => {
    if (quest.done) return quest;
    const add = step(quest);
    if (add <= 0) return quest;
    const progress = Math.min(quest.params.target, quest.progress + add);
    const done = progress >= quest.params.target;
    if (done) completed.push(i);
    return { ...quest, progress, done };
  });
  return completed.length === 0 && list.every((x, i) => x === q.list[i]) ? { quests: q, completed } : { quests: { ...q, list }, completed };
}

/** A fish was caught (the Pale One counts for any / deep / time-of-day, never for species or records). */
export function questsOnCatch(q: QuestsState, c: CatchInfo): ProgressResult {
  const legendary = isUnique(speciesById(c.speciesId));
  return advance(q, (quest) => {
    switch (quest.kind) {
      case 'catchSpecies': return quest.params.speciesId === c.speciesId ? 1 : 0;
      case 'catchAny': return 1;
      case 'catchAtTime': return quest.params.timeOfDay === c.timeOfDay ? 1 : 0;
      case 'catchDeep': return c.zone === 'deep' ? 1 : 0;
      case 'beatRecord': return c.isRecord && !legendary ? 1 : 0;
      case 'catchOnLure': return c.lure ? 1 : 0;
      case 'sellCoins': return 0;
    }
  });
}

/** Fish were sold for `coins` in total. */
export function questsOnSale(q: QuestsState, coins: number): ProgressResult {
  if (!(coins > 0)) return { quests: q, completed: [] };
  return advance(q, (quest) => (quest.kind === 'sellCoins' ? coins : 0));
}

/** The player with a catch applied to their quests. */
export function applyCatchToPlayer(p: PlayerState, c: CatchInfo): { player: PlayerState; completed: number[] } {
  const r = questsOnCatch(questsOf(p), c);
  return { player: r.quests === p.quests ? p : { ...p, quests: r.quests }, completed: r.completed };
}

// ---- Claiming and rerolling ------------------------------------------------------------------

/** Pays a finished quest once. Does nothing when it is not done, already claimed or out of range. */
export function claimQuest(player: PlayerState, index: number): { player: PlayerState; paid: QuestReward | null } {
  const q = questsOf(player);
  const quest = q.list[index];
  if (!quest || !quest.done || quest.claimed) return { player, paid: null };
  const list = q.list.map((x, i) => (i === index ? { ...x, claimed: true } : x));
  return {
    paid: quest.reward,
    player: { ...payReward(player, quest.reward), quests: { ...q, list } },
  };
}

/** Quests that are done and wait for a Claim (the "!" badge). */
export const claimableCount = (q: QuestsState): number => q.list.filter((x) => x.done && !x.claimed).length;
export const doneCount = (q: QuestsState): number => q.list.filter((x) => x.done).length;

/** Can this quest be swapped today? One free reroll a day, only for an unfinished quest of today's list. */
export function canReroll(q: QuestsState, index: number, today: string): boolean {
  const quest = q.list[index];
  return !!quest && !quest.done && !q.rerollUsed && q.date === today;
}

/**
 * Swaps an unfinished quest for a new one of a kind that is not on the list now. Once a day.
 * Deterministic: seeded from the date and the slot. `ok` is false when nothing changed.
 */
export function rerollQuest(player: PlayerState, index: number, today: string): { player: PlayerState; ok: boolean } {
  const q = questsOf(player);
  if (!canReroll(q, index, today)) return { player, ok: false };
  const used = new Set(q.list.map((x) => x.kind));
  const kinds = availableKinds(player).filter((k) => !used.has(k));
  if (kinds.length === 0) return { player, ok: false };
  const rng = seededRng(hashString(`${today}reroll${index}`));
  const kind = kinds[randInt(rng, 0, kinds.length - 1)];
  const list = q.list.map((x, i) => (i === index ? withBaitReward(rollQuest(kind, player, rng), seededRng(hashString(`${today}rerollbait${index}`))) : x));
  return { player: { ...player, quests: { ...q, rerollUsed: true, list } }, ok: true };
}

// ---- Words -----------------------------------------------------------------------------------

/** "Catch 3 roach", "Catch a fish at dusk", "Sell fish for 100 coins", "Beat a personal best". */
export function questText(quest: Quest): string {
  const n = quest.params.target;
  switch (quest.kind) {
    case 'catchSpecies': {
      const sp = speciesById(quest.params.speciesId ?? '');
      const one = (sp?.name ?? 'fish').toLowerCase();
      const many = (sp?.plural ?? sp?.name ?? 'fish').toLowerCase();
      return n === 1 ? `Catch ${article(one)} ${one}` : `Catch ${n} ${many}`;
    }
    case 'catchAny': return `Catch ${n} fish`;
    case 'catchAtTime': {
      const t = quest.params.timeOfDay ?? 'night';
      const when = t === 'night' ? 'at night' : `at ${t}`;
      return n === 1 ? `Catch a fish ${when}` : `Catch ${n} fish ${when}`;
    }
    case 'catchDeep': return `Catch ${n} fish in deep water`;
    case 'sellCoins': return `Sell fish for ${n} coins`;
    case 'beatRecord': return 'Beat a personal best';
    case 'catchOnLure': return n === 1 ? 'Catch a predator on a lure' : `Catch ${n} predators on a lure`;
  }
}

export const rewardText = (r: QuestReward): string => {
  const bait = r.bait ? baitById(r.bait.id) : undefined;
  return `+${r.coins} coins · +${r.worms} worms${bait && r.bait ? ` · +${r.bait.n} ${bait.name.toLowerCase()}` : ''}`;
};
