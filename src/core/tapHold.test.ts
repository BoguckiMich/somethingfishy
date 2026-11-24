import { describe, expect, it } from 'vitest';
import { MIN_HOLD_MS } from './casting';
import { resolveRelease } from './tapHold';

describe('resolveRelease', () => {
  it('a short tap that ends on the object it started on is the object action', () => {
    expect(resolveRelease(100, 'sign', 'sign')).toBe('action');
    expect(resolveRelease(0, 'chair', 'chair')).toBe('action');
  });
  it('a hold casts, wherever the finger ends', () => {
    expect(resolveRelease(MIN_HOLD_MS, 'sign', 'sign')).toBe('cast');
    expect(resolveRelease(400, 'car', null)).toBe('cast');
    expect(resolveRelease(400, null, null)).toBe('cast');
  });
  it('a short press that slid off the object, or never touched one, is just a tap', () => {
    expect(resolveRelease(100, 'sign', null)).toBe('tooShort');
    expect(resolveRelease(100, 'sign', 'car')).toBe('tooShort');
    expect(resolveRelease(100, null, null)).toBe('tooShort');
  });
});
