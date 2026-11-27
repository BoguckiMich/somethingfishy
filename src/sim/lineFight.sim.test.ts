/**
 * Tuning sim for the line fight (slice 28). Skipped by default; run it with
 *
 *     SIM=1 npx vitest run src/sim/lineFight < /dev/null
 *
 * It plays the pure core only: the classic catch bar and the line fight against every species at a rolled size, with a decent
 * player bot (200 ms reaction, noise) and a skilled one (150 ms, none). The numbers are written up in docs/ECONOMY_SIM.md "Line fight".
 * Nothing here is imported by the game.
 */
import { describe, it } from 'vitest';
import { barResult, isPerfect, newCatchBar, tickCatchBar, type FishProfile } from '../core/catchBar';
import { STARTER_BAR_GEAR } from '../core/data/barGear';
import { POOL_SPECIES, SPECIES, speciesById } from '../core/data/fish';
import { RODS } from '../core/data/rods';
import { LINES, REELS } from '../core/data/tackle';
import { fightProfile, rollLength } from '../core/fish';
import type { BarGear } from '../core/gear';
import { RIVER_CURRENT, type RiverGearOwned } from '../core/current';
import { QUIET_LAKE, RIVER_BEND } from '../core/data/locations';
import { step, type FishingState, type SessionContext } from '../core/fishingSession';
import { zoneAt, type Location } from '../core/location';
import { isPerfectLine, newLineFight, tickLineFight, type LineFightState } from '../core/lineFight';
import { seededRng } from '../core/random';

declare const process: { env: Record<string, string | undefined> };
const ON = process.env.SIM === '1';
/** `SIM_ONLY=silverGhost,lantern` runs the catch-rate table for those species only. */
const ONLY = process.env.SIM_ONLY?.split(',');
const N = Number(process.env.SIM_FIGHTS ?? 200);

const TICK = 16;
interface Bot {
  delayMs: number;
  /** Classic bar: noise on what she sees. */
  noise: number;
  /** Line: timing noise on every press and release (+- ms): the thumb is never exactly on the beat. */
  jitterMs: number;
  /** Line: chance that a reaction is a lapse (looking away): it takes 0.6 s longer. A small realistic share now: the fights are lost to control, not to lapses. */
  lapse: number;
}
const DECENT: Bot = { delayMs: 200, noise: 0.05, jitterMs: 100, lapse: 0.03 };
const SKILLED: Bot = { delayMs: 150, noise: 0, jitterMs: 50, lapse: 0.02 };

export interface Played {
  caught: boolean;
  perfect: boolean;
  ms: number;
  how: 'caught' | 'slipped' | 'snapped' | 'escaped' | 'lost' | 'timeout';
  /** Line style: total ms in the red / slack (for tuning). */
  redMs?: number;
  slackMs?: number;
}

/** The classic bar, played the way the other sims do: hold while the fish is above the zone centre. */
export function playClassic(fish: FishProfile, bot: Bot, seed: number, gear: BarGear): Played {
  const rng = seededRng(seed);
  const noiseRng = seededRng(seed + 7919);
  let s = newCatchBar(fish, gear, rng);
  const q: boolean[] = [];
  const d = Math.round(bot.delayMs / TICK);
  for (let ms = 0; ms < 90_000; ms += TICK) {
    q.push(s.fish - s.zone + (bot.noise ? (noiseRng() * 2 - 1) * bot.noise : 0) > 0);
    s = tickCatchBar(s, TICK, q.length > d ? q.shift()! : false, fish, gear, rng);
    const r = barResult(s);
    if (r === 'caught') return { caught: true, perfect: isPerfect(s), ms, how: 'caught' };
    if (r === 'lost') return { caught: false, perfect: false, ms, how: 'lost' };
  }
  return { caught: false, perfect: false, ms: 90_000, how: 'timeout' };
}

/**
 * The line fight, played with the thumb: pulses (hold, release, hold) to keep the needle in the gold. She sees the tension, how fast it moves and
 * whether a surge or a cut is showing; she holds while the needle (where it will be when her thumb lands) is below the target in the gold, lets go above it
 * or at a telegraph. Every press and release lands `delayMs` late with +-`jitterMs` of timing noise.
 */
export function playLine(fish: FishProfile, bot: Bot, seed: number, gear: BarGear, startM: number, speciesId?: string, trace?: string[], calmMul?: number): Played {
  const rng = seededRng(seed);
  const reactRng = seededRng(seed + 104729);
  let s: LineFightState = newLineFight(rng, startM, speciesId, fish, gear, calmMul);
  let holding = true;
  let switchAt = -1;
  let prevT = s.tension;
  let vel = 0; // tension change per ms, smoothed
  for (let ms = 0; ms < 120_000; ms += TICK) {
    vel = vel * 0.8 + ((s.tension - prevT) / TICK) * 0.2;
    prevT = s.tension;
    const target = s.goldLo + (s.goldHi - s.goldLo) * 0.5;
    const surging = s.phase === 'warn' || s.phase === 'hush' || s.phase === 'run' || s.cutWarn > 0;
    // Where the needle will be when the thumb lands (it keeps moving the way it moves now).
    const ahead = s.tension + vel * bot.delayMs;
    const want = !surging && ahead < target;
    if (want === holding) switchAt = -1;
    else if (switchAt < 0) switchAt = ms + bot.delayMs + (reactRng() * 2 - 1) * bot.jitterMs + (reactRng() < bot.lapse ? 600 : 0);
    if (switchAt >= 0 && ms >= switchAt) {
      holding = want;
      switchAt = -1;
    }
    s = tickLineFight(s, TICK, holding, fish, gear, rng);
    if (trace && ms % 200 < TICK) trace.push(`${(ms / 1000).toFixed(1)}s T=${s.tension.toFixed(2)} ${holding ? 'HOLD' : '    '} ${s.phase.padEnd(4)} cut=${s.cutWarn > 0 ? 1 : 0} dist=${s.distanceM.toFixed(1)} slack=${s.slackS.toFixed(2)} red=${s.redS.toFixed(2)} gold=${(s.goldMs / Math.max(1, s.timedMs)).toFixed(2)}`);
    if (s.result === 'caught') return { caught: true, perfect: isPerfectLine(s), ms, how: 'caught', redMs: s.redTotalMs, slackMs: s.slackTotalMs };
    if (s.result !== 'fighting') return { caught: false, perfect: false, ms, how: s.result, redMs: s.redTotalMs, slackMs: s.slackTotalMs };
  }
  return { caught: false, perfect: false, ms: 120_000, how: 'timeout' };
}

/** A player who never lets go / never holds (the line fight must beat both on anything but the easiest fish). */
export function playFixed(fish: FishProfile, hold: boolean, seed: number, gear: BarGear, startM: number): Played {
  const rng = seededRng(seed);
  let s = newLineFight(rng, startM, undefined, fish, gear);
  for (let ms = 0; ms < 120_000; ms += TICK) {
    s = tickLineFight(s, TICK, hold, fish, gear, rng);
    if (s.result === 'caught') return { caught: true, perfect: false, ms, how: 'caught' };
    if (s.result !== 'fighting') return { caught: false, perfect: false, ms, how: s.result };
  }
  return { caught: false, perfect: false, ms: 120_000, how: 'timeout' };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const TOP: BarGear = { ...RODS[2].barGear, lineDrain: RODS[2].barGear.lineDrain * LINES[1].drain, reelResponse: RODS[2].barGear.reelResponse * REELS[1].response };
const [BAMBOO, FIBER, CARBON] = RODS.map((r) => r.barGear);
void STARTER_BAR_GEAR;

/** A fish of this species at a rolled size, and where it was hooked: 8 m in the shallows, 20 m in the deep (the economy sim's casts). */
const profileOf = (id: string, seed: number): { fish: FishProfile; startM: number } => {
  const sp = speciesById(id)!;
  return { fish: fightProfile(sp, rollLength(sp, seededRng(seed * 977))), startM: sp.zone === 'deep' ? 20 : 8 };
};

interface Cell {
  catchShare: number;
  medianS: number;
  perfect: number;
  how: Record<string, number>;
  redMs: number;
  slackMs: number;
}
function cell(id: string, style: 'classic' | 'line', bot: Bot, gear: BarGear, n = N, calmMul?: number): Cell {
  const rs = seeds(n).map((seed) => {
    const { fish, startM } = profileOf(id, seed);
    return style === 'classic' ? playClassic(fish, bot, seed, gear) : playLine(fish, bot, seed, gear, startM, id, undefined, calmMul);
  });
  const how: Record<string, number> = {};
  for (const r of rs) how[r.how] = (how[r.how] ?? 0) + 1;
  return {
    catchShare: rs.filter((r) => r.caught).length / n,
    medianS: median(rs.map((r) => (r.caught ? r.ms : 120_000))) / 1000,
    perfect: rs.filter((r) => r.perfect).length / n,
    redMs: median(rs.map((r) => r.redMs ?? 0)),
    slackMs: median(rs.map((r) => r.slackMs ?? 0)),
    how,
  };
}

describe.skipIf(!ON)('line fight sim (SIM=1)', () => {
  it('decent bot: catch rate per species and rod, line vs classic', { timeout: 900_000 }, () => {
    const rows: string[] = ['species   zone    rod         classic catch/med s   line catch/med s   (line: slipped/snapped)   diff'];
    const worst: string[] = [];
    for (const sp of SPECIES) {
      if (ONLY && !ONLY.includes(sp.id)) continue;
      const sets: [string, BarGear][] = sp.zone === 'deep' ? [['fiberglass', FIBER], ['carbon', CARBON]] : [['bamboo', BAMBOO], ['fiberglass', FIBER]];
      if (sp.rarity === 'trophy') sets.push(['top gear', TOP]);
      for (const [label, gear] of sets) {
        const c = cell(sp.id, 'classic', DECENT, gear);
        const l = cell(sp.id, 'line', DECENT, gear);
        const diff = (l.catchShare - c.catchShare) * 100;
        rows.push(
          `${sp.id.padEnd(11)}${sp.zone.padEnd(8)}${label.padEnd(12)}${pct(c.catchShare).padStart(4)} ${c.medianS.toFixed(1).padStart(5)}s        ${pct(l.catchShare).padStart(4)} ${l.medianS.toFixed(1).padStart(5)}s        ${l.how.slipped ?? 0}/${l.how.snapped ?? 0} red ${l.redMs.toFixed(0)}ms slack ${l.slackMs.toFixed(0)}`.padEnd(100) + `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}`,
        );
        if (Math.abs(diff) > 10) worst.push(`${sp.id}/${label} ${diff.toFixed(0)}`);
      }
    }
    console.log(rows.join('\n') + '\nOUTSIDE +-10: ' + (worst.join(', ') || 'none'));
  });

  it('perfect rate: skilled bot, top gear', { timeout: 600_000 }, () => {
    const darting = ['bleak', 'perch', 'asp', 'pike'];
    const trophies = ['goldenTench', 'silverGhost', 'mossback'];
    const others = ['roach', 'rudd', 'crucian', 'eel', 'ide', 'bream', 'tench', 'carp', 'zander', 'burbot', 'catfish'];
    const rows: string[] = [];
    for (const [style, bot] of [['classic', SKILLED], ['line', SKILLED], ['line', DECENT]] as const) {
      const per = new Map<string, number>();
      for (const id of [...darting, ...trophies, ...others]) per.set(id, cell(id, style, bot, TOP).perfect);
      const avg = (ids: string[]) => pct(ids.reduce((s, id) => s + per.get(id)!, 0) / ids.length);
      rows.push(`${style} ${bot.delayMs} ms/noise ${bot.noise}: darting ${avg(darting)}, trophies ${avg(trophies)}, others ${avg(others)}`);
      rows.push('   ' + [...per].map(([id, v]) => `${id} ${pct(v)}`).join(', '));
    }
    console.log(rows.join('\n'));
  });

  it('never-hold and hold-forever lose on a mid fish', { timeout: 300_000 }, () => {
    const rows: string[] = [];
    for (const id of ['roach', 'perch', 'ide', 'asp', 'bream', 'carp', 'pike', 'catfish']) {
      const hold = seeds(60).map((seed) => playFixed(profileOf(id, seed).fish, true, seed, id === 'bream' || profileOf(id, 1).startM > 8 ? FIBER : BAMBOO, profileOf(id, seed).startM));
      const never = seeds(60).map((seed) => playFixed(profileOf(id, seed).fish, false, seed, BAMBOO, profileOf(id, seed).startM));
      rows.push(`${id.padEnd(8)} hold forever: caught ${pct(hold.filter((r) => r.caught).length / 60)}   never hold: caught ${pct(never.filter((r) => r.caught).length / 60)}`);
    }
    console.log(rows.join('\n'));
  });
});

/** The river's species and the rod each is fished with (a shallow fish with bamboo and fiberglass, the pool's barbel and the trophies with fiberglass and carbon). */
const RIVER_SIM: [string, [string, BarGear][]][] = [
  ['trout', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['grayling', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['nase', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['chub', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['barbel', [['fiberglass', FIBER], ['carbon', CARBON]]],
  ['vimba', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['asp', [['bamboo', BAMBOO], ['fiberglass', FIBER]]],
  ['ferryPike', [['bamboo', BAMBOO], ['fiberglass', FIBER], ['top gear', TOP]]],
  ['lantern', [['bamboo', BAMBOO], ['fiberglass', FIBER], ['top gear', TOP]]],
  ['barbelKing', [['fiberglass', FIBER], ['carbon', CARBON], ['top gear', TOP]]],
  ['ferryman', [['carbon', CARBON], ['top gear', TOP]]],
];

describe.skipIf(!ON)('river current sim (slice 25c, SIM=1)', () => {
  it('decent bot: catch rate at the river, without and with the current surges (dry, rain)', { timeout: 900_000 }, () => {
    // SIM_MUL=0.9 SIM_RAINMUL=0.9 tries other numbers; SIM_ONLY limits the species.
    const dry = Number(process.env.SIM_MUL ?? RIVER_CURRENT.fightEveryMul);
    const rain = dry * Number(process.env.SIM_RAINMUL ?? RIVER_CURRENT.rainFightEveryMul);
    const rows: string[] = [`species     rod         without    dry (x${dry})     rain (x${rain.toFixed(3)})    drop dry / rain (points)`];
    let worst = 0;
    for (const [id, sets] of RIVER_SIM) {
      if (ONLY && !ONLY.includes(id)) continue;
      for (const [label, gear] of sets) {
        const a = cell(id, 'line', DECENT, gear);
        const trophy = speciesById(id)!.rarity === 'trophy' || speciesById(id)!.rarity === 'legendary';
        // The game passes no multiplier for a trophy (core/current.ts fightEveryMul); SIM_TROPHIES=1 forces it on to show why.
        const forced = process.env.SIM_TROPHIES === '1';
        const b = cell(id, 'line', DECENT, gear, N, trophy && !forced ? undefined : dry);
        const c = cell(id, 'line', DECENT, gear, N, trophy && !forced ? undefined : rain);
        const dd = (a.catchShare - b.catchShare) * 100;
        const dr = (a.catchShare - c.catchShare) * 100;
        worst = Math.max(worst, dd, dr);
        rows.push(`${id.padEnd(11)} ${label.padEnd(11)} ${pct(a.catchShare).padStart(4)}       ${pct(b.catchShare).padStart(4)}          ${pct(c.catchShare).padStart(4)}            ${dd.toFixed(0)} / ${dr.toFixed(0)}`);
      }
    }
    console.log([...rows, `WORST DROP: ${worst.toFixed(1)} points`].join(String.fromCharCode(10)));
  });
});

describe.skipIf(!ON)('river bite timing (slice 25c, SIM=1)', () => {
  it('mean seconds to the first bite per band: still water, a drifting bobber that never settles, a settled one, and the real run (flow 1, rain 1.6)', { timeout: 300_000 }, () => {
    const n = 400;
    const meanS = (loc: Location, distanceM: number, flow: number, startDrift: number): number => {
      let total = 0;
      for (let seed = 1; seed <= n; seed++) {
        const ctx: SessionContext = { location: loc, rod: RODS[2], barGear: CARBON, rng: seededRng(seed), timeOfDay: () => 'day', flow: () => flow };
        let state: FishingState = step({ kind: 'casting', power: 1, distanceM, zone: zoneAt(loc, distanceM).fishZone }, { type: 'landed' }, ctx).state;
        if (loc.current) state = { ...state, drift: startDrift } as FishingState;
        let ms = 0;
        while (state.kind === 'waiting' && ms < 900_000) {
          state = step(state, { type: 'tick', dtMs: 25 }, ctx).state;
          ms += 25;
        }
        total += ms;
      }
      return total / n / 1000;
    };
    const quick: Location = { ...RIVER_BEND, current: { ...RIVER_CURRENT, runS: 12 } };
    const rows = ['band (cast)        Quiet Lake   river, stays at landing   river, settled   river, real run (runS 30)   river, runS 12 (flow 1 / rain 1.6)'];
    for (const [name, m, lakeM] of [['riffle 6 m', 6, 6], ['seam 20 m', 20, 20], ['pool 32 m', 32, 32]] as const) {
      rows.push(
        `${name.padEnd(18)} ${meanS(QUIET_LAKE, lakeM, 1, 0).toFixed(1).padStart(8)}s   ${meanS(RIVER_BEND, m, 0, 0).toFixed(1).padStart(12)}s            ${meanS(RIVER_BEND, m, 0, 1).toFixed(1).padStart(8)}s       ${meanS(RIVER_BEND, m, 1, 0).toFixed(1).padStart(8)}s            ${meanS(quick, m, 1, 0).toFixed(1).padStart(6)}s / ${meanS(quick, m, 1.6, 0).toFixed(1).padStart(5)}s`,
      );
    }
    console.log(rows.join(String.fromCharCode(10)));
  });
});

describe.skipIf(!ON)('river gear (slice 25g, SIM=1)', () => {
  it('mean seconds to the first bite and the share of waits that reach the eddy before it, per band, with no gear / float / lead / both (real run, flow 1)', { timeout: 300_000 }, () => {
    const n = 400;
    const combos: [string, RiverGearOwned][] = [
      ['none', { float: false, lead: false }],
      ['float', { float: true, lead: false }],
      ['lead', { float: false, lead: true }],
      ['both', { float: true, lead: true }],
    ];
    const cell = (distanceM: number, gear: RiverGearOwned): { meanS: number; settledPct: number } => {
      let total = 0;
      let settled = 0;
      for (let seed = 1; seed <= n; seed++) {
        const ctx: SessionContext = { location: RIVER_BEND, rod: RODS[2], barGear: CARBON, rng: seededRng(seed), timeOfDay: () => 'day', flow: () => 1, riverGear: () => gear };
        let state: FishingState = step({ kind: 'casting', power: 1, distanceM, zone: zoneAt(RIVER_BEND, distanceM).fishZone }, { type: 'landed' }, ctx).state;
        let ms = 0;
        let reachedEddy = false;
        while (state.kind === 'waiting' && ms < 900_000) {
          state = step(state, { type: 'tick', dtMs: 25 }, ctx).state;
          if ((state as { drift?: number }).drift === 1) reachedEddy = true;
          ms += 25;
        }
        total += ms;
        if (reachedEddy) settled++;
      }
      return { meanS: total / n / 1000, settledPct: (settled / n) * 100 };
    };
    const rows = ['band (cast)        ' + combos.map(([name]) => name.padStart(14)).join('')];
    for (const [name, m] of [['riffle 6 m', 6], ['seam 20 m', 20], ['pool 32 m', 32]] as const) {
      rows.push(name.padEnd(18) + combos.map(([, g]) => { const c = cell(m, g); return `${c.meanS.toFixed(1)}s/${c.settledPct.toFixed(0)}%`.padStart(14); }).join(''));
    }
    console.log(rows.join(String.fromCharCode(10)));
  });
});

void POOL_SPECIES;

describe.skipIf(process.env.PROBE === undefined)('probe', () => {
  it('trace', () => {
    const id = process.env.PROBE!;
    const { fish, startM } = profileOf(id, Number(process.env.SEED ?? 3));
    const trace: string[] = [`d=${fish.difficulty.toFixed(2)} ${fish.pattern}`];
    const r = playLine(fish, process.env.BOT === 'skilled' ? SKILLED : DECENT, Number(process.env.SEED ?? 3), process.env.ROD === 'bamboo' ? BAMBOO : FIBER, startM, id, trace);
    console.log(trace.join(String.fromCharCode(10)) + ' ' + JSON.stringify(r));
  });
});
