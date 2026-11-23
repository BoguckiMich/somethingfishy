import { describe, expect, it } from 'vitest';
import { advanceReel, REEL_PRIMED } from './reelClicks';

describe('advanceReel', () => {
  it('clicks at once when reeling starts, then at the interval', () => {
    let r = advanceReel(REEL_PRIMED, 16, true, 100);
    expect(r.clicks).toBe(1);
    let clicks = r.clicks;
    for (let t = 16; t < 1000; t += 16) {
      r = advanceReel(r.acc, 16, true, 100);
      clicks += r.clicks;
    }
    expect(clicks).toBeGreaterThanOrEqual(9);
    expect(clicks).toBeLessThanOrEqual(11);
  });

  it('is silent when not reeling and primed for the next press', () => {
    const r = advanceReel(40, 500, false, 100);
    expect(r.clicks).toBe(0);
    expect(r.acc).toBe(REEL_PRIMED);
  });

  it('never bursts after a long frame', () => {
    expect(advanceReel(0, 5000, true, 100).clicks).toBe(1);
  });
});
