import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/**
 * Bestia's food bowl (slice 30): a terracotta bowl seen from a little above, standing on the grass by the car (warm, so it never echoes
 * her blue bed). Two pictures: empty, and with a mound of kibble heaped over the rim (shown from the moment a treat goes in until she has
 * eaten it). Feet are the bottom row.
 */
export const BOWL_SIZE = { w: 24, h: 13 };

const CLAY = 0xc4623a;
const CLAY_DARK = 0x8f3f26;
const CLAY_LIGHT = 0xe9946a;
const KIBBLE = 0x9a6234;

export function bowlSprite(full: boolean): Sprite {
  const p = new Pix(BOWL_SIZE.w, BOWL_SIZE.h);
  const cx = 11.5;
  // The outer wall (clay, dark along the front) and the foot ring under it.
  p.ell(cx, 8, 10.4, 4.2, CLAY_DARK);
  p.ell(cx, 7, 10.4, 4, CLAY);
  p.rect(7, 11, 10, 1, CLAY_DARK);
  // A cream stripe round the wall, like a painted bowl.
  for (let x = 3; x <= 20; x++) p.set(x, 9, PAL.cream);
  // The wide, light rim round the mouth (lit along the back), then the dark hollow inside it.
  p.ell(cx, 5.2, 10.4, 4.3, (_x, y) => (y <= 2 ? PAL.white : CLAY_LIGHT));
  p.ell(cx, 5.6, 8.2, 3, CLAY_DARK);
  if (!full) p.ell(cx, 6.2, 7, 2.1, CLAY);
  if (full) {
    // A mound of kibble heaped well over the rim.
    p.ell(cx, 5, 8.6, 3, KIBBLE);
    p.ell(cx, 3.2, 6.6, 3, KIBBLE);
    p.ell(cx, 2.2, 4.4, 1.8, PAL.woodLight);
    for (const [x, y] of [[7, 5], [10, 6], [14, 5], [16, 6], [9, 3], [13, 3], [11, 1], [15, 4], [6, 6]]) p.rect(x, y, 2, 1, PAL.woodDark);
    for (const [x, y] of [[8, 4], [12, 2], [14, 4], [10, 4]]) p.rect(x, y, 2, 1, PAL.woodHi);
  }
  p.outline();
  return p.done();
}
