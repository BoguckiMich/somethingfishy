import { describe, expect, it } from 'vitest';
import { canOpenMap, napAvailable } from './carMap';

describe('canOpenMap', () => {
  const ok = { fishing: 'idle', panelOpen: false, fading: false };
  it('opens while idle or waiting', () => {
    expect(canOpenMap(ok)).toBe(true);
    expect(canOpenMap({ ...ok, fishing: 'waiting' })).toBe(true);
  });
  it('not during a cast, bite, fight, show-off or loss', () => {
    for (const fishing of ['charging', 'casting', 'bite', 'fighting', 'caught', 'lost', 'retrieving']) expect(canOpenMap({ ...ok, fishing })).toBe(false);
  });
  it('not with a panel open or the sleep fade running', () => {
    expect(canOpenMap({ ...ok, panelOpen: true })).toBe(false);
    expect(canOpenMap({ ...ok, fading: true })).toBe(false);
  });
});

describe('napAvailable', () => {
  const dock = { fishing: 'idle', mode: 'dock', asleepInCar: false };
  it('on the dock with Alex idle', () => expect(napAvailable(dock)).toEqual({ available: true, reason: '' }));
  it('says why not while they play fetch', () => {
    for (const mode of ['play', 'leaving', 'returning']) expect(napAvailable({ ...dock, mode })).toEqual({ available: false, reason: '{companion} is busy playing' });
  });
  it('says why not while asleep or on the way', () => {
    expect(napAvailable({ ...dock, mode: 'bed', asleepInCar: true }).reason).toBe("They're already asleep");
    expect(napAvailable({ ...dock, mode: 'bed' }).available).toBe(false);
  });
  it('not while the bobber waits', () => {
    expect(napAvailable({ ...dock, fishing: 'waiting' })).toEqual({ available: false, reason: 'Reel in first' });
  });
});
