import { describe, expect, it } from 'vitest';
import { BAR_BORDER, BAR_INNER, barFrameSprite } from './catchBarArt';
import { PAL } from './palette';
import { coinSprite, gearSprite, wormSprite, zSprite } from './iconArt';
import { TRANSPARENT, type Sprite } from './pixelGrid';

const at = (s: Sprite, x: number, y: number) => s.pixels[y * s.width + x];
const colours = (s: Sprite) => new Set([...s.pixels].filter((c) => c !== TRANSPARENT));
const opaque = (s: Sprite) => s.pixels.filter((c) => c !== TRANSPARENT).length;

describe('HUD icons', () => {
  it('are 16 x 16', () => {
    for (const s of [gearSprite(), wormSprite(), coinSprite()]) expect([s.width, s.height]).toEqual([16, 16]);
  });

  it('gear has a hole in the middle and teeth around the body', () => {
    const g = gearSprite();
    expect(at(g, 7, 7)).toBe(TRANSPARENT);
    expect(at(g, 8, 8)).toBe(TRANSPARENT);
    expect(at(g, 7, 4)).not.toBe(TRANSPARENT); // body next to the hole
    expect(at(g, 7, 1)).not.toBe(TRANSPARENT); // tooth on the vertical axis
    expect(at(g, 14, 8)).not.toBe(TRANSPARENT); // tooth on the horizontal axis
    expect(at(g, 0, 0)).toBe(TRANSPARENT);
    expect(at(g, 15, 15)).toBe(TRANSPARENT);
    expect(colours(g).has(PAL.outline)).toBe(true);
  });

  it('gear teeth are separated by gaps (more than a blob)', () => {
    const g = gearSprite();
    // Walk a circle of radius 6.5 around the centre and count switches between filled and empty.
    let switches = 0;
    let prev = false;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = Math.round(7.5 + 6.6 * Math.cos(a) - 0.5);
      const y = Math.round(7.5 + 6.6 * Math.sin(a) - 0.5);
      const filled = at(g, x, y) !== TRANSPARENT;
      if (i > 0 && filled !== prev) switches++;
      prev = filled;
    }
    expect(switches).toBeGreaterThanOrEqual(12);
  });

  it('worm is pink and segmented', () => {
    const w = wormSprite();
    expect(colours(w).has(PAL.pink)).toBe(true);
    expect(colours(w).size).toBeGreaterThanOrEqual(4);
    expect(at(w, 0, 0)).toBe(TRANSPARENT);
  });

  it('coin is a gold disc with a rim and a shine', () => {
    const c = coinSprite();
    expect(at(c, 0, 0)).toBe(TRANSPARENT);
    expect(at(c, 8, 8)).not.toBe(TRANSPARENT);
    expect(colours(c).has(PAL.gold)).toBe(true);
    expect(colours(c).has(PAL.sun)).toBe(true);
    expect(colours(c).has(PAL.strawDark)).toBe(true);
    expect(opaque(c)).toBeGreaterThan(120);
  });
});

describe('zSprite', () => {
  it('comes in two sizes, cream with only a drop shadow (never a closed dark box)', () => {
    const small = zSprite(false);
    const big = zSprite(true);
    expect(big.width).toBeGreaterThan(small.width);
    for (const s of [small, big]) {
      expect(colours(s)).toEqual(new Set([PAL.white, PAL.outline]));
      expect(at(s, 0, 0)).toBe(PAL.white); // the letter starts at the corner: no ring around it
      expect(at(s, s.width - 1, 0)).toBe(TRANSPARENT); // top-right stays open
      expect(at(s, 0, s.height - 1)).toBe(TRANSPARENT); // shadow only down-right
    }
  });
});

describe('barFrameSprite', () => {
  it('is thicker and lighter than before, with an unchanged window', () => {
    expect(BAR_BORDER).toBeGreaterThanOrEqual(6);
    expect(BAR_INNER).toEqual({ w: 22, h: 340 });
    const f = barFrameSprite(BAR_INNER.w, BAR_INNER.h);
    expect([f.width, f.height]).toEqual([BAR_INNER.w + BAR_BORDER * 2, BAR_INNER.h + BAR_BORDER * 2]);
    expect(at(f, BAR_BORDER + 3, BAR_BORDER + 3)).toBe(TRANSPARENT); // the window stays open
    expect(at(f, 10, 1)).toBe(PAL.sandLight); // light top bevel
    expect(at(f, 10, f.height - 2)).not.toBe(PAL.sandLight);
    expect(at(f, 10, 3)).toBe(PAL.woodLight); // lighter mid wood than the old frame's mix
  });
  it('still works at the thin strip border', () => {
    const f = barFrameSprite(6, 340, 3);
    expect([f.width, f.height]).toEqual([12, 346]);
  });
});
