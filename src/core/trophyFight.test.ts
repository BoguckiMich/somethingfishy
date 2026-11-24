import { describe, expect, it } from 'vitest';
import { barResult, newCatchBar, tickCatchBar, type FishProfile } from './catchBar';
import { RARE_TUNING } from './data/rare';
import { RODS } from './data/rods';
import { speciesById } from './data/fish';
import { fightProfile, rollLength } from './fish';
import type { BarGear } from './gear';
import { seededRng } from './random';

/**
 * The trophy fight (slice 23d): difficulty ~0.8 and a slip-away rule (outside the green zone for more than 2.5 s in one go).
 * The catch-math audit rule must hold: a player who never touches the screen does not win.
 */
const TICK = 16;
const MAX_MS = 90_000;
const GEARS: [string, BarGear][] = RODS.map((r) => [r.id, r.barGear]);
const TROPHIES = ['goldenTench', 'mossback', 'silverGhost'];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const profileFor = (id: string, seed: number): FishProfile => {
  const sp = speciesById(id)!;
  return fightProfile(sp, rollLength(sp, seededRng(seed * 977)));
};

interface Fight { result: 'caught' | 'lost' | 'timeout'; ms: number; slipped: boolean }

function play(fish: FishProfile, gear: BarGear, seed: number, bot: { delayMs: number; noise: number } | 'never'): Fight {
  const rng = seededRng(seed);
  const noise = seededRng(seed + 7919);
  let s = newCatchBar(fish, gear, rng);
  const queue: boolean[] = [];
  const delayTicks = bot === 'never' ? 0 : Math.round(bot.delayMs / TICK);
  let ms = 0;
  while (ms < MAX_MS) {
    let holding = false;
    if (bot !== 'never') {
      const err = s.fish - s.zone + (bot.noise ? (noise() * 2 - 1) * bot.noise : 0);
      queue.push(err > 0);
      holding = queue.length > delayTicks ? queue.shift()! : false;
    }
    s = tickCatchBar(s, TICK, holding, fish, gear, rng);
    ms += TICK;
    const r = barResult(s);
    if (r !== 'fighting') return { result: r, ms, slipped: s.slipped };
  }
  return { result: 'timeout', ms, slipped: false };
}

const share = (id: string, gear: BarGear, bot: Parameters<typeof play>[3], n = 100) =>
  seeds(n).filter((seed) => play(profileFor(id, seed), gear, seed, bot).result === 'caught').length / n;

describe('the slip-away rule', () => {
  const gear = RODS[0].barGear;

  it('a fish outside the zone for longer than the limit slips away, with the flag set', () => {
    const fish: FishProfile = { pattern: 'smooth', difficulty: 0.5, slipAfterMs: 1000 };
    const rng = seededRng(3);
    let s = { ...newCatchBar(fish, gear, rng), fish: 0.95, fishTarget: 0.95, fishTimer: 99, progress: 0.9 };
    for (let i = 0; i < 120 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, TICK, false, fish, gear, rng);
    expect(barResult(s)).toBe('lost');
    expect(s.slipped).toBe(true);
    expect(s.elapsedMs).toBeLessThan(2500); // it did not wait for the line to run out (0.9 would take seconds)
  });

  it('the timer resets whenever the fish is back inside, and a fish without the limit never slips', () => {
    const fish: FishProfile = { pattern: 'smooth', difficulty: 0.5, slipAfterMs: 1000 };
    const rng = seededRng(4);
    let s = newCatchBar(fish, gear, rng);
    s = { ...s, fish: s.zone, fishTarget: s.zone, fishTimer: 99, outsideMs: 900 };
    s = tickCatchBar(s, TICK, false, fish, gear, rng);
    expect(s.outsideMs).toBe(0);
    expect(s.slipped).toBe(false);
    const plain: FishProfile = { pattern: 'smooth', difficulty: 0.5 };
    let t = { ...newCatchBar(plain, gear, rng), fish: 0.95, fishTarget: 0.95, fishTimer: 99, progress: 0.9 };
    for (let i = 0; i < 40; i++) t = tickCatchBar(t, TICK, false, plain, gear, rng);
    expect(t.slipped).toBe(false);
    expect(barResult(t)).toBe('fighting');
  });

  it('the trophies use the tuned limit (2.5 s)', () => {
    expect(RARE_TUNING.slipAfterMs).toBe(2500);
    for (const id of TROPHIES) expect(profileFor(id, 1).slipAfterMs).toBe(2500);
  });
});

describe('trophy fights are never won by doing nothing', () => {
  it('a player who never presses wins (almost) never, on every rod', () => {
    for (const id of TROPHIES) {
      for (const [rod, gear] of GEARS) {
        const s = share(id, gear, 'never');
        // measured (100 seeds): 0 on every rod except golden tench / silver ghost on carbon at 0.01
        expect(s, `${id} ${rod}`).toBeLessThanOrEqual(0.03);
      }
    }
  });

  it('a good player wins a fair share on the rod that reaches it, and a sloppy one wins clearly less', () => {
    // measured on the rod used here: golden tench (fiberglass) good 0.72 / sloppy 0.07, Old Mossback (carbon) 0.93 / 0.71,
    // silver ghost (bamboo) 0.56 / 0.01
    const rodFor: Record<string, number> = { goldenTench: 1, mossback: 2, silverGhost: 0 };
    for (const id of TROPHIES) {
      const gear = GEARS[rodFor[id]][1];
      const good = share(id, gear, { delayMs: 150, noise: 0 });
      const sloppy = share(id, gear, { delayMs: 300, noise: 0.1 });
      expect(good, `${id} good`).toBeGreaterThanOrEqual(0.4);
      expect(sloppy, `${id} sloppy`).toBeLessThan(good - 0.2);
    }
  });
});
