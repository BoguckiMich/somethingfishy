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
