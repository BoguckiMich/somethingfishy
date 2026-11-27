import { describe, expect, it } from 'vitest';
import { LURES } from '../core/data/spinning';
import { followerGapM } from '../core/spinning';
import { BOBBER_X, ORIGIN_Y, distanceToY } from './layout';
import { LURE_COLOURS, crankFrame, followerPose, glintLook, lureScreenPos, shadowLengthPx, spinRodMotion } from './spinFx';

describe('lureScreenPos', () => {
  it('puts a lake lure in the landing column at the distance mapping, a few px under the surface', () => {
    const p = lureScreenPos(12, 0);
    expect(p.x).toBe(BOBBER_X);
    expect(p.y).toBe(distanceToY(12) + glintLook(0, false, 0).sinkPx);
  });
  it('follows the river drift (x and the band bend)', () => {
    const p = lureScreenPos(12, 0, { x: 140, dy: -3 });
    expect(p.x).toBe(140);
    expect(p.y).toBe(distanceToY(12) - 3 + glintLook(0, false, 0).sinkPx);
  });
  it('reaches the rod end at 0 m', () => {
    expect(lureScreenPos(0, 0).y).toBeLessThanOrEqual(ORIGIN_Y + 2);
  });
  it('sinks lower with depth', () => {
    expect(lureScreenPos(10, 1).y).toBeGreaterThan(lureScreenPos(10, 0).y);
  });
});

describe('glintLook', () => {
  it('dims and sinks as the lure goes down', () => {
    const top = glintLook(0, false, 0);
    const mid = glintLook(0.5, false, 0);
    const bottom = glintLook(1, false, 0);
    expect(top.alpha).toBeGreaterThan(mid.alpha);
    expect(mid.alpha).toBeGreaterThan(bottom.alpha);
    expect(bottom.alpha).toBeGreaterThan(0.2); // still findable on the bottom
    expect(bottom.sinkPx).toBeGreaterThan(top.sinkPx);
  });
  it('twinkles only near the surface', () => {
    expect(glintLook(1, true, 0).sparkle).toBe(false);
    const seen = new Set([0, 160, 320, 480].map((t) => glintLook(0.1, true, t).sparkle));
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
  });
  it('clamps a depth out of range', () => {
    expect(glintLook(2, false, 0)).toEqual(glintLook(1, false, 0));
    expect(glintLook(-1, false, 0)).toEqual(glintLook(0, false, 0));
  });
});

describe('the follower', () => {
  it('is a bigger shadow for a bigger fish, bigger when near the dock', () => {
    expect(shadowLengthPx(80, 10)).toBeGreaterThan(shadowLengthPx(20, 10));
    expect(shadowLengthPx(40, 3)).toBeGreaterThan(shadowLengthPx(40, 28));
  });
  it('closes in on the lure the longer it follows', () => {
    const early = followerPose({ followMs: 0, lengthCm: 40 }, 15);
    const late = followerPose({ followMs: 2500, lengthCm: 40 }, 15);
    expect(early.gapPx).toBeGreaterThan(late.gapPx);
    expect(followerGapM({ followMs: 2500 })).toBeLessThan(followerGapM({ followMs: 0 }));
  });
  it('a dart back (a nip) widens the gap', () => {
    expect(followerPose({ followMs: 1000, lengthCm: 40 }, 15, 12).gapPx).toBeGreaterThan(followerPose({ followMs: 1000, lengthCm: 40 }, 15).gapPx);
  });
});

describe('the rod and the crank', () => {
  it('jolts up on a strike and bends hard on a snag', () => {
    const calm = spinRodMotion(false, 1000, 0, false);
    const jolt = spinRodMotion(false, 1000, 1, false);
    expect(jolt.dy).toBeLessThan(calm.dy);
    expect(spinRodMotion(true, 0, 0, true).bend).toBeGreaterThan(jolt.bend);
  });
  it('alternates the crank frame about six times a second', () => {
    const frames = [0, 100, 170, 330, 500].map(crankFrame);
    expect(frames).toEqual([0, 0, 1, 0, 1]);
  });
});

describe('lure colours', () => {
  it('every lure has a glint colour', () => {
    for (const l of LURES) expect(LURE_COLOURS[l.id]).toBeDefined();
  });
});
