import { afterAll, describe, expect, it } from 'vitest';
import {
  CATCH_BAR_TUNING,
  barResult,
  newCatchBar,
  tickCatchBar,
  type CatchBarState,
  type FishPattern,
  type FishProfile,
} from './catchBar';
import { STARTER_BAR_GEAR } from './data/barGear';
import { POOL_SPECIES, SPECIES } from './data/fish';
import { RODS } from './data/rods';
import { fightProfile, rollLength } from './fish';
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

function fights(profiles: (seed: number) => FishProfile, bot: Bot, n = 40, gear: BarGear = STARTER_BAR_GEAR): Fight[] {
  return seeds(n).map((seed) => playBot(profiles(seed), bot, seed, gear));
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

  it('darting fish move in bursts: far more of the time standing still than smooth glides', () => {
    const stillShare = (pattern: FishPattern, seed: number) => {
      const f: FishProfile = { pattern, difficulty: 0.7 };
      const rng = seededRng(seed);
      let s = newCatchBar(f, STARTER_BAR_GEAR, rng);
      let still = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) {
        s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 50 < 25, f, STARTER_BAR_GEAR, rng);
        if (Math.abs(s.fishVel) < 0.08) still++;
      }
      return still / n;
    };
    const darting = avg(seeds(8).map((s) => stillShare('darting', s)));
    const smooth = avg(seeds(8).map((s) => stillShare('smooth', s)));
    expect(darting).toBeGreaterThan(smooth * 1.3);
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

/** A fight against a species at a rolled size, the way the session builds it. */
const speciesFight = (sp: (typeof SPECIES)[number]) => (seed: number): FishProfile =>
  fightProfile(sp, rollLength(sp, seededRng(seed * 977)));
const shallowSpecies = POOL_SPECIES.filter((s) => s.zone === 'shallow');
const deepSpecies = POOL_SPECIES.filter((s) => s.zone === 'deep');
const caughtShare = (f: Fight[]) => f.filter((x) => x.result === 'caught').length / f.length;

const [, FIBERGLASS, CARBON] = RODS.map((r) => r.barGear);

describe('difficulty tuning (scripted player bots)', () => {
  it('shallow fish (starter gear): forgiving. A decent player takes about 4-8 s, a sloppy one still lands at least 85%', () => {
    const shallow = (seed: number): FishProfile => ({
      pattern: PATTERNS[seed % PATTERNS.length],
      difficulty: 0.05 + ((seed * 37) % 100) / 100 * 0.25,
    });
    const good = fights(shallow, GOOD_BOT, 50);
    expect(caughtShare(good)).toBeGreaterThanOrEqual(0.98);
    const m = median(good.map((f) => f.ms)) / 1000;
    expect(m).toBeGreaterThanOrEqual(4);
    expect(m).toBeLessThanOrEqual(8);
    expect(caughtShare(fights(shallow, SLOPPY_BOT, 50))).toBeGreaterThanOrEqual(0.85);
  });

  it('deep fish (fiberglass gear): a decent player takes about 8-15 s, and a sloppy one loses a fair share', () => {
    const deep = (seed: number): FishProfile => speciesFight(deepSpecies[seed % deepSpecies.length])(seed);
    const good = fights(deep, GOOD_BOT, 60, FIBERGLASS);
    const m = median(good.map((f) => f.ms)) / 1000;
    expect(m).toBeGreaterThanOrEqual(8);
    expect(m).toBeLessThanOrEqual(15);
    const lostShare = 1 - caughtShare(fights(deep, SLOPPY_BOT, 60, FIBERGLASS));
    expect(lostShare).toBeGreaterThanOrEqual(0.2);
  });

  it('carbon makes deep fights a bit easier than fiberglass', () => {
    const deep = (seed: number): FishProfile => speciesFight(deepSpecies[seed % deepSpecies.length])(seed);
    const medianMs = (gear: BarGear) => median(fights(deep, GOOD_BOT, 60, gear).map((f) => f.ms));
    expect(medianMs(CARBON)).toBeLessThanOrEqual(medianMs(FIBERGLASS));
  });

  it('difficulty 1.0: often lost, or a very long fight', () => {
    const legend = (seed: number): FishProfile => ({ pattern: PATTERNS[seed % PATTERNS.length], difficulty: 1 });
    const good = fights(legend, GOOD_BOT, 50);
    const lost = 1 - caughtShare(good);
    const m = median(good.map((f) => (f.result === 'caught' ? f.ms : MAX_MS))) / 1000;
    expect(m >= 20 || lost >= 0.4).toBe(true);
  });
});

describe('the real roster, fought by the bots', () => {
  const rows: string[] = [];
  afterAll(() => console.log(['roster bot results (median seconds, catch share)', ...rows].join(String.fromCharCode(10))));
  const stats = (sp: (typeof SPECIES)[number], gear: BarGear = STARTER_BAR_GEAR, label = 'bamboo') => {
    const good = fights(speciesFight(sp), GOOD_BOT, 40, gear);
    const sloppy = fights(speciesFight(sp), SLOPPY_BOT, 40, gear);
    const gm = median(good.map((f) => (f.result === 'caught' ? f.ms : MAX_MS))) / 1000;
    const sm = median(sloppy.map((f) => (f.result === 'caught' ? f.ms : MAX_MS))) / 1000;
    rows.push(
      `${sp.id.padEnd(8)} ${sp.zone.padEnd(7)} ${label.padEnd(10)} good: ${gm.toFixed(1)}s ${(caughtShare(good) * 100).toFixed(0)}%   sloppy: ${sm.toFixed(1)}s ${(caughtShare(sloppy) * 100).toFixed(0)}%`,
    );
    return { gm, goodShare: caughtShare(good), sloppyShare: caughtShare(sloppy) };
  };

  it('every shallow species is forgiving', () => {
    const results = shallowSpecies.map((sp) => ({ sp, ...stats(sp) }));
    for (const r of results) {
      expect(r.goodShare, `${r.sp.id} good`).toBeGreaterThanOrEqual(0.98);
      expect(r.sloppyShare, `${r.sp.id} sloppy`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('every deep species takes a good player 8-15 s with fiberglass', () => {
    const results = deepSpecies.map((sp) => ({ sp, ...stats(sp, FIBERGLASS, 'fiberglass') }));
    for (const r of results) {
      expect(r.gm, r.sp.id).toBeGreaterThanOrEqual(8);
      expect(r.gm, r.sp.id).toBeLessThanOrEqual(15);
    }
  });

  it('every deep species is no harder with carbon than with fiberglass (and no less catchable)', () => {
    for (const sp of deepSpecies) {
      const fg = stats(sp, FIBERGLASS, 'fiberglass');
      const cb = stats(sp, CARBON, 'carbon');
      expect(cb.gm, sp.id).toBeLessThanOrEqual(fg.gm + 0.3);
      expect(cb.goodShare, sp.id).toBeGreaterThanOrEqual(fg.goodShare - 0.03);
    }
  });
});

describe('the Pale One (abyssal pattern, scripted player bots)', () => {
  const pale = SPECIES.find((s) => s.id === 'pale')!;
  const palFight = speciesFight(pale);
  const rows: string[] = [];
  afterAll(() => console.log(['pale bot results (carbon rod)', ...rows].join(String.fromCharCode(10))));

  it('is a very hard fight: difficulty from about 0.9 up to 1', () => {
    expect(pale.pattern).toBe('abyssal');
    const lo = fightProfile(pale, pale.lengthCm[0]).difficulty;
    const hi = fightProfile(pale, pale.lengthCm[1]).difficulty;
    expect(lo).toBeGreaterThanOrEqual(0.9);
    expect(hi).toBeLessThanOrEqual(1);
  });

  it('moves in long calm drifts broken by sudden hard dives to the bottom', () => {
    const f: FishProfile = { pattern: 'abyssal', difficulty: 0.95 };
    let slow = 0;
    let n = 0;
    let dives = 0;
    let fastBefore = false;
    let fastestDown = 0;
    for (const seed of seeds(6)) {
      const rng = seededRng(seed);
      let s = newCatchBar(f, CARBON, rng);
      for (let i = 0; i < 60 * 60; i++) {
        s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 50 < 25, f, CARBON, rng);
        n++;
        if (Math.abs(s.fishVel) < 0.35) slow++;
        const fast = s.fishVel < -1;
        if (fast && !fastBefore) dives++;
        fastBefore = fast;
        fastestDown = Math.min(fastestDown, s.fishVel);
      }
    }
    expect(slow / n).toBeGreaterThan(0.7); // long calm drifts
    expect(fastestDown).toBeLessThan(-1.5); // hard dives
    expect(dives / 6).toBeGreaterThan(3); // a few dives in a minute of fight
    expect(dives / 6).toBeLessThan(25);
  });

  it('a dive ends near the bottom of the bar', () => {
    const f: FishProfile = { pattern: 'abyssal', difficulty: 0.95 };
    const rng = seededRng(4);
    let s = newCatchBar(f, CARBON, rng);
    let lowest = 1;
    for (let i = 0; i < 60 * 60; i++) {
      s = tickCatchBar({ ...s, progress: 0.5 }, 16, i % 50 < 25, f, CARBON, rng);
      lowest = Math.min(lowest, s.fish);
    }
    expect(lowest).toBeLessThan(0.25);
  });

  it('a skilled bot with the carbon rod needs at least 20 s (median) and wins a fair share', () => {
    const good = fights(palFight, GOOD_BOT, 80, CARBON);
    const times = good.map((f) => f.ms);
    const won = caughtShare(good);
    rows.push(`good   win ${(won * 100).toFixed(0)}%  median fight ${(median(times) / 1000).toFixed(1)}s (all)  ${(median(good.filter((f) => f.result === 'caught').map((f) => f.ms)) / 1000).toFixed(1)}s (won)`);
    expect(median(times) / 1000).toBeGreaterThanOrEqual(20);
    expect(median(good.filter((f) => f.result === 'caught').map((f) => f.ms)) / 1000).toBeGreaterThanOrEqual(20);
    expect(won).toBeGreaterThanOrEqual(0.4);
  });

  it('a sloppy bot loses most of the time, and a player who never holds almost always loses', () => {
    const sloppy = fights(palFight, SLOPPY_BOT, 80, CARBON);
    rows.push(`sloppy win ${(caughtShare(sloppy) * 100).toFixed(0)}%`);
    expect(caughtShare(sloppy)).toBeLessThan(0.5);
    const never = seeds(80).map((seed) => {
      const f = palFight(seed);
      const rng = seededRng(seed);
      let s = newCatchBar(f, CARBON, rng);
      for (let i = 0; i < 6000 && barResult(s) === 'fighting'; i++) s = tickCatchBar(s, 16, false, f, CARBON, rng);
      return barResult(s);
    });
    const winShare = never.filter((r) => r === 'caught').length / never.length;
    rows.push(`passive win ${(winShare * 100).toFixed(0)}%`);
    expect(winShare).toBeLessThan(0.1);
  });
});
