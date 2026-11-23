import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';

/** Pure art for the small UI icons (gear, worm, coin) and the sleep "z", drawn at 16 x 16 on the 360 px canvas. */

const SIZE = 16;
const PINK_DARK = 0xc4607e;
const PINK_LIGHT = 0xffc2d2;

const NEIGHBOURS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Adds a 1 px outline around the non-transparent pixels of a w x h grid (a ring of empty margin is needed). */
function addOutline(filled: Int32Array, w: number, h: number, neighbours: number[][]): Int32Array {
  const out = Int32Array.from(filled);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (filled[y * w + x] !== TRANSPARENT) continue;
      const near = neighbours.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < w && ny < h && filled[ny * w + nx] !== TRANSPARENT;
      });
      if (near) out[y * w + x] = PAL.outline;
    }
  }
  return out;
}

/** Paints `mask` (on a (SIZE-2) grid, TRANSPARENT = empty) into a SIZE grid with a 1 px outline around it. */
function outlined(mask: (x: number, y: number) => number): Sprite {
  const inner = SIZE - 2;
  const filled = new Int32Array(SIZE * SIZE).fill(TRANSPARENT);
  for (let y = 0; y < inner; y++) for (let x = 0; x < inner; x++) filled[(y + 1) * SIZE + x + 1] = mask(x, y);
  return { width: SIZE, height: SIZE, pixels: addOutline(filled, SIZE, SIZE, NEIGHBOURS_4) };
}

/**
 * The settings gear: eight square teeth on a round cream body, a shaded lower right, and a hole in
 * the middle that shows what is behind it.
 */
export function gearSprite(): Sprite {
  const c = (SIZE - 2 - 1) / 2; // centre of the 14 x 14 mask
  return outlined((x, y) => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.hypot(dx, dy);
    if (r < 2.1) return TRANSPARENT; // the hole
    const onTooth = Math.cos(Math.atan2(dy, dx) * 8) > 0.35;
    if (r > 4.9 && !(r <= 6.8 && onTooth)) return TRANSPARENT;
    if (r < 3.2) return PAL.whiteShade; // ring around the hole
    return dx + dy > 3 ? PAL.whiteShade : PAL.cream;
  });
}

/** A fat pink worm with light and dark segments, curving like an S, with a tiny eye. */
export function wormSprite(): Sprite {
  const inner = SIZE - 2;
  const colour = new Int32Array(inner * inner).fill(TRANSPARENT);
  const set = (x: number, y: number, col: number) => {
    if (x >= 0 && y >= 0 && x < inner && y < inner) colour[y * inner + x] = col;
  };
  const body: [number, number][] = [];
  for (let x = 1; x <= 12; x++) body.push([x, Math.round(6.5 + 2.4 * Math.sin((x - 1) * 0.55 + 0.2))]);
  body.forEach(([x, y], i) => {
    const light = Math.floor(i / 2) % 2 === 0;
    const base = light ? PAL.pink : PINK_DARK;
    set(x, y - 2, light ? PINK_LIGHT : PAL.pink);
    set(x, y - 1, light ? PAL.pink : PINK_DARK);
    set(x, y, base);
    set(x, y + 1, PINK_DARK);
  });
  const [tx, ty] = body[0];
  set(tx - 1, ty, PINK_DARK); // rounded tail
  const [hx, hy] = body[body.length - 1];
  set(hx, hy - 1, PAL.outline); // eye
  set(hx + 1, hy, PAL.pink);
  set(hx + 1, hy - 1, PAL.pink);
  return outlined((x, y) => colour[y * inner + x]);
}

/** A gold coin: dark gold rim, bright face, a highlight on the upper left and an embossed centre mark. */
export function coinSprite(): Sprite {
  const c = (SIZE - 2 - 1) / 2;
  return outlined((x, y) => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.hypot(dx, dy);
    if (r > 6.5) return TRANSPARENT;
    if (r > 5.2) return dx + dy > 0 ? PAL.strawDark : PAL.straw; // rim: dark lower right, lit upper left
    if (Math.abs(dx) < 1 && Math.abs(dy) < 2.6) return PAL.strawDark; // centre mark
    if (dx + dy < -4.4 && r < 4.8 && r > 2.8) return PAL.sun; // shine
    return PAL.gold;
  });
}

/**
 * The sleep "z": a thin cream letter with only a 1 px drop shadow (down-right). A full outline
 * closes the Z into a dark box, which is what the play-test complained about.
 */
export function zSprite(big: boolean): Sprite {
  const rows = big
    ? ['#####', '...#.', '..#..', '.#...', '#####']
    : ['####', '..#.', '.#..', '####'];
  const w = rows[0].length + 1;
  const h = rows.length + 1;
  const px = new Int32Array(w * h).fill(TRANSPARENT);
  const on = (x: number, y: number) => rows[y]?.[x] === '#';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x, y)) px[y * w + x] = PAL.white;
      else if (on(x - 1, y - 1)) px[y * w + x] = PAL.outline;
    }
  }
  return { width: w, height: h, pixels: px };
}
