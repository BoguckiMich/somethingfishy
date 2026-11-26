import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/** The skipping stones (slice 26): three flat grey pebbles on the near shore. Feet are the bottom row, centred. */
export const STONES_SIZE = { w: 22, h: 10 };

/** One flat stone: an ellipse with a light top and a dark underside, then the outline is added by the caller. */
function stone(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  p.ell(cx, cy + 0.6, rx, ry, PAL.stoneDark);
  p.ell(cx, cy, rx, ry * 0.8, PAL.stone);
  p.ell(cx - rx * 0.25, cy - ry * 0.3, Math.max(1, rx * 0.5), Math.max(0.5, ry * 0.35), PAL.stoneLight);
}

export function stonesSprite(): Sprite {
  const p = new Pix(STONES_SIZE.w, STONES_SIZE.h);
  stone(p, 6.5, 6.4, 4.6, 2.6); // the big one, left
  stone(p, 14.5, 6.8, 3.6, 2.2); // the medium one
  stone(p, 11, 3.4, 2.4, 1.6); // a small one on top between them
  p.outline();
  return p.done();
}
