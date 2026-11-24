import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import {
  PLAY_AREA,
  STICK_TUNING,
  createCompanions,
  groundStickAlpha,
  oldSticks,
  startPlayNow,
  stickVariantAt,
  tickCompanions,
  type Companions,
  type CompanionContext,
} from './behaviour';

const idle: CompanionContext = { fishing: 'idle', night: false };
/** He stays in the chair (idle would send them off to play after 25 s), so a stick is left alone. */
const busy: CompanionContext = { fishing: 'charging', night: false };

function runUntil(s: Companions, rng: () => number, until: () => boolean, maxMs = 120_000, onTick?: () => void): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, idle, rng);
    onTick?.();
  }
  return until() ? maxMs : -1;
}

function play(seed: number): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  const s = createCompanions(rng);
  startPlayNow(s);
  return { s, rng };
}

const lone = (age = 0): Companions['sticks'][number] => ({ x: 200, y: 520, kind: 'old', variant: 0, ageMs: age, fadeMs: null });

describe('the fetch sticks (slice 22a)', () => {
  it('the lawn is y 500 to 554, so even the lowest stick clears the hint frame; at most 2 old sticks', () => {
    expect(PLAY_AREA).toMatchObject({ x0: 100, x1: 322, y0: 500, y1: 554 });
    expect(STICK_TUNING.maxOld).toBe(2);
    expect(STICK_TUNING.oldLifeMs).toBe(30_000);
    expect(STICK_TUNING.fadeOutMs).toBe(2000);
  });

  it('an old stick lies 30 s, then fades out over 2 s and is gone', () => {
    const rng = seededRng(1);
    const s = createCompanions(rng);
    const g = lone();
    s.sticks.push(g);
    for (let t = 0; t < STICK_TUNING.oldLifeMs - 100; t += 50) tickCompanions(s, 50, busy, rng);
    expect(g.fadeMs).toBeNull();
    expect(groundStickAlpha(g)).toBe(1);
    for (let t = 0; t < 200; t += 50) tickCompanions(s, 50, busy, rng);
    expect(g.fadeMs).not.toBeNull(); // 30 s are up: it starts to fade
    for (let t = 0; t < 1000; t += 50) tickCompanions(s, 50, busy, rng);
    expect(groundStickAlpha(g)).toBeGreaterThan(0.3);
    expect(groundStickAlpha(g)).toBeLessThan(0.7); // about half way through the 2 s
    for (let t = 0; t < 1200; t += 50) tickCompanions(s, 50, busy, rng);
    expect(s.sticks.includes(g)).toBe(false);
  });

  it('the spare stick has no life limit: it waits for him', () => {
    const rng = seededRng(1);
    const s = createCompanions(rng);
    const g = { ...lone(), kind: 'spare' as const };
    s.sticks.push(g);
    for (let t = 0; t < 90_000; t += 50) tickCompanions(s, 50, busy, rng);
    expect(s.sticks.includes(g)).toBe(true);
    expect(g.fadeMs).toBeNull();
  });

  it('a third old stick makes the oldest start its 2 s fade at once (pushed out by the cap, not by age)', () => {
    const { s, rng } = play(1);
    runUntil(s, rng, () => s.sticks.some((g) => g.fadeMs !== null), 600_000);
    const fading = s.sticks.find((g) => g.fadeMs !== null)!;
    expect(fading.fadeMs).toBeLessThanOrEqual(STICK_TUNING.fadeOutMs);
    expect(fading.ageMs).toBeLessThan(STICK_TUNING.oldLifeMs);
    expect(oldSticks(s).length).toBeLessThanOrEqual(STICK_TUNING.maxOld);
  });

  it('sticks come in three shapes, a stick keeps its shape, and every one stays on the lawn', () => {
    const { s, rng } = play(12);
    const seen = new Set<number>();
    runUntil(s, rng, () => false, 300_000, () => {
      for (const g of s.sticks) {
        seen.add(g.variant);
        expect(g.x).toBeGreaterThanOrEqual(PLAY_AREA.x0 - 1);
        expect(g.x).toBeLessThanOrEqual(PLAY_AREA.x1 + 1);
        expect(g.y).toBeGreaterThanOrEqual(PLAY_AREA.y0 - 1);
        expect(g.y).toBeLessThanOrEqual(PLAY_AREA.y1 + 1);
      }
    });
    for (const v of seen) expect([0, 1, 2]).toContain(v);
    expect(seen.size).toBeGreaterThan(1);
    expect(stickVariantAt({ x: 150, y: 520 })).toBe(stickVariantAt({ x: 150, y: 520 }));
  });

  it('when nothing lands clear of the others, the oldest stick fades to make room instead of piling up', () => {
    const rng = seededRng(7);
    const s = createCompanions(rng);
    startPlayNow(s);
    // A lawn packed so tight that no throw can find a spot 18 px from every stick.
    const grid: Companions['sticks'] = [];
    for (let x = PLAY_AREA.x0; x <= PLAY_AREA.x1; x += 12) {
      for (let y = PLAY_AREA.y0; y <= PLAY_AREA.y1; y += 12) grid.push({ x, y, kind: 'old', variant: 0, ageMs: 1000, fadeMs: null });
    }
    s.sticks.push(...grid);
    expect(runUntil(s, rng, () => s.stick.state === 'flying')).toBeGreaterThanOrEqual(0);
    expect(grid[0].fadeMs).not.toBeNull();
    expect(s.play.target.x).toBeGreaterThanOrEqual(PLAY_AREA.x0);
    expect(s.play.target.y).toBeLessThanOrEqual(PLAY_AREA.y1);
  });
});
