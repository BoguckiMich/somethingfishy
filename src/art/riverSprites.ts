import { lerpColor } from './dayCycle';
import { PAL } from './palette';
import { bayer, mulberry32 } from './raster';
import { sprite, TRANSPARENT, type Sprite } from './pixelGrid';

/** Sprites of the River bend (slice 25b), pure: willows, alders, the ferry posts and the boulders. */

/** Pads every row with `.` to the widest row, so hand-drawn grids may end ragged on the empty side. */
function padded(grid: string): string {
  const rows = grid
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.')).join('\n');
}

const LEAF = { H: PAL.leafHi, l: PAL.leafLight, m: PAL.leaf, d: PAL.leafDark, D: PAL.leafDeep, t: PAL.woodLight, T: PAL.woodDark, B: PAL.woodDeep };

/** A weeping willow: a round crown with long drooping fronds that nearly touch the water; the trunk shows between them. */
export const WILLOW = sprite(
  padded(`
  .........HHllll
  .......HllllmmllH
  .....HlllmmmmmmmllH
  ....llmmmmdmmmmmmmllH
  ...HlmmmmmmmmdmmmmmmlH
  ...llmmdmmmmmmmmmdmmmll
  ...lmmmmmmdmmmmmmmmmmmd
  ..HlmmdmmmmmmmdmmmmmmdD
  ..lmmmmmlmmmmmmmmlmmmdD
  ..lmdmm.lmmdmmT.lmmmdmdD
  ..lmd.m.lmmd.mT.lmm.dmdD
  ..lm..m..lmd.mT..lm..md
  ..ld..d..lmd.dT..ld..md
  ..lm..m...md.mT..lm...d
  ..ld..d...Td.dT..ld...d
  ..d...d...Td.d...d....D
  ..D...d...T..d...D
  ..D...D...T..D...
  ......D...T.....
  `),
  LEAF,
);

/** An alder: a compact, darker, rounder tree on a thin trunk. */
export const ALDER = sprite(
  padded(`
  ....lmmmm
  ..lHlmmmmml
  .lllmmmdmmml
  .lmmmmmmmdmmd
  lmmdmmmmmmmmmd
  lmmmmmmdmmmdmd
  .mmmmdmmmmmmdD
  .mdmmmmmmdmmDD
  ..dmmmdmmmdDD
  ...ddmmmdDDD
  .....dtTd
  .....tTT
  .....tT
  .....tT
  `),
  LEAF,
);

/** A small alder bush for the far bank's gaps. */
export const ALDER_LOW = sprite(
  padded(`
  ..lHlmmml
  .lllmmmdml
  lmmmdmmmmmd
  lmdmmmmdmmD
  .mmmmdmmmDD
  ..ddmmmdDD
  ....tT.
  `),
  LEAF,
);

const POSTC = { o: PAL.outline, H: PAL.woodHi, L: PAL.woodLight, w: PAL.wood, d: PAL.woodDark, D: PAL.woodDeep, s: PAL.stone, S: PAL.stoneDark, r: PAL.sandDark };

/** The far bank's ferry post (the rope ends at its top): a plain tall post with an iron ring near the top. */
export const FAR_POST = sprite(
  padded(`
  .oo.
  oLwo
  oLwo
  oSsd
  oLwd
  oLwd
  oLwd
  oLdD
  oLwd
  oLwd
  oLwd
  oLdD
  oLwd
  oLwd
  oddD
  oddD
  oddD
  oDDD
  `),
  POSTC,
);
/** Where the rope is tied on the far post, from the sprite's top. */
export const FAR_POST_ROPE_Y = 3;

/** The ferry rope's post at the landing's left edge: thick, tall, an iron cap, a rope-worn neck near the top. */
export const ROPE_POST = sprite(
  padded(`
  ..oooo..
  .oSssSo.
  .oLLwdo.
  oHLLwwdo
  orrrrrro
  orrrrrro
  oLLwwwdo
  oLLwwwdo
  oHLwwddo
  oLLwwddo
  oLwwwddo
  oLwwdddo
  oLLwwddo
  oLwwwddo
  oLwwdddo
  oLwwwddo
  oLwwddDo
  oLLwwddo
  oLwwdddo
  oLwwwddo
  oLwwddDo
  oLwwwddo
  oLwwdddo
  oLwwwddo
  oLwwddDo
  oLLwwddo
  oLwwdddo
  oLwwwddo
  oLwwddDo
  oLwwdddo
  oLwwddDo
  oLwwwddo
  oLwwddDo
  oLwwdddo
  oLwwddDo
  oLwwwddo
  oLwwddDo
  oLwwdddo
  oLwwddDo
  oLwwwddo
  oLwwddDo
  oLwwdddo
  oLwwddDo
  oDddddDo
  .oDDDDo.
  `),
  POSTC,
);
/** The rope is tied here, from the post's top-left (the worn neck rows). */
export const ROPE_POST_KNOT = { x: 4, y: 5 };

/** A stubby mooring post for the landing: a fat cap, a rope-worn neck. */
export const MOORING_POST = sprite(
  padded(`
  .oooooo.
  oHLLLwdo
  oLLwwddo
  .oLwwdo.
  .orrrro.
  .oLwwdo.
  .oLwwdo.
  .oLwdDo.
  oLwwwddo
  oddddDDo
  `),
  POSTC,
);

/** The dock post (the lake's) turned weathered and grey for the ferry landing's stilts, with a moss collar at the foot. */
export function weatheredPostSprite(src: Sprite): Sprite {
  const pixels = new Int32Array(src.pixels);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const c = pixels[y * src.width + x];
      if (c === TRANSPARENT || c === PAL.outline) continue;
      let v = lerpColor(c, PAL.stone, 0.4);
      if (y >= src.height - 3 && bayer(x, y) < 0.6) v = lerpColor(PAL.leafDark, PAL.woodDark, 0.4);
      pixels[y * src.width + x] = v;
    }
  }
  return { width: src.width, height: src.height, pixels };
}

// ---- Boulders ------------------------------------------------------------------------------

export type BoulderSize = 's' | 'm' | 'l';
export const BOULDER_SIZES: Record<BoulderSize, { w: number; h: number }> = { s: { w: 10, h: 8 }, m: { w: 16, h: 11 }, l: { w: 24, h: 15 } };

/**
 * A boulder: a rounded grey body lit from the upper left, a mossy top, and a darker wet band at the foot (the waterline).
 * Built from a dome with a little noise, then shaded; the bottom edge carries the outline.
 */
export function boulderSprite(size: BoulderSize, seed: number): Sprite {
  const { w, h } = BOULDER_SIZES[size];
  const rnd = mulberry32(seed);
  const pixels = new Int32Array(w * h).fill(TRANSPARENT);
  const cx = (w - 1) / 2;
  const wet = size === 's' ? 1 : 2;
  const wobble: number[] = [];
  for (let x = 0; x < w; x++) wobble.push((rnd() - 0.5) * 1.1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / (w / 2);
      const top = h - 1 - (h - 2) * Math.sqrt(Math.max(0, 1 - nx * nx)) + wobble[x];
      if (y < top || (nx * nx > 0.8 && y > h - 2)) continue;
      const lit = 1 - (x / w) * 0.6 - (y / h) * 0.7;
      let c: number = lit > 0.62 ? PAL.stoneLight : lit > 0.28 ? PAL.stone : PAL.stoneDark;
      const depth = y - Math.ceil(top);
      // Moss on the crown, ragged.
      if (depth <= (size === 's' ? 1 : 2) && bayer(x, y) < 0.78 - depth * 0.25) c = depth === 0 && x < cx ? PAL.leafLight : PAL.leaf;
      if (depth === 1 && size !== 's' && bayer(x + 2, y) < 0.35) c = PAL.leafDark;
      // A crack.
      if (size === 'l' && x === Math.round(cx + 3) && y > 5 && y < 11) c = PAL.stoneDark;
      // The wet band at the foot.
      if (y >= h - wet) c = y === h - 1 ? PAL.outline : PAL.stoneDark;
      pixels[y * w + x] = c;
    }
  }
  return { width: w, height: h, pixels };
}

/** Nearest-neighbour scaling by a fractional factor (1.5 etc.): a bigger tree from the same drawing, for variety on the far bank. */
export function scaleSprite(s: Sprite, k: number): Sprite {
  const w = Math.round(s.width * k);
  const h = Math.round(s.height * k);
  const pixels = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixels[y * w + x] = s.pixels[Math.min(s.height - 1, Math.floor(y / k)) * s.width + Math.min(s.width - 1, Math.floor(x / k))];
  return { width: w, height: h, pixels };
}

export const WILLOW_BIG = scaleSprite(WILLOW, 1.5);
export const ALDER_BIG = scaleSprite(ALDER, 1.4);
