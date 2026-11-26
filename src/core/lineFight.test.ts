import { describe, expect, it } from 'vitest';
import type { FishPattern, FishProfile } from './catchBar';
import { FISH_PATTERNS } from './catchBar';
import { STARTER_BAR_GEAR } from './data/barGear';
import { LINE_FIGHT_TUNING as T, SIGNATURE_MOVES } from './data/lineFight';
import { RODS } from './data/rods';
import { LINES } from './data/tackle';
import { inRed, isPerfectLine, isSlack, lineGearOf, lineProgress, newLineFight, surgeLevel, tickLineFight, warnLevel, type LineFightState } from './lineFight';
import { seededRng } from './random';

const TICK = 16;
const easy = (pattern: FishPattern = 'smooth'): FishProfile => ({ pattern, difficulty: 0.15 });
const gear = STARTER_BAR_GEAR;

/** Runs the fight with a thumb rule until it is decided (or `maxMs`). */
function run(s: LineFightState, fish: FishProfile, thumb: (s: LineFightState, ms: number) => boolean, rng: () => number, g = gear, maxMs = 90_000): LineFightState {
  let ms = 0;
  while (s.result === 'fighting' && ms < maxMs) {
    s = tickLineFight(s, TICK, thumb(s, ms), fish, g, rng);
    ms += TICK;
  }
  return s;
}
/** A decent thumb: hold below the middle of the gold band, let go on a surge. */
const decent = (s: LineFightState) => s.phase !== 'warn' && s.phase !== 'run' && s.tension < (T.goldBand[0] + T.goldBand[1]) / 2;

describe('line fight basics', () => {
  it('starts at the hook distance with steady tension and nothing decided', () => {
    const s = newLineFight(seededRng(1), 12);
    expect(s.distanceM).toBe(12);
    expect(s.startM).toBe(12);
    expect(s.tension).toBe(T.startTension);
    expect(s.result).toBe('fighting');
    expect(s.holding).toBe(true);
    expect(lineProgress(s)).toBe(0);
  });

  it('holding reels the fish in, releasing does not (before the first surge)', () => {
    const rng = seededRng(2);
    const fish = easy();
    let held = newLineFight(rng, 10);
    let free = newLineFight(seededRng(2), 10);
    for (let i = 0; i < 40; i++) {
      held = tickLineFight(held, TICK, true, fish, gear, rng);
      free = tickLineFight(free, TICK, false, fish, gear, seededRng(2));
    }
    expect(held.distanceM).toBeLessThan(10);
    expect(free.distanceM).toBeGreaterThanOrEqual(10 - 1e-9);
  });

  it('holding raises the tension and releasing lets it ease', () => {
    const rng = seededRng(3);
    const fish = easy();
    let s = newLineFight(rng, 10);
    for (let i = 0; i < 25; i++) s = tickLineFight(s, TICK, true, fish, gear, rng);
    const up = s.tension;
    for (let i = 0; i < 40; i++) s = tickLineFight(s, TICK, false, fish, gear, rng);
    expect(s.tension).toBeLessThan(up);
  });

  it('a surge is telegraphed first, then takes line from a released thumb and strains a held one', () => {
    const fish: FishProfile = { pattern: 'smooth', difficulty: 0.5 };
    const rng = seededRng(4);
    let s = newLineFight(rng, 20);
    let sawWarn = false;
    let atRun: LineFightState | undefined;
    for (let ms = 0; ms < 20_000 && !atRun; ms += TICK) {
      s = tickLineFight(s, TICK, false, fish, gear, rng);
      if (s.phase === 'warn') {
        sawWarn = true;
        expect(warnLevel(s)).toBeGreaterThanOrEqual(0);
      }
      if (s.phase === 'run') atRun = s;
    }
    expect(sawWarn).toBe(true);
    expect(atRun).toBeDefined();
    let t = atRun!;
    const before = t.distanceM;
    for (let i = 0; i < 60; i++) t = tickLineFight(t, TICK, false, fish, gear, rng);
    expect(t.distanceM).toBeGreaterThan(before);
    expect(surgeLevel(t)).toBeGreaterThan(0);
    // The same moment with the thumb down is under far more strain.
    let h = atRun!;
    for (let i = 0; i < 40; i++) h = tickLineFight(h, TICK, true, fish, gear, seededRng(9));
    let r = atRun!;
    for (let i = 0; i < 40; i++) r = tickLineFight(r, TICK, false, fish, gear, seededRng(9));
    expect(h.tension).toBeGreaterThan(r.tension);
  });

  it('is caught when the distance reaches 0', () => {
    const fish = easy();
    const rng = seededRng(5);
    const s = run(newLineFight(rng, 8), fish, decent, rng);
    expect(s.result).toBe('caught');
    expect(s.distanceM).toBe(0);
    expect(lineProgress(s)).toBe(1);
  });

  it('does nothing once the fight is decided', () => {
    const rng = seededRng(6);
    const s = run(newLineFight(rng, 8), easy(), decent, rng);
    expect(tickLineFight(s, 500, true, easy(), gear, rng)).toBe(s);
  });

  it('the frame rate does not change the fight', () => {
    const fish: FishProfile = { pattern: 'darting', difficulty: 0.5 };
    const play = (dt: number) => {
      const rng = seededRng(7);
      let s = newLineFight(rng, 10);
      for (let ms = 0; ms < 3000; ms += dt) s = tickLineFight(s, dt, true, fish, gear, rng);
      return s;
    };
    const a = play(16);
    const b = play(33);
    expect(b.tension).toBeCloseTo(a.tension, 1);
    expect(b.distanceM).toBeCloseTo(a.distanceM, 0);
  });

  it('keeps tension, lateral and distance in bounds', () => {
    for (const pattern of FISH_PATTERNS) {
      const fish: FishProfile = { pattern, difficulty: 0.9 };
      const rng = seededRng(8);
      let s = newLineFight(rng, 15);
      for (let i = 0; i < 4000 && s.result === 'fighting'; i++) {
        s = tickLineFight(s, TICK, Math.floor(i / 25) % 2 === 0, fish, gear, rng);
        expect(s.tension).toBeGreaterThanOrEqual(0);
        expect(s.tension).toBeLessThanOrEqual(1);
        expect(Math.abs(s.lateral)).toBeLessThanOrEqual(1);
        expect(s.distanceM).toBeGreaterThanOrEqual(0);
        expect(s.distanceM).toBeLessThanOrEqual(15 * T.maxFarFactor + 1e-9);
      }
    }
  });
});

describe('failing: slack and snap', () => {
  it('never holding lets the hook slip after the slack time, not before', () => {
    const rng = seededRng(10);
    let s = newLineFight(rng, 10);
    let slackStart = -1;
    let ms = 0;
    while (s.result === 'fighting' && ms < 30_000) {
      s = tickLineFight(s, TICK, false, easy('smooth'), gear, rng);
      ms += TICK;
      if (slackStart < 0 && isSlack(s)) slackStart = ms;
    }
    expect(s.result).toBe('slipped');
    expect(slackStart).toBeGreaterThan(0);
    expect(ms - slackStart).toBeGreaterThanOrEqual(T.slackS * 1000 - 100);
  });

  it('a trophy slips sooner than a plain fish', () => {
    const timeToSlip = (slipAfterMs?: number) => {
      const rng = seededRng(11);
      const fish: FishProfile = { pattern: 'smooth', difficulty: 0.3, ...(slipAfterMs ? { slipAfterMs } : {}) };
      let s = newLineFight(rng, 10);
      let ms = 0;
      while (s.result === 'fighting' && ms < 30_000) {
        s = tickLineFight(s, TICK, false, fish, gear, rng);
        ms += TICK;
      }
      return { ms, result: s.result };
    };
    const plain = timeToSlip();
    const trophy = timeToSlip(2500);
    expect(trophy.result).toBe('slipped');
    expect(trophy.ms).toBeLessThan(plain.ms);
  });

  it('holding forever against a hard fish snaps the line', () => {
    let snapped = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      const s = run(newLineFight(rng, 20), { pattern: 'sinker', difficulty: 0.8 }, () => true, rng, RODS[1].barGear);
      if (s.result === 'snapped') snapped++;
    }
    expect(snapped).toBeGreaterThanOrEqual(18);
  });

  it('a short stretch in the red is forgiven', () => {
    const fish = easy();
    const rng = seededRng(12);
    let s: LineFightState = { ...newLineFight(rng, 10), tension: 0.99 };
    expect(inRed(s, gear)).toBe(true);
    for (let i = 0; i < 12; i++) s = tickLineFight(s, TICK, true, fish, gear, rng); // ~0.19 s
    expect(s.result).toBe('fighting');
    expect(s.redS).toBeGreaterThan(0);
  });

  it('red drains more slowly than it builds, and snaps past the rod budget', () => {
    const rng = seededRng(13);
    let s: LineFightState = { ...newLineFight(rng, 10), tension: 1 };
    const budget = lineGearOf(gear).flexS;
    // Pinned in the red: held tension target > limit for a hard fish.
    const fish: FishProfile = { pattern: 'sinker', difficulty: 1 };
    for (let ms = 0; ms < (budget + 1) * 1000 && s.result === 'fighting'; ms += TICK) s = tickLineFight(s, TICK, true, fish, gear, rng);
    expect(s.result).toBe('snapped');
  });
});

describe('gear', () => {
  it('maps rod → flex, line → snap limit, reel → reel speed, bait → calm', () => {
    const [bamboo, fiberglass, carbon] = RODS.map((r) => lineGearOf(r.barGear));
    expect(bamboo.flexS).toBeLessThan(fiberglass.flexS);
    expect(fiberglass.flexS).toBeLessThan(carbon.flexS);
    const braided = lineGearOf({ ...gear, lineDrain: gear.lineDrain * LINES[0].drain });
    const fluoro = lineGearOf({ ...gear, lineDrain: gear.lineDrain * LINES[1].drain });
    expect(bamboo.snapLimit).toBeLessThan(braided.snapLimit);
    expect(braided.snapLimit).toBeLessThan(fluoro.snapLimit);
    expect(lineGearOf({ ...gear, reelResponse: 1.4 }).reel).toBe(1.4);
    expect(lineGearOf({ ...gear, baitCalm: 0.5 }).calm).toBe(0.5);
  });

  it('a better reel finishes the same fight sooner', () => {
    const fish = easy();
    const ms = (reelResponse: number) => {
      const rng = seededRng(14);
      let s = newLineFight(rng, 10);
      let t = 0;
      while (s.result === 'fighting' && t < 60_000) {
        s = tickLineFight(s, TICK, decent(s), fish, { ...gear, reelResponse }, rng);
        t += TICK;
      }
      return t;
    };
    expect(ms(1.4)).toBeLessThan(ms(1));
  });

  it('a longer flex budget survives more red', () => {
    const wins = (g: typeof gear) => {
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const rng = seededRng(seed);
        const fish: FishProfile = { pattern: 'darting', difficulty: 0.75 };
        const s = run(newLineFight(rng, 20), fish, (s0) => decent(s0), rng, g);
        if (s.result === 'caught') n++;
      }
      return n;
    };
    expect(wins(RODS[2].barGear)).toBeGreaterThanOrEqual(wins(RODS[0].barGear));
  });

  it('corn (bait calm) makes the surges weaker', () => {
    const avg = (baitCalm: number) => {
      let sum = 0;
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const rng = seededRng(seed);
        let s = newLineFight(rng, 20);
        for (let ms = 0; ms < 30_000; ms += TICK) {
          s = tickLineFight(s, TICK, false, { pattern: 'smooth', difficulty: 0.6 }, { ...gear, baitCalm }, rng);
          if (s.phase === 'warn') {
            sum += s.strength;
            n++;
          }
          if (s.result !== 'fighting') break;
        }
      }
      return sum / n;
    };
    expect(avg(0.5)).toBeLessThan(avg(0));
  });
});

describe('personalities', () => {
  const surgeStats = (fish: FishProfile, seconds = 40) => {
    const rng = seededRng(21);
    let s = newLineFight(rng, 1000); // so far away it can not be caught or lost to distance in the test
    let surges = 0;
    let runMs = 0;
    let prev = s.phase;
    let maxStrength = 0;
    for (let ms = 0; ms < seconds * 1000; ms += TICK) {
      s = { ...tickLineFight({ ...s, tension: 0.5, slackS: 0, redS: 0 }, TICK, false, fish, gear, rng), result: 'fighting' };
      if (s.phase === 'warn' && prev !== 'warn') surges++;
      if (s.phase === 'run') {
        runMs += TICK;
        maxStrength = Math.max(maxStrength, s.strength);
      }
      prev = s.phase;
    }
    return { surges, runMs, maxStrength };
  };

  it('every pattern surges', () => {
    for (const pattern of FISH_PATTERNS) expect(surgeStats({ pattern, difficulty: 0.6 }).surges, pattern).toBeGreaterThan(2);
  });

  it('darting surges are short and frequent, smooth ones long and steady', () => {
    const smooth = surgeStats({ pattern: 'smooth', difficulty: 0.6 });
    const darting = surgeStats({ pattern: 'darting', difficulty: 0.6 });
    expect(darting.surges).toBeGreaterThan(smooth.surges);
    expect(darting.runMs / darting.surges).toBeLessThan(smooth.runMs / smooth.surges);
  });

  it('a harder fish surges more often and harder', () => {
    const lo = surgeStats({ pattern: 'erratic', difficulty: 0.1 });
    const hi = surgeStats({ pattern: 'erratic', difficulty: 0.95 });
    expect(hi.surges).toBeGreaterThan(lo.surges);
    expect(hi.maxStrength).toBeGreaterThan(lo.maxStrength);
  });

  it('darting fish cut sideways more than sinkers', () => {
    const swing = (pattern: FishPattern) => {
      const rng = seededRng(22);
      let s = newLineFight(rng, 1000);
      let travelled = 0;
      let last = s.lateral;
      for (let ms = 0; ms < 20_000; ms += TICK) {
        s = { ...tickLineFight({ ...s, tension: 0.5, slackS: 0, redS: 0 }, TICK, false, { pattern, difficulty: 0.6 }, gear, rng), result: 'fighting' };
        travelled += Math.abs(s.lateral - last);
        last = s.lateral;
      }
      return travelled;
    };
    expect(swing('darting')).toBeGreaterThan(swing('sinker') * 2);
  });

  it('each trophy has its own signature move', () => {
    expect(Object.keys(SIGNATURE_MOVES).sort()).toEqual(['goldenTench', 'mossback', 'silverGhost']);
    const seen = (speciesId: string, want: (s: LineFightState) => boolean) => {
      const rng = seededRng(31);
      const fish: FishProfile = { pattern: 'darting', difficulty: 0.8, slipAfterMs: 2500 };
      let s = newLineFight(rng, 1000, speciesId);
      for (let ms = 0; ms < 120_000; ms += TICK) {
        s = { ...tickLineFight({ ...s, tension: 0.5, slackS: 0, redS: 0 }, TICK, false, fish, gear, rng), result: 'fighting' };
        if (want(s)) return true;
      }
      return false;
    };
    expect(seen('silverGhost', (s) => s.phase === 'hush')).toBe(true); // the feint goes limp
    expect(seen('goldenTench', (s) => s.chain > 0)).toBe(true); // two surges back to back
    expect(seen('mossback', (s) => s.phase === 'warn' && s.phaseTotal >= 0.85)).toBe(true); // the long warning of the dive
    expect(seen('roach', (s) => s.phase === 'hush' || s.chain > 0)).toBe(false);
  });
});

describe('perfect catch', () => {
  it('is a won fight with almost no red and almost no slack', () => {
    let perfect = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      const s = run(newLineFight(rng, 8), easy('smooth'), decent, rng);
      expect(s.result).toBe('caught');
      if (isPerfectLine(s)) perfect++;
    }
    expect(perfect).toBeGreaterThanOrEqual(15);
  });

  it('a long stretch in the red or in slack ruins it', () => {
    const rng = seededRng(40);
    const s = run(newLineFight(rng, 8), easy('smooth'), decent, rng);
    expect(isPerfectLine(s)).toBe(true);
    expect(isPerfectLine({ ...s, redTotalMs: T.perfectRedGraceMs + 100 })).toBe(false);
    expect(isPerfectLine({ ...s, slackTotalMs: T.perfectSlackGraceMs + 100 })).toBe(false);
    expect(isPerfectLine({ ...s, result: 'slipped' })).toBe(false);
  });

  it('is rarer against a hard darting fish', () => {
    const rate = (d: number) => {
      let p = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const rng = seededRng(seed);
        const s = run(newLineFight(rng, 8), { pattern: 'darting', difficulty: d }, decent, rng, RODS[2].barGear);
        if (isPerfectLine(s)) p++;
      }
      return p;
    };
    expect(rate(0.9)).toBeLessThan(rate(0.15));
  });
});

describe('tuning (decent player bot)', () => {
  it('lands the shallow fish nearly every time, in a fight of about 4-12 s', () => {
    const ms: number[] = [];
    let caught = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seededRng(seed);
      const pattern = (['smooth', 'darting', 'sinker', 'erratic', 'floater'] as const)[seed % 5];
      const fish: FishProfile = { pattern, difficulty: 0.05 + ((seed * 37) % 100) / 400 };
      const s = run(newLineFight(rng, 8), fish, decent, rng);
      if (s.result === 'caught') caught++;
      ms.push(s.elapsedMs);
    }
    expect(caught / 40).toBeGreaterThanOrEqual(0.95);
    const median = [...ms].sort((a, b) => a - b)[20] / 1000;
    expect(median).toBeGreaterThanOrEqual(3);
    expect(median).toBeLessThanOrEqual(12);
  });

  it('never holding or always holding does not win a mid fish', () => {
    for (const hold of [true, false]) {
      let won = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const rng = seededRng(seed);
        const s = run(newLineFight(rng, 20), { pattern: 'smooth', difficulty: 0.65 }, () => hold, rng, RODS[1].barGear);
        if (s.result === 'caught') won++;
      }
      expect(won, hold ? 'hold forever' : 'never hold').toBe(0);
    }
  });
});

describe('fair telegraphs, passive play, tiring (tester fixes)', () => {
  it('every sideways cut is telegraphed for at least 0.35 s, on every pattern and difficulty', () => {
    for (const pattern of FISH_PATTERNS) {
      for (const difficulty of [0.1, 0.6, 1]) {
        const rng = seededRng(51);
        let s = newLineFight(rng, 1000);
        let cutSince = -1;
        for (let ms = 0; ms < 60_000; ms += TICK) {
          s = { ...tickLineFight({ ...s, tension: 0.5, slackS: 0, redS: 0, releasedS: 0 }, TICK, true, { pattern, difficulty }, gear, rng), result: 'fighting' };
          if (s.cutWarn > 0 && cutSince < 0) cutSince = s.cutWarn;
          if (s.cutWarn === 0 && cutSince > 0) {
            expect(cutSince).toBeGreaterThanOrEqual(0.35);
            cutSince = -1;
          }
        }
      }
    }
  });

  it('a surge warning is at least 0.35 s even for the hardest fish', () => {
    for (const pattern of FISH_PATTERNS) {
      const rng = seededRng(52);
      let s = newLineFight(rng, 1000);
      for (let ms = 0; ms < 40_000; ms += TICK) {
        s = { ...tickLineFight({ ...s, tension: 0.5, slackS: 0, redS: 0, releasedS: 0 }, TICK, true, { pattern, difficulty: 1 }, gear, rng), result: 'fighting' };
        if (s.phase === 'warn' && s.phaseTotal !== 0.22) expect(s.phaseTotal, pattern).toBeGreaterThanOrEqual(0.34);
      }
    }
  });

  it('a passive player loses the fish to the slip in a few seconds at any depth, never by the 60 s timeout', () => {
    for (const startM of [8, 25]) {
      const rng = seededRng(53);
      const fish: FishProfile = { pattern: 'darting', difficulty: 0.75 };
      const s = run(newLineFight(rng, startM), fish, () => false, rng, gear, 90_000);
      expect(s.result).toBe('slipped');
      expect(s.elapsedMs).toBeLessThan(15_000);
    }
  });

  it('the safety-net timeout is its own result (worded "It got away")', () => {
    const rng = seededRng(54);
    const s = tickLineFight({ ...newLineFight(rng, 20), elapsedMs: T.maxFightMs + 100 }, 20, true, easy(), gear, rng);
    expect(s.result).toBe('escaped');
  });

  it('the fish tires near the dock: surges are weaker in the last metres', () => {
    const rng = seededRng(55);
    const far = { ...newLineFight(rng, 20), phase: 'run' as const, phaseT: 1, phaseTotal: 2, strength: 0.8, distanceM: 10 };
    expect(surgeLevel({ ...far, distanceM: 0.4 })).toBeLessThan(surgeLevel(far) * 0.4);
    expect(surgeLevel({ ...far, distanceM: 3 })).toBeCloseTo(surgeLevel(far), 5);
  });

  it('red drains faster while the tension is in the steady band', () => {
    const rng = seededRng(56);
    const base = { ...newLineFight(rng, 10), redS: 0.5 };
    const calm = tickLineFight({ ...base, tension: 0.2 }, 1000, false, easy(), gear, rng).redS;
    const gold = tickLineFight({ ...base, tension: 0.5 }, 1000, true, easy(), gear, rng).redS;
    expect(gold).toBeLessThan(calm);
  });
});
