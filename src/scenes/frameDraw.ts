import type Phaser from 'phaser';
import { FRAME_STYLES, frameRuns, type FrameRun, type FrameStyle, type FrameStyleName } from '../art/frameArt';
import { PAL } from '../art/palette';

const cache = new Map<string, FrameRun[]>();

function runsFor(w: number, h: number, name: FrameStyleName, pressed: boolean): FrameRun[] {
  const key = `${name}:${w}x${h}:${pressed ? 1 : 0}`;
  let runs = cache.get(key);
  if (!runs) {
    runs = frameRuns(w, h, FRAME_STYLES[name] as FrameStyle, pressed);
    // Cap the cache: name tags and labels take many widths over a long session.
    if (cache.size > 300) cache.clear();
    cache.set(key, runs);
  }
  return runs;
}

/** Draws a pixel frame (art/frameArt.ts) at (x, y) with Phaser Graphics; `alpha` fades the whole thing. */
export function drawFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  name: FrameStyleName,
  alpha = 1,
  pressed = false,
): void {
  if (name === 'hud') {
    // The HUD boxes are see-through: a deep-wood fill (slightly translucent) under the frame.
    g.fillStyle(PAL.woodDeep, 0.9 * alpha).fillRect(x + 1, y + 1, w - 2, h - 2);
  }
  for (const r of runsFor(w, h, name, pressed)) g.fillStyle(r.color, alpha).fillRect(x + r.x, y + r.y, r.w, r.h);
}
