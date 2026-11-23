import { PAL } from './palette';
import { sprite, TRANSPARENT, type Sprite } from './pixelGrid';

/**
 * Pure art for the app icon: a chunky perch on the night-lake blue with a little ripple under it.
 * The fish is authored once on a 24 x 24 grid; the "any" icon pads it by 2 px, the maskable one by
 * 4 px (the fish then sits inside the central 75%, within the 80% safe zone).
 */

export const ICON_BG = 0x1b2b3a;
export const FISH_GRID = 24;

const COLORS: Record<string, number> = {
  o: PAL.outline,
  b: PAL.leafDark, // back
  g: PAL.leaf,
  s: PAL.leafDeep, // stripes
  y: PAL.straw, // flank
  Y: PAL.strawLight,
  c: PAL.cream, // belly
  r: PAL.red, // fins
  R: PAL.redLight,
  w: PAL.white, // eye
  '~': PAL.shallow3, // ripple
  '-': PAL.shallow1,
};

const FISH = `
........................
........o.o.o.o.........
.......oRoRoRoRo........
......oRRRRRRRRRo.......
......orrrrrrrrro.....o.
......ooobsbbooo.....oRo
....oosbbbsbbbsboo..oRro
...obbsbbbsbbbsbbbooRrro
..obbbsbbbsbbbsbbbbRrrRo
.ogggowgggsgggsggggrrRro
.ogggowgggsgggsggggrRrro
.ooyyysyyysyyysyyyyRrrRo
.oyyyysyyysyyysyyyyrrRro
..occccccccccccccccrRrro
...occccccccccccccoorrRo
....ooccccccccccoo..oRro
......oorrcccrro.....oro
.......oroooooo.......o.
........o...............
........................
...~-~-~-~...~-~-~-~-...
........................
......------------......
........................
`;

/** The fish alone (transparent around it), 24 x 24. */
export function fishSprite(): Sprite {
  return sprite(FISH, COLORS);
}

/** The icon motif on a square background that is `pad` px larger on every side. */
export function appIconSprite(maskable: boolean): Sprite {
  const pad = maskable ? 4 : 2;
  const size = FISH_GRID + pad * 2;
  const fish = fishSprite();
  const pixels = new Int32Array(size * size).fill(ICON_BG);
  for (let y = 0; y < fish.height; y++) {
    for (let x = 0; x < fish.width; x++) {
      const c = fish.pixels[y * fish.width + x];
      if (c !== TRANSPARENT) pixels[(y + pad) * size + x + pad] = c;
    }
  }
  return { width: size, height: size, pixels };
}

/** Nearest-neighbour upscale by an integer factor. */
export function scaleSprite(s: Sprite, k: number): Sprite {
  const width = s.width * k;
  const pixels = new Int32Array(width * s.height * k);
  for (let y = 0; y < s.height * k; y++) {
    for (let x = 0; x < width; x++) pixels[y * width + x] = s.pixels[Math.floor(y / k) * s.width + Math.floor(x / k)];
  }
  return { width, height: s.height * k, pixels };
}

/** Centres `s` in a size x size square of the background colour (size >= s.width). */
export function centreOnBackground(s: Sprite, size: number): Sprite {
  const pixels = new Int32Array(size * size).fill(ICON_BG);
  const ox = Math.floor((size - s.width) / 2);
  const oy = Math.floor((size - s.height) / 2);
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) pixels[(y + oy) * size + x + ox] = s.pixels[y * s.width + x];
  return { width: size, height: size, pixels };
}

/** The icon as a size x size image: the largest integer scale that fits, centred on the background. */
export function renderIcon(maskable: boolean, size: number): Sprite {
  const base = appIconSprite(maskable);
  return centreOnBackground(scaleSprite(base, Math.max(1, Math.floor(size / base.width))), size);
}
