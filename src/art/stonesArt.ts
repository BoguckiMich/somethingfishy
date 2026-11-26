import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/** The skipping stones (slice 26): three flat, light pebbles on the near shore, each with a white highlight pixel. Feet are the bottom row, centred. */
export const STONES_SIZE = { w: 22, h: 12 };

/** One flat stone: a dark underside, a light body, a brighter top and a white highlight pixel. */
function stone(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  p.ell(cx, cy + 0.8, rx, ry, PAL.stone);
  p.ell(cx, cy, rx, ry * 0.85, PAL.stoneLight);
  p.ell(cx - rx * 0.2, cy - ry * 0.35, Math.max(1, rx * 0.55), Math.max(0.5, ry * 0.4), 0xdcd8d0);
  p.set(cx - rx * 0.45, cy - ry * 0.5, PAL.white);
}

export function stonesSprite(): Sprite {
  const p = new Pix(STONES_SIZE.w, STONES_SIZE.h);
  stone(p, 6.5, 7.8, 5.2, 3.0); // the big one, left
  stone(p, 15.5, 8, 4.4, 2.7); // the medium one
  stone(p, 11, 4, 3.2, 2.0); // a small one on top between them
  p.outline();
  return p.done();
}
