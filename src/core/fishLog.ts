import type { TimeOfDay } from './clock';
import { POOL_SPECIES, speciesById, type Species } from './data/fish';
import { TIER_RANK, isGoldOrBetter, isTier, starFor, tierFor, type Tier } from './data/stars';
import { PALE_ONE } from './data/legendary';
import { RARE_RULES } from './data/rare';
import type { HookedFish } from './fish';

/**
 * The fish log: per species how many were caught and the record (longest fish; weight follows
 * length). Plain serialisable data inside PlayerState; every function returns a new log.
 */
export interface LogEntry {
  count: number;
  bestLengthCm: number;
  bestWeightG: number;
  /**
   * The best tier a perfect catch earned (slice 23f), stored only when it beats what the record length alone earns
   * (so older saves have none and read as before).
   */
  bestTier?: Tier;
}

export type FishLog = Record<string, LogEntry>;

export type CatchOutcome =
  | { kind: 'newSpecies' }
  /** Only a strictly longer fish beats the record. `previousCm` is the old best. */
  | { kind: 'newRecord'; previousCm: number }
  | { kind: 'normal' };

export const newFishLog = (): FishLog => ({});

/** Records a won fight. A first catch is a new species (not also a record). A perfect catch can raise the species' best tier. */
export function recordCatch(log: FishLog, hooked: HookedFish, perfect = false): { log: FishLog; outcome: CatchOutcome } {
  const old = log[hooked.speciesId];
  const species = speciesById(hooked.speciesId);
  const tier: Tier = species ? tierFor(species, hooked.lengthCm, perfect) : 'none';
  /** `bestTier` after this catch: the better of the old one and this catch's tier, kept only when it beats the record length's star. */
  const bestTierOf = (entry: Omit<LogEntry, 'bestTier'>, before?: Tier): Partial<LogEntry> => {
    const best = before && TIER_RANK[before] > TIER_RANK[tier] ? before : tier;
    const base: Tier = species ? starFor(species, entry.bestLengthCm) : 'none';
    return TIER_RANK[best] > TIER_RANK[base] ? { bestTier: best } : {};
  };
  if (!old) {
    const entry = { count: 1, bestLengthCm: hooked.lengthCm, bestWeightG: hooked.weightG };
    return { log: { ...log, [hooked.speciesId]: { ...entry, ...bestTierOf(entry) } }, outcome: { kind: 'newSpecies' } };
  }
  if (hooked.lengthCm > old.bestLengthCm) {
    const entry = { count: old.count + 1, bestLengthCm: hooked.lengthCm, bestWeightG: hooked.weightG };
    return { log: { ...log, [hooked.speciesId]: { ...entry, ...bestTierOf(entry, old.bestTier) } }, outcome: { kind: 'newRecord', previousCm: old.bestLengthCm } };
  }
  const { bestTier: _drop, ...rest } = old;
  const entry = { ...rest, count: old.count + 1 };
  return { log: { ...log, [hooked.speciesId]: { ...entry, ...bestTierOf(entry, old.bestTier) } }, outcome: { kind: 'normal' } };
}

/** The best tier a species earned: the record length's star, or a better one from a perfect catch (`bestTier`). Old saves have no `bestTier`. */
export function bestStar(log: FishLog, species: Species): Tier {
  const entry = log[species.id];
  if (!entry) return 'none';
  const base: Tier = starFor(species, entry.bestLengthCm);
  return isTier(entry.bestTier) && TIER_RANK[entry.bestTier] > TIER_RANK[base] ? entry.bestTier : base;
}

/** In how many non-legendary species the best tier is gold or a medal ("Gold x/15"). */
export const goldCount = (log: FishLog): number => POOL_SPECIES.filter((s) => isGoldOrBetter(bestStar(log, s))).length;

/** How many different species are in the log ("7" of "7/12"). */
export const speciesCaught = (log: FishLog): number => Object.keys(log).length;

/** What a locked log tile tells (slice 22b): icons for the depth and the times, and the same said in words for the tap card. */
export interface LockedHint {
  depth: 'shallow' | 'deep';
  /** The kinds of time to draw: day = sun, dawn and dusk = one half sun, night = moon. All four times = all three icons. */
  times: ('sun' | 'half' | 'moon')[];
  text: string;
}

const TIME_ICON: Record<TimeOfDay, 'sun' | 'half' | 'moon'> = { dawn: 'half', day: 'sun', dusk: 'half', night: 'moon' };
const TIME_PHRASE: Record<TimeOfDay, string> = { dawn: 'at dawn', day: 'by day', dusk: 'at dusk', night: 'at night' };

/** "Shallow water · by day", "Deep water · at dusk and night", "Shallow water · any time"; the Pale One keeps its riddle. */
export function lockedHint(species: Species): LockedHint {
  const depth = species.zone === 'deep' ? 'deep' : 'shallow';
  const anyTime = species.times.length >= 4;
  const times = [...new Set(species.times.map((t) => TIME_ICON[t]))];
  const where = depth === 'deep' ? 'Deep water' : 'Shallow water';
  const when = anyTime ? 'any time' : species.times.map((t, i) => (i === 0 ? TIME_PHRASE[t] : TIME_PHRASE[t].replace(/^(at|by) /, ''))).join(' and ');
  const text = species.logHint ?? `${where} · ${when}`;
  return { depth, times: anyTime ? ['sun', 'half', 'moon'] : times, text };
}

/** "Shallow water · day", "Deep water · dusk, night", "Deep water · any time". */
export function whereWhen(species: Species): string {
  if (species.rarity === 'legendary') {
    const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
    return `Deep water, ${PALE_ONE.minDistanceM} m or more · ${hh(PALE_ONE.fromHour)} to ${hh(PALE_ONE.toHour)}`;
  }
  if (species.rarity === 'trophy') return RARE_RULES.find((r) => r.speciesId === species.id)?.where ?? 'Quiet Lake';
  const where = species.zone === 'deep' ? 'Deep water' : 'Shallow water';
  const when = species.times.length >= 4 ? 'any time' : species.times.join(', ');
  return `${where} · ${when}`;
}
