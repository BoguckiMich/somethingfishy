import { describe, expect, it } from 'vitest';
import { SPECIES } from './data/fish';
import { newFishLog, recordCatch, speciesCaught, whereWhen, type FishLog } from './fishLog';

const roach = (lengthCm: number, weightG = lengthCm * 10) => ({ speciesId: 'roach', lengthCm, weightG });

describe('recordCatch', () => {
  it('a first catch is a new species, with count 1 and that size as the record', () => {
    const r = recordCatch(newFishLog(), roach(20, 200));
    expect(r.outcome).toEqual({ kind: 'newSpecies' });
    expect(r.log.roach).toEqual({ count: 1, bestLengthCm: 20, bestWeightG: 200 });
  });

  it('a strictly longer fish is a new record and reports the previous best', () => {
    const first = recordCatch(newFishLog(), roach(20, 200));
    const r = recordCatch(first.log, roach(25, 380));
    expect(r.outcome).toEqual({ kind: 'newRecord', previousCm: 20 });
    expect(r.log.roach).toEqual({ count: 2, bestLengthCm: 25, bestWeightG: 380 });
  });

  it('a tie or a shorter fish is normal: the count grows, the record stays', () => {
    const first = recordCatch(newFishLog(), roach(20, 200));
    const tie = recordCatch(first.log, roach(20, 205));
    expect(tie.outcome).toEqual({ kind: 'normal' });
    expect(tie.log.roach).toEqual({ count: 2, bestLengthCm: 20, bestWeightG: 200 });
    const shorter = recordCatch(tie.log, roach(15, 90));
    expect(shorter.outcome).toEqual({ kind: 'normal' });
    expect(shorter.log.roach).toEqual({ count: 3, bestLengthCm: 20, bestWeightG: 200 });
  });

  it('tracks species independently', () => {
    const a = recordCatch(newFishLog(), roach(20));
    const b = recordCatch(a.log, { speciesId: 'pike', lengthCm: 50, weightG: 1000 });
    expect(b.outcome).toEqual({ kind: 'newSpecies' });
    expect(Object.keys(b.log).sort()).toEqual(['pike', 'roach']);
  });

  it('does not mutate its input', () => {
    const log: FishLog = { roach: { count: 1, bestLengthCm: 20, bestWeightG: 200 } };
    const snapshot = JSON.parse(JSON.stringify(log));
    recordCatch(log, roach(25));
    expect(log).toEqual(snapshot);
  });
});

describe('speciesCaught', () => {
  it('counts the species in the log', () => {
    expect(speciesCaught(newFishLog())).toBe(0);
    const log = recordCatch(recordCatch(newFishLog(), roach(20)).log, { speciesId: 'eel', lengthCm: 50, weightG: 300 }).log;
    expect(speciesCaught(log)).toBe(2);
  });
});

describe('whereWhen', () => {
  const of = (id: string) => whereWhen(SPECIES.find((s) => s.id === id)!);
  it('names the zone and the times of day', () => {
    expect(of('roach')).toBe('Shallow water · day');
    expect(of('zander')).toBe('Deep water · dusk, night');
    expect(of('tench')).toBe('Deep water · dawn, dusk');
  });
  it('says any time when it bites all day', () => {
    expect(of('bream')).toBe('Deep water · any time');
    expect(of('crucian')).toBe('Shallow water · any time');
  });
});
