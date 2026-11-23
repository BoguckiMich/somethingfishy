import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';

/** Pure pixel-art scaling for the fish: no Phaser, no DOM. */

export interface ShrinkOptions {
  /** Colours that win their cell whenever any of them is under it (the eye). */
  protect?: readonly number[];
  /** Colours of unoutlined hair-thin parts (barbels): carried over by sampling, drawn after the outline. */
  thin?: readonly number[];
}

/**
 * Shrinks an outlined fish sprite to `targetWidth` while staying crisp pixel art: the outline and the
 * thin parts are lifted off, the body is downsampled by picking one existing colour per destination
 * cell (area-weighted majority, rarer colours slightly favoured, `protect` colours always win), and a
 * fresh closed 1 px outline is drawn around the result. Output colours are always a subset of the
 * source's, and the outline can never break.
 */
export function shrinkSprite(s: Sprite, targetWidth: number, opts: ShrinkOptions = {}): Sprite {
  if (targetWidth > s.width) throw new Error(`shrinkSprite: cannot upsize ${s.width} to ${targetWidth}`);
  const protect = new Set(opts.protect ?? []);
  const thin = new Set(opts.thin ?? []);
  const at = (x: number, y: number) => s.pixels[y * s.width + x];
  const isBody = (c: number) => c !== TRANSPARENT && c !== PAL.outline && !thin.has(c);

  // Bounding box of the body (everything but outline and thin parts).
  let x0 = s.width, y0 = s.height, x1 = -1, y1 = -1;
  const freq = new Map<number, number>();
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = at(x, y);
      if (!isBody(c)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      freq.set(c, (freq.get(c) ?? 0) + 1);
    }
  }
  if (x1 < 0) throw new Error('shrinkSprite: sprite has no body pixels');
  const total = Array.from(freq.values()).reduce((a, b) => a + b, 0);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const f = targetWidth / s.width;
  const overhang = Math.max(0, s.width - x1 - 2); // thin columns past the body and its ring
  const od = overhang > 0 ? Math.max(1, Math.round(overhang * f)) : 0;
  const iw = Math.max(2, targetWidth - 2 - od);
  const ih = Math.max(2, Math.round((bh * iw) / bw));
  const W = iw + 2 + od;
  const H = ih + 2;
  const px = new Int32Array(W * H).fill(TRANSPARENT);

  // Body: one existing colour per cell.
  const cw = bw / iw;
  const ch = bh / ih;
  for (let j = 0; j < ih; j++) {
    for (let i = 0; i < iw; i++) {
      const sx0 = x0 + i * cw, sx1 = sx0 + cw, sy0 = y0 + j * ch, sy1 = sy0 + ch;
      const votes = new Map<number, number>();
      let covered = 0;
      let protectedHit = -1;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          const c = at(x, y);
          if (!isBody(c)) continue;
          const area = (Math.min(x + 1, sx1) - Math.max(x, sx0)) * (Math.min(y + 1, sy1) - Math.max(y, sy0));
          covered += area;
          if (protect.has(c)) protectedHit = c;
          votes.set(c, (votes.get(c) ?? 0) + area * (1 + 1.5 * (1 - (freq.get(c) ?? 0) / total)));
        }
      }
      if (protectedHit !== -1) { px[(j + 1) * W + i + 1] = protectedHit; continue; }
      if (covered < 0.45 * cw * ch) continue;
      let best = TRANSPARENT, bestV = -1;
      for (const [c, v] of votes) if (v > bestV) { best = c; bestV = v; }
      px[(j + 1) * W + i + 1] = best;
    }
  }

  // Fresh closed outline.
  const src = Int32Array.from(px);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (src[y * W + x] !== TRANSPARENT) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && src[ny * W + nx] !== TRANSPARENT) { px[y * W + x] = PAL.outline; break; }
      }
    }
  }

  // Thin parts: sampled onto empty cells, after the outline.
  if (thin.size > 0) {
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = at(x, y);
        if (!thin.has(c)) continue;
        const past = x - (x1 + 2); // columns beyond the body's outline ring
        const dx = past >= 0 ? iw + 2 + Math.min(od - 1, Math.floor((past * od) / Math.max(1, overhang))) : 1 + Math.floor(((x - x0) * iw) / bw);
        const dy = 1 + Math.min(ih - 1, Math.max(0, Math.floor(((y - y0) * ih) / bh)));
        if (dx >= 0 && dx < W && dy < H && (px[dy * W + dx] === TRANSPARENT || px[dy * W + dx] === PAL.outline)) px[dy * W + dx] = c;
      }
    }
  }
  return { width: W, height: H, pixels: px };
}

/** The sprite as a flat one-colour shadow: same size, same alpha mask. */
export function silhouetteOf(s: Sprite, color: number): Sprite {
  const pixels = new Int32Array(s.pixels.length);
  for (let i = 0; i < pixels.length; i++) pixels[i] = s.pixels[i] === TRANSPARENT ? TRANSPARENT : color;
  return { width: s.width, height: s.height, pixels };
}
