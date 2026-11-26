import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { PLAY_AREA, PLAY_TUNING, createCompanions, startPlayNow, tickCompanions, type Companions, type CompanionContext } from './behaviour';

/**
 * Seeded simulations of whole fetch sessions at a phone's frame time, to catch the "stuck near the edge
 * or the car" bug: both standing in place, her head inside his beard, his legs in the walk frame.
 */
const idle: CompanionContext = { fishing: 'idle', night: false };
const DT = 16;
/** The sprites are ~26 px wide, so their centres must never be closer than this. */
const MIN_GAP = 28;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const { x0, x1, y0, y1 } = PLAY_AREA;
/** Where a session starts: both put in this spot (feet) after the usual walk to the grass. */
const STARTS: { name: string; paj: { x: number; y: number }; dog: { x: number; y: number } }[] = [
  { name: 'by the car', paj: { x: x0 + 4, y: 530 }, dog: { x: x0 + 32, y: 530 } },
  { name: 'car, bottom corner', paj: { x: x0 + 2, y: y1 - 1 }, dog: { x: x0 + 30, y: y1 - 1 } },
  { name: 'car, top corner', paj: { x: x0 + 2, y: y0 + 1 }, dog: { x: x0 + 30, y: y0 + 1 } },
  { name: 'bottom edge', paj: { x: 200, y: y1 - 1 }, dog: { x: 230, y: y1 - 1 } },
  { name: 'top edge', paj: { x: 200, y: y0 + 1 }, dog: { x: 230, y: y0 + 1 } },
  { name: 'right edge', paj: { x: x1 - 2, y: 528 }, dog: { x: x1 - 30, y: 528 } },
];

interface Sample {
  mode: string;
  phase: string;
  shape: string;
  paj: { x: number; y: number };
  dog: { x: number; y: number };
}

function session(seed: number, start: (typeof STARTS)[number], ms: number): Sample[] {
  const rng = seededRng(seed);
  const s: Companions = createCompanions(rng);
  startPlayNow(s);
  Object.assign(s.paj, start.paj);
  Object.assign(s.dog, start.dog);
  const out: Sample[] = [];
  for (let t = 0; t < ms; t += DT) {
    tickCompanions(s, DT, idle, rng);
    out.push({ mode: s.mode, phase: s.play.phase, shape: s.paj.shape, paj: { x: s.paj.x, y: s.paj.y }, dog: { x: s.dog.x, y: s.dog.y } });
  }
  return out;
}

const CHASE = new Set(['tease', 'dodge', 'keepAway']);

describe('the chase never gets stuck (seeded simulations)', () => {
  const runs: { label: string; samples: Sample[] }[] = [];
  for (const start of STARTS) for (let seed = 1; seed <= 40; seed++) runs.push({ label: `${start.name}, seed ${seed}`, samples: session(seed, start, 45_000) });

  it('the new minimum gap clears the sprites', () => {
    expect(PLAY_TUNING.minGap).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('their centres never come closer than the sprites are wide while she is being chased', () => {
    for (const { label, samples } of runs) {
      for (const m of samples) {
        if (m.mode !== 'play' || !CHASE.has(m.phase)) continue;
        if (dist(m.paj, m.dog) < MIN_GAP - 0.5) throw new Error(`${label}: gap ${dist(m.paj, m.dog).toFixed(1)} in ${m.phase}`);
      }
    }
  });

  it('he is never in the walk frame for 300 ms while moving less than 2 px', () => {
    const win = Math.round(300 / DT);
    for (const { label, samples } of runs) {
      // Trailing 300 ms entirely in the walk frame: he must have got somewhere in it.
      let run = 0;
      samples.forEach((m, i) => {
        run = m.mode === 'play' && m.shape === 'walk' ? run + 1 : 0;
        if (run <= win) return;
        let far = 0;
        for (let k = i - win; k <= i; k++) far = Math.max(far, dist(samples[k].paj, samples[i - win].paj));
        if (far < 2) throw new Error(`${label}: walking in place in ${m.phase} (${i * DT} ms)`);
      });
    }
  });

  it('the dog covers more than 20 px in any 1.5 s of the chase', () => {
    const win = Math.round(1500 / DT);
    for (const { label, samples } of runs) {
      for (let i = 0; i + win < samples.length; i++) {
        const a = samples[i];
        const b = samples[i + win];
        if (!samples.slice(i, i + win + 1).every((m) => m.phase === 'keepAway' && m.mode === 'play')) continue;
        // Over the window she must have got somewhere (the farthest point from where she started).
        let far = 0;
        for (let k = i; k <= i + win; k++) far = Math.max(far, dist(samples[k].dog, a.dog));
        if (far <= 20) throw new Error(`${label}: dog stuck near ${Math.round(a.dog.x)},${Math.round(a.dog.y)} (${i * DT} ms) b=${Math.round(b.dog.x)}`);
      }
    }
  });

  it('both stay on the lawn', () => {
    for (const { label, samples } of runs) {
      for (const m of samples) {
        if (m.mode !== 'play' || !['tease', 'dodge', 'keepAway', 'giveUp'].includes(m.phase)) continue;
        for (const a of [m.paj, m.dog]) {
          if (a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 1) throw new Error(`${label}: off the lawn at ${Math.round(a.x)},${Math.round(a.y)}`);
        }
      }
    }
  });

  it('chases actually happen in these runs', () => {
    const n = runs.filter((r) => r.samples.some((m) => m.phase === 'keepAway')).length;
    expect(n).toBeGreaterThan(runs.length * 0.9);
  });
});

/**
 * Frame time differs between devices (a 120/144 Hz screen ticks every 7-8 ms, a slow phone every 33 ms):
 * the dog must not freeze at the edge on any of them. At 8 ms her step towards her waypoint and her slide
 * round him were opposite ways and undid each other every other frame (a two-frame limit cycle: both
 * standing, she "runs" on the spot).
 */
describe('the chase never freezes at any frame time', () => {
  for (const dt of [8, 11, 16, 33]) {
    it(`the dog covers more than 20 px in any 1.5 s of the chase at ${dt} ms frames`, () => {
      const win = Math.round(1500 / dt);
      for (const start of STARTS) {
        for (let seed = 1; seed <= 40; seed++) {
          const rng = seededRng(seed);
          const s: Companions = createCompanions(rng);
          startPlayNow(s);
          Object.assign(s.paj, start.paj);
          Object.assign(s.dog, start.dog);
          const h: { chase: boolean; x: number; y: number }[] = [];
          for (let t = 0; t < 60_000; t += dt) {
            tickCompanions(s, dt, idle, rng);
            h.push({ chase: s.mode === 'play' && s.play.phase === 'keepAway', x: s.dog.x, y: s.dog.y });
          }
          for (let i = 0; i + win < h.length; i += 2) {
            let ok = true;
            let far = 0;
            for (let k = i; k <= i + win && ok; k++) {
              ok = h[k].chase;
              far = Math.max(far, dist(h[k], h[i]));
            }
            if (ok && far <= 20) throw new Error(`${start.name}, seed ${seed}, ${dt} ms: dog stuck near ${Math.round(h[i].x)},${Math.round(h[i].y)} at ${i * dt} ms`);
          }
        }
      }
    }, 30_000); // 160 runs of 60 s each: ~6 s alone, slower under a full parallel run
  }
});
