import { describe, expect, it } from 'vitest';
import { MIN_HOLD_MS } from './casting';
import { OBJECT_HOLD_MS, objectPressOutcome, resolveRelease } from './tapHold';

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

describe('objectPressOutcome', () => {
  it('stays pending while the finger is on the object and the hold is short', () => {
    expect(objectPressOutcome(0, true)).toBe('pending');
    expect(objectPressOutcome(OBJECT_HOLD_MS - 1, true)).toBe('pending');
  });
  it('starts the charge once held long enough', () => {
    expect(objectPressOutcome(OBJECT_HOLD_MS, true)).toBe('charge');
    expect(objectPressOutcome(2000, true)).toBe('charge');
  });
  it('starts the charge at once when the finger slides off the object', () => {
    expect(objectPressOutcome(10, false)).toBe('charge');
  });
});
