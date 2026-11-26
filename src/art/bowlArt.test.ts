import { describe, expect, it } from 'vitest';
import { BOWL_SIZE, bowlSprite } from './bowlArt';
import { allDogFrames, dogSprite } from './characters';
import { TRANSPARENT, type Sprite } from './pixelGrid';
import { QUIET_LAKE } from '../core/data/locations';
import { BED_SIZE } from './campArt';

const opaque = (s: Sprite) => s.pixels.filter((c) => c !== TRANSPARENT).length;
const differs = (a: Sprite, b: Sprite) => a.pixels.some((c, i) => c !== b.pixels[i]);

describe("Bestia's bowl", () => {
  it('is a small sprite of the size the layout counts on, with something on its feet row', () => {
    for (const full of [false, true]) {
      const s = bowlSprite(full);
      expect([s.width, s.height]).toEqual([BOWL_SIZE.w, BOWL_SIZE.h]);
      expect(opaque(s)).toBeGreaterThan(60);
      expect(s.pixels.slice((s.height - 1) * s.width).some((c) => c !== TRANSPARENT)).toBe(true);
    }
  });

  it('shows kibble only when a treat is in it', () => {
    expect(differs(bowlSprite(false), bowlSprite(true))).toBe(true);
  });

  it('is smaller than her bed and stands left of it, clear of it', () => {
    expect(BOWL_SIZE.w).toBeLessThan(BED_SIZE.w);
    const { bowl, camp } = QUIET_LAKE.spots;
    expect(bowl.x + BOWL_SIZE.w).toBeLessThan(camp.bed.x);
  });
});

describe('the eating dog', () => {
  it('has two munch frames per tail frame, each a different picture of the right size', () => {
    const eat = allDogFrames().filter((f) => f.shape === 'eat');
    expect(eat).toHaveLength(4);
    const a = dogSprite({ shape: 'eat', tail: 0, perked: false, step: 0 });
    const b = dogSprite({ shape: 'eat', tail: 0, perked: false, step: 1 });
    const c = dogSprite({ shape: 'eat', tail: 1, perked: false, step: 0 });
    expect(differs(a, b)).toBe(true);
    expect(differs(a, c)).toBe(true);
    expect([a.width, a.height]).toEqual([32, 24]);
  });

  it('keeps her head low: the lowest rows of the head are below the standing dog\'s head', () => {
    const lowest = (s: Sprite, x0: number) => {
      let y = -1;
      for (let r = 0; r < s.height; r++) for (let x = x0; x < s.width; x++) if (s.pixels[r * s.width + x] !== TRANSPARENT) y = Math.max(y, r);
      return y;
    };
    const topOf = (s: Sprite, x0: number) => {
      for (let r = 0; r < s.height; r++) for (let x = x0; x < s.width; x++) if (s.pixels[r * s.width + x] !== TRANSPARENT) return r;
      return -1;
    };
    const eat = dogSprite({ shape: 'eat', tail: 0, perked: false, step: 0 });
    const stand = dogSprite({ shape: 'stand', tail: 0, perked: false, step: 0 });
    expect(topOf(eat, 27)).toBeGreaterThan(topOf(stand, 27) + 6); // the snout end sits far lower than standing
    expect(lowest(eat, 27)).toBeLessThanOrEqual(23);
  });
});
