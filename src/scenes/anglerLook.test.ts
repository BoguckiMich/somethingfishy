import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/random';
import { LOOK_TUNING, lookEvent, newLook, tickLook, type LookDir } from './anglerLook';

/** Runs the look state for `totalMs` and records each glance (start time, direction, length). */
function record(kind: Parameters<typeof tickLook>[2], totalMs: number, seed: number) {
  const rng = seededRng(seed);
  const s = newLook(rng);
  const glances: { start: number; dir: LookDir; len: number }[] = [];
  let open: { start: number; dir: LookDir } | null = null;
  for (let t = 0; t < totalMs; t += 50) {
    tickLook(s, 50, kind, rng);
    if (s.dir !== 'forward' && !open) open = { start: t, dir: s.dir };
    if (s.dir === 'forward' && open) {
      glances.push({ ...open, len: t - open.start });
      open = null;
    }
  }
  return glances;
}

describe('angler look', () => {
  it('starts looking forward', () => {
    expect(newLook(seededRng(1)).dir).toBe('forward');
  });

  it('glances to both sides while waiting', () => {
    const dirs = new Set(record('waiting', 600_000, 7).map((g) => g.dir));
    expect(dirs).toEqual(new Set(['left', 'right']));
  });

  it('glances only every 6-15 s and for 1-2 s', () => {
    for (const kind of ['idle', 'waiting'] as const) {
      const g = record(kind, 900_000, 3);
      expect(g.length).toBeGreaterThan(20);
      for (let i = 0; i < g.length; i++) {
        expect(g[i].len).toBeGreaterThanOrEqual(LOOK_TUNING.minGlanceMs - 50);
        expect(g[i].len).toBeLessThanOrEqual(LOOK_TUNING.maxGlanceMs + 100);
        if (i > 0) {
          const gap = g[i].start - (g[i - 1].start + g[i - 1].len);
          expect(gap).toBeGreaterThanOrEqual(LOOK_TUNING.minGapMs - 100);
          expect(gap).toBeLessThanOrEqual(LOOK_TUNING.maxGapMs + 100);
        }
      }
    }
  });

  it('never glances while charging, casting, biting, fighting, showing off, losing or retrieving', () => {
    for (const kind of ['charging', 'casting', 'bite', 'fighting', 'caught', 'lost', 'retrieving'] as const) {
      expect(record(kind, 300_000, 11)).toEqual([]);
    }
  });

  it('snaps back to forward on a nibble or bite, and waits a fresh gap', () => {
    for (const ev of ['nibble', 'bite']) {
      const rng = seededRng(5);
      const s = newLook(rng);
      while (s.dir === 'forward') tickLook(s, 50, 'waiting', rng);
      lookEvent(s, ev, rng);
      expect(s.dir).toBe('forward');
      expect(s.timerMs).toBeGreaterThanOrEqual(LOOK_TUNING.minGapMs);
    }
  });

  it('ignores unrelated events', () => {
    const rng = seededRng(5);
    const s = newLook(rng);
    while (s.dir === 'forward') tickLook(s, 50, 'idle', rng);
    const dir = s.dir;
    lookEvent(s, 'cast', rng);
    expect(s.dir).toBe(dir);
  });

  it('goes forward immediately when a non-relaxed phase starts mid-glance', () => {
    const rng = seededRng(9);
    const s = newLook(rng);
    while (s.dir === 'forward') tickLook(s, 50, 'idle', rng);
    tickLook(s, 16, 'charging', rng);
    expect(s.dir).toBe('forward');
  });

  it('is deterministic for a seed', () => {
    expect(record('idle', 200_000, 42)).toEqual(record('idle', 200_000, 42));
  });
});
