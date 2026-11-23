import type { TimeOfDay } from '../clock';
import { isValidDate } from '../daily/dates';
import { POOL_SPECIES, speciesById, type Species } from '../data/fish';
import { QUIET_LAKE } from '../data/locations';
import { QUEST_TUNING as T } from '../data/quests';
import { RODS } from '../data/rods';
import type { PlayerState } from '../inventory';
import type { ZoneId } from '../location';
import { randInt, seededRng, type Rng } from '../random';
import { speciesCaught } from '../fishLog';

/**
 * Daily quests (slice 13b). Pure: "today" is injected as `today` (YYYY-MM-DD) and every roll is
 * seeded from the date, so the same day (and gear) always gives the same quests. The list is
 * stored in the save, so buying a rod mid-day never changes today's quests.
 */
export type QuestKind = 'catchSpecies' | 'catchAny' | 'catchAtTime' | 'catchDeep' | 'sellCoins' | 'beatRecord';
export const QUEST_KINDS: readonly QuestKind[] = ['catchSpecies', 'catchAny', 'catchAtTime', 'catchDeep', 'sellCoins', 'beatRecord'];
export type QuestTime = Exclude<TimeOfDay, 'day'>;
export const QUEST_TIMES: readonly QuestTime[] = ['dawn', 'dusk', 'night'];

export interface QuestReward {
  coins: number;
  worms: number;
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
/** The zones the equipped rod can reach on the lake. */
export function reachableZones(p: PlayerState): ZoneId[] {
  const reach = rodOf(p).maxCastM;
  return QUIET_LAKE.zones.filter((z) => z.fromM < reach).map((z) => z.id);
}
const reachesDeep = (p: PlayerState): boolean => rodOf(p).maxCastM >= T.deepMinCastM && reachableZones(p).includes('deep');

/** The kinds that make sense with this gear and log. */
export function availableKinds(p: PlayerState): QuestKind[] {
  return QUEST_KINDS.filter((k) => {
    if (k === 'catchDeep') return reachesDeep(p);
    if (k === 'beatRecord') return speciesCaught(p.log) >= T.beatRecordMinSpecies;
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
      const zones = reachableZones(p);
      const pool: Species[] = POOL_SPECIES.filter((s) => zones.includes(s.zone));
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
  return kinds.map((k) => rollQuest(k, p, rng));
}

// ---- Day change ------------------------------------------------------------------------------

const payable = (list: Quest[]): QuestReward =>
  list.reduce((sum, q) => (q.done && !q.claimed ? { coins: sum.coins + q.reward.coins, worms: sum.worms + q.reward.worms } : sum), { coins: 0, worms: 0 });

/**
 * Makes sure the stored quests are today's. On a later date: every done-but-unclaimed quest is
 * paid into the purse first (nothing earned is lost), then three new quests are rolled. On the
 * same day, an earlier date (the device clock was set back) or an invalid `today`, nothing changes.
 */
export function syncQuests(player: PlayerState, today: string): { player: PlayerState; paid: QuestReward | null; rolled: boolean } {
  const q = questsOf(player);
  if (!isValidDate(today)) return { player, paid: null, rolled: false };
  if (q.date !== null && isValidDate(q.date) && today <= q.date) return { player, paid: null, rolled: false };
  const owed = payable(q.list);
  const paid = owed.coins > 0 || owed.worms > 0 ? owed : null;
  const paidPlayer = { ...player, coins: player.coins + owed.coins, worms: player.worms + owed.worms };
  return {
    player: { ...paidPlayer, quests: { date: today, rerollUsed: false, list: rollDay(today, paidPlayer) } },
    paid,
    rolled: true,
  };
}

// ---- Progress --------------------------------------------------------------------------------

export interface CatchInfo {
  speciesId: string;
  zone: ZoneId;
  /** The game clock's period when the fish was caught. */
  timeOfDay: TimeOfDay;
  /** A strictly longer fish of a species that was already in the log (a first catch is not one). */
  isRecord: boolean;
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
  const legendary = speciesById(c.speciesId)?.rarity === 'legendary';
  return advance(q, (quest) => {
    switch (quest.kind) {
      case 'catchSpecies': return quest.params.speciesId === c.speciesId ? 1 : 0;
      case 'catchAny': return 1;
      case 'catchAtTime': return quest.params.timeOfDay === c.timeOfDay ? 1 : 0;
      case 'catchDeep': return c.zone === 'deep' ? 1 : 0;
      case 'beatRecord': return c.isRecord && !legendary ? 1 : 0;
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
    player: { ...player, coins: player.coins + quest.reward.coins, worms: player.worms + quest.reward.worms, quests: { ...q, list } },
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
  const list = q.list.map((x, i) => (i === index ? rollQuest(kind, player, rng) : x));
  return { player: { ...player, quests: { ...q, rerollUsed: true, list } }, ok: true };
}

// ---- Words -----------------------------------------------------------------------------------

/** "Catch 3 roach", "Catch a fish at dusk", "Sell 100 coins' worth of fish", "Beat a personal best". */
export function questText(quest: Quest): string {
  const n = quest.params.target;
  switch (quest.kind) {
    case 'catchSpecies': {
      const name = (speciesById(quest.params.speciesId ?? '')?.name ?? 'fish').toLowerCase();
      return n === 1 ? `Catch a ${name}` : `Catch ${n} ${name}`;
    }
    case 'catchAny': return `Catch ${n} fish`;
    case 'catchAtTime': {
      const t = quest.params.timeOfDay ?? 'night';
      const when = t === 'night' ? 'at night' : `at ${t}`;
      return n === 1 ? `Catch a fish ${when}` : `Catch ${n} fish ${when}`;
    }
    case 'catchDeep': return `Catch ${n} fish in deep water`;
    case 'sellCoins': return `Sell ${n} coins' worth of fish`;
    case 'beatRecord': return 'Beat a personal best';
  }
}

export const rewardText = (r: QuestReward): string => `+${r.coins} coins · +${r.worms} worms`;
