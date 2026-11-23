import { describe, expect, it } from 'vitest';
import { appIconSprite, fishSprite, FISH_GRID, ICON_BG, renderIcon } from './appIconArt';
import { TRANSPARENT, type Sprite } from './pixelGrid';

const at = (s: Sprite, x: number, y: number) => s.pixels[y * s.width + x];

describe('app icon art', () => {
  it('the fish grid is square and has a fish in it', () => {
    const f = fishSprite();
    expect([f.width, f.height]).toEqual([FISH_GRID, FISH_GRID]);
    expect(f.pixels.some((c) => c !== TRANSPARENT)).toBe(true);
  });

  it('every pixel of the icons is opaque (the background fills the square)', () => {
    for (const maskable of [false, true]) {
      const s = appIconSprite(maskable);
      expect(s.pixels.every((c) => c !== TRANSPARENT)).toBe(true);
      expect(at(s, 0, 0)).toBe(ICON_BG);
      expect(at(s, s.width - 1, s.height - 1)).toBe(ICON_BG);
    }
  });

  it('the maskable icon keeps the fish inside the central 80%', () => {
    const s = appIconSprite(true);
    const margin = Math.ceil(s.width * 0.1);
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const inSafe = x >= margin && x < s.width - margin && y >= margin && y < s.height - margin;
        if (!inSafe) expect(at(s, x, y)).toBe(ICON_BG);
      }
    }
  });

  it('renders at the exact size with a nearest-neighbour scale', () => {
    for (const size of [32, 180, 192, 512]) {
      const s = renderIcon(true, size);
      expect([s.width, s.height]).toEqual([size, size]);
    }
    const base = appIconSprite(false);
    const big = renderIcon(false, base.width * 3);
    expect(at(big, 4, 4)).toBe(at(base, 1, 1));
    expect(at(big, 5, 5)).toBe(at(base, 1, 1));
  });
});
