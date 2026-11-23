import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * Pixel art of the lake moments (slice 14): pure grids drawn from the shared palette. The scene
 * (scenes/MomentsView.ts) places, bobs, tints and fades them; nothing here knows about Phaser.
 */

/** 14 x 9: a mallard drake facing right (green head, white collar, brown body). */
export const DUCK = sprite(
  `
  .......ooo....
  ......oggGo...
  ......ogkGoyy.
  ......oggGoYY.
  .dd..owwwwo...
  .ooooobBBBBbo.
  oddbbBBBBBBbo.
  .obbbbbbbbbbo.
  ..oooooooooo..
`,
  { o: PAL.outline, g: PAL.leafLight, G: PAL.leaf, k: PAL.outline, y: PAL.gold, Y: PAL.strawDark, w: PAL.white, b: PAL.wood, B: PAL.woodLight, d: PAL.woodDark },
);

const FROG_COLORS = { o: PAL.outline, F: PAL.leafHi, f: PAL.leaf, k: PAL.outline, c: PAL.cream, L: PAL.lily, l: PAL.lilyDark };

/** 14 x 5: a frog sitting, mouth closed (it sits on the lily pad, which is its own 14 x 5 sprite below it). */
export const FROG_IDLE = sprite(
  `
  ....oo..oo....
  ...oFkooFko...
  ...oFFFFFFo...
  ..oFFFFFFFFo..
  ..oFfFFFFfFo..
`,
  FROG_COLORS,
);

/** The same frog with its throat puffed (alternates with the idle frame, a slow croak). */
export const FROG_PUFF = sprite(
  `
  ....oo..oo....
  ...oFkooFko...
  ...oFFFFFFo...
  ..oFFFccFFFo..
  ..oFfcccccFo..
`,
  FROG_COLORS,
);

/** 14 x 5: the lily pad the frog sits on (stays a moment after the frog plops in). */
export const FROG_PAD = sprite(
  `
  ...oooooooo...
  .ooLLLLLLLLoo.
  oLLLLLLLLLLLlo
  .oollllllllloo
  ...oooooooo...
`,
  FROG_COLORS,
);

/** 11 x 5: a small silver fish facing right; the scene tilts it along its arc. */
export const JUMP_FISH = sprite(
  `
  ...oooooo..
  .oSSSSSSSo.
  oTSSSSSkSSo
  .osssssssso
  ...oooooo..
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

/** 14 x 7: a corked bottle with a rolled note, lying on the water. */
export const BOTTLE = sprite(
  `
  ..oooooo......
  .oGGGGGGo.....
  oGGPPPPGGoooo.
  oGGPpPPGGGGCCo
  oGGPPPPGGoooo.
  .ogggggggo....
  ..oooooo......
`,
  { o: PAL.outline, G: PAL.foam, g: PAL.shallow3, P: PAL.cream, p: PAL.sandDark, C: PAL.woodLight },
);

/** 3 x 3 and 5 x 5 bubbles. */
export const BUBBLE_S = sprite(
  `
  .W.
  W.W
  .W.
`,
  { W: PAL.foam },
);
export const BUBBLE_M = sprite(
  `
  .WWW.
  W...W
  W..hW
  W...W
  .WWW.
`,
  { W: PAL.foam, h: PAL.white },
);

/** 32 x 7: a long dark shape under the water (drawn translucent by the scene). */
export const SHAPE = sprite(
  `
  ..........DDDDDDDD..............
  .....DDDDDDDDDDDDDDDDD..........
  DD.DDDDDDDDDDDDDDDDDDDDDDD......
  DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD..
  DD.DDDDDDDDDDDDDDDDDDDDDDD......
  .....DDDDDDDDDDDDDDDDD..........
  ..........DDDDDDDD..............
`,
  { D: PAL.outline },
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
  bubbleS: BUBBLE_S,
  bubbleM: BUBBLE_M,
  shape: SHAPE,
};
