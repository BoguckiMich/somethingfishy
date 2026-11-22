import { lerpColor } from './dayCycle';
import { TRANSPARENT, type Sprite } from './pixelGrid';

/** A small pure RGBA pixel buffer used to bake scenery. No Phaser, no DOM. */
export class Raster {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: number, alpha = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return;
    const i = (y * this.width + x) * 4;
    if (alpha >= 255) {
      this.data[i] = (color >> 16) & 255;
      this.data[i + 1] = (color >> 8) & 255;
      this.data[i + 2] = color & 255;
      this.data[i + 3] = 255;
      return;
    }
    // Source-over for translucent pixels.
    const a = alpha / 255;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    const mix = (src: number, dst: number) => (src * a + dst * da * (1 - a)) / oa;
    this.data[i] = mix((color >> 16) & 255, this.data[i]);
    this.data[i + 1] = mix((color >> 8) & 255, this.data[i + 1]);
    this.data[i + 2] = mix(color & 255, this.data[i + 2]);
    this.data[i + 3] = oa * 255;
  }

  /** Colour at x,y, or -1 when transparent / out of bounds. */
  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return TRANSPARENT;
    const i = (y * this.width + x) * 4;
    if (this.data[i + 3] === 0) return TRANSPARENT;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }

  alphaAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.data[(y * this.width + x) * 4 + 3] : 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 255): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, color, alpha);
  }

  /** Draws a sprite with its top-left at x,y. `mix` blends every pixel toward a colour (haze). */
  blit(s: Sprite, x: number, y: number, opts: { flip?: boolean; mix?: { color: number; t: number } } = {}): void {
    for (let yy = 0; yy < s.height; yy++) {
      for (let xx = 0; xx < s.width; xx++) {
        const c = s.pixels[yy * s.width + (opts.flip ? s.width - 1 - xx : xx)];
        if (c === TRANSPARENT) continue;
        this.set(x + xx, y + yy, opts.mix ? lerpColor(c, opts.mix.color, opts.mix.t) : c);
      }
    }
  }

  static fromSprite(s: Sprite): Raster {
    const r = new Raster(s.width, s.height);
    r.blit(s, 0, 0);
    return r;
  }
}

/** Deterministic PRNG so baked art is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in [0,1) for a pixel. */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Position `t` in a colour ramp (0..ramp.length-1), dithering between neighbouring colours. */
export function rampDither(ramp: readonly number[], t: number, x: number, y: number): number {
  const c = Math.min(ramp.length - 1, Math.max(0, t));
  const lo = Math.floor(c);
  const frac = c - lo;
  if (lo >= ramp.length - 1) return ramp[ramp.length - 1];
  return frac > bayer(x, y) ? ramp[lo + 1] : ramp[lo];
}
