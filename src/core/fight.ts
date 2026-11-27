import { barResult, isPerfect, newCatchBar, tickCatchBar, type CatchBarState, type FishProfile } from './catchBar';
import type { BarGear } from './gear';
import { isPerfectLine, newLineFight, tickLineFight, type LineFightState } from './lineFight';
import type { Rng } from './random';
import { seededRng } from './random';

/**
 * The one seam between the two catch styles (slice 28). The fishing session only talks to these three functions, so the fight's style
 * is decided here and nowhere else: "classic" is the vertical catch bar, "line" is the feel-the-line fight (core/lineFight.ts).
 * Both end in the same outcome, which the session turns into the same `fishCaught` / `fishLost` events.
 */
export type CatchStyle = 'classic' | 'line';
export const CATCH_STYLES: readonly CatchStyle[] = ['classic', 'line'];
export const DEFAULT_CATCH_STYLE: CatchStyle = 'line';

/**
 * The state of a running fight. `bar` is the classic bar; in the line style it stays an inert placeholder (only `holding` and
 * `elapsedMs` are kept in step) and `line` carries the fight.
 */
export interface FightState {
  bar: CatchBarState;
  line?: LineFightState;
}

export type FightOutcome =
  | { kind: 'fighting' }
  | { kind: 'caught'; perfect: boolean; fightMs: number }
  /** `slipped`: the hook came off (a trophy that got away, or the line hung slack too long). `snapped`: the line broke (line style only). */
  | { kind: 'lost'; slipped: boolean; snapped: boolean };

/** Starts a fight. `distanceM` is where the fish was hooked; `speciesId` picks a trophy's signature move (line style). */
export function beginFight(style: CatchStyle, fish: FishProfile, gear: BarGear, rng: Rng, distanceM: number, speciesId?: string): FightState {
  if (style === 'line') {
    const line = newLineFight(rng, distanceM, speciesId, fish, gear);
    return { bar: { ...newCatchBar(fish, gear, seededRng(1)), holding: true }, line };
  }
  return { bar: { ...newCatchBar(fish, gear, rng), holding: true } }; // the hooking press is still down
}

/** The thumb went down or up. */
export function holdFight(f: FightState, holding: boolean): FightState {
  return { ...f, bar: { ...f.bar, holding }, ...(f.line ? { line: { ...f.line, holding } } : {}) };
}

/** Advances a fight by `dtMs` with the thumb as it was. */
export function tickFight(f: FightState, dtMs: number, fish: FishProfile, gear: BarGear, rng: Rng): { fight: FightState; outcome: FightOutcome } {
  if (f.line) {
    const line = tickLineFight(f.line, dtMs, f.bar.holding, fish, gear, rng);
    const fight: FightState = { bar: { ...f.bar, elapsedMs: line.elapsedMs }, line };
    if (line.result === 'caught') return { fight, outcome: { kind: 'caught', perfect: isPerfectLine(line), fightMs: line.elapsedMs } };
    if (line.result === 'fighting') return { fight, outcome: { kind: 'fighting' } };
    if (line.result === 'escaped') return { fight, outcome: { kind: 'lost', slipped: false, snapped: false } };
    // The hook slipping (slack too long) is a slip, and a trophy keeps its "slips away" loss whichever way the fight went wrong.
    return { fight, outcome: { kind: 'lost', slipped: line.result === 'slipped' || fish.slipAfterMs !== undefined, snapped: line.result === 'snapped' } };
  }
  const bar = tickCatchBar(f.bar, dtMs, f.bar.holding, fish, gear, rng);
  const fight: FightState = { bar };
  const r = barResult(bar);
  if (r === 'caught') return { fight, outcome: { kind: 'caught', perfect: isPerfect(bar), fightMs: bar.elapsedMs } };
  if (r === 'lost') return { fight, outcome: { kind: 'lost', slipped: bar.slipped, snapped: false } };
  return { fight, outcome: { kind: 'fighting' } };
}
