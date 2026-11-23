import type { Species } from './data/fish';
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

/** How many different species are in the log ("7" of "7/12"). */
export const speciesCaught = (log: FishLog): number => Object.keys(log).length;

/** "Shallow water · day", "Deep water · dusk, night", "Deep water · any time". */
export function whereWhen(species: Species): string {
  const where = species.zone === 'deep' ? 'Deep water' : 'Shallow water';
  const when = species.times.length >= 4 ? 'any time' : species.times.join(', ');
  return `${where} · ${when}`;
}
