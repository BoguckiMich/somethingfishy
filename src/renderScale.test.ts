import { describe, expect, it } from 'vitest';
import { MAX_RENDER_SCALE, renderScaleFor } from './renderScaleMath';

describe('render scale', () => {
  it('is capped at 3', () => {
    expect(MAX_RENDER_SCALE).toBe(3);
    expect(renderScaleFor(1, 4)).toBe(3);
    expect(renderScaleFor(2, 3)).toBe(3);
    expect(renderScaleFor(1.8, 3)).toBe(3);
  });
  it('rounds up, never below 1, and 3.001 does not tip over', () => {
    expect(renderScaleFor(1, 1)).toBe(1);
    expect(renderScaleFor(0.5, 1)).toBe(1);
    expect(renderScaleFor(1, 1.5)).toBe(2);
    expect(renderScaleFor(1.0003, 3)).toBe(3);
  });
});
