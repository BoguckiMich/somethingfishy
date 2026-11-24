import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/**
 * Pure art for the camp items on the grass by the car (slice 23e): the campfire (3 flicker frames), the tent, the string-light pole,
 * Bestia's bed and the windsock (3 strengths x 2 flap frames). The deck chair is Pajkel's own sitting art (characters.ts). Feet are the
 * bottom row, centred. A contact sheet is /dev/camp-sheet.html.
 */

// ---- Campfire ------------------------------------------------------------------------------

export const CAMPFIRE_SIZE = { w: 20, h: 16 };
export const CAMPFIRE_FRAMES = 3;
/** Where the middle of the flames is (the glow and the crackle sparks are centred here). */
export const CAMPFIRE_FLAME = { x: 10, y: 8 };

/** A flame layer: a teardrop `hw` wide at the base row, `h` tall, its tip leaning `lean` px. */
function flameLayer(p: Pix, baseY: number, hw: number, h: number, lean: number, col: number): void {
  for (let r = 0; r < h; r++) {
    const t = r / h;
    const half = Math.max(0, Math.round(hw * (1 - t) ** 0.85 + (r === h - 1 ? 0 : 0.2)));
    const cx = 10 + lean * t * t;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) p.set(x, baseY - r, col);
  }
}

/** Two crossed logs on a ring of grey stones, with flames that sway over three frames. */
export function campfireSprite(frame: number): Sprite {
  const p = new Pix(CAMPFIRE_SIZE.w, CAMPFIRE_SIZE.h);
  // Stones (a low ring, front row bigger).
  for (const [x, y, w] of [[1, 13, 3], [4, 14, 3], [8, 14, 4], [13, 14, 3], [16, 13, 3], [3, 12, 2], [15, 12, 2]]) {
    p.rect(x, y, w, 2, PAL.stone);
    p.rect(x, y, w, 1, PAL.stoneLight);
    p.rect(x, y + 1, w, 1, PAL.stoneDark);
  }
  // Logs, one rising to the right, one to the left.
  p.line(4, 13, 14, 10, PAL.woodDark);
  p.line(4, 12, 14, 9, PAL.wood);
  p.line(16, 13, 6, 10, PAL.woodDark);
  p.line(16, 12, 6, 9, PAL.woodLight);
  p.outline();
  // Flames over the logs (no outline: they glow).
  const f = frame % CAMPFIRE_FRAMES;
  const h = [9, 11, 8][f];
  const lean = [-1.2, 1.4, 0.2][f];
  flameLayer(p, 11, 4, h, lean, PAL.red);
  flameLayer(p, 11, 3, Math.round(h * 0.78), lean * 0.7, PAL.redLight);
  flameLayer(p, 11, 2, Math.round(h * 0.5), lean * 0.4, PAL.gold);
  p.set(10, 10, PAL.strawLight);
  p.set(9, 10, PAL.strawLight);
  // A second, small tongue that flips side with the frame.
  p.set(f === 0 ? 14 : f === 1 ? 6 : 13, 6 + f, PAL.redLight);
  p.set(f === 0 ? 14 : f === 1 ? 6 : 13, 7 + f, PAL.red);
  return p.done();
}

// ---- Tent ----------------------------------------------------------------------------------

export const TENT_SIZE = { w: 40, h: 44 };
/** The top of the ridge pole, where the string lights are tied (sprite pixels). */
export const TENT_ANCHOR = { x: 20, y: 1 };

/** A small cream ridge tent seen from the front, the right side in shade, red trim, a dark door with the flap pulled aside. */
export function tentSprite(): Sprite {
  const p = new Pix(TENT_SIZE.w, TENT_SIZE.h);
  const apex = 11;
  const base = 42;
  const half = (y: number) => ((y - apex) * 19) / (base - apex);
  for (let y = apex; y <= base; y++) {
    const hw = Math.round(half(y));
    for (let x = 20 - hw; x <= 20 + hw; x++) {
      const left = x < 20;
      // Cloth with a faint seam every few pixels.
      const seam = (x + 40) % 7 === 0 && y > apex + 3;
      p.set(x, y, left ? (seam ? PAL.sandLight : PAL.cream) : seam ? PAL.sandDark : PAL.sand);
    }
    p.set(20 - hw, y, PAL.red); // the trim along both edges
    p.set(20 + hw, y, PAL.redDark);
  }
  for (let x = 1; x <= 39; x++) p.set(x, base, x < 20 ? PAL.red : PAL.redDark); // hem
  // The door: a dark triangle, a lighter flap on its left.
  const doorTop = apex + 9;
  for (let y = doorTop; y < base; y++) {
    const dw = Math.round(((y - doorTop) * 7) / (base - 1 - doorTop));
    for (let x = 20 - dw; x <= 20 + dw; x++) p.set(x, y, x < 20 - dw + 2 && dw > 2 ? PAL.woodLight : PAL.woodDeep);
  }
  p.set(20, doorTop - 1, PAL.red);
  // The ridge pole above the apex.
  p.rect(20, TENT_ANCHOR.y, 1, apex - TENT_ANCHOR.y, PAL.woodLight);
  p.set(20, TENT_ANCHOR.y, PAL.gold);
  p.outline();
  return p.done();
}

// ---- The pole of the string lights --------------------------------------------------------

export const POLE_SIZE = { w: 7, h: 50 };
/** Where the string is tied (sprite pixels). */
export const POLE_ANCHOR = { x: 3, y: 1 };

/** A wooden pole with a cross-piece at the top and a stone footing. */
export function lightPoleSprite(): Sprite {
  const p = new Pix(POLE_SIZE.w, POLE_SIZE.h);
  p.rect(2, 3, 3, POLE_SIZE.h - 6, PAL.wood);
  p.rect(2, 3, 1, POLE_SIZE.h - 6, PAL.woodLight);
  p.rect(4, 3, 1, POLE_SIZE.h - 6, PAL.woodDark);
  p.rect(0, 2, 7, 2, PAL.wood);
  p.rect(0, 2, 7, 1, PAL.woodLight);
  p.set(3, POLE_ANCHOR.y, PAL.gold);
  p.rect(1, POLE_SIZE.h - 4, 5, 2, PAL.stone);
  p.rect(1, POLE_SIZE.h - 4, 5, 1, PAL.stoneLight);
  p.rect(2, POLE_SIZE.h - 2, 3, 1, PAL.stoneDark);
  p.outline();
  return p.done();
}

// ---- Bestia's bed ---------------------------------------------------------------------------

export const BED_SIZE = { w: 24, h: 11 };

/** A round blue dog bed seen from a little above: a puffy rim, a cream cushion with a tiny bone. */
export function dogBedSprite(): Sprite {
  const p = new Pix(BED_SIZE.w, BED_SIZE.h);
  p.ell(11.5, 6, 11.5, 4.8, PAL.denimDark);
  p.ell(11.5, 5.4, 11.1, 4.3, PAL.denimLight);
  p.ell(11.5, 6, 8.8, 3.1, PAL.whiteShade); // the dip: shaded at the back
  p.ell(11.5, 6.6, 8.4, 2.4, PAL.cream);
  for (const x of [4, 8, 12, 16, 19]) p.set(x, 2 + Math.round(Math.abs(x - 11.5) / 5), PAL.blueFlower); // a few stitches on the rim
  // The bone.
  p.rect(9, 5, 5, 1, PAL.white);
  p.set(8, 4, PAL.white);
  p.set(8, 6, PAL.white);
  p.set(14, 4, PAL.white);
  p.set(14, 6, PAL.white);
  p.outline();
  return p.done();
}

// ---- Windsock ---------------------------------------------------------------------------------

export const WINDSOCK_SIZE = { w: 32, h: 44 };
export const WINDSOCK_LEVELS = 3;
/** Where the ring on top of the pole is (the cone hangs from here). */
export const WINDSOCK_RING = { x: 4, y: 5 };

/**
 * A pole with a striped orange and white cone. `level` 0 hangs limp (a short, slack cone pointing down), 1 is half blown out (about 40
 * degrees below the horizontal), 2 is blown straight out. `flap` alternates the tip by a pixel so the sock looks alive.
 */
export function windsockSprite(level: number, flap: 0 | 1): Sprite {
  const p = new Pix(WINDSOCK_SIZE.w, WINDSOCK_SIZE.h);
  // The pole.
  p.rect(3, 4, 2, WINDSOCK_SIZE.h - 6, PAL.woodLight);
  p.rect(4, 4, 1, WINDSOCK_SIZE.h - 6, PAL.wood);
  p.rect(1, WINDSOCK_SIZE.h - 3, 6, 2, PAL.stone);
  p.rect(1, WINDSOCK_SIZE.h - 3, 6, 1, PAL.stoneLight);
  // The ring.
  p.rect(WINDSOCK_RING.x, WINDSOCK_RING.y - 1, 3, 1, PAL.stoneLight);
  const lv = Math.max(0, Math.min(2, Math.round(level)));
  // The direction of the cone (unit vector) and its length; the radius shrinks from 4.2 to 2.2 towards the tip.
  const ang = [Math.PI / 2 - 0.12, Math.PI / 4, 0.05][lv]; // 0 = right, PI/2 = straight down
  const len = [15, 21, 24][lv];
  const wob = (flap ? 1 : -1) * [0.5, 0.9, 1.1][lv];
  const ox = WINDSOCK_RING.x + 2;
  const oy = WINDSOCK_RING.y;
  const n = len * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // The cone sags a little (more when limp) and waves at the tip.
    const a = ang + Math.sin(t * Math.PI) * 0.0 + wob * 0.05 * t * (lv === 0 ? 3 : 1);
    const cx = ox + Math.cos(a) * len * t;
    const cy = oy + Math.sin(a) * len * t + (lv === 2 ? 3 * t * t : 0) + wob * t * t * 0.8;
    const rad = 4.4 - 2.2 * t;
    const stripe = Math.floor(t * 6) % 2 === 0;
    const col = stripe ? PAL.redLight : PAL.white;
    // The cross-section runs across the direction of the cone.
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    for (let k = -Math.floor(rad); k <= Math.floor(rad); k++) {
      p.set(cx + nx * k, cy + ny * k, k > Math.floor(rad) - 1 && stripe ? PAL.red : col);
    }
  }
  p.outline();
  return p.done();
}
