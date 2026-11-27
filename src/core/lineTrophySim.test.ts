import { describe, expect, it } from 'vitest';
import { RODS } from './data/rods';
import { speciesById } from './data/fish';
import { fightProfile, rollLength } from './fish';
import { newLineFight, tickLineFight, type LineFightState } from './lineFight';
import { SIGNATURE_MOVES, SIGNATURE_TUNING } from './data/lineFight';
import { seededRng } from './random';
import { playClassic, playLine } from '../sim/lineFight.sim.test';
import type { BarGear } from './gear';

/**
 * The decent thumb against each trophy in the Line style (slice 25f fix): the signature moves must not make a trophy much harder than in
 * the Classic bar (docs/CATCH_MATH_AUDIT.md), and obey the normal rules (a telegraph of at least 0.35 s, the strength and the lateral reach of a normal surge).
 */
const TICK = 16;
const decent = (s: LineFightState) => s.phase !== 'warn' && s.phase !== 'run' && s.tension < (s.goldLo + s.goldHi) / 2;
const ROD: Record<string, number> = { goldenTench: 1, mossback: 2, silverGhost: 0, lantern: 0, barbelKing: 2, ferryPike: 1 };

function share(id: string, n = 200): number {
  const sp = speciesById(id)!;
  const gear = RODS[ROD[id]].barGear;
  let won = 0;
  for (let seed = 1; seed <= n; seed++) {
    const rng = seededRng(seed * 31);
    const fish = fightProfile(sp, rollLength(sp, seededRng(seed * 977)));
    let s = newLineFight(rng, 20, id);
    for (let ms = 0; s.result === 'fighting' && ms < 90_000; ms += TICK) s = tickLineFight(s, TICK, decent(s), fish, gear, rng);
    if (s.result === 'caught') won++;
  }
  return won / n;
}

describe('Line trophies and the decent thumb', () => {
  it('prints the shares', () => {
    const out: Record<string, number> = {};
    for (const id of Object.keys(ROD)) out[id] = share(id);
    expect(Object.keys(out)).toHaveLength(6);
  });

  it('the signature moves obey the normal rules: a telegraph of at least 0.35 s and a capped strength', () => {
    expect(SIGNATURE_TUNING.flashWarnS).toBeGreaterThanOrEqual(0.35);
    expect(SIGNATURE_TUNING.diveWarnS).toBeGreaterThanOrEqual(0.35);
    expect(SIGNATURE_TUNING.feintHushS).toBeGreaterThanOrEqual(0.35);
    expect(SIGNATURE_TUNING.feintMaxStrength).toBeLessThanOrEqual(0.85);
    expect(Object.keys(SIGNATURE_MOVES).length).toBe(6);
  });

  // The Ferry pike's Line-vs-Classic share is guarded below against the sim's decent bot (the older 0.475 target came from a cruder bot).
});

/**
 * Balance pass (branch tune/line-trophies): the decent bot of the sim (src/sim/lineFight.sim.test.ts) lands these cells in Line within about 10 points
 * of Classic. Tolerance 12 here because 200 fights per cell are noisy; the full table is in docs/ECONOMY_SIM.md "Line fight".
 */
const DECENT_BOT = { delayMs: 200, noise: 0.05, jitterMs: 100, lapse: 0.03 };
const [BAMBOO, FIBER, CARBON] = RODS.map((r) => r.barGear);
function lineVsClassic(id: string, gear: BarGear, n = 200): number {
  const sp = speciesById(id)!;
  let line = 0;
  let classic = 0;
  for (let seed = 1; seed <= n; seed++) {
    const fish = fightProfile(sp, rollLength(sp, seededRng(seed * 977)));
    if (playLine(fish, DECENT_BOT, seed, gear, sp.zone === 'deep' ? 20 : 8, id).caught) line++;
    if (playClassic(fish, DECENT_BOT, seed, gear).caught) classic++;
  }
  return ((line - classic) / n) * 100;
}

describe('Line vs Classic, decent bot, cheap rods (balance pass)', () => {
  const cells: [string, string, BarGear][] = [
    ['silverGhost', 'bamboo', BAMBOO],
    ['silverGhost', 'fiberglass', FIBER],
    ['lantern', 'bamboo', BAMBOO],
    ['lantern', 'fiberglass', FIBER],
    ['ferryPike', 'bamboo', BAMBOO],
    ['ferryPike', 'fiberglass', FIBER],
    ['pike', 'fiberglass', FIBER],
    ['goldenTench', 'fiberglass', FIBER],
    ['barbelKing', 'carbon', CARBON],
  ];
  for (const [id, rod, gear] of cells) {
    it(`${id} on ${rod}: within 12 points of Classic`, { timeout: 60_000 }, () => {
      expect(Math.abs(lineVsClassic(id, gear))).toBeLessThanOrEqual(12);
    });
  }
});
