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

// ---- River bend moments (slice 25e) ------------------------------------------------------------

const KF_COLORS = { o: PAL.outline, b: PAL.shallow1, B: PAL.deep2, t: PAL.shallow3, O: PAL.redLight, w: PAL.white, k: PAL.outline, Q: PAL.woodDark };

/** 16 x 10: a kingfisher in flight facing right, wings up (blue back, orange belly, a long dark beak). */
export const KINGFISHER_UP = sprite(
  `
  ......oo........
  .....obbo.......
  ....obtbbo......
  ...obtbbbbooo...
  ..obbbbbbbbkoQQQ
  ..obBBBBbbbbooQQ
  ...obbbbOOwwwoQ.
  ....ooOOOOOwoo..
  ......oooOOo....
  ........ooo.....
`,
  KF_COLORS,
);

/** 16 x 10: the same bird with its wings down (the flap). */
export const KINGFISHER_DOWN = sprite(
  `
  ................
  ................
  ......ooooo.....
  ....oobbbbbooo..
  ..ooobtbbbbbkoQQ
  .obbbBBBbbbbbooQ
  .obbbbbbbbOwwwQQ
  ..oobbbbbOOOwoo.
  ....obbbooooo...
  ....obbo........
`,
  KF_COLORS,
);

/** 8 x 14: the kingfisher diving, head down, wings swept back. */
export const KINGFISHER_DIVE = sprite(
  `
  ..oooo..
  .obbbbo.
  obbbkbbo
  obtbbbbo
  .obbbbo.
  .oOwwOo.
  ..oOOo..
  ..oooo..
  ...oQ...
  ...oQ...
  ...QQ...
  ...QQ...
  ...Q....
  ...Q....
`,
  KF_COLORS,
);

const OT_COLORS = { Q: PAL.woodDark, o: PAL.outline, b: PAL.woodLight, B: PAL.wood, d: PAL.woodDark, c: PAL.sandLight, k: PAL.outline, s: PAL.stoneLight, S: PAL.white, p: PAL.pink };

/** 30 x 11: an otter floating on its back, eating a small fish held on its chest (head left, tail right; the water hides its lower half). */
export const OTTER_BACK = sprite(
  `
  ......ooooo...................
  .....obbbbbo..................
  ....obbbbbbboooooo............
  ...obbckcccbbbbbbbooooo.......
  ...obcccccccbbbbbbbbbbbooo....
  ...oQcccccbbbssSSsbbbbbbbbooo.
  ....obcccbbbbsSSSSsbbbbbbbbbbo
  .....oobbbbbbbbssbbbbbBBBBBoo.
  .......ooobBBBBBBBBBBBBBoooo..
  .........oooooooooooooooo.....
  ..............................
`,
  OT_COLORS,
);

/** 11 x 11: the otter's head and shoulders above the water after its dive (a whiskery little face, looking at you). */
export const OTTER_HEAD = sprite(
  `
  ..ooooooo..
  .obbbbbbbo.
  obbbbbbbbbo
  obbkbbbkbbo
  obbbccccbbo
  .obcccQccco
  .obccpcpccc
  ..occccccco
  ...obbbbbo.
  ..obbbbbbbo
  .obbbbbbbbb
`,
  OT_COLORS,
);

/** 14 x 12: the otter mid-dive, back arched and its tail up as it goes under. */
export const OTTER_DIVE = sprite(
  `
  .........oo...
  ........obbo..
  .......obbbo..
  ......obbbo...
  .....obbbbo...
  ..ooobbbbbo...
  .obbbbbbbbo...
  obbkbbbbbo....
  obbbbbbbbo....
  .obbbbbbo.....
  ..oooooo......
  ..............
`,
  OT_COLORS,
);

/** 9 x 13: a small paper lantern, lit from inside (the glow is drawn by the scene). */
export const LANTERN = sprite(
  `
  ...ooo...
  ..oDDDo..
  .oDDDDDo.
  oRRrrrRRo
  oRrYYYrRo
  oRrYWYrRo
  oRrYYYrRo
  oRRrrrRRo
  .oDDDDDo.
  ..oDDDo..
  ...oDo...
  ....o....
  ...o.o...
`,
  { o: PAL.outline, D: PAL.redDark, R: PAL.red, r: PAL.redLight, Y: PAL.gold, W: PAL.white },
);

/** 15 x 8: a folded paper boat, white with a shaded fold. */
export const PAPER_BOAT = sprite(
  `
  .......o.......
  ......oWo......
  .....oWWWo.....
  ....oWWsWWo....
  ...oWWWsWWWo...
  ooooooooooooooo
  .oWWWWWWWWWWWo.
  ..ossssssssso..
`,
  { o: PAL.outline, W: PAL.white, s: PAL.whiteShade },
);

const HERON_COLORS = { o: PAL.outline, g: PAL.stoneLight, G: PAL.stone, d: PAL.stoneDark, w: PAL.white, y: PAL.gold, Y: PAL.strawDark, k: PAL.outline };

/** 16 x 28: a grey heron standing still in the shallows, neck folded in an S, a long yellow beak and long thin legs. */
export const HERON_STAND = sprite(
  `
  ..oooo..........
  .owwwwo.........
  owwkwwwoyyyyyy..
  owwwwwwoYYYYYo..
  .oowwwo.........
  ...owwo.........
  ...owwo.........
  ..owwgo.........
  .owwggo.........
  .owggGo.........
  .owgggoo........
  ..ogggggoo......
  ..oggggggGoo....
  .oggggggGGGGoo..
  .oggggggGGGGGGo.
  oogggggGGGGGGGGo
  .oogggGGGGdddGdo
  ..ooggGGGGGdddo.
  ...ooGGGGGGGGo..
  ....ooGGGGGoo...
  .....oodddoo....
  ......ody.......
  ......oy........
  ......oy........
  ......oy........
  ......oy........
  .....oYYY.......
  ................
`,
  HERON_COLORS,
);

/** 16 x 28: the same heron mid-step (one leg lifted, the other planted), for when it stalks off. */
export const HERON_STEP = sprite(
  `
  ..oooo..........
  .owwwwo.........
  owwkwwwoyyyyyy..
  owwwwwwoYYYYYo..
  .oowwwo.........
  ...owwo.........
  ...owwo.........
  ..owwgo.........
  .owwggo.........
  .owggGo.........
  .owgggoo........
  ..ogggggoo......
  ..oggggggGoo....
  .oggggggGGGGoo..
  .oggggggGGGGGGo.
  oogggggGGGGGGGGo
  .oogggGGGGdddGdo
  ..ooggGGGGGdddo.
  ...ooGGGGGGGGo..
  ....ooGGGGGoo...
  .....oodddoo....
  .....oyyo.oy....
  ....oy...oy.....
  ...oy....oy.....
  ..oYYo...oy.....
  .........oy.....
  ........oYYY....
  ................
`,
  HERON_COLORS,
);

/** 15 x 4: a stick, the kind {dog} keeps (it floats upstream in R1). */
export const STICK = sprite(
  `
  ..oooooooooo...
  .oBbBbbBbBbBoo.
  oBBbBBBbBBBbbBo
  .ooooooooooooo.
`,
  { o: PAL.outline, B: PAL.wood, b: PAL.woodLight },
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
  // River bend (slice 25e)
  kingfisherUp: KINGFISHER_UP,
  kingfisherDown: KINGFISHER_DOWN,
  kingfisherDive: KINGFISHER_DIVE,
  otterBack: OTTER_BACK,
  otterHead: OTTER_HEAD,
  otterDive: OTTER_DIVE,
  lantern: LANTERN,
  paperBoat: PAPER_BOAT,
  heronStand: HERON_STAND,
  heronStep: HERON_STEP,
  stick: STICK,
};
