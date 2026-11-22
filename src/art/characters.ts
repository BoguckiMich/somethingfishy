import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/**
 * Character sprites (Alex, Pajkel, the dog). Pure: no Phaser. The figures are composed from
 * palette-only shape painters so every pose and walk frame stays consistent; small details
 * (the band-tee logo, mug, stick, heart) are letter grids.
 */

class Pix {
  readonly px: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Int32Array(w * h).fill(TRANSPARENT);
  }
  set(x: number, y: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : TRANSPARENT;
  }
  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, c);
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: number | ((x: number, y: number) => number)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, typeof c === 'number' ? c : c(x, y));
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  blit(s: Sprite, x: number, y: number): void {
    for (let yy = 0; yy < s.height; yy++) {
      for (let xx = 0; xx < s.width; xx++) {
        const c = s.pixels[yy * s.width + xx];
        if (c !== TRANSPARENT) this.set(x + xx, y + yy, c);
      }
    }
  }
  /** 1 px outline around everything painted so far. */
  outline(color: number = PAL.outline): this {
    const src = Int32Array.from(this.px);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== TRANSPARENT) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && src[ny * this.w + nx] !== TRANSPARENT) {
            this.px[y * this.w + x] = color;
            break;
          }
        }
      }
    }
    return this;
  }
  done(): Sprite {
    return { width: this.w, height: this.h, pixels: this.px };
  }
}

/** Tiny deterministic noise for messy hair / fur. */
const noise = (x: number, y: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

// ---- Small details ---------------------------------------------------------------------

/** An original spiky "metal band" logo for the back of Alex's tee (not a real band's mark). */
const LOGO = sprite(
  `
  w...w.w.w...w
  ww..ww.ww..ww
  .wwwwwwwwwww.
  wwwwwwwwwwwww
  .wwww.w.wwww.
  ..ww..w..ww..
  ..w...w...w..
`,
  { w: PAL.white },
);

export const HEART = sprite(
  `
  .h.h.
  hhhhh
  hhhhh
  .hhh.
  ..h..
`,
  { h: PAL.heart },
);

export const STICK = sprite('sLsssss', { s: PAL.woodLight, L: PAL.woodHi });

// ---- Alex (player): ¾ back view, seated, turned a little toward Pajkel --------------------

export const ALEX_SIZE = { w: 32, h: 40 };
/** Where the rod is held, in sprite pixels (her right hand). */
export const ALEX_HAND = { x: 29, y: 26 };

export function alexSprite(breath: 0 | 1): Sprite {
  const p = new Pix(32, 40);
  // Black band tee.
  for (let y = 22; y <= 34; y++) {
    const x0 = y === 22 ? 8 : 6;
    const x1 = y === 22 ? 23 : 25;
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 9 ? PAL.teeLight : x >= 22 ? PAL.teeDark : PAL.tee);
  }
  p.blit(LOGO, 9, 25);
  // Black capri pants (seat).
  for (let y = 35; y <= 38; y++) for (let x = 5; x <= 26; x++) p.set(x, y, x <= 8 ? PAL.tee : PAL.teeDark);
  // Left arm resting, right arm out to the rod with a smartwatch.
  p.rect(3, 23, 3, 4, PAL.tee);
  p.rect(3, 27, 3, 6, PAL.skin);
  p.rect(5, 27, 1, 6, PAL.skinShade);
  p.rect(26, 22, 4, 3, PAL.tee);
  p.rect(28, 25, 3, 4, PAL.skin);
  p.set(30, 25, PAL.skinShade);
  p.set(30, 26, PAL.skinShade);
  p.rect(28, 27, 2, 1, PAL.watch);
  p.set(30, 27, PAL.shades);
  // Neck.
  p.rect(13, 19, 5, 4, PAL.skinShade);
  // Shoulder-length light-brown hair.
  const dy = breath;
  const hairColor = (x: number, y: number) => {
    const n = noise(x, y);
    if (x < 17 && y < 16 + dy && n > 0.42) return PAL.alexHairLight;
    if (x > 19 || y > 20 || n < 0.18 || (y > 14 && (x + y) % 5 === 0)) return PAL.alexHairDark;
    return PAL.alexHair;
  };
  p.ell(15.5, 11 + dy, 8.6, 9.2, hairColor);
  for (let y = 19; y <= 25; y++) {
    const x0 = y < 23 ? 8 : 9;
    const x1 = y < 23 ? 23 : 22;
    for (let x = x0; x <= x1; x++) {
      if (y === 25 && (x * 7) % 3 === 0) continue;
      if (y === 24 && x % 5 === 0) continue;
      p.set(x, y, hairColor(x, y));
    }
  }
  // Face turned left: cheek, nose, eye, and bangs sweeping across the forehead.
  p.ell(7.5, 13 + dy, 2.8, 3.8, PAL.skin);
  p.set(4, 13 + dy, PAL.skin);
  p.set(4, 14 + dy, PAL.skin);
  p.set(5, 12 + dy, PAL.outline);
  p.set(6, 16 + dy, PAL.skinShade);
  // Bangs: a fringe across the forehead, with a couple of strands falling over it.
  p.rect(4, 8 + dy, 10, 2, PAL.alexHair);
  p.rect(4, 9 + dy, 4, 1, PAL.alexHairDark);
  p.set(4, 10 + dy, PAL.alexHair);
  p.set(5, 10 + dy, PAL.alexHairDark);
  p.set(7, 10 + dy, PAL.alexHair);
  p.set(9, 10 + dy, PAL.alexHairDark);
  p.set(5, 8 + dy, PAL.alexHairLight);
  p.set(8, 8 + dy, PAL.alexHairLight);
  p.rect(10, 10 + dy, 1, 4, PAL.alexHairDark);
  return p.outline().done();
}

// ---- Pajkel (companion): broad, messy blond hair, long beard, sunglasses ---------------------

export const PAJ_SIZE = { w: 40, h: 44 };
export type PajPose = 'sit' | 'sip' | 'cheer' | 'look';

export function pajkelSittingSprite(pose: PajPose, breath: 0 | 1): Sprite {
  const p = new Pix(40, 44);
  // Broad black tee.
  for (let y = 24; y <= 41; y++) {
    let x0 = 4;
    let x1 = 35;
    if (y === 24) [x0, x1] = [10, 29];
    else if (y === 25) [x0, x1] = [7, 32];
    else if (y >= 40) [x0, x1] = [6, 33];
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 10 ? PAL.teeLight : x >= 29 ? PAL.teeDark : PAL.tee);
  }
  // Left arm hanging, right arm holding the thermos (or raised).
  p.rect(2, 26, 4, 5, PAL.tee);
  p.rect(2, 31, 4, 5, PAL.skin);
  p.rect(5, 31, 1, 5, PAL.skinShade);
  if (pose === 'sip') {
    p.rect(33, 26, 4, 5, PAL.tee);
    p.rect(31, 21, 4, 6, PAL.skin);
    p.rect(30, 14, 4, 7, PAL.mug);
    p.rect(30, 14, 1, 7, PAL.mugDark);
    p.rect(30, 12, 4, 2, PAL.stoneLight);
  } else if (pose === 'cheer') {
    p.rect(33, 26, 4, 4, PAL.tee);
    p.rect(34, 12, 3, 14, PAL.skin);
    p.rect(36, 12, 1, 14, PAL.skinShade);
    p.rect(33, 5, 5, 7, PAL.mug);
    p.rect(33, 5, 1, 7, PAL.mugDark);
    p.rect(33, 3, 5, 2, PAL.stoneLight);
  } else {
    p.rect(33, 26, 4, 5, PAL.tee);
    p.rect(32, 31, 4, 5, PAL.skin);
    p.rect(34, 30, 4, 8, PAL.mug);
    p.rect(34, 30, 1, 8, PAL.mugDark);
    p.rect(34, 28, 4, 2, PAL.stoneLight);
  }
  const dy = breath;
  // Messy shoulder-length dirty-blond hair (head + back), with flyaway strands.
  const hair = (x: number, y: number) => {
    const n = noise(x, y);
    if (n > 0.72) return PAL.pajHairLight;
    if (n < 0.22 || y > 17) return PAL.pajHairDark;
    return PAL.pajHair;
  };
  p.ell(20.5, 10 + dy, 9.5, 8, hair);
  for (let y = 14; y <= 23; y++) for (let x = 11; x <= 19; x++) if (noise(x + 3, y) > 0.12 + (y - 14) * 0.03) p.set(x, y + (y < 18 ? dy : 0), hair(x, y));
  if (pose === 'look') {
    // Looking at the water: only the back of the head and beard edges show.
    p.ell(20.5, 11 + dy, 9.5, 9, hair);
    for (let y = 14; y <= 22; y++) {
      p.set(10, y, PAL.beard);
      p.set(31, y, PAL.beardLight);
    }
    p.rect(11, 22, 20, 2, PAL.pajHairDark);
  } else {
    // Face in profile looking right: skin, sunglasses with a temple arm, nose.
    p.ell(26, 13 + dy, 5, 6, PAL.skin);
    p.rect(30, 12 + dy, 3, 2, PAL.skin);
    p.rect(24, 10 + dy, 8, 3, PAL.shades);
    p.line(24, 10 + dy, 15, 9 + dy, PAL.shades);
    p.set(29, 10 + dy, PAL.shadesGlint);
    p.set(30, 10 + dy, PAL.shadesGlint);
    // Long full brown beard: a moustache band, then a big spade hanging over the chest.
    const beard = (x: number, y: number) => {
      const n = noise(x * 2, y);
      if (y > 20 && n > 0.78) return PAL.beardGrey;
      if (n > 0.62) return PAL.beardLight;
      if (n < 0.25 || y > 24) return PAL.beardDark;
      return PAL.beard;
    };
    for (let y = 14; y <= 28; y++) {
      let x0 = 18;
      let x1 = 31;
      if (y === 14) [x0, x1] = [19, 28];
      else if (y >= 22 && y <= 25) [x0, x1] = [19, 30];
      else if (y === 26) [x0, x1] = [21, 29];
      else if (y === 27) [x0, x1] = [23, 28];
      else if (y === 28) [x0, x1] = [24, 27];
      for (let x = x0; x <= x1; x++) p.set(x, y + (y < 20 ? dy : 0), beard(x, y));
    }
    p.rect(27, 15 + dy, 5, 1, PAL.beardDark);
    if (pose === 'sip') p.rect(28, 17 + dy, 3, 1, PAL.beardDark);
  }
  return p.outline().done();
}

// Standing / walking side view, facing right (flip for left).
export const PAJ_WALK_SIZE = { w: 32, h: 52 };
export type PajWalkPose = 'stand' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'throw';

export function pajkelWalkSprite(pose: PajWalkPose): Sprite {
  const p = new Pix(32, 52);
  const f = pose.startsWith('walk') ? Number(pose[4]) : 0;
  const swing = pose === 'stand' || pose === 'throw' ? 0 : [-4, 0, 4, 0][f];
  const bob = pose === 'stand' || pose === 'throw' ? 0 : f % 2 === 1 ? 1 : 0;
  // Legs (jeans) and shoes.
  const leg = (x: number, c: number) => {
    p.rect(x, 35 + bob, 5, 14 - bob, c);
    p.rect(x, 48, 6, 3, PAL.shoeDark);
  };
  leg(12 - swing, PAL.denimDark);
  leg(14 + swing, PAL.jeans);
  // Torso: broad black tee.
  for (let y = 18 + bob; y <= 36; y++) for (let x = 8; x <= 23; x++) p.set(x, y, x <= 11 ? PAL.teeLight : x >= 20 ? PAL.teeDark : PAL.tee);
  // Arm.
  if (pose === 'throw') {
    p.line(17, 21, 21, 8, PAL.skin);
    p.line(18, 21, 22, 8, PAL.skin);
    p.rect(16, 19, 5, 4, PAL.tee);
    p.blit(STICK, 20, 6);
  } else {
    p.rect(14, 19 + bob, 5, 5, PAL.tee);
    p.rect(14 + swing / 2, 24 + bob, 4, 8, PAL.skin);
  }
  // Head: hair, face profile, sunglasses, beard.
  const hair = (x: number, y: number) => (noise(x, y) > 0.7 ? PAL.pajHairLight : noise(x, y) < 0.25 ? PAL.pajHairDark : PAL.pajHair);
  p.ell(15, 9 + bob, 7, 7, hair);
  for (let y = 12; y <= 21; y++) for (let x = 8; x <= 13; x++) if (noise(x, y + 4) > 0.2 + (y - 12) * 0.03) p.set(x, y + bob, hair(x, y));
  p.ell(19, 11 + bob, 4, 5, PAL.skin);
  p.rect(23, 11 + bob, 2, 2, PAL.skin);
  p.rect(18, 8 + bob, 7, 3, PAL.shades);
  p.line(18, 8 + bob, 10, 8 + bob, PAL.shades);
  p.set(23, 8 + bob, PAL.shadesGlint);
  const beard = (x: number, y: number) => (noise(x * 2, y) > 0.62 ? PAL.beardLight : noise(x * 2, y) < 0.28 || y > 20 ? PAL.beardDark : PAL.beard);
  for (let y = 12; y <= 24; y++) {
    let x0 = 13;
    let x1 = 24;
    if (y >= 20) [x0, x1] = [15, 23];
    if (y >= 23) [x0, x1] = [17, 21];
    for (let x = x0; x <= x1; x++) p.set(x, y + bob, beard(x, y));
  }
  p.rect(21, 12 + bob, 4, 1, PAL.beardDark);
  return p.outline().done();
}

// ---- The dog: small, ginger, short-haired, folded ears, yellow harness -------------------------

export const DOG_SIZE = { w: 32, h: 24 };
export type DogShape = 'lie' | 'sleep' | 'sit' | 'stand' | 'run';
export interface DogFrame {
  shape: DogShape;
  /** Tail wag frame 0..2 (lie), 0..1 (sit/stand). */
  tail: number;
  perked: boolean;
  /** Run cycle 0..3. */
  step: number;
}

export function dogKey(f: DogFrame): string {
  return `dog:${f.shape}:${f.tail}:${f.perked ? 'p' : 'f'}:${f.step}`;
}

export function dogSprite(f: DogFrame): Sprite {
  const p = new Pix(32, 24);
  const fur = (x: number, y: number) => (noise(x, y) > 0.8 ? PAL.gingerLight : noise(x, y) < 0.12 ? PAL.gingerDark : PAL.ginger);
  const ear = (hx: number, hy: number) => {
    if (f.perked) {
      p.rect(hx - 2, hy - 5, 2, 5, PAL.gingerDark);
      p.set(hx - 2, hy - 6, PAL.gingerDark);
      p.set(hx - 1, hy - 4, PAL.gingerLight);
    } else {
      p.rect(hx - 3, hy - 2, 3, 5, PAL.gingerDark);
      p.set(hx - 3, hy + 3, PAL.gingerDark);
    }
  };
  const head = (hx: number, hy: number, closedEyes = false) => {
    p.ell(hx, hy, 4.5, 4, fur);
    p.rect(hx + 3, hy, 4, 3, PAL.gingerLight); // snout
    p.set(hx + 7, hy, PAL.outline); // nose
    if (closedEyes) p.rect(hx + 1, hy - 1, 2, 1, PAL.outline);
    else p.set(hx + 1, hy - 1, PAL.outline);
    ear(hx, hy - 2);
  };
  if (f.shape === 'lie' || f.shape === 'sleep') {
    p.ell(13, 17.5, 8, 5, fur);
    p.rect(8, 21, 11, 1, PAL.gingerDark);
    head(f.shape === 'sleep' ? 22 : 22, f.shape === 'sleep' ? 17 : 15, f.shape === 'sleep');
    p.rect(19, 20, 6, 2, PAL.gingerLight); // front paws
    // Yellow harness: chest band, back strap, ring.
    p.rect(17, 14, 2, 8, PAL.harness);
    p.rect(12, 14, 6, 1, PAL.harness);
    p.set(17, 14, PAL.harnessDark);
    p.set(18, 20, PAL.harnessDark);
    // Tail.
    if (f.shape === 'sleep' || f.tail === 2) p.rect(3, 19, 3, 2, fur(2, 19));
    else if (f.tail === 1) p.line(4, 17, 6, 15, PAL.ginger);
    else p.line(4, 14, 6, 17, PAL.ginger);
  } else if (f.shape === 'sit') {
    p.ell(10, 18, 6, 5, fur);
    p.ell(16, 13, 4, 8, fur);
    p.rect(15, 14, 2, 8, PAL.harness);
    p.rect(11, 12, 6, 1, PAL.harness);
    p.set(15, 13, PAL.harnessDark);
    head(19, 6);
    p.rect(17, 20, 4, 3, PAL.gingerLight);
    p.rect(11, 22, 8, 1, PAL.gingerDark);
    if (f.tail === 1) p.line(2, 21, 5, 19, PAL.ginger);
    else p.line(2, 20, 5, 22, PAL.ginger);
  } else if (f.shape === 'stand') {
    p.ell(13, 12, 9, 4.5, fur);
    for (const x of [6, 10, 18, 22]) p.rect(x, 15, 2, 8, x < 14 ? PAL.ginger : PAL.gingerLight);
    p.rect(17, 8, 2, 8, PAL.harness);
    p.rect(11, 8, 7, 1, PAL.harness);
    p.set(17, 8, PAL.harnessDark);
    head(24, 7);
    if (f.tail === 1) p.line(3, 6, 5, 9, PAL.ginger);
    else p.line(3, 8, 5, 9, PAL.ginger);
  } else {
    // run: gallop cycle
    p.ell(14, 11, 9, 4, fur);
    p.rect(17, 7, 2, 7, PAL.harness);
    p.rect(11, 7, 7, 1, PAL.harness);
    p.set(17, 7, PAL.harnessDark);
    const s = f.step % 4;
    const stretch = s === 0 ? 5 : s === 2 ? -3 : 0;
    // front legs reach forward, back legs reach back (tucked in the middle frames)
    p.line(20, 14, 22 + stretch, 21, PAL.gingerLight);
    p.line(21, 14, 23 + stretch, 21, PAL.gingerLight);
    p.line(8, 14, 6 - stretch, 21, PAL.ginger);
    p.line(9, 14, 7 - stretch, 21, PAL.ginger);
    head(25, 7);
    p.line(5, 9, 2, 5, PAL.ginger);
  }
  return p.outline().done();
}

export function allDogFrames(): DogFrame[] {
  const out: DogFrame[] = [];
  for (const perked of [false, true]) for (const tail of [0, 1, 2]) out.push({ shape: 'lie', tail, perked, step: 0 });
  out.push({ shape: 'sleep', tail: 0, perked: false, step: 0 });
  for (const tail of [0, 1]) {
    for (const perked of [false, true]) {
      out.push({ shape: 'sit', tail, perked, step: 0 });
      out.push({ shape: 'stand', tail, perked, step: 0 });
    }
  }
  for (let step = 0; step < 4; step++) out.push({ shape: 'run', tail: 0, perked: false, step });
  return out;
}
