import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/**
 * Pure art for the car (slice 16): a white Citroen DS4 (2nd generation, 2021+), a sleek compact
 * crossover-hatchback. Only the FRONT QUARTER is drawn, seen from the side, facing right, and the
 * left edge of the picture is where the screen edge cuts the car off: slim angular LED headlight
 * with a light-blue daytime strip, a chrome trim line under the dark tinted window, black lower
 * trim and wheel arch, the front wheel and the front door.
 * Three variants: door closed, door open, and closed with the warm interior light on.
 */

export const CAR_SIZE = { w: 76, h: 46 };
export type CarVariant = 'closed' | 'open' | 'light';
export const CAR_VARIANTS: readonly CarVariant[] = ['closed', 'open', 'light'];
export const carKey = (v: CarVariant) => `car:${v}`;

/** Where things sit in the picture (sprite pixels). The scene and the companions use these. */
export const CAR_PARTS = {
  /** The little LED strip of the headlight (x, y, w, h): the scene lights it a little at night. */
  led: { x: 62, y: 21, w: 9, h: 1 },
  /** The front door's centre, where Pajkel and Bestia step in and out. */
  door: { x: 24, y: 28 },
  /** The glass of the front door, for the interior light glow. */
  window: { x: 8, y: 6, w: 32, h: 12 },
};

const WHEEL = { x: 50, y: 35, r: 9.4 };

/** Fills a polygon (even-odd scanline) with a colour or a per-pixel colour function. */
function fillPoly(p: Pix, pts: readonly (readonly [number, number])[], c: number | ((x: number, y: number) => number)): void {
  const ys = pts.map((q) => q[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) p.set(x, y, typeof c === 'number' ? c : c(x, y));
    }
  }
}

/** Paint colour at a body pixel: bright on the shoulder, soft grey lower down (the shading of a white car). */
function paint(y: number): number {
  if (y <= 19) return PAL.white;
  if (y <= 24) return PAL.white;
  if (y <= 28) return PAL.whiteShade;
  return PAL.stoneLight;
}

/** The roof, windows frame and the body, shared by all variants. */
function paintBody(p: Pix): void {
  const edge = PAL.outline;
  // Body silhouette: roof at the top left, the windscreen sloping down to the cowl, a long low bonnet, the nose.
  const hull: [number, number][] = [
    [-2, 3], [22, 3], [26, 4], [31, 6], [37, 12], [43, 17], [56, 19], [68, 21], [73, 23], [75, 27], [75, 33], [73, 36], [-2, 36],
  ];
  fillPoly(p, hull, (_x, y) => paint(y));
  // Soft light along the roof and the bonnet's crown.
  for (let x = 0; x <= 24; x++) p.set(x, 3, PAL.white);
  for (let x = 44; x <= 68; x++) p.set(x, 19 + Math.round((x - 44) * 0.08), PAL.white);
  // The A-pillar and roof edge get the dark outline.
  p.line(22, 2, 26, 3, edge);
  p.line(26, 3, 31, 5, edge);
  p.line(31, 5, 37, 11, edge);
  p.line(37, 11, 43, 16, edge);
  for (let x = 0; x <= 22; x++) p.set(x, 2, edge);

  // Black lower trim: sill cladding and the front bumper's dark intake.
  fillPoly(p, [[-2, 31], [38, 31], [60, 31], [72, 31], [75, 32], [75, 33], [73, 36], [-2, 36]], PAL.outlineSoft);
  p.rect(0, 31, 38, 1, PAL.stoneDark);
  p.rect(64, 27, 10, 3, PAL.outlineSoft); // the lower air intake, black
  p.rect(66, 28, 6, 1, PAL.stoneDark);
  // Front bumper lip catching a little light.
  p.line(72, 31, 74, 31, PAL.stone);
}

function paintWheel(p: Pix): void {
  const { x: cx, y: cy, r } = WHEEL;
  // Wheel arch: a black ring around the tyre (cladding), its top half over the white paint.
  p.ell(cx, cy, r + 2.4, r + 2.4, (_x, y) => (y <= cy + 3 ? PAL.outlineSoft : PAL.outline));
  // Inside the arch, behind the tyre: dark.
  p.ell(cx, cy, r + 1, r + 1, PAL.outline);
  // Tyre, rim, hub.
  p.ell(cx, cy, r, r, PAL.outlineSoft);
  p.ell(cx, cy, 6.2, 6.2, PAL.stoneLight);
  p.ell(cx, cy, 5.2, 5.2, PAL.stone);
  // Five spokes in a bright alloy.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    p.line(cx, cy, cx + Math.cos(a) * 5.3, cy + Math.sin(a) * 5.3, PAL.white);
  }
  p.ell(cx, cy, 1.6, 1.6, PAL.stoneDark);
  p.set(cx, cy, PAL.stoneLight);
  // A sliver of light on the tyre's upper left.
  p.set(cx - 7, cy - 3, PAL.stone);
  p.set(cx - 6, cy - 5, PAL.stone);
}

function paintHeadlight(p: Pix): void {
  // A slim, angular LED unit wrapping the top of the nose: a dark housing with one clean light-blue
  // daytime strip that turns white at the very front, and a small second line under it.
  fillPoly(p, [[59, 20], [69, 22], [74, 25], [74, 27], [68, 26], [59, 23]], PAL.outlineSoft);
  p.line(60, 21, 68, 23, PAL.shallow3);
  p.line(69, 23, 73, 25, PAL.foam);
  p.set(73, 25, PAL.white);
  p.line(62, 24, 67, 25, PAL.shallow1);
  // Chrome trim accent: a thin bright line along the fender, from the arch towards the nose.
  p.line(57, 26, 66, 28, PAL.stoneLight);
  p.line(58, 25, 64, 26, PAL.white);
}

/** The window: dark tinted glass, a pale reflection, chrome trim beneath; `glow` = interior light on. */
function paintWindow(p: Pix, glow: boolean): void {
  const glass: [number, number][] = [[6, 5], [28, 5], [31, 6], [38, 13], [40, 18], [6, 18]];
  fillPoly(p, glass, glow ? PAL.straw : PAL.deep0);
  if (glow) {
    fillPoly(p, [[6, 5], [28, 5], [31, 6], [33, 9], [6, 9]], PAL.strawLight);
    // The seats show as dark shapes against the light: a headrest and a seat back.
    p.ell(14, 8, 2.6, 2.4, PAL.woodDark);
    fillPoly(p, [[11, 11], [18, 11], [19, 18], [10, 18]], PAL.woodDark);
    p.ell(30, 12, 1.5, 3, PAL.woodDeep);
  } else {
    // A diagonal reflection and a lighter upper band.
    fillPoly(p, [[6, 5], [28, 5], [31, 6], [32, 8], [6, 8]], PAL.deep1);
    p.line(18, 17, 24, 8, PAL.deep2);
    p.line(21, 17, 26, 10, PAL.deep2);
    p.line(28, 12, 30, 9, PAL.deep1);
  }
  // Pillar between the rear window and this door: black, with a sliver of rear glass behind it.
  p.rect(0, 5, 3, 13, PAL.deep0);
  p.rect(3, 5, 3, 13, PAL.outlineSoft);
  // Chrome strip under the glass, a bright top edge over a grey one.
  p.line(6, 19, 41, 19, PAL.white);
  p.line(6, 20, 42, 20, PAL.stoneLight);
  p.line(2, 19, 5, 19, PAL.stoneLight);
}

/** Door cut lines, handle, mirror: all the small details that make it a car and not a box. */
function paintDoor(p: Pix): void {
  const cut = PAL.stone;
  p.line(6, 21, 6, 30, cut); // rear edge (the B-pillar)
  p.line(37, 21, 37, 30, cut); // front edge, behind the wheel arch
  p.line(7, 21, 36, 21, PAL.whiteShade);
  p.line(7, 31, 36, 31, PAL.stone); // sill line
  // Flush door handle and the character line along the door.
  p.rect(26, 23, 5, 1, PAL.stoneDark);
  p.rect(26, 22, 5, 1, PAL.white);
  p.line(8, 26, 36, 26, PAL.stoneLight);
  // The wing mirror: a black housing at the foot of the A-pillar.
  p.rect(38, 15, 6, 4, PAL.outlineSoft);
  p.rect(39, 15, 4, 1, PAL.stoneDark);
  p.set(44, 17, PAL.outline);
}

/** The door standing open: the dark interior shows, and the door leaf swings out towards the viewer, seen foreshortened. */
function paintOpenDoor(p: Pix): void {
  // The doorway: dark cabin through the opening and the window.
  fillPoly(p, [[6, 5], [28, 5], [31, 6], [38, 13], [40, 19], [38, 31], [6, 31]], PAL.outlineSoft);
  fillPoly(p, [[7, 6], [28, 6], [31, 7], [37, 13], [39, 19], [7, 19]], PAL.deep0);
  // The seat: a headrest and a back, a bit lighter than the dark cabin; the floor is dark.
  p.ell(14, 10, 2.8, 2.6, PAL.stoneDark);
  fillPoly(p, [[10, 12], [19, 12], [21, 26], [9, 26]], PAL.stoneDark);
  fillPoly(p, [[11, 13], [14, 13], [14, 25], [10, 25]], PAL.stone);
  p.rect(9, 27, 14, 3, PAL.outline);
  // The door leaf, hinged at the front edge, swung out and down towards us.
  fillPoly(p, [[37, 18], [25, 22], [25, 36], [37, 31]], (_x, y) => (y <= 28 ? PAL.whiteShade : PAL.stoneLight));
  fillPoly(p, [[36, 19], [27, 22], [27, 26], [36, 24]], PAL.deep1);
  p.line(37, 18, 25, 22, PAL.white);
  p.line(25, 22, 25, 36, PAL.stone);
  p.line(25, 36, 37, 31, PAL.stoneDark);
  p.line(37, 18, 37, 31, PAL.stone);
  p.line(26, 27, 36, 25, PAL.stone);
  p.rect(28, 28, 4, 1, PAL.stoneDark);
}

/** Draws one variant. All three share the body, wheel and headlight, so only the door area differs. */
export function carSprite(variant: CarVariant): Sprite {
  const p = new Pix(CAR_SIZE.w, CAR_SIZE.h);
  paintBody(p);
  if (variant === 'open') paintOpenDoor(p);
  else {
    paintWindow(p, variant === 'light');
    paintDoor(p);
  }
  paintWheel(p);
  paintHeadlight(p);
  // A slim outline round the whole shape (the left edge is cut by the screen, so no outline needs to run there).
  return p.outline().done();
}
