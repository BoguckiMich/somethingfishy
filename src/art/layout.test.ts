import { describe, expect, it } from 'vitest';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import { FAR_WATER_Y, ORIGIN_Y, ZONE_BOUNDARY_Y, distanceToY } from './layout';

describe('distanceToY', () => {
  const max = QUIET_LAKE.maxDistanceM;

  it('has the right endpoints', () => {
    expect(distanceToY(0)).toBe(ORIGIN_Y);
    expect(distanceToY(max)).toBeCloseTo(FAR_WATER_Y, 6);
  });

  it('is strictly monotonic (farther is higher on screen)', () => {
    let prev = distanceToY(0);
    for (let d = 0.5; d <= max; d += 0.5) {
      const y = distanceToY(d);
      expect(y).toBeLessThan(prev);
      prev = y;
    }
  });

  it('gives the shallow zone about half of the water in front of the dock', () => {
    const share = (ORIGIN_Y - ZONE_BOUNDARY_Y) / (ORIGIN_Y - FAR_WATER_Y);
    expect(share).toBeGreaterThanOrEqual(0.45);
    expect(share).toBeLessThanOrEqual(0.55);
  });

  it('puts a full-power starter cast just inside the shallow zone', () => {
    const y = distanceToY(RODS[0].maxCastM);
    expect(y).toBeGreaterThan(ZONE_BOUNDARY_Y);
    expect(y - ZONE_BOUNDARY_Y).toBeLessThan(40);
  });
});
