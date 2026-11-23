import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';

/**
 * Pure art for the UI frames: stepped corners, a dark outline, a light top-left bevel and a dark
 * bottom-right one, drawn with the wood palette. The same description feeds the DOM panels (a small
 * frame sprite used as a CSS 9-slice `border-image`) and the canvas HUD / bottom bar (runs of
 * rects for Phaser Graphics), so every panel in the game shares one look.
 */

export interface FrameStyle {
  outline: number;
  /** Bevel colours, outermost band first (one entry per px of bevel), on the top and left sides. */
  lit: readonly number[];
  /** The same for the bottom and right sides. */
  dark: readonly number[];
  /** A uniform ring just inside the bevel (the inner groove of a panel), if any. */
  inner?: number;
  /** Interior colour; omitted = transparent interior (the caller fills it or tiles a texture). */
  fill?: number;
  /** Corner cut: 1 cuts the corner pixel, 2 cuts a 3 px step. */
  notch: 1 | 2;
}

export const FRAME_STYLES = {
  /** Big panels (DOM cards): 4 px border = outline + 2 px bevel + inner groove. */
  panel: { outline: PAL.outline, lit: [PAL.woodHi, PAL.woodLight], dark: [PAL.wood, PAL.woodDark], inner: PAL.woodDark, notch: 2 },
  /** Small HUD boxes on the canvas: outline + 1 px bevel. */
  hud: { outline: PAL.outline, lit: [PAL.woodLight], dark: [PAL.woodDark], notch: 1 },
  /** Wooden buttons (bottom bar, close X): 2 px bevel. */
  buttonWood: { outline: PAL.outline, lit: [PAL.woodLight, PAL.wood], dark: [PAL.woodDeep, PAL.woodDeep], fill: PAL.woodDark, notch: 1 },
  /** The gold primary button. */
  buttonGold: { outline: PAL.outline, lit: [PAL.sun, 0xffe27e], dark: [PAL.strawDark, 0xd9a943], fill: PAL.gold, notch: 1 },
  /** A disabled button: dull but readable. */
  buttonOff: { outline: PAL.outline, lit: [0x6b5242, 0x5a4333], dark: [0x2a1c14, 0x3a2a1e], fill: 0x4a3426, notch: 1 },
} as const satisfies Record<string, FrameStyle>;

export type FrameStyleName = keyof typeof FRAME_STYLES;

/** Width of the border in px (outline + bevel + inner ring): the 9-slice size. */
export function frameBorder(style: FrameStyle): number {
  return 1 + style.lit.length + (style.inner === undefined ? 0 : 1);
}

/** A `w` x `h` frame. `pressed` swaps the light and dark sides (a pushed-in button). */
export function frameSprite(w: number, h: number, style: FrameStyle, pressed = false): Sprite {
  const pixels = new Int32Array(w * h).fill(TRANSPARENT);
  const lit = pressed ? style.dark : style.lit;
  const dark = pressed ? style.lit : style.dark;
  const n = style.notch;
  const bevel = style.lit.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.min(x, w - 1 - x);
      const cy = Math.min(y, h - 1 - y);
      const ring = Math.min(cx, cy);
      const inCorner = cx <= n && cy <= n;
      let c: number;
      if (inCorner && cx + cy < n) c = TRANSPARENT;
      else if (inCorner ? cx + cy === n : ring === 0) c = style.outline;
      else if (ring <= bevel) {
        // Top/left edge is nearer than bottom/right: lit side.
        const litSide = Math.min(x, y) < Math.min(w - 1 - x, h - 1 - y);
        c = (litSide ? lit : dark)[ring - 1];
      } else if (style.inner !== undefined && ring === bevel + 1) c = style.inner;
      else c = style.fill ?? TRANSPARENT;
      pixels[y * w + x] = c;
    }
  }
  return { width: w, height: h, pixels };
}

export interface FrameRun {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

/** The frame as non-overlapping rects (same pixels as `frameSprite`), for Phaser Graphics.fillRect. */
export function frameRuns(w: number, h: number, style: FrameStyle, pressed = false): FrameRun[] {
  const s = frameSprite(w, h, style, pressed);
  const done: FrameRun[] = [];
  let open: FrameRun[] = [];
  for (let y = 0; y < h; y++) {
    const row: FrameRun[] = [];
    let x = 0;
    while (x < w) {
      const c = s.pixels[y * w + x];
      if (c === TRANSPARENT) {
        x++;
        continue;
      }
      let e = x + 1;
      while (e < w && s.pixels[y * w + e] === c) e++;
      const prev = open.find((r) => r.x === x && r.w === e - x && r.color === c && r.y + r.h === y);
      if (prev) {
        prev.h++;
        row.push(prev);
      } else {
        const r = { x, y, w: e - x, h: 1, color: c };
        row.push(r);
        done.push(r);
      }
      x = e;
    }
    open = row;
  }
  return done;
}

/**
 * A small tileable wood-grain texture for the inside of a panel: the deep wood colour with a few
 * short, slightly lighter horizontal streaks. Subtle on purpose, text sits on top of it.
 */
export function woodGrainSprite(w: number, h: number): Sprite {
  const base = PAL.woodDeep;
  const streak = 0x432a1d;
  const knot = 0x4a2f20;
  const pixels = new Int32Array(w * h).fill(base);
  let seed = 0x2f6e1b;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const streaks = Math.max(2, Math.round((w * h) / 40));
  for (let i = 0; i < streaks; i++) {
    const y = Math.floor(rnd() * h);
    const x = Math.floor(rnd() * w);
    const len = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < len; k++) pixels[y * w + ((x + k) % w)] = k === 0 && rnd() < 0.3 ? knot : streak;
  }
  return { width: w, height: h, pixels };
}
