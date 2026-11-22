import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import { QUIET_LAKE } from './data/locations';
import { RODS } from './data/rods';
import { INITIAL_STATE, step, type FishingEvent, type FishingState, type SessionContext } from './fishingSession';
import { zoneAt } from './location';

const [bamboo, , carbon] = RODS;

function run(events: FishingEvent[], ctx: SessionContext): FishingState {
  return events.reduce((s, e) => step(s, e, ctx), INITIAL_STATE);
}

const fullPowerCast: FishingEvent[] = [
  { type: 'press' },
  { type: 'tick', dtMs: CHARGE_HALF_CYCLE_MS },
  { type: 'release' },
];

describe('fishing session', () => {
  it('goes idle → charging → casting → waiting → retrieving → idle', () => {
    const ctx = { location: QUIET_LAKE, rod: bamboo };
    let s = run(fullPowerCast, ctx);
    expect(s.kind).toBe('casting');
    s = step(s, { type: 'landed' }, ctx);
    expect(s.kind).toBe('waiting');
    s = step(s, { type: 'press' }, ctx);
    expect(s.kind).toBe('retrieving');
    s = step(s, { type: 'retrieved' }, ctx);
    expect(s).toEqual(INITIAL_STATE);
  });

  it('starter rod at full power stays in shallow water', () => {
    const s = run(fullPowerCast, { location: QUIET_LAKE, rod: bamboo });
    expect(s).toMatchObject({ kind: 'casting', zone: 'shallow', distanceM: bamboo.maxCastM });
  });

  it('best rod at full power reaches deep water', () => {
    const s = run(fullPowerCast, { location: QUIET_LAKE, rod: carbon });
    expect(s).toMatchObject({ kind: 'casting', zone: 'deep' });
  });

  it('ignores events that do not apply to the current state', () => {
    const ctx = { location: QUIET_LAKE, rod: bamboo };
    expect(step(INITIAL_STATE, { type: 'release' }, ctx)).toBe(INITIAL_STATE);
    const casting = run(fullPowerCast, ctx);
    expect(step(casting, { type: 'press' }, ctx)).toBe(casting);
  });
});

describe('zoneAt', () => {
  it('maps distances to zones, clamping past the end', () => {
    expect(zoneAt(QUIET_LAKE, 0).id).toBe('shallow');
    expect(zoneAt(QUIET_LAKE, 14.9).id).toBe('shallow');
    expect(zoneAt(QUIET_LAKE, 15).id).toBe('deep');
    expect(zoneAt(QUIET_LAKE, 999).id).toBe('deep');
  });
});
