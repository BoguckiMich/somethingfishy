import { describe, expect, it } from 'vitest';
import { MAP_PLACES, MAP_SIZE, QUIET_LAKE } from './locations';

describe('road map places', () => {
  it('has exactly one open place, Quiet Lake', () => {
    const open = MAP_PLACES.filter((p) => p.status === 'open');
    expect(open.map((p) => p.id)).toEqual([QUIET_LAKE.id]);
  });

  it('has unique ids and text for every place', () => {
    expect(new Set(MAP_PLACES.map((p) => p.id)).size).toBe(MAP_PLACES.length);
    for (const p of MAP_PLACES) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  it('keeps every pin inside the map picture, with room for the pin sprite above it', () => {
    for (const p of MAP_PLACES) {
      expect(p.pin.x).toBeGreaterThanOrEqual(8);
      expect(p.pin.x).toBeLessThanOrEqual(MAP_SIZE.w - 8);
      expect(p.pin.y).toBeGreaterThanOrEqual(14);
      expect(p.pin.y).toBeLessThanOrEqual(MAP_SIZE.h - 1);
    }
  });
});
