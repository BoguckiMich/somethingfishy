import { describe, expect, it } from 'vitest';
import {
  CATCH_BAR_TUNING,
  barResult,
  newCatchBar,
  placeholderFish,
  tickCatchBar,
  type CatchBarState,
  type FishPattern,
  type FishProfile,
} from './catchBar';
import { STARTER_BAR_GEAR } from './data/barGear';
import type { BarGear } from './gear';
import { seededRng } from './random';

const PATTERNS: FishPattern[] = ['smooth', 'darting', 'sinker', 'floater', 'erratic'];
const TICK_MS = 16;
const MAX_MS = 90_000;

interface Bot {
  delayMs: number;
  /** Half-width of the random error added to what the bot sees (bar units). */
  noise: number;
}
const GOOD_BOT: Bot = { delayMs: 150, noise: 0 };
const SLOPPY_BOT: Bot = { delayMs: 300, noise: 0.1 };

interface Fight {
  result: 'caught' | 'lost' | 'timeout';
  ms: number;
}

/** A scripted player: holds when the fish is above the zone centre, after a reaction delay. */
function playBot(fish: FishProfile, bot: Bot, seed: number, gear: BarGear = STARTER_BAR_GEAR): Fight {
  const rng = seededRng(seed);
  const noiseRng = seededRng(seed + 7919);
  let s = newCatchBar(fish, gear, rng);
  const queue: boolean[] = [];
  const delayTicks = Math.round(bot.delayMs / TICK_MS);
  let ms = 0;
  while (ms < MAX_MS) {
    const err = s.fish - s.zone + (bot.noise ? (noiseRng() * 2 - 1) * bot.noise : 0);
    queue.push(err > 0);
    const holding = queue.length > delayTicks ? queue.shift()! : false;
    s = tickCatchBar(s, TICK_MS, holding, fish, gear, rng);
    ms += TICK_MS;
    const r = barResult(s);
    if (r !== 'fighting') return { result: r, ms };
  }
  return { result: 'timeout', ms };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

function fights(profiles: (seed: number) => FishProfile, bot: Bot, n = 40): Fight[] {
  return seeds(n).map((seed) => playBot(profiles(seed), bot, seed));
}

describe('catch bar basics', () => {
  const fish: FishProfile = { pattern: 'smooth', difficulty: 0.2 };

  it('starts at 30% progress with the zone at the bottom and nothing decided', () => {
    const s = newCatchBar(fish, STARTER_BAR_GEAR, seededRng(1));
    expect(s.progress).toBe(CATCH_BAR_TUNING.startProgress);
    expect(s.progress).toBe(0.3);
    expect(barResult(s)).toBe('fighting');
    expect(s.zoneVel).toBe(0);
  });

  it('holding raises the zone and releasing lets it fall', () => {
    const rng = seededRng(2);
    let s = newCatchBar(fish, STARTER_BAR_GEAR, rng);
    for (let i = 0; i < 20; i++) s = tickCatchBar(s, 16, true, fish, STARTER_BAR_GEAR, rng);
    const up = s.zone;
    expect(up).toBeGreaterThan(newCatchBar(fish, STARTER_BAR_GEAR, seededRng(2)).zone);
    for (let i = 0; i < 60; i++) s = tickCatchBar(s, 16, false, fish, STARTER_BAR_GEAR, rng);
    expect(s.zone).toBeLessThan(up);
  });

  it('a player who never holds loses (a floater stays up, away from the bottom)', () => {
    const f: FishProfile = { pattern: 'floater', difficulty: 0.2 };
    for (const seed of seeds(15)) {
      const rng = seededRng(seed);
      let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
      for (let i = 0; i < 6000 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, 16, false, f, STARTER_BAR_GEAR, rng);
      expect(barResult(s)).toBe('lost');
    }
  });

  it('a player who never holds mostly loses (only fish that hang at the bottom let it win)', () => {
    let lost = 0;
    let total = 0;
    for (const pattern of PATTERNS) {
      const f: FishProfile = { pattern, difficulty: 0.5 };
      for (const seed of seeds(10)) {
        const rng = seededRng(seed);
        let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
        for (let i = 0; i < 6000 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, 16, false, f, STARTER_BAR_GEAR, rng);
        total++;
        if (barResult(s) === 'lost') lost++;
      }
    }
    expect(lost / total).toBeGreaterThan(0.5);
  });

  it('a player who holds forever also fails against a fish that is not at the very top', () => {
    const rng = seededRng(3);
    let s = newCatchBar({ pattern: 'sinker', difficulty: 0.5 }, STARTER_BAR_GEAR, rng);
    for (let i = 0; i < 6000 && barResult(s) === 'fighting'; i++) {
      s = tickCatchBar(s, 16, true, { pattern: 'sinker', difficulty: 0.5 }, STARTER_BAR_GEAR, rng);
    }
    expect(barResult(s)).toBe('lost');
  });

  it('keeps the zone and the fish in bounds, with progress clamped', () => {
    for (const pattern of PATTERNS) {
      const f: FishProfile = { pattern, difficulty: 0.9 };
      const rng = seededRng(5);
      let s: CatchBarState = newCatchBar(f, STARTER_BAR_GEAR, rng);
      const half = STARTER_BAR_GEAR.zoneSize / 2;
      for (let i = 0; i < 3000 && barResult(s) === 'fighting'; i++) {
        s = tickCatchBar(s, 16, Math.floor(i / 20) % 2 === 0, f, STARTER_BAR_GEAR, rng);
        expect(s.zone).toBeGreaterThanOrEqual(half - 1e-9);
        expect(s.zone).toBeLessThanOrEqual(1 - half + 1e-9);
        expect(s.fish).toBeGreaterThanOrEqual(0);
        expect(s.fish).toBeLessThanOrEqual(1);
        expect(s.progress).toBeGreaterThanOrEqual(0);
        expect(s.progress).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does nothing once the fight is decided', () => {
    const rng = seededRng(4);
    let s = newCatchBar(fish, STARTER_BAR_GEAR, rng);
    for (let i = 0; i < 6000 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, 16, false, fish, STARTER_BAR_GEAR, rng);
    const done = s;
    expect(tickCatchBar(done, 16, true, fish, STARTER_BAR_GEAR, rng)).toEqual(done);
  });

  it('gear matters: a bigger zone and a gentler line make the same fight easier', () => {
    const hard: FishProfile = { pattern: 'erratic', difficulty: 0.7 };
    const roomy: BarGear = { ...STARTER_BAR_GEAR, zoneSize: STARTER_BAR_GEAR.zoneSize * 1.5, lineDrain: 0.6 };
    const rate = (gear: BarGear) =>
      seeds(30).filter((seed) => playBot(hard, SLOPPY_BOT, seed, gear).result === 'caught').length;
    expect(rate(roomy)).toBeGreaterThan(rate(STARTER_BAR_GEAR));
  });

  it('bait calm slows the fish', () => {
    const f: FishProfile = { pattern: 'darting', difficulty: 0.8 };
    const peak = (gear: BarGear) => {
      const rng = seededRng(11);
      let s = newCatchBar(f, gear, rng);
      let top = 0;
      for (let i = 0; i < 1500; i++) {
        s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 40 < 20, f, gear, rng);
        top = Math.max(top, Math.abs(s.fishVel));
      }
      return top;
    };
    expect(peak({ ...STARTER_BAR_GEAR, baitCalm: 0.8 })).toBeLessThan(peak(STARTER_BAR_GEAR));
  });
});

describe('fish patterns', () => {
  /** Pins progress so the fight lasts and we can sample the fish for a while. */
  function sample(pattern: FishPattern, seed: number, difficulty = 0.5) {
    const f: FishProfile = { pattern, difficulty };
    const rng = seededRng(seed);
    let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
    let below = 0;
    let n = 0;
    let peak = 0;
    for (let i = 0; i < 60 * 60; i++) {
      s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 50 < 25, f, STARTER_BAR_GEAR, rng);
      if (i > 60) {
        n++;
        if (s.fish < 0.5) below++;
      }
      peak = Math.max(peak, Math.abs(s.fishVel));
    }
    return { lowShare: below / n, peak };
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('sinkers hang in the lower half, floaters in the upper half', () => {
    const sinker = avg(seeds(8).map((s) => sample('sinker', s).lowShare));
    const floater = avg(seeds(8).map((s) => sample('floater', s).lowShare));
    const smooth = avg(seeds(8).map((s) => sample('smooth', s).lowShare));
    expect(sinker).toBeGreaterThan(0.6);
    expect(floater).toBeLessThan(0.4);
    expect(sinker).toBeGreaterThan(smooth);
    expect(floater).toBeLessThan(smooth);
  });

  it('darting dashes much faster than smooth glides', () => {
    const darting = avg(seeds(8).map((s) => sample('darting', s).peak));
    const smooth = avg(seeds(8).map((s) => sample('smooth', s).peak));
    expect(darting).toBeGreaterThan(smooth * 1.5);
  });

  it('erratic fish change direction far more often than smooth ones', () => {
    const flips = (pattern: FishPattern) => {
      const f: FishProfile = { pattern, difficulty: 0.5 };
      const rng = seededRng(21);
      let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
      let flipsN = 0;
      let last = 0;
      for (let i = 0; i < 3000; i++) {
        s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 50 < 25, f, STARTER_BAR_GEAR, rng);
        const dir = Math.abs(s.fishVel) > 0.03 ? Math.sign(s.fishVel) : 0;
        if (dir !== 0 && last !== 0 && dir !== last) flipsN++;
        if (dir !== 0) last = dir;
      }
      return flipsN;
    };
    expect(flips('erratic')).toBeGreaterThan(flips('smooth') * 1.5);
  });

  it('higher difficulty moves the fish faster', () => {
    const easy = avg(seeds(8).map((s) => sample('smooth', s, 0.1).peak));
    const hard = avg(seeds(8).map((s) => sample('smooth', s, 0.9).peak));
    expect(hard).toBeGreaterThan(easy * 1.5);
  });
});

describe('frame-rate independence', () => {
  it('gives the same outcome at 16 ms and 33 ms ticks for the same hold schedule', () => {
    for (const pattern of PATTERNS) {
      const f: FishProfile = { pattern, difficulty: 0.6 };
      const run = (dt: number) => {
        const rng = seededRng(99);
        let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
        // 528 ms is a multiple of both tick lengths, so the schedule lines up exactly.
        for (let t = 0; t < 528 * 20; t += dt) {
          s = tickCatchBar(s, dt, Math.floor(t / 528) % 2 === 0, f, STARTER_BAR_GEAR, rng);
        }
        return s;
      };
      const a = run(16);
      const b = run(33);
      expect(b.progress).toBeCloseTo(a.progress, 6);
      expect(b.zone).toBeCloseTo(a.zone, 6);
      expect(b.fish).toBeCloseTo(a.fish, 6);
    }
  });
});

describe('difficulty tuning (scripted player bots, starter gear)', () => {
  it('shallow fish: a decent player takes about 4-8 s, and even a sloppy one nearly never loses', () => {
    const shallow = (seed: number): FishProfile => ({
      pattern: PATTERNS[seed % PATTERNS.length],
      difficulty: 0.05 + ((seed * 37) % 100) / 100 * 0.25,
    });
    const good = fights(shallow, GOOD_BOT, 50);
    expect(good.every((f) => f.result === 'caught')).toBe(true);
    const m = median(good.map((f) => f.ms)) / 1000;
    expect(m).toBeGreaterThanOrEqual(4);
    expect(m).toBeLessThanOrEqual(8);
    const sloppy = fights(shallow, SLOPPY_BOT, 50);
    expect(sloppy.filter((f) => f.result === 'caught').length / sloppy.length).toBeGreaterThanOrEqual(0.95);
  });

  it('deep fish: a decent player takes about 8-15 s, and a sloppy one loses a fair share', () => {
    const deep = (seed: number): FishProfile => placeholderFish('deep', seededRng(seed * 31));
    const good = fights(deep, GOOD_BOT, 50);
    const m = median(good.map((f) => f.ms)) / 1000;
    expect(m).toBeGreaterThanOrEqual(8);
    expect(m).toBeLessThanOrEqual(15);
    const sloppy = fights(deep, SLOPPY_BOT, 50);
    const lostShare = sloppy.filter((f) => f.result !== 'caught').length / sloppy.length;
    expect(lostShare).toBeGreaterThanOrEqual(0.2);
  });

  it('legendary (difficulty 1.0): takes 20 s or more, or is often lost', () => {
    const legend = (seed: number): FishProfile => ({ pattern: PATTERNS[seed % PATTERNS.length], difficulty: 1 });
    const good = fights(legend, GOOD_BOT, 50);
    const lost = good.filter((f) => f.result !== 'caught').length / good.length;
    const m = median(good.map((f) => (f.result === 'caught' ? f.ms : MAX_MS))) / 1000;
    expect(m >= 20 || lost >= 0.4).toBe(true);
  });
});

describe('placeholderFish', () => {
  it('shallow fish are easy and mostly calm; deep fish are harder and can be any pattern', () => {
    const seen = new Set<FishPattern>();
    for (const seed of seeds(200)) {
      const f = placeholderFish('shallow', seededRng(seed));
      expect(f.difficulty).toBeGreaterThanOrEqual(0.05);
      expect(f.difficulty).toBeLessThanOrEqual(0.3);
      expect(['smooth', 'floater', 'sinker']).toContain(f.pattern);
    }
    for (const seed of seeds(200)) {
      const f = placeholderFish('deep', seededRng(seed));
      expect(f.difficulty).toBeGreaterThanOrEqual(0.45);
      expect(f.difficulty).toBeLessThanOrEqual(0.8);
      seen.add(f.pattern);
    }
    expect(seen.size).toBe(5);
  });
});
