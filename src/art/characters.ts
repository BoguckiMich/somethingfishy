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

export const STICK = sprite('sLsssss', { s: PAL.woodLight, L: PAL.woodHi });

/**
 * The stick as the dog carries it: gripped across the mouth, the front end up and ahead of the
 * snout, the back end trailing behind the head, a small twig on top. Centred on its middle
 * (the mouth); faces right, flipped with the dog.
 */
export const STICK_CARRY_SIZE = { w: 17, h: 8 };
export function stickCarrySprite(): Sprite {
  const p = new Pix(STICK_CARRY_SIZE.w, STICK_CARRY_SIZE.h);
  p.line(4, 6, 16, 3, PAL.woodLight);
  p.line(4, 5, 16, 2, PAL.woodHi);
  p.line(12, 3, 14, 0, PAL.woodLight); // a twig
  p.set(4, 6, PAL.wood);
  return p.outline().done();
}

/** A stick lying on the grass (slice 17): a bit bigger than the thrown one, slightly tilted, with a twig. */
export const STICK_GROUND_SIZE = { w: 11, h: 5 };
export function stickGroundSprite(): Sprite {
  const p = new Pix(STICK_GROUND_SIZE.w, STICK_GROUND_SIZE.h);
  p.line(1, 3, 9, 2, PAL.woodLight);
  p.line(1, 2, 9, 1, PAL.woodHi);
  p.line(6, 2, 8, 0, PAL.woodLight); // a twig
  p.set(1, 3, PAL.wood);
  return p.outline().done();
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

export const PAJ_SIZE = { w: 40, h: 44 };
export type PajPose = 'sit' | 'sip' | 'cheer' | 'look';

const pajHair = (x: number, y: number) => {
  const n = noise(x, y);
  if (n > 0.62) return PAL.pajHairLight;
  if (n < 0.18 || y > 19) return PAL.pajHairDark;
  return PAL.pajHair;
};
const pajBeard = (x: number, y: number) => {
  const n = noise(x * 2, y);
  if (y > 20 && n > 0.78) return PAL.beardGrey;
  if (n > 0.62) return PAL.beardLight;
  if (n < 0.25 || y > 24) return PAL.beardDark;
  return PAL.beard;
};

/**
 * Seen from behind, sitting on the dock with the rod in his left hand (left of the picture) and the
 * thermos in his right. Slate jacket with a collar, two shoulders and a back seam; the head is
 * turned a little to the right so the cheek and the long beard show ('look' faces the water
 * squarely: only the back of the head).
 */
export function pajkelSittingSprite(pose: PajPose, breath: 0 | 1): Sprite {
  const p = new Pix(40, 44);
  const dy = breath;
  // Jacket body: sloping shoulders, a darker side each, a seam down the back.
  for (let y = 22; y <= 41; y++) {
    let x0 = 10;
    let x1 = 29;
    if (y === 22) [x0, x1] = [15, 24];
    else if (y === 23) [x0, x1] = [12, 27];
    else if (y === 24) [x0, x1] = [11, 28];
    else if (y >= 40) [x0, x1] = [11, 28];
    for (let x = x0; x <= x1; x++) p.set(x, y, x <= 13 ? PAL.jacketLight : x >= 26 ? PAL.jacketDark : PAL.jacket);
  }
  p.line(19, 27, 19, 41, PAL.jacketDark); // back seam
  p.line(14, 24, 11, 26, PAL.jacketDark); // where each shoulder meets the arm
  p.line(25, 24, 28, 26, PAL.jacketDark);
  // Neck, then the collar over its foot.
  p.rect(17, 17, 6, 6, PAL.skinShade);
  p.rect(16, 21, 8, 2, PAL.jacketDark);
  p.rect(17, 21, 6, 1, PAL.jacket);
  // Left arm (picture left) bent forward holding the rod: sleeve, hand, and the rod rising away.
  p.rect(5, 25, 5, 9, PAL.jacket);
  p.rect(5, 25, 1, 9, PAL.jacketLight);
  p.rect(9, 25, 1, 9, PAL.jacketDark);
  p.rect(5, 34, 5, 3, PAL.skin);
  p.rect(9, 34, 1, 3, PAL.skinShade);
  p.line(7, 33, 4, 3, PAL.woodHi);
  p.line(8, 33, 5, 3, PAL.woodDark);
  p.rect(6, 34, 3, 2, PAL.woodDark); // the grip in his fist
  // Right arm (picture right): thermos in hand, or raised to sip / cheer.
  const sleeve = (x: number, y: number, h: number) => {
    p.rect(x, y, 4, h, PAL.jacket);
    p.rect(x + 3, y, 1, h, PAL.jacketDark);
  };
  if (pose === 'sip') {
    sleeve(29, 25, 5);
    p.rect(30, 20, 3, 6, PAL.skin);
    p.rect(29, 13, 4, 7, PAL.mug);
    p.rect(29, 13, 1, 7, PAL.mugDark);
    p.rect(29, 11, 4, 2, PAL.stoneLight);
  } else if (pose === 'cheer') {
    sleeve(29, 25, 4);
    p.rect(30, 12, 3, 14, PAL.skin);
    p.rect(32, 12, 1, 14, PAL.skinShade);
    p.rect(29, 5, 5, 7, PAL.mug);
    p.rect(29, 5, 1, 7, PAL.mugDark);
    p.rect(29, 3, 5, 2, PAL.stoneLight);
  } else {
    sleeve(29, 25, 7);
    p.rect(30, 32, 3, 3, PAL.skin);
    p.rect(30, 31, 4, 8, PAL.mug);
    p.rect(30, 31, 1, 8, PAL.mugDark);
    p.rect(30, 29, 4, 2, PAL.stoneLight);
  }
  // Messy shoulder-length dirty-blond hair: the crown, and strands falling over the collar.
  const lobe = (x0: number, x1: number, density: number) => {
    for (let y = 14; y <= 23; y++) for (let x = x0; x <= x1; x++) if (noise(x + 3, y) > density + (y - 14) * 0.035) p.set(x, y + (y < 18 ? dy : 0), pajHair(x, y));
  };
  p.ell(20.5, 10 + dy, 9.5, 8.5, pajHair);
  if (pose === 'look') {
    p.ell(20.5, 12 + dy, 9.5, 9, pajHair);
    lobe(11, 16, 0.08);
    lobe(25, 30, 0.08);
    // Beard edges peeking out past the jaw on both sides.
    for (let y = 14; y <= 21; y++) {
      p.set(10, y, pajBeard(10, y));
      p.set(31, y, pajBeard(31, y));
    }
    for (let x = 17; x <= 23; x++) p.set(x, 18 + (x % 2), PAL.pajHairDark); // hair parted over the nape
  } else {
    lobe(11, 17, 0.1);
    // Head turned right: a sliver of cheek, brow, eye and nose, the beard hanging under it.
    p.ell(27.5, 13 + dy, 3.6, 5.5, PAL.skin);
    p.rect(30, 13 + dy, 3, 2, PAL.skin); // nose
    p.set(29, 12 + dy, PAL.outline); // eye
    p.line(27, 10 + dy, 31, 10 + dy, PAL.pajHairDark); // brow
    for (let y = 15; y <= 27; y++) {
      let x0 = 22;
      let x1 = 31;
      if (y >= 22) [x0, x1] = [24, 30];
      if (y >= 25) [x0, x1] = [25, 29];
      if (y >= 27) [x0, x1] = [26, 28];
      for (let x = x0; x <= x1; x++) p.set(x, y + (y < 20 ? dy : 0), pajBeard(x, y));
    }
    p.rect(28, 16 + dy, 5, 1, PAL.beardDark); // moustache
    if (pose === 'sip') p.rect(29, 18 + dy, 3, 1, PAL.beardDark);
  }
  return p.outline().done();
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
