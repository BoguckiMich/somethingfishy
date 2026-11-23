import { Pix } from './characters';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * The little lantern that stands on the dock beside Alex once the night kit is owned (slice 16):
 * 9 x 13 px, with the flame lit or the glass dark. Feet at the bottom row, centred.
 */
export const LANTERN_SIZE = { w: 9, h: 13 };
/** Where the flame is, in sprite pixels (the glow is centred here). */
export const LANTERN_FLAME = { x: 4, y: 7 };

const GRID = `
  ..hhhhh..
  .h.....h.
  ..kkkkk..
  .kKKKKKk.
  ..gYYYg..
  ..gYwYg..
  ..gYwYg..
  ..gYYYg..
  ..gYYYg..
  .kKKKKKk.
  ..kkkkk..
`;

export function lanternSprite(lit: boolean): Sprite {
  const base = sprite(GRID, {
    h: PAL.stoneLight,
    k: PAL.stoneDark,
    K: PAL.stone,
    g: PAL.stoneDark,
    Y: lit ? PAL.straw : PAL.outlineSoft,
    w: lit ? PAL.white : PAL.stoneDark,
  });
  const p = new Pix(LANTERN_SIZE.w, LANTERN_SIZE.h);
  p.blit(base, 0, 1);
  return p.outline().done();
}
