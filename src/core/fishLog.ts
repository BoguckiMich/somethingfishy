import type { TimeOfDay } from './clock';
import { POOL_SPECIES, type Species } from './data/fish';
import { starFor, type Star } from './data/stars';
import { PALE_ONE } from './data/legendary';
import type { HookedFish } from './fish';

/**
 * The fish log: per species how many were caught and the record (longest fish; weight follows
 * length). Plain serialisable data inside PlayerState; every function returns a new log.
 */
export interface LogEntry {
  count: number;
  bestLengthCm: number;
  bestWeightG: number;
}

export type FishLog = Record<string, LogEntry>;

export type CatchOutcome =
  | { kind: 'newSpecies' }
  /** Only a strictly longer fish beats the record. `previousCm` is the old best. */
  | { kind: 'newRecord'; previousCm: number }
  | { kind: 'normal' };

export const newFishLog = (): FishLog => ({});

/** Records a won fight. A first catch is a new species (not also a record). */
export function recordCatch(log: FishLog, hooked: HookedFish): { log: FishLog; outcome: CatchOutcome } {
  const old = log[hooked.speciesId];
  if (!old) {
    const entry = { count: 1, bestLengthCm: hooked.lengthCm, bestWeightG: hooked.weightG };
    return { log: { ...log, [hooked.speciesId]: entry }, outcome: { kind: 'newSpecies' } };
  }
  if (hooked.lengthCm > old.bestLengthCm) {
    const entry = { count: old.count + 1, bestLengthCm: hooked.lengthCm, bestWeightG: hooked.weightG };
    return { log: { ...log, [hooked.speciesId]: entry }, outcome: { kind: 'newRecord', previousCm: old.bestLengthCm } };
  }
  return { log: { ...log, [hooked.speciesId]: { ...old, count: old.count + 1 } }, outcome: { kind: 'normal' } };
}

/** The best star a species' record earns (derived from `bestLengthCm`, so old saves have it too). */
export function bestStar(log: FishLog, species: Species): Star {
  const entry = log[species.id];
  return entry ? starFor(species, entry.bestLengthCm) : 'none';
}

/** In how many non-legendary species the record is gold ("Gold x/12"). */
export const goldCount = (log: FishLog): number => POOL_SPECIES.filter((s) => bestStar(log, s) === 'gold').length;

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
  const where = species.zone === 'deep' ? 'Deep water' : 'Shallow water';
  const when = species.times.length >= 4 ? 'any time' : species.times.join(', ');
  return `${where} · ${when}`;
}
