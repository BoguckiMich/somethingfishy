import { describe, expect, it } from 'vitest';
import { DAILY_BOX } from '../data/daily';
import { newPlayer } from '../inventory';
import { seededRng } from '../random';
import { boxAvailable, newDaily, openBox, rollContents, tierFor, tierMultiplier, type DailyState } from './daily';

const d = (lastBoxDate: string | null, streakTier: number): DailyState => ({ lastBoxDate, streakTier });
/** An rng that returns the given values in turn (then 0.5). */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++] ?? 0.5;
};

describe('boxAvailable', () => {
  it('is true before the first box', () => {
    expect(boxAvailable(newDaily(), '2026-11-23')).toBe(true);
  });
  it('is false on the same day, true on a later one', () => {
    expect(boxAvailable(d('2026-11-23', 1), '2026-11-23')).toBe(false);
    expect(boxAvailable(d('2026-11-23', 1), '2026-11-24')).toBe(true);
    expect(boxAvailable(d('2026-11-23', 1), '2027-01-01')).toBe(true);
  });
  it('is false when the clock was set back', () => {
    expect(boxAvailable(d('2026-11-23', 3), '2026-11-20')).toBe(false);
  });
  it('treats a garbage stored date as no box yet, and a garbage today as none', () => {
    expect(boxAvailable(d('junk', 2), '2026-11-23')).toBe(true);
    expect(boxAvailable(newDaily(), 'junk')).toBe(false);
  });
});

describe('tierFor', () => {
  it('starts at 1', () => {
    expect(tierFor(newDaily(), '2026-11-23')).toBe(1);
  });
  it('goes up one tier for a consecutive day and caps at 5', () => {
    expect(tierFor(d('2026-11-22', 1), '2026-11-23')).toBe(2);
    expect(tierFor(d('2026-11-22', 4), '2026-11-23')).toBe(5);
    expect(tierFor(d('2026-11-22', 5), '2026-11-23')).toBe(5);
  });
  it('works across a month and a year boundary', () => {
    expect(tierFor(d('2026-12-31', 2), '2027-01-01')).toBe(3);
  });
  it('drops exactly one tier after a gap, however long, never below 1', () => {
    expect(tierFor(d('2026-11-20', 5), '2026-11-23')).toBe(4);
    expect(tierFor(d('2026-11-21', 3), '2026-11-23')).toBe(2);
    expect(tierFor(d('2025-01-01', 5), '2026-11-23')).toBe(4);
    expect(tierFor(d('2026-11-20', 1), '2026-11-23')).toBe(1);
  });
  it('repairs an odd stored tier', () => {
    expect(tierFor(d('2026-11-22', 0), '2026-11-23')).toBe(2);
    expect(tierFor(d('2026-11-22', 99), '2026-11-23')).toBe(5);
  });
});

describe('tierMultiplier', () => {
  it('runs linearly from x1 to x2', () => {
    expect(tierMultiplier(1)).toBe(1);
    expect(tierMultiplier(3)).toBeCloseTo(1.5);
    expect(tierMultiplier(5)).toBe(DAILY_BOX.topTierMultiplier);
  });
  it('clamps out-of-range tiers', () => {
    expect(tierMultiplier(0)).toBe(1);
    expect(tierMultiplier(9)).toBe(2);
  });
});

describe('rollContents', () => {
  it('has 5 to 10 worms and 0 or 15 to 40 coins at tier 1 (when not lucky)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 400; i++) {
      const c = rollContents(1, rng);
      if (c.lucky) continue;
      expect(c.worms).toBeGreaterThanOrEqual(5);
      expect(c.worms).toBeLessThanOrEqual(10);
      expect(c.coins === 0 || (c.coins >= 15 && c.coins <= 40)).toBe(true);
      expect(Number.isInteger(c.worms) && Number.isInteger(c.coins)).toBe(true);
    }
  });
  it('is usually coins and rarely lucky', () => {
    const rng = seededRng(11);
    const boxes = Array.from({ length: 1000 }, () => rollContents(1, rng));
    const withCoins = boxes.filter((b) => b.coins > 0).length;
    expect(withCoins).toBeGreaterThan(700);
    expect(withCoins).toBeLessThan(900);
    const lucky = boxes.filter((b) => b.lucky).length;
    expect(lucky).toBeGreaterThan(10);
    expect(lucky).toBeLessThan(100);
  });
  it('a lucky box has three times everything', () => {
    // rolls in order: luck, worms, coin chance, coins
    const plain = rollContents(1, seq(0.5, 0, 0, 0));
    const lucky = rollContents(1, seq(0.01, 0, 0, 0));
    expect(plain).toEqual({ worms: 5, coins: 15, baits: {}, lucky: false, tier: 1 });
    expect(lucky).toEqual({ worms: 15, coins: 45, baits: {}, lucky: true, tier: 1 });
  });
  it('a missed coin roll gives no coins but keeps the worms', () => {
    const c = rollContents(1, seq(0.5, 0.99, 0.95, 0.5));
    expect(c.coins).toBe(0);
    expect(c.worms).toBe(10);
  });
  it('the top tier doubles the contents', () => {
    expect(rollContents(5, seq(0.5, 0.99999, 0, 0.99999))).toMatchObject({ worms: 20, coins: 80 });
    expect(rollContents(5, seq(0.01, 0.99999, 0, 0.99999))).toMatchObject({ worms: 60, coins: 240, lucky: true });
  });
  it('rounds to whole numbers at a middle tier', () => {
    const c = rollContents(2, seq(0.5, 0.2, 0, 0.2)); // x1.25
    expect(Number.isInteger(c.worms)).toBe(true);
    expect(Number.isInteger(c.coins)).toBe(true);
  });
});

describe('openBox', () => {
  const rng = () => seq(0.5, 0, 0, 0);
  it('the first box adds the contents and records date and tier 1', () => {
    const r = openBox(newPlayer(), '2026-11-23', rng());
    expect(r.contents).toEqual({ worms: 5, coins: 15, baits: {}, lucky: false, tier: 1 });
    expect(r.player.worms).toBe(newPlayer().worms + 5);
    expect(r.player.coins).toBe(newPlayer().coins + 15);
    expect(r.player.daily).toEqual({ lastBoxDate: '2026-11-23', streakTier: 1 });
  });
  it('does not mutate its input', () => {
    const p = newPlayer();
    const copy = JSON.stringify(p);
    openBox(p, '2026-11-23', rng());
    expect(JSON.stringify(p)).toBe(copy);
  });
  it('a second open on the same day grants nothing', () => {
    const first = openBox(newPlayer(), '2026-11-23', rng()).player;
    const again = openBox(first, '2026-11-23', rng());
    expect(again.contents).toBeNull();
    expect(again.player).toBe(first);
  });
  it('a clock set back grants nothing and keeps the saved date', () => {
    const first = openBox(newPlayer(), '2026-11-23', rng()).player;
    const back = openBox(first, '2026-11-01', rng());
    expect(back.contents).toBeNull();
    expect(back.player.daily).toEqual({ lastBoxDate: '2026-11-23', streakTier: 1 });
  });
  it('builds a streak over consecutive days, then loses one tier after a gap', () => {
    let p = newPlayer();
    const tiers: number[] = [];
    for (const day of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) {
      const r = openBox(p, day, rng());
      tiers.push(r.contents!.tier);
      p = r.player;
    }
    expect(tiers).toEqual([1, 2, 3, 4, 5, 5, 5]);
    const after = openBox(p, '2026-12-05', rng());
    expect(after.contents!.tier).toBe(4);
    expect(after.player.daily).toEqual({ lastBoxDate: '2026-12-05', streakTier: 4 });
  });
  it('works on an old player without a daily field', () => {
    const { daily: _daily, ...old } = newPlayer();
    const r = openBox(old, '2026-11-23', rng());
    expect(r.contents!.tier).toBe(1);
  });
});
