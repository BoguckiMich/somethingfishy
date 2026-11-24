import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * Pixel art of the lake moments (slice 14): pure grids drawn from the shared palette. The scene
 * (scenes/MomentsView.ts) places, bobs, tints and fades them; nothing here knows about Phaser.
 */

/** 21 x 11: a mallard drake facing right (green head, white collar, brown body). */
export const DUCK = sprite(
  `
  ..........ooooo......
  .........ogggggGo....
  .........ogggkgGoyyy.
  .........ogggggGoYYY.
  ..........oggGGo.....
  .........owwwwwwo....
  .dd.....ooBBBBBBBbo..
  .oddooobBBBBBBBBBbo..
  oddbbbbBBBBBBBBBBbbo.
  .obbbbbbbbbbbbbbbbo..
  ...ooooooooooooooo...
`,
  { o: PAL.outline, g: PAL.leafLight, G: PAL.leaf, k: PAL.outline, y: PAL.gold, Y: PAL.strawDark, w: PAL.white, b: PAL.wood, B: PAL.woodLight, d: PAL.woodDark },
);

const FROG_COLORS = { o: PAL.outline, F: PAL.leafHi, f: PAL.leaf, k: PAL.outline, c: PAL.cream, L: PAL.lily, l: PAL.lilyDark };

/** 20 x 8: a frog sitting, mouth closed (it sits on the lily pad, its own 20 x 6 sprite right below it). */
export const FROG_IDLE = sprite(
  `
  .....ooo....ooo.....
  ....oFkFo..oFkFo....
  ....oFFFooooFFFo....
  ...oFFFFFFFFFFFFo...
  ..oFFFFFFFFFFFFFFo..
  ..oFfFFFFFFFFFFfFo..
  .oFFFoFFFFFFFFoFFFo.
  ..ooo..oooooooo..ooo
`,
  FROG_COLORS,
);

/** The same frog with its throat puffed (alternates with the idle frame, a slow croak). */
export const FROG_PUFF = sprite(
  `
  .....ooo....ooo.....
  ....oFkFo..oFkFo....
  ....oFFFooooFFFo....
  ...oFFFFFFFFFFFFo...
  ..oFFFccccccccFFFo..
  ..oFfFccccccFFFfFo..
  .oFFFoFFFFFFFFoFFFo.
  ..ooo..oooooooo..ooo
`,
  FROG_COLORS,
);

/** 20 x 6: the lily pad the frog sits on (stays a moment after the frog plops in). */
export const FROG_PAD = sprite(
  `
  ....oooooooooooo....
  ..ooLLLLLLLLLLLLoo..
  .oLLLLLLLLLLLLLLLLo.
  oLLLLLLLLLLLLLLLLLlo
  .ooollllllllllllooo.
  ....oooooooooooo....
`,
  FROG_COLORS,
);

/** 21 x 9: a small silver fish facing right; the scene tilts it along its arc. */
export const JUMP_FISH = sprite(
  `
  ......oooooooooo.....
  ....ooSSSSSSSSSSoo...
  ..ooTSSSSSSSSSSSSSoo.
  .oTTTSSSSSSSSSSSSkSSo
  oTTTTsSSSSSSSSSSSSSSo
  .oTTTsssssssssssssso.
  ..ooTsssssssssssssoo.
  ....oossssssssssoo...
  ......oooooooooo.....
`,
  { o: PAL.outline, S: PAL.foam, s: PAL.shallow3, T: PAL.shallow2, k: PAL.outline },
);

/** 7 x 7: the head of a shooting star, and the sparkle shown when it is caught. */
export const STAR_HEAD = sprite(
  `
  ...g...
  ...w...
  ..gwg..
  gwwWwwg
  ..gwg..
  ...w...
  ...g...
`,
  { g: PAL.gold, w: PAL.cream, W: PAL.white },
);

/** 19 x 9: a corked bottle with a rolled note, lying on the water. */
export const BOTTLE = sprite(
  `
  ..ooooooooo........
  .oGGGGGGGGGo.......
  oGGPPPPPPPGGoooooo.
  oGGPpppPPPGGGGGGCCo
  oGGPPpPPPPGGGGGGCCo
  oGGPPPPPPPGGGGGGCCo
  oGGPPPPPPPGGoooooo.
  .ogggggggggo.......
  ..ooooooooo........
`,
  { o: PAL.outline, G: PAL.foam, g: PAL.shallow3, P: PAL.cream, p: PAL.sandDark, C: PAL.woodLight },
);

/** 21 x 9: the sealed story bottle: the bottle with a red wax seal over the cork (slice 21; it never drifts away). */
export const STORY_BOTTLE = sprite(
  `
  ..ooooooooo..........
  .oGGGGGGGGGo..oooo...
  oGGPPPPPPPGGooRRRRo..
  oGGPpppPPPGGGGRrRRRo.
  oGGPPpPPPPGGGGRRRRRo.
  oGGPPPPPPPGGGGRRRRDo.
  oGGPPPPPPPGGooRRRDo..
  .ogggggggggo..oooo...
  ..ooooooooo..........
`,
  { o: PAL.outline, G: PAL.foam, g: PAL.shallow3, P: PAL.cream, p: PAL.sandDark, R: PAL.red, r: PAL.redLight, D: PAL.redDark },
);

/** 11 x 7: a sandwich lying on the planks (Q2: the duck takes it). */
export const SANDWICH = sprite(
  `
  ..ooooooo..
  .oBBBBBBBo.
  oBBBBBBBBBo
  oLlLlLlLlLo
  oPPPPPPPPPo
  oBBBBBBBBBo
  .ooooooooo.
`,
  { o: PAL.outline, B: PAL.strawLight, L: PAL.leafLight, l: PAL.leaf, P: PAL.pink },
);

/** 7 x 10: a wet footprint on the planks (Q5), dark water with a pale shine on one edge; the scene fades it in, then dries it. */
export const FOOTPRINT = sprite(
  `
  .d.d.d.
  .......
  .hdddd.
  hddddd.
  hddddd.
  .ddddd.
  ..ddd..
  ..ddd..
  .hdddd.
  ..ddd..
`,
  { d: PAL.deep0, h: PAL.shallow2 },
);

/** 9 x 9, 9 x 5, 9 x 3: the star reflection with no star above it (Q4): open, half shut, shut. The scene shows them in turn for the slow blink. */
const BLINK_COLORS = { g: PAL.gold, w: PAL.cream, W: PAL.white };
export const BLINK_OPEN = sprite(
  `
  ....g....
  ....w....
  ...gwg...
  .gwwWwwg.
  gwwwWwwwg
  .gwwWwwg.
  ...gwg...
  ....w....
  ....g....
`,
  BLINK_COLORS,
);
export const BLINK_HALF = sprite(
  `
  ....g....
  .gwwwwwg.
  gwwwWwwwg
  .gwwwwwg.
  ....g....
`,
  BLINK_COLORS,
);
export const BLINK_SHUT = sprite(
  `
  ....g....
  gwwwWwwwg
  ....g....
`,
  BLINK_COLORS,
);

/** Bubbles as pixel offsets from their centre (drawn tinted and faded by the scene): a 3 x 3 and a 5 x 5 ring, the big one with a highlight. */
export const BUBBLE_SMALL: readonly (readonly [number, number])[] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
export const BUBBLE_BIG: readonly (readonly [number, number])[] = [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]];
export const BUBBLE_BIG_HIGHLIGHT: readonly [number, number] = [1, -1];

/** 40 x 9: a long dark shape under the water, with a lighter rim along its back so it still reads on night water (drawn translucent by the scene). */
export const SHAPE = sprite(
  `
  ..............RRRRRRRRRRRRRRR...........
  RR.........RRRDDDDDDDDDDDDDDDRRR........
  DDRR.....RRDDDDDDDDDDDDDDDDDDDDDRR......
  DDDDRRRRRDDDDDDDDDDDDDDDDDDDDDDDDDRRRR..
  ..DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDRR
  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD..
  DDDD.....DDDDDDDDDDDDDDDDDDDDDDDDD......
  DD.........DDDDDDDDDDDDDDDDDDDDD........
  ..............DDDDDDDDDDDDDDD...........
`,
  { D: PAL.outline, R: PAL.deep2 },
);

/**
 * The pixels of a one-pixel ring (an ellipse with radii rx, ry), as offsets from the centre, each
 * pixel once. Used for the ripple rings of a jumping fish, the bubbles' pop and the ducks' wake.
 */
export function ringPoints(rx: number, ry: number): { x: number; y: number }[] {
  const n = Math.max(12, Math.ceil((rx + ry) * 2.2));
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(Math.cos(a) * rx);
    const y = Math.round(Math.sin(a) * ry);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, y });
  }
  return out;
}

/** Every moment sprite by texture key (the dev sheet and the texture baker both read this). */
export const MOMENT_SPRITES: Record<string, Sprite> = {
  duck: DUCK,
  frogIdle: FROG_IDLE,
  frogPuff: FROG_PUFF,
  frogPad: FROG_PAD,
  jumpFish: JUMP_FISH,
  starHead: STAR_HEAD,
  bottle: BOTTLE,
  shape: SHAPE,
  storyBottle: STORY_BOTTLE,
  sandwich: SANDWICH,
  footprint: FOOTPRINT,
  blinkOpen: BLINK_OPEN,
  blinkHalf: BLINK_HALF,
  blinkShut: BLINK_SHUT,
};
