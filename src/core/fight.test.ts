import { describe, expect, it } from 'vitest';
import type { FishProfile } from './catchBar';
import { STARTER_BAR_GEAR } from './data/barGear';
import { LINE_FIGHT_TUNING as T } from './data/lineFight';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import type { GameEvent } from './events';
import { beginFight, holdFight, tickFight, type CatchStyle } from './fight';
import { step, type FishingState, type SessionContext } from './fishingSession';
import type { HookedFish } from './fish';
import { seededRng } from './random';

const PERCH: HookedFish = { speciesId: 'perch', lengthCm: 24, weightG: 210 };
const biteState: FishingState = { kind: 'bite', distanceM: 10, zone: 'shallow', hooked: PERCH, windowLeftMs: 1000 };
const EASY: FishProfile = { pattern: 'smooth', difficulty: 0.05 };

function ctxWith(style: CatchStyle | (() => CatchStyle), fishOverride?: FishProfile): SessionContext {
  return {
    location: QUIET_LAKE,
    rod: RODS[0],
    barGear: STARTER_BAR_GEAR,
    rng: seededRng(1),
    timeOfDay: () => 'day',
    catchStyle: typeof style === 'function' ? style : () => style,
    fishOverride,
  };
}

/** Plays a fight with a thumb rule (reading the state) until `until`, collecting events. */
function play(ctx: SessionContext, thumb: (s: FishingState) => boolean, until: (s: FishingState) => boolean = (s) => s.kind !== 'fighting') {
  let state = step(biteState, { type: 'press' }, ctx).state;
  const events: GameEvent[] = [];
  for (let i = 0; i < 40_000 && !until(state); i++) {
    if (state.kind === 'fighting') {
      const want = thumb(state);
      if (want !== (state.bar.holding)) state = step(state, { type: want ? 'press' : 'release' }, ctx).state;
    }
    const r = step(state, { type: 'tick', dtMs: 16 }, ctx);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const decentLine = (s: FishingState): boolean => {
  if (s.kind !== 'fighting' || !s.line) return true;
  return s.line.phase !== 'warn' && s.line.phase !== 'run' && s.line.tension < (T.goldBand[0] + T.goldBand[1]) / 2;
};

describe('catch style seam (core/fight.ts)', () => {
  it('classic keeps the catch bar and no line fight', () => {
    const f = beginFight('classic', EASY, STARTER_BAR_GEAR, seededRng(1), 10);
    expect(f.line).toBeUndefined();
    expect(f.bar.progress).toBe(0.3);
    expect(f.bar.holding).toBe(true);
  });

  it('line carries a line fight from the hook distance, with the thumb still down', () => {
    const f = beginFight('line', EASY, STARTER_BAR_GEAR, seededRng(1), 14, 'perch');
    expect(f.line?.distanceM).toBe(14);
    expect(f.line?.holding).toBe(true);
    expect(holdFight(f, false).line?.holding).toBe(false);
    expect(holdFight(f, false).bar.holding).toBe(false);
  });

  it('both styles give the same kind of outcome', () => {
    for (const style of ['classic', 'line'] as const) {
      const rng = seededRng(3);
      let f = beginFight(style, EASY, STARTER_BAR_GEAR, rng, 8);
      let last = tickFight(f, 16, EASY, STARTER_BAR_GEAR, rng);
      for (let i = 0; i < 20_000 && last.outcome.kind === 'fighting'; i++) {
        f = last.fight;
        if (f.line ? decentLine({ kind: 'fighting', distanceM: 8, zone: 'shallow', hooked: PERCH, fish: EASY, ...f }) !== f.bar.holding : false) f = holdFight(f, !f.bar.holding);
        else if (!f.line) f = holdFight(f, f.bar.fish > f.bar.zone);
        last = tickFight(f, 16, EASY, STARTER_BAR_GEAR, rng);
      }
      expect(last.outcome.kind, style).toBe('caught');
    }
  });
});

describe('the session with the line style', () => {
  it('hooking starts a line fight and emits the same hooked event', () => {
    const r = step(biteState, { type: 'press' }, ctxWith('line', EASY));
    expect(r.events).toEqual([{ type: 'hooked', zone: 'shallow' }]);
    expect(r.state.kind).toBe('fighting');
    if (r.state.kind === 'fighting') expect(r.state.line?.distanceM).toBe(10);
  });

  it('a won fight emits the same fishCaught event as the classic bar, with the perfect flag', () => {
    const lineRun = play(ctxWith('line', EASY), decentLine);
    expect(lineRun.state.kind).toBe('caught');
    const caught = lineRun.events.find((e) => e.type === 'fishCaught');
    expect(caught).toMatchObject({ type: 'fishCaught', zone: 'shallow', pattern: 'smooth', speciesId: 'perch', lengthCm: 24, weightG: 210, perfect: true });
    const classic = play(ctxWith('classic', EASY), (s) => s.kind === 'fighting' && s.bar.fish > s.bar.zone);
    const c = classic.events.find((e) => e.type === 'fishCaught');
    expect(Object.keys(caught!).sort()).toEqual(Object.keys(c!).sort().filter((k) => k !== 'perfect' || 'perfect' in caught!));
  });

  it('letting go for good ends in a lost fish (slack) with the same fishLost event', () => {
    const r = play(ctxWith('line', EASY), () => false);
    expect(r.state.kind).toBe('lost');
    const lost = r.events.find((e) => e.type === 'fishLost');
    expect(lost).toMatchObject({ type: 'fishLost', zone: 'shallow', speciesId: 'perch', slipped: true });
    expect(lost).not.toHaveProperty('snapped');
  });

  it('holding on through a hard fish snaps the line', () => {
    const hard: FishProfile = { pattern: 'sinker', difficulty: 0.9 };
    const r = play(ctxWith('line', hard), () => true);
    expect(r.state.kind).toBe('lost');
    expect(r.events.find((e) => e.type === 'fishLost')).toMatchObject({ snapped: true });
    expect(r.events.find((e) => e.type === 'fishLost')).not.toHaveProperty('slipped');
  });

  it('a trophy lost in the line fight keeps the slipped flag', () => {
    const trophy: FishProfile = { pattern: 'darting', difficulty: 0.8, slipAfterMs: 2500 };
    const r = play(ctxWith('line', trophy), () => false);
    expect(r.events.find((e) => e.type === 'fishLost')).toMatchObject({ slipped: true });
  });

  it('the style is read when the fight starts: switching mid-fight changes nothing', () => {
    let style: CatchStyle = 'line';
    const ctx = ctxWith(() => style, EASY);
    let state = step(biteState, { type: 'press' }, ctx).state;
    style = 'classic';
    for (let i = 0; i < 50; i++) state = step(state, { type: 'tick', dtMs: 16 }, ctx).state;
    expect(state.kind === 'fighting' && state.line !== undefined).toBe(true);
    // And the other way round.
    style = 'classic';
    let classic = step(biteState, { type: 'press' }, ctx).state;
    style = 'line';
    for (let i = 0; i < 50; i++) classic = step(classic, { type: 'tick', dtMs: 16 }, ctx).state;
    expect(classic.kind === 'fighting' && classic.line === undefined).toBe(true);
  });

  it('without a style callback the fight is classic', () => {
    const ctx = ctxWith('classic');
    delete ctx.catchStyle;
    const r = step(biteState, { type: 'press' }, ctx);
    expect(r.state.kind === 'fighting' && r.state.line === undefined).toBe(true);
  });

  it('press, release and cancel set the thumb in a line fight', () => {
    const ctx = ctxWith('line', EASY);
    let state = step(biteState, { type: 'press' }, ctx).state;
    state = step(state, { type: 'release' }, ctx).state;
    expect(state.kind === 'fighting' && state.line?.holding).toBe(false);
    state = step(state, { type: 'press' }, ctx).state;
    expect(state.kind === 'fighting' && state.line?.holding).toBe(true);
    state = step(state, { type: 'cancel' }, ctx).state;
    expect(state.kind === 'fighting' && state.line?.holding).toBe(false);
  });
});
