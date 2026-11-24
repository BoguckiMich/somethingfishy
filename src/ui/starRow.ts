import { starRowSprite } from '../art/starArt';
import type { Tier } from '../core/data/stars';
import { spriteCanvas } from './spriteCanvas';

/** The star row (or the medal) of a tier as a canvas (whole-pixel `scale`), or undefined for none. */
export function starRow(star: Tier, scale: number): HTMLCanvasElement | undefined {
  const s = starRowSprite(star);
  return s ? spriteCanvas(s, s.width * scale) : undefined;
}
