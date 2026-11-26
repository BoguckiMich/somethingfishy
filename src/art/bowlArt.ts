import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/**
 * Bestia's food bowl (slice 30): a small blue bowl seen from a little above, standing on the grass by the car. Two pictures: empty,
 * and with a heap of kibble in it (shown from the moment a treat goes in until she has eaten it). Feet are the bottom row.
 */
export const BOWL_SIZE = { w: 20, h: 11 };

export function bowlSprite(full: boolean): Sprite {
  const p = new Pix(BOWL_SIZE.w, BOWL_SIZE.h);
  const cx = 9.5;
  // The outer wall (denim, dark along the front) and the foot ring under it.
  p.ell(cx, 6.6, 8.4, 3.6, PAL.denimDark);
  p.ell(cx, 5.8, 8.4, 3.4, PAL.denim);
  p.rect(6, 9, 8, 1, PAL.denimDark);
  // The wide, light rim round the mouth (lit along the back), then the hollow inside it.
  p.ell(cx, 4.2, 8.4, 3.6, (_x, y) => (y <= 2 ? PAL.white : PAL.blueFlower));
  p.ell(cx, 4.6, 6.3, 2.4, PAL.denimDark);
  p.ell(cx, 5.1, 5.4, 1.7, PAL.denim);
  if (full) {
    // A little heap of kibble over the hollow.
    p.ell(cx, 4.0, 5.6, 2.3, PAL.woodLight);
    p.ell(cx, 3.4, 4.2, 1.4, PAL.straw);
    for (const [x, y] of [[6, 4], [9, 5], [12, 4], [8, 3], [11, 3]]) p.set(x, y, PAL.wood);
    p.set(7, 2, PAL.strawLight);
    p.set(10, 2, PAL.strawLight);
  }
  p.outline();
  return p.done();
}
