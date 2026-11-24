import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/**
 * Character sprites (Alex, Pajkel, the dog). Pure: no Phaser. The figures are composed from
 * palette-only shape painters so every pose and walk frame stays consistent; small details
 * (the band-tee logo, mug, stick, heart) are letter grids.
 */

export class Pix {
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
  w..w.w..w
  ww.www.ww
  .wwwwwww.
  wwwwwwwww
  .ww.w.ww.
  ..w.w.w..
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

/** The stick in Pajkel's fist in the throw frame (slice 17). */
export const STICK = sprite('sLsssss', { s: PAL.wood, L: PAL.woodLight });

/**
 * The stick as the dog carries it: gripped across the mouth, the front end up and ahead of the
 * snout, the back end trailing behind the head, a small twig on top. Centred on its middle
 * (the mouth); faces right, flipped with the dog. Wood colours, no outline (slice 22a).
 */
export const STICK_CARRY_SIZE = { w: 17, h: 8 };
export function stickCarrySprite(): Sprite {
  const p = new Pix(STICK_CARRY_SIZE.w, STICK_CARRY_SIZE.h);
  p.line(4, 6, 16, 3, PAL.wood);
  p.line(4, 5, 16, 2, PAL.woodLight);
  p.line(12, 3, 14, 0, PAL.woodLight); // a twig
  p.set(4, 6, PAL.woodDark);
  p.set(4, 5, PAL.woodDark);
  p.set(16, 3, PAL.woodDark);
  return p.done();
}

/** A stick lying on the grass (slice 22a): 13x4, three shapes, wood colours, no outline, a grass shadow row. */
export const STICK_GROUND_SIZE = { w: 13, h: 4 };
export const STICK_VARIANTS = 3;
export type StickVariant = 0 | 1 | 2;
export function stickGroundSprite(variant: StickVariant = 0): Sprite {
  const L = PAL.woodLight;
  const w = PAL.wood;
  const d = PAL.woodDark;
  const k = PAL.woodDeep;
  const g = PAL.grass0;
  const p = new Pix(STICK_GROUND_SIZE.w, STICK_GROUND_SIZE.h);
  if (variant === 0) {
    // straight
    p.rect(1, 0, 6, 1, L);
    p.rect(1, 1, 11, 1, w);
    p.set(0, 1, d);
    p.set(12, 1, d);
    p.set(6, 1, k);
    p.rect(1, 2, 11, 1, d);
    p.rect(2, 3, 11, 1, g);
  } else if (variant === 1) {
    // forked: a twig up at col 9
    p.rect(1, 0, 5, 1, L);
    p.rect(1, 1, 10, 1, w);
    p.set(0, 1, d);
    p.set(11, 1, d);
    p.set(9, 0, L);
    p.set(9, 1, k);
    p.rect(1, 2, 10, 1, d);
    p.rect(2, 3, 10, 1, g);
  } else {
    // bent: a kink at col 6, the right half one row lower
    p.rect(1, 0, 4, 1, L);
    p.rect(1, 1, 5, 1, w);
    p.set(0, 1, d);
    p.set(3, 1, k);
    p.set(6, 1, L);
    p.rect(1, 2, 6, 1, d);
    p.rect(7, 2, 5, 1, w);
    p.set(12, 2, d);
    p.rect(7, 3, 5, 1, d);
    p.rect(2, 3, 5, 1, g);
  }
  return p.done();
}

/** The thrown stick turns through these angles (baked as rotated copies), no shadow. */
export const STICK_SPIN_ANGLES = [0, 45, 90, 135] as const;
export const STICK_SPIN_SIZE = { w: 13, h: 13 };
export function stickSpinSprite(step: number): Sprite {
  const n = STICK_SPIN_SIZE.w;
  const c = (n - 1) / 2;
  const a = (STICK_SPIN_ANGLES[((step % 4) + 4) % 4] * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const p = new Pix(n, n);
  // The straight stick (light top, wood body, dark underside) rotated by inverse mapping.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - c;
      const dy = y - c;
      const u = dx * cos + dy * sin; // along the stick
      const v = -dx * sin + dy * cos; // across it
      if (Math.abs(u) > 6.2 || v < -1.55 || v > 1.55) continue;
      const col = Math.abs(u) > 5.4 ? PAL.woodDark : v < -0.5 ? PAL.woodLight : v > 0.5 ? PAL.woodDark : Math.abs(u - 0.5) < 0.6 ? PAL.woodDeep : PAL.wood;
      p.set(x, y, col);
    }
  }
  return p.done();
}

/** The little dust puff where a thrown stick lands: two frames of five or six pixels, spreading. */
export const STICK_PUFF_SIZE = { w: 11, h: 5 };
export function stickPuffSprite(frame: 0 | 1): Sprite {
  const p = new Pix(STICK_PUFF_SIZE.w, STICK_PUFF_SIZE.h);
  const c = PAL.sandLight; // pale dust: shows on every shade of the lawn
  const d = PAL.sand;
  if (frame === 0) {
    // a small cloud close to the ground
    for (const [x, y] of [[4, 3], [5, 3], [6, 3], [3, 2], [7, 2]]) p.set(x, y, c);
    p.set(5, 2, d);
  } else {
    // spread out and rising
    for (const [x, y] of [[0, 3], [2, 1], [5, 0], [8, 1], [10, 3]]) p.set(x, y, c);
    p.set(3, 3, d);
    p.set(7, 3, d);
  }
  return p.done();
}

// ---- Alex (player): standing at the dock edge, ¾ back view, rod in her right hand ----------

export const ALEX_SIZE = { w: 32, h: 56 };
/** Where the rod is held, in sprite pixels (her right hand). */
export const ALEX_HAND = { x: 27, y: 28 };
/** Row of the soles of her shoes, in sprite pixels. */
export const ALEX_FEET_Y = 55;

export type AlexHead = 'forward' | 'left' | 'right';
export const ALEX_HEADS: readonly AlexHead[] = ['forward', 'left', 'right'];
export const alexKey = (head: AlexHead, breath: 0 | 1) => `alex:${head}:${breath}`;

/**
 * Hair colour for a pixel. Colours are sampled in head-local rows (y - dy), so the strand pattern
 * travels with the head when she breathes.
 */
function alexHairColor(dy: number): (x: number, yy: number) => number {
  return (x, yy) => {
    const y = yy - dy;
    const col = noise(x, 3.7);
    const n = noise(x, y);
    // Highlight band sweeping across the crown (light from the upper left).
    const sheen = Math.abs(x + y * 0.8 - 18) < 1.3 && y < 11;
    if (sheen) return n > 0.4 ? PAL.alexHairHi : PAL.alexHairLight;
    if (y > 17 && (x < 10 || x > 21)) return PAL.alexHairDark;
    if (col > 0.62) return y > 12 && n < 0.3 ? PAL.alexHair : PAL.alexHairLight;
    if (col < 0.28 || (n < 0.12 && y > 6)) return PAL.alexHairDark;
    return PAL.alexHair;
  };
}

/** Black capris and bare calves, white shoes with dark soles (same in every pose). */
function paintAlexLegs(p: Pix): void {
  // Black capri pants: hips, then two slim legs ending mid-calf.
  for (let y = 37; y <= 41; y++) {
    const x0 = y <= 40 ? 10 : 11;
    const x1 = y <= 40 ? 21 : 20;
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 12 ? PAL.tee : PAL.teeDark);
  }
  for (let y = 42; y <= 47; y++) {
    for (let x = 11; x <= 14; x++) p.set(x, y, x === 11 ? PAL.teeLight : PAL.tee);
    for (let x = 17; x <= 20; x++) p.set(x, y, x === 20 ? PAL.teeDark : PAL.tee);
  }
  p.rect(11, 47, 4, 1, PAL.teeLight);
  p.rect(17, 47, 4, 1, PAL.tee);
  // Bare calves and ankles, then shoes (white with a dark sole).
  p.rect(12, 48, 3, 5, PAL.skin);
  p.rect(14, 48, 1, 5, PAL.skinShade);
  p.rect(18, 48, 3, 5, PAL.skin);
  p.rect(20, 48, 1, 5, PAL.skinShade);
  for (const x of [11, 17]) {
    p.rect(x, 53, 4, 2, PAL.shoe);
    p.rect(x, 55, 4, 1, PAL.shoeDark);
  }
}

export function alexSprite(head: AlexHead, breath: 0 | 1): Sprite {
  const p = new Pix(32, 56);
  const dy = breath;
  // Slim black band tee: narrow shoulders, a waist, a slight flare at the hem.
  for (let y = 21; y <= 36; y++) {
    let x0 = 10;
    let x1 = 21;
    if (y === 21) [x0, x1] = [11, 20];
    else if (y >= 31 && y <= 34) [x0, x1] = [11, 20];
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 11 ? PAL.teeLight : x >= 19 ? PAL.teeDark : PAL.tee);
  }
  p.blit(LOGO, 11, 24);
  // Left arm hanging (sleeve, then bare forearm and hand).
  p.rect(8, 22, 2, 4, PAL.tee);
  p.rect(8, 26, 2, 9, PAL.skin);
  p.rect(9, 26, 1, 9, PAL.skinShade);
  // Right arm bent out to the rod: sleeve, forearm, fist, smartwatch on the wrist.
  p.rect(22, 22, 3, 3, PAL.tee);
  p.rect(23, 25, 2, 3, PAL.skin);
  p.set(24, 25, PAL.skinShade);
  p.set(24, 26, PAL.skinShade);
  p.rect(25, 27, 3, 3, PAL.skin);
  p.set(27, 29, PAL.skinShade);
  p.rect(25, 27, 1, 2, PAL.watch);
  paintAlexLegs(p);
  // Neck.
  p.rect(14, 17 + dy, 3, 5 - dy, PAL.skinShade);

  // Shoulder-length light-brown hair. Strands run down the head; the ends are ragged.
  // Breathing moves the whole head and hair block rigidly by `dy`: colours are sampled in
  // head-local rows (y - dy), so the strand pattern travels with the silhouette.
  const hairColor = alexHairColor(dy);
  // Hair hanging to the shoulders, with uneven ends.
  for (let x = 9; x <= 22; x++) {
    const end = 20 + Math.floor(noise(x, 9.1) * 4) - (x === 9 || x === 22 ? 2 : 0);
    for (let y = 14 + dy; y <= end + dy; y++) p.set(x, y, hairColor(x, y));
  }
  // The head itself.
  p.ell(15.5, 8.5 + dy, 7.6, 8.3, hairColor);

  // The crown parting sits a little toward the side she is turned to.
  const part = head === 'left' ? 13 : head === 'right' ? 18 : 15;
  p.line(part + 1, 1 + dy, part, 7 + dy, PAL.alexHairDark);
  p.set(part, 8 + dy, PAL.alexHairDark);
  p.set(part + 2, 3 + dy, PAL.alexHairLight);
  if (head !== 'forward') {
    // Turned: only a sliver of profile inside the same silhouette (mirrored for 'right').
    const f = (x: number, y: number, c: number) => p.set(head === 'right' ? 31 - x : x, y + dy, c);
    for (let y = 11; y <= 15; y++) f(9, y, y === 15 ? PAL.skinShade : PAL.skin);
    f(8, 12, PAL.skin);
    f(8, 13, PAL.skin); // nose tip
    f(8, 14, PAL.skinShade);
    f(10, 13, PAL.skinShade); // a hint of cheek/ear shadow
    f(10, 14, PAL.skinShade);
    // Bangs sweeping over the forehead, a couple of strands falling toward the cheek.
    for (let x = 9; x <= 13; x++) f(x, 9, x % 2 ? PAL.alexHairDark : PAL.alexHair);
    f(9, 10, PAL.alexHairDark);
    f(10, 10, PAL.alexHair);
    f(12, 10, PAL.alexHairDark);
    f(9, 8, PAL.alexHairLight);
    f(11, 7, PAL.alexHairHi);
  }
  return p.outline().done();
}

// ---- Alex showing off the catch: front-facing, holding the fish at her chest --------------------------------

/** Centre of the fish she holds, in sprite pixels. The fish itself is a separate sprite (see fishArt.ts). */
export const SHOW_OFF_FISH_ANCHOR = { x: 16, y: 29 };
export const ALEX_HANDS_KEY = 'alex:showoff:hands';

/** The two hands gripping the fish's ends, drawn over the fish (same size and origin as her sprite). */
export function alexShowOffHandsSprite(): Sprite {
  const p = new Pix(32, 56);
  for (const side of [-1, 1] as const) {
    const X = (x: number) => (side < 0 ? x : 31 - x);
    p.rect(Math.min(X(8), X(10)), 28, 3, 4, PAL.skin);
    p.rect(Math.min(X(8), X(10)), 31, 3, 1, PAL.skinShade);
    p.set(X(10), 28, PAL.skinShade); // thumb over the fish
  }
  return p.outline().done();
}
export const alexShowOffKey = (breath: 0 | 1) => `alex:showoff:${breath}`;

export function alexShowOffSprite(breath: 0 | 1): Sprite {
  const p = new Pix(32, 56);
  const dy = breath;
  // Slim black band tee, seen from the front; the small jagged logo sits low on the chest.
  for (let y = 21; y <= 36; y++) {
    let x0 = 10;
    let x1 = 21;
    if (y === 21) [x0, x1] = [11, 20];
    else if (y >= 31 && y <= 34) [x0, x1] = [11, 20];
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 11 ? PAL.teeLight : x >= 19 ? PAL.teeDark : PAL.tee);
  }
  p.blit(LOGO, 11, 27);
  // Both arms bent in front of her: short sleeve, upper arm down to the elbow, forearm in to the
  // hands that carry the fish at chest height (the hands are a separate overlay, see above).
  // The smartwatch is on her left wrist (the right side of the picture).
  for (const side of [-1, 1] as const) {
    const X = (x: number) => (side < 0 ? x : 31 - x);
    p.rect(side < 0 ? 8 : 21, 22, 3, 4, PAL.tee);
    p.line(X(8), 26, X(7), 29, PAL.skin);
    p.line(X(9), 26, X(8), 29, PAL.skinShade);
    p.line(X(7), 30, X(9), 30, PAL.skin);
    p.line(X(8), 31, X(10), 31, PAL.skinShade);
  }
  p.rect(22, 30, 2, 1, PAL.watch);
  paintAlexLegs(p);
  // Neck.
  p.rect(14, 17 + dy, 3, 5 - dy, PAL.skinShade);

  // Head: shoulder-length hair framing a small, quiet face, with bangs.
  const hairColor = alexHairColor(dy);
  for (let x = 8; x <= 23; x++) {
    const end = 21 + Math.floor(noise(x, 9.1) * 3) - (x === 8 || x === 23 ? 2 : 0);
    for (let y = 12 + dy; y <= end + dy; y++) p.set(x, y, hairColor(x, y));
  }
  p.ell(15.5, 8.5 + dy, 7.6, 8.3, hairColor);
  // The face: a rounded skin oval inside the hair.
  p.ell(15.5, 11.2 + dy, 4.7, 5.9, (_x, y) => (y - dy >= 16 ? PAL.skinShade : PAL.skin));
  // Bangs across the forehead, parted a little to her left, with a few loose strands.
  for (let x = 10; x <= 21; x++) {
    const bottom = 6 + (x < 13 || x > 18 ? 2 : 1) + (x === 15 || x === 16 ? 0 : 0);
    for (let y = 3; y <= bottom; y++) p.set(x, y + dy, hairColor(x, y + dy));
  }
  p.set(11, 9 + dy, PAL.alexHairDark);
  p.set(20, 9 + dy, PAL.alexHair);
  p.set(15, 6 + dy, PAL.alexHairDark);
  // Minimal face: 1 px eyes, a faint nose, a tiny smile.
  p.set(13, 10 + dy, PAL.outline);
  p.set(18, 10 + dy, PAL.outline);
  p.set(16, 12 + dy, PAL.skinShade);
  p.set(14, 14 + dy, PAL.skinShade);
  p.set(15, 15 + dy, PAL.skinShade);
  p.set(16, 15 + dy, PAL.skinShade);
  p.set(17, 14 + dy, PAL.skinShade);
  return p.outline().done();
}

// ---- Pajkel (companion): broad, messy blond hair, long brown beard, a slate-blue jacket ------------

export const PAJ_SIZE = { w: 40, h: 48 };
/** The sprite row that sits on the anchor: the chair legs and the shadow hang below it (slice 22a). */
export const PAJ_ORIGIN_Y = 42;
/** The top row of his hair (the speech bubble points at it). */
export const PAJ_HEAD_TOP = 7;
export type PajPose = 'sit' | 'sipLift' | 'sipDrink' | 'pourReach' | 'pour' | 'cheer' | 'look';
/** Every seated frame, in the order the textures are baked. */
export const PAJ_POSES: readonly PajPose[] = ['sit', 'sipLift', 'sipDrink', 'pourReach', 'pour', 'cheer', 'look'];
/** Where the cup's top centre is, per pose (sprite pixels): the steam wisps start just above it. */
export const PAJ_CUP: Partial<Record<PajPose, { x: number; y: number }>> = {
  sit: { x: 27, y: 22 },
  sipLift: { x: 28, y: 18 },
  sipDrink: { x: 28, y: 13 },
};

const pajHair = (x: number, y: number) => {
  const n = noise(x, y);
  if (n > 0.62) return PAL.pajHairLight;
  if (n < 0.18) return PAL.pajHairDark;
  return PAL.pajHair;
};
const pajBeard = (x: number, y: number) => {
  const n = noise(x * 2, y);
  if (y > 20 && n > 0.78) return PAL.beardGrey;
  if (n > 0.62) return PAL.beardLight;
  if (n < 0.25 || y > 23) return PAL.beardDark;
  return PAL.beard;
};

/**
 * The camp chair seen from behind: light grey arms, posts and legs (they show against the planks), a
 * red canvas back. Seated, the canvas is low (his jacket shows above it); empty, it is taller and has a
 * top rail. The legs and shadow come after the outline.
 */
function paintChairBack(p: Pix, empty = false): void {
  const top = empty ? 33 : 35;
  p.rect(6, 34, 3, 1, PAL.stoneLight); // armrests
  p.rect(25, 34, 3, 1, PAL.stoneLight);
  p.rect(7, 35, 1, 6, PAL.stone); // posts
  p.rect(26, 35, 1, 6, PAL.stone);
  if (empty) {
    p.rect(7, 32, 20, 1, PAL.stoneLight); // the top rail
    p.rect(7, 33, 1, 2, PAL.stone);
    p.rect(26, 33, 1, 2, PAL.stone);
  }
  p.rect(8, top, 18, 1, PAL.shirt); // the hem
  p.rect(8, top + 1, 18, 40 - top, PAL.shirtDark);
  for (let x = 8; x < 26; x += 2) p.set(x, top + 1, PAL.shirt);
  p.rect(16, top + 2, 1, 40 - top - 2, PAL.shirt); // a fold down the middle
  p.set(16, 40, PAL.shirtDark);
}

function paintChairLegs(p: Pix): void {
  for (const x0 of [7, 23]) {
    // an X of two legs, 4 wide and 4 tall, under each post
    p.line(x0, 42, x0 + 3, 45, PAL.stoneLight);
    p.line(x0 + 3, 42, x0, 45, PAL.stoneLight);
    p.set(x0 + 1, 43, PAL.stone);
    p.set(x0 + 2, 44, PAL.stone);
  }
  p.rect(5, 46, 28, 1, PAL.outline); // a 1 px shadow on the planks
}

/** The thermos standing on the planks right of the chair. */
function paintThermos(p: Pix): void {
  p.rect(34, 38, 3, 7, PAL.mug);
  p.rect(34, 38, 1, 7, PAL.mugDark);
  p.rect(34, 37, 3, 1, PAL.stoneLight);
}

/** The shadow under the thermos (after the outline), only where it stands. */
function paintThermosShadow(p: Pix): void {
  p.rect(33, 46, 5, 1, PAL.outline);
}

/** A camp chair with nobody in it and the thermos beside it: drawn where he sits while he is away (22a). */
export const EMPTY_CHAIR = { x: 4, y: 31, w: 35, h: 17 };
export function emptyChairSprite(): Sprite {
  const p = new Pix(40, 48);
  paintChairBack(p, true);
  paintThermos(p);
  p.outline();
  paintChairLegs(p);
  paintThermosShadow(p);
  const full = p.done();
  const out = new Pix(EMPTY_CHAIR.w, EMPTY_CHAIR.h);
  out.blit(full, -EMPTY_CHAIR.x, -EMPTY_CHAIR.y);
  return out.done();
}

/** A cup 3 wide and 4 tall: a white rim row, a grey body with a darker foot, a dark edge on its left (the jacket side). */
const cup = (p: Pix, x: number, y: number) => {
  p.rect(x, y + 1, 3, 3, PAL.stone);
  p.rect(x, y + 3, 3, 1, PAL.stoneDark);
  p.set(x + 1, y + 1, PAL.stoneLight);
  p.rect(x, y, 3, 1, PAL.white);
  p.rect(x - 1, y, 1, 4, PAL.outline);
};

/**
 * Seen from behind, sitting in a red camp chair on the dock, the rod leaning against its left arm and
 * the thermos standing on the planks to his right. Slate jacket with a collar, two shoulders and a
 * back seam; the head is turned a little to the right so the sunglasses, cheek and the long beard
 * show ('look' faces the water squarely: only the back of the head). `breath` lifts the head 1 px
 * (the 'cheer' pose uses it as its second frame).
 */
export function pajkelSittingSprite(pose: PajPose, breath: 0 | 1): Sprite {
  const p = new Pix(40, 48);
  const up = new Pix(40, 48); // head and torso (leans in pourReach / pour)
  const front = new Pix(40, 48); // the arm, cup and thermos in hand: drawn over everything else
  const dy = pose === 'sipDrink' ? -1 : pose === 'cheer' ? 0 : breath;
  const lean = pose === 'pourReach' || pose === 'pour' ? 1 : 0;

  // The rod leans against the left chair arm.
  for (let y = 3; y <= 32; y++) {
    const x = Math.round(5 - ((32 - y) * 3) / 29);
    p.set(x, y, PAL.woodHi);
    if (y > 16) p.set(x + 1, y, PAL.woodDark);
  }

  // Jacket: sloping shoulders, a lighter left side, a darker right side, a back seam, two sleeves.
  for (let y = 22; y <= 34; y++) {
    // Slim: narrow shoulders, a taper to the waist.
    let [x0, x1] = [11, 22];
    if (y === 22) [x0, x1] = [13, 20];
    else if (y === 23) [x0, x1] = [11, 22];
    else if (y === 24) [x0, x1] = [10, 23];
    else if (y <= 28) [x0, x1] = [9, 24];
    else if (y <= 31) [x0, x1] = [10, 23];
    for (let x = x0; x <= x1; x++) up.set(x, y, x <= x0 + 2 ? PAL.jacketLight : x >= x1 - 2 ? PAL.jacketDark : PAL.jacket);
  }
  up.line(16, 27, 16, 34, PAL.jacketDark); // back seam
  up.line(12, 24, 10, 26, PAL.jacketDark); // where each shoulder meets the arm
  up.line(21, 24, 23, 26, PAL.jacketDark);
  up.line(12, 26, 12, 34, PAL.jacketDark); // sleeve edges
  up.line(21, 27, 21, 34, PAL.jacketDark);
  // Neck, then the collar over its foot.
  up.rect(14, 16, 6, 6, PAL.skinShade);
  up.rect(13, 21, 8, 2, PAL.jacketDark);
  up.rect(14, 21, 6, 1, PAL.jacket);

  // Head: a smaller crown of messy dirty-blond hair with a darker underside, strands over the collar.
  const hair = (x: number, y: number) => (y >= 16 + dy ? PAL.pajHairDark : pajHair(x, y));
  const lobe = (x0: number, x1: number, density: number) => {
    for (let y = 14; y <= 22; y++) for (let x = x0; x <= x1; x++) if (noise(x + 3, y) > density + (y - 14) * 0.035) up.set(x, y + (y < 18 ? dy : 0), y >= 18 ? PAL.pajHairDark : pajHair(x, y));
  };
  if (pose === 'look') {
    up.ell(16.5, 12 + dy, 7.5, 6.5, hair);
    lobe(8, 13, 0.08);
    lobe(21, 25, 0.08);
    for (let y = 14; y <= 21; y++) {
      up.set(8, y, pajBeard(8, y)); // beard edges peeking out past the jaw
      up.set(25, y, pajBeard(25, y));
    }
    for (let x = 14; x <= 19; x++) up.set(x, 18 + (x % 2), PAL.pajHairDark); // hair parted over the nape
  } else {
    // Turned right: the cheek and nose first, the hair over them (a fringe over the brow), then glasses and beard.
    up.ell(22.5, 14 + dy, 3.2, 3.8, PAL.skin);
    up.rect(25, 13 + dy, 2, 2, PAL.skin); // nose
    for (let y = 6; y <= 18; y++) {
      for (let x = 8; x <= 25; x++) {
        const inside = ((x - 16.5) / 7.5) ** 2 + ((y - 12 - dy) / 5.5) ** 2 <= 1;
        if (inside && (x < 20 || y <= 9 + dy)) up.set(x, y, hair(x, y));
      }
    }
    lobe(8, 13, 0.1);
    up.rect(19, 12 + dy, 1, 3, PAL.skin); // ear
    up.set(19, 14 + dy, PAL.skinShade);
    up.rect(22, 12 + dy, 3, 1, PAL.outline); // sunglasses
    up.set(23, 13 + dy, PAL.skinShade); // cheek under the glasses
    up.set(21, 12 + dy, PAL.outline); // the arm of the glasses
    up.rect(20, 14 + dy, 2, 1, PAL.skinShade); // cheek shade above the beard
    for (let y = 15; y <= 26; y++) {
      let x0 = 19;
      let x1 = 26;
      if (y >= 20) [x0, x1] = [20, 26];
      if (y >= 23) [x0, x1] = [21, 25];
      if (y >= 25) [x0, x1] = [22, 25];
      if (y >= 26) [x0, x1] = [22, 24];
      const swing = pose === 'sipDrink' && y >= 22 ? 1 : 0;
      for (let x = x0; x <= x1; x++) {
        const c = y === 26 ? (noise(x * 3, y) > 0.45 ? PAL.beardGrey : PAL.beardDark) : pajBeard(x, y);
        const yy = y < 20 ? y + dy : y;
        up.set(x + swing, yy, c);
        if (dy < 0 && y === 19) up.set(x + swing, y, c);
      }
    }
    up.rect(22, 15 + dy, 5, 1, PAL.beardDark); // moustache
  }

  // The arm, the cup and the thermos in hand.
  const sleeve = (x: number, y: number, w: number, h: number) => {
    front.rect(x, y, w, h, PAL.jacket);
    front.rect(x, y + h - 1, w, 1, PAL.jacketDark);
  };
  if (pose === 'sit' || pose === 'look') {
    sleeve(24, 29, 5, 3);
    cup(front, 28, 23);
    front.rect(29, 27, 2, 3, PAL.skin);
    front.set(28, 27, PAL.skin);
    front.set(30, 29, PAL.skinShade);
  } else if (pose === 'sipLift') {
    sleeve(24, 29, 4, 3);
    front.line(28, 29, 30, 26, PAL.skin);
    front.line(29, 29, 31, 26, PAL.skinShade);
    cup(front, 30, 19);
    front.rect(30, 23, 3, 3, PAL.skin);
  } else if (pose === 'sipDrink') {
    sleeve(22, 29, 6, 3);
    front.rect(28, 20, 2, 10, PAL.skin);
    front.rect(29, 20, 1, 10, PAL.skinShade);
    cup(front, 27, 14);
    front.rect(27, 18, 3, 2, PAL.skin);
    front.set(27, 15, PAL.skinShade); // the rim at his lip
  } else if (pose === 'pourReach') {
    // Reaching down to the thermos beside the chair; the other hand holds the cup low in his lap.
    sleeve(22, 29, 7, 3);
    front.line(27, 31, 33, 36, PAL.skin);
    front.line(27, 32, 33, 37, PAL.skinShade);
    front.rect(33, 35, 3, 2, PAL.skin);
    cup(front, 24, 29);
    front.rect(23, 31, 1, 2, PAL.skin);
  } else if (pose === 'pour') {
    // His right hand tips the thermos (3 wide, 6 tall on the slant) over the cup in his lap.
    sleeve(22, 29, 6, 3);
    front.line(27, 30, 29, 25, PAL.skin);
    front.line(28, 30, 30, 25, PAL.skinShade);
    for (let r = 21; r <= 26; r++) {
      const x0 = 26 + (26 - r);
      front.rect(x0, r, 3, 1, r === 26 ? PAL.stoneLight : PAL.mug);
      if (r < 26) front.set(x0, r, PAL.mugDark);
    }
    front.rect(29, 23, 2, 2, PAL.skin); // the hand on the thermos
    front.rect(25, 27, 1, 2, PAL.mugDark); // the stream
    cup(front, 24, 29);
    front.rect(23, 31, 1, 2, PAL.skin);
  } else {
    // cheer: the cup held high; the second frame lifts it a little
    const hi = breath;
    sleeve(24, 28, 5, 3);
    front.rect(28, 10 - hi, 2, 18 + hi, PAL.skin);
    front.rect(29, 10 - hi, 1, 18 + hi, PAL.skinShade);
    cup(front, 28 + hi, 4 - hi);
    front.rect(28, 8 - hi, 3, 2, PAL.skin);
  }

  p.blit(up.done(), lean, 0);
  const fx = pose === 'sit' || pose === 'look' || pose === 'sipLift' ? -2 : pose === 'cheer' ? -1 : 0; // the arm follows the slimmer body
  paintChairBack(p);
  // His right knee and shoe stick out past the arm of the chair.
  p.rect(28, 35, 4, 1, PAL.jeans);
  p.rect(27, 36, 6, 3, PAL.jeans);
  p.rect(28, 39, 4, 1, PAL.jeans);
  p.rect(28, 35, 3, 1, PAL.denim);
  p.rect(29, 40, 3, 3, PAL.jeans);
  p.rect(28, 43, 5, 2, PAL.shoe);
  p.rect(28, 45, 5, 1, PAL.shoeDark);
  if (pose !== 'pour') paintThermos(p);
  p.blit(front.done(), lean + fx, 0);
  p.outline();
  paintChairLegs(p);
  if (pose !== 'pour') paintThermosShadow(p);
  return p.done();
}

// Standing / walking side view, facing right (flip for left).
export const PAJ_WALK_SIZE = { w: 32, h: 52 };
export type PajWalkPose = 'stand' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'throw' | 'carry0' | 'carry1' | 'carry2' | 'carry3' | 'stretch0' | 'stretch1' | 'bend';
/** Number of frames in the walk cycle (walk0..walkN-1; carry0..carryN-1 is the same cycle with Bestia in his arms). */
export const PAJ_WALK_FRAMES = 4;
/** Every standing / walking pose, in the order the textures are baked. */
export const PAJ_WALK_POSES: readonly PajWalkPose[] = ['stand', 'walk0', 'walk1', 'walk2', 'walk3', 'throw', 'carry0', 'carry1', 'carry2', 'carry3', 'stretch0', 'stretch1', 'bend'];

/**
 * Bestia held in Pajkel's arms (slice 16), painted into his walking sprite: her body lies across the
 * crook of his arm in front of his chest, head forward over his forearm, the harness showing, paws
 * and tail hanging. Drawn before his head so his beard falls over her back.
 */
function paintCarriedDog(p: Pix, bob: number): void {
  const fur = (x: number, y: number) => (noise(x, y) > 0.8 ? PAL.gingerLight : noise(x, y) < 0.12 ? PAL.gingerDark : PAL.ginger);
  // Upper arm hanging from the shoulder to the elbow.
  for (let dx = 0; dx < 4; dx++) p.line(15 + dx, 21 + bob, 14 + dx, 29 + bob, dx === 3 ? PAL.jacketDark : dx === 0 ? PAL.jacketLight : PAL.jacket);
  // The dog: body across his front, a hind leg and a tail hanging behind, the head out over his forearm.
  p.ell(18, 27 + bob, 6.8, 3.6, fur);
  p.rect(12, 29 + bob, 2, 4, PAL.ginger); // hind leg dangling
  p.line(11, 26 + bob, 10, 31 + bob, PAL.ginger); // tail
  p.rect(21, 23 + bob, 2, 8, PAL.harness); // harness band
  p.set(21, 23 + bob, PAL.harnessDark);
  p.ell(26, 24 + bob, 3.6, 3.2, fur); // head
  p.rect(28, 24 + bob, 3, 2, PAL.gingerLight); // snout
  p.set(31, 24 + bob, PAL.outline); // nose
  p.set(27, 23 + bob, PAL.outline); // eye
  p.rect(23, 21 + bob, 2, 4, PAL.gingerDark); // a folded ear
  // His forearm under her chest and belly, the hand cupped under the front legs.
  p.rect(14, 29 + bob, 12, 4, PAL.jacket);
  p.rect(14, 32 + bob, 12, 1, PAL.jacketDark);
  p.rect(25, 29 + bob, 4, 4, PAL.skin);
  p.rect(25, 32 + bob, 4, 1, PAL.skinShade);
  p.rect(27, 28 + bob, 2, 1, PAL.gingerLight); // her front paws over his hand
}

/** Both arms stretched up: `high` = straight overhead, else out and up like a yawn. */
function paintStretchArms(p: Pix, high: boolean): void {
  const arm = (sx: number, ex: number, ey: number, c: number, edge: number) => {
    for (let dx = 0; dx < 4; dx++) p.line(sx + dx, 21, ex + dx, ey, dx === 3 ? edge : c);
  };
  // The far arm (darker, behind) and the near arm; the fists end in skin.
  arm(8, high ? 2 : 4, high ? 4 : 10, PAL.jacketDark, PAL.jacketDark);
  arm(17, high ? 25 : 24, high ? 3 : 8, PAL.jacket, PAL.jacketDark);
  for (const [x, y] of high ? [[2, 0], [25, 0]] : [[4, 7], [24, 5]]) {
    p.rect(x, y, 4, 4, PAL.skin);
    p.rect(x + 3, y, 1, 4, PAL.skinShade);
  }
}

export function pajkelWalkSprite(pose: PajWalkPose): Sprite {
  const p = new Pix(32, 52);
  const carry = pose.startsWith('carry');
  const stretch = pose.startsWith('stretch');
  const walking = pose.startsWith('walk') || carry;
  const f = walking ? Number(pose.slice(-1)) : 0;
  // Stride: legs apart in frames 0 and 2 (opposite ways), passing under the body in 1 and 3.
  const swing = walking ? [-5, 0, 5, 0][f] : 0;
  const passing = walking && f % 2 === 1;
  const bob = passing ? 1 : 0;
  // Far leg (darker, behind) then near leg: 6 px wide, the passing leg lifted at the knee.
  const leg = (x: number, c: number, lifted: boolean) => {
    const top = 32 + bob;
    const foot = lifted ? 46 : 48;
    p.rect(x, top, 6, foot - top + 1, c);
    p.rect(x, foot - 5, 1, 6, c === PAL.jeans ? PAL.denimLight : c);
    p.rect(x + (lifted ? 1 : 0), foot + 1, 8, 3, PAL.shoeDark);
    p.rect(x + (lifted ? 1 : 0), foot + 1, 8, 1, PAL.shoe);
  };
  const farLift = passing && f === 1;
  const nearLift = passing && f === 3;
  leg(11 - swing, PAL.denimDark, farLift);
  leg(14 + swing, PAL.jeans, nearLift);
  // Torso: a broad jacket with a belly in front and a lighter back.
  for (let y = 18 + bob; y <= 34; y++) {
    let x0 = 7;
    let x1 = y >= 24 ? 26 : 24;
    if (y === 18 + bob) [x0, x1] = [10, 22];
    else if (y === 19 + bob) [x0, x1] = [8, 24];
    else if (y >= 33) [x0, x1] = [8, 24];
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 10 ? PAL.jacketLight : x >= 22 ? PAL.jacketDark : PAL.jacket);
  }
  p.line(8, 34, 24, 34, PAL.jacketDark); // hem
  // Near arm: sleeve from the shoulder, swinging opposite the near leg, hand at the end.
  if (carry) paintCarriedDog(p, bob);
  else if (stretch) paintStretchArms(p, pose === 'stretch1');
  else if (pose === 'bend') {
    // Picking a stick up: the near arm reaches down and forward to the grass, hand open.
    for (let dx = 0; dx < 5; dx++) p.line(15 + dx, 21, 22 + dx, 42, dx === 4 ? PAL.jacketDark : dx === 0 ? PAL.jacketLight : PAL.jacket);
    p.rect(22, 43, 5, 4, PAL.skin);
    p.rect(26, 43, 1, 4, PAL.skinShade);
  } else if (pose !== 'throw') {
    const hx = Math.round(16 - swing * 0.9);
    const sx = 15;
    for (let dx = 0; dx < 5; dx++) p.line(sx + dx, 21 + bob, hx + dx, 27 + bob, dx === 4 ? PAL.jacketDark : dx === 0 ? PAL.jacketLight : PAL.jacket);
    p.rect(hx, 28 + bob, 5, 4, PAL.skin);
    p.rect(hx + 4, 28 + bob, 1, 4, PAL.skinShade);
  }
  // Head: hair, a profile face (no glasses), the long beard.
  p.ell(15, 9 + bob, 7, 7, pajHair);
  for (let y = 12; y <= 21; y++) for (let x = 7; x <= 13; x++) if (noise(x, y + 4) > 0.15 + (y - 12) * 0.03) p.set(x, y + bob, pajHair(x, y));
  p.ell(19, 11 + bob, 4, 5, PAL.skin);
  p.rect(23, 11 + bob, 2, 2, PAL.skin); // nose
  p.set(21, 9 + bob, PAL.outline); // eye
  p.line(20, 7 + bob, 23, 7 + bob, PAL.pajHairDark); // brow
  for (let y = 12; y <= 25; y++) {
    let x0 = 13;
    let x1 = 24;
    if (y >= 20) [x0, x1] = [15, 24];
    if (y >= 23) [x0, x1] = [17, 22];
    if (y >= 25) [x0, x1] = [18, 21];
    for (let x = x0; x <= x1; x++) p.set(x, y + bob, pajBeard(x, y));
  }
  p.rect(21, 12 + bob, 4, 1, PAL.beardDark);
  if (pose === 'throw') {
    // The arm winds up in front of the beard, stick in the fist.
    for (let dx = 0; dx < 4; dx++) p.line(17 + dx, 22, 24 + dx, 11, dx === 3 ? PAL.jacketDark : PAL.jacket);
    p.rect(25, 7, 4, 5, PAL.skin);
    p.rect(28, 7, 1, 5, PAL.skinShade);
    p.blit(STICK, 25, 6);
  }
  return p.outline().done();
}

// ---- The dog: small, ginger, short-haired, folded ears, yellow harness -------------------------

export const DOG_SIZE = { w: 32, h: 24 };
export type DogShape = 'lie' | 'sleep' | 'sit' | 'stand' | 'run' | 'bow';
export interface DogFrame {
  shape: DogShape;
  /** Tail wag frame 0..2 (lie), 0..1 (sit/stand). */
  tail: number;
  perked: boolean;
  /** Run cycle 0..3. */
  step: number;
  /** Carrying the stick: head up, tail high (run only). */
  carry?: boolean;
}

export function dogKey(f: DogFrame): string {
  return `dog:${f.shape}:${f.tail}:${f.perked ? 'p' : 'f'}:${f.step}${f.carry ? ':c' : ''}`;
}

export function dogSprite(frame: DogFrame): Sprite {
  // The play-bow always has its ears up.
  const f: DogFrame = frame.shape === 'bow' ? { ...frame, perked: true } : frame;
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
  } else if (f.shape === 'bow') {
    // Play-bow: front legs stretched out low, chest near the grass, rump and tail up, head down and forward.
    p.ell(9, 12, 5.5, 4.5, fur);
    p.ell(16, 16, 6.5, 3.5, fur);
    p.rect(5, 14, 2, 9, PAL.ginger);
    p.rect(10, 14, 2, 9, PAL.ginger);
    p.rect(14, 12, 2, 7, PAL.harness);
    p.rect(10, 11, 5, 1, PAL.harness);
    p.set(14, 12, PAL.harnessDark);
    p.line(19, 19, 27, 22, PAL.gingerLight);
    p.line(20, 20, 28, 23, PAL.gingerLight);
    head(24, 17);
    if (f.tail === 1) p.line(3, 9, 1, 4, PAL.ginger);
    else p.line(3, 9, 4, 3, PAL.ginger);
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
    const up = f.carry ? 1 : 0; // proud: chin up
    head(25, 7 - up);
    if (f.carry) {
      p.line(5, 9, 3, 4, PAL.ginger); // tail held high with a curl
      p.line(3, 4, 4, 2, PAL.gingerLight);
    } else p.line(5, 9, 2, 5, PAL.ginger);
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
  for (const tail of [0, 1]) out.push({ shape: 'bow', tail, perked: false, step: 0 });
  for (let step = 0; step < 4; step++) out.push({ shape: 'run', tail: 0, perked: false, step });
  for (let step = 0; step < 4; step++) out.push({ shape: 'run', tail: 0, perked: false, step, carry: true });
  return out;
}
