import { ICON_SIZE, outlined } from './iconArt';
import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/**
 * Pure art for the shop icons (slice 15b): 16 x 16, a 1 px outline, chunky enough to read at 48 px.
 * Look them up by item id with `shopIconSprite(id)`; baits (slice 15c) and later the lantern add ids here.
 * Ids match core/data: the worm pack plus RODS, LINES, REELS and BAITS (a test keeps them in step).
 */

const INNER = ICON_SIZE - 2; // the icon grid minus the outline ring
const PINK_DARK = 0xc4607e;
const PINK_LIGHT = 0xffc2d2;

/** Parses a 14 x 14 grid and outlines it. */
function fromGrid(grid: string, colours: Record<string, number>): Sprite {
  const s = sprite(grid, colours);
  if (s.width !== INNER || s.height !== INNER) throw new Error(`shop icon: grid must be ${INNER} x ${INNER}, got ${s.width} x ${s.height}`);
  return outlined((x, y) => s.pixels[y * INNER + x]);
}

/** A 14 x 14 pixel canvas to draw into, finished with `done()` (adds the outline). */
function painter() {
  const px = new Int32Array(INNER * INNER).fill(TRANSPARENT);
  return {
    set(x: number, y: number, col: number) {
      if (x >= 0 && y >= 0 && x < INNER && y < INNER) px[y * INNER + x] = col;
    },
    done: (): Sprite => outlined((x, y) => px[y * INNER + x]),
  };
}

/** A tin can with a cream label, a few pink worms peeking out of the top. */
export function wormPackSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ....P.....P...
    ...pPp...pP...
    ...dp.pPd.dp..
    ..dp.pdPpdp...
    ...dpPpdpd....
    .tttttttttttt.
    .tssssssssssk.
    .tsccccccccsk.
    .tscrcrcrccsk.
    .tsccccccccsk.
    .tssssssssssk.
    .kkkkkkkkkkkk.
    ..............
    `,
    { P: PINK_LIGHT, p: PAL.pink, d: PINK_DARK, t: PAL.stoneLight, s: PAL.stone, k: PAL.stoneDark, c: PAL.cream, r: PAL.red },
  );
}

interface RodColours {
  handle: number;
  /** Lit and shaded pixel of the two-pixel-thick lower part (the tip is one pixel, lit). */
  hi: number;
  body: number;
  joint: number;
  /** Optional stripe near the handle. */
  stripe?: number;
  reel: number;
  reelDark: number;
  reelHi: number;
}

/**
 * A rod running from the lower left to the upper right, a small reel hanging under it and a crank.
 * Thick (2 px) up to the middle, then a thin tip; joints are darker pixels.
 */
function rodSprite(c: RodColours): Sprite {
  const p = painter();
  for (let x = 1; x <= 12; x++) {
    const y = 13 - x;
    if (x <= 3) {
      p.set(x, y, c.handle);
      p.set(x + 1, y, c.handle);
    } else if (x <= 10) {
      const joint = x === 7 || x === 10;
      const stripe = c.stripe && (x === 4 || x === 5);
      p.set(x, y, stripe ? c.stripe! : joint ? c.joint : c.hi);
      p.set(x + 1, y, stripe ? c.stripe! : joint ? c.joint : c.body);
    } else {
      p.set(x, y, c.hi);
    }
  }
  // The reel: a small round body under the rod, a darker spool in the middle, and a crank with a knob.
  for (let y = 7; y <= 13; y++) {
    for (let x = 4; x <= 12; x++) {
      const r = Math.hypot(x - 8, y - 10);
      if (r <= 2.6) p.set(x, y, r < 0.9 ? c.reelDark : c.reel);
    }
  }
  p.set(7, 9, c.reelHi);
  p.set(11, 10, c.reelDark);
  p.set(12, 10, c.reelDark);
  p.set(12, 11, c.reelDark);
  return p.done();
}

const ROD_ART: Record<string, RodColours> = {
  bamboo: { handle: PAL.woodDark, hi: PAL.sandLight, body: PAL.sand, joint: PAL.sandDark, reel: PAL.stoneLight, reelDark: PAL.stoneDark, reelHi: PAL.white },
  fiberglass: { handle: PAL.woodDark, hi: PAL.strawLight, body: PAL.straw, joint: PAL.strawDark, reel: PAL.stoneLight, reelDark: PAL.stoneDark, reelHi: PAL.white },
  carbon: { handle: PAL.teeLight, hi: PAL.stone, body: PAL.stoneDark, joint: PAL.outlineSoft, stripe: PAL.red, reel: PAL.stone, reelDark: PAL.stoneDark, reelHi: PAL.white },
};

interface SpoolColours {
  /** Light, middle and dark winding. */
  a: number;
  b: number;
  c: number;
  /** Braided line shows a woven checker; plain line shows smooth bands. */
  woven: boolean;
  /** Pale see-through line: a bright glint on top. */
  glass?: boolean;
}

/** A wooden spool seen from the side, wound with line, a loose end leaving the right and curling down. */
function spoolSprite(s: SpoolColours): Sprite {
  const pad = (mid: string, left: number) => '.'.repeat(left) + mid + '.'.repeat(INNER - left - mid.length);
  const rows = [pad('', 0), pad('FFFFFFFFFF', 2), pad('ffffffffff', 2)];
  ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b'].forEach((ch, i) => {
    const other = ch === 'b' ? 'a' : 'b';
    const pair = i % 2 === 0 ? ch + other : other + ch;
    rows.push(pad(s.woven ? pair.repeat(4) : ch.repeat(8), 3));
  });
  rows.push(pad('ffffffffff', 2), pad('DDDDDDDDDD', 2), pad('', 0));
  rows[7] = pad('bbbbbbbbbb', 3);
  const out = fromGrid(rows.join('\n'), { F: PAL.woodHi, f: PAL.woodLight, D: PAL.woodDark, a: s.a, b: s.b, c: s.c });
  if (s.glass) {
    const at = (x: number, y: number) => (y + 1) * ICON_SIZE + x + 1;
    for (const [x, y] of [[3, 3], [4, 3], [3, 4]]) out.pixels[at(x, y)] = PAL.white;
  }
  return out;
}

/** A reel seen from the side: round body with a spool (ridged on the pro one) and a crank with a knob. */
function reelSprite(rim: number, face: number, spool: number, shine: number, ridge: boolean): Sprite {
  const p = painter();
  const cx = 5.5;
  const cy = 5.5;
  for (let y = 0; y < INNER; y++) {
    for (let x = 0; x < INNER; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > 4.9) continue;
      if (r > 3.9) p.set(x, y, dx + dy > 1 ? face : rim);
      else if (r < 1.3) p.set(x, y, rim); // hub
      else if (r < 3) p.set(x, y, ridge && Math.round(r) === 2 ? rim : spool);
      else p.set(x, y, face);
    }
  }
  for (const [x, y] of [[1, 4], [2, 3], [2, 4]]) p.set(x, y, shine);
  for (const [x, y] of [[7, 7], [8, 8], [9, 9]]) p.set(x, y, rim); // crank arm
  for (const [x, y] of [[10, 9], [11, 9], [10, 10], [11, 10]]) p.set(x, y, spool); // knob
  for (let x = 4; x <= 7; x++) p.set(x, 11, face); // foot
  for (let x = 2; x <= 9; x++) p.set(x, 12, rim);
  return p.done();
}

/** A yellow corn cob with rows of kernels and a green husk at the bottom. */
export function cornSprite(): Sprite {
  return fromGrid(
    `
    .....sYYs.....
    ....sYyYYs....
    ....YyYyYy....
    ....yYyYyY....
    ....YyYyYy....
    ....yYyYyY....
    ....YyYyYy....
    ...ggYyYygg...
    ..gGggyyggGg..
    ..gGGggggGGg..
    ...gGGggGGg...
    ....gGggGg....
    .....gGGg.....
    ......gg......
    `,
    { s: PAL.strawDark, Y: PAL.strawLight, y: PAL.straw, g: PAL.leaf, G: PAL.leafLight },
  );
}

/** A little clay pot with a cream label, a heap of pale maggots on top. */
export function maggotsSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ....c..c......
    ..c.Cc.Cc.c...
    ..cCcCcCcCcC..
    .rrrrrrrrrrrr.
    ..bbbbbbbbbb..
    ..bhbbbbbbbd..
    ..bhLLLLLLbd..
    ..bhLmLmLLbd..
    ..bhLLLLLLbd..
    ..bhbbbbbbbd..
    ..bbbbbbbbbd..
    ..dddddddddd..
    ..............
    `,
    { c: PAL.cream, C: PAL.white, r: PAL.shirtLight, b: PAL.shirt, h: PAL.shirtLight, d: PAL.shirtDark, L: PAL.cream, m: PAL.shirtDark },
  );
}

/** A strip of fish: silver skin along the edges, pink flesh with a few pale fat lines, running up to the right. */
export function stripSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ..............
    ..........ssss
    ........ssSSSs
    ......ssSPPPps
    ....ssSPPwPPps
    ..ssSPPPwPPpps
    .sSPPwPPPPppp.
    .sPPPPPPpppp..
    .ssPPPPpppss..
    ..sssPPppss...
    ....sssss.....
    ..............
    ..............
    `,
    { s: PAL.stone, S: PAL.stoneLight, P: PAL.pink, p: PINK_DARK, w: PINK_LIGHT },
  );
}

/** A glowing green-yellow ball with a few light pixels around it. */
export function glowSprite(): Sprite {
  const p = painter();
  for (let y = 0; y < INNER; y++) {
    for (let x = 0; x < INNER; x++) {
      const r = Math.hypot(x - 6.5, y - 6.5);
      if (r > 4.6) continue;
      p.set(x, y, r < 1.8 ? PAL.sun : r < 3 ? PAL.firefly : r < 4 ? PAL.fireflyGlow : PAL.leaf);
    }
  }
  p.set(5, 5, PAL.white);
  p.set(6, 5, PAL.white);
  p.set(5, 6, PAL.white);
  // A little plus of light up left, and two single sparks.
  for (const [x, y] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]) p.set(x, y, PAL.firefly);
  p.set(2, 2, PAL.white);
  p.set(11, 3, PAL.firefly);
  p.set(11, 11, PAL.firefly);
  return p.done();
}

/** The night kit's icon: an iron lantern with a lit flame (the blanket is not shown, it would not read at 16 px). */
export function lanternIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ....hhhhhh....
    ...h......h...
    ...h......h...
    ...kkkkkkkk...
    ..kKKKKKKKKk..
    ...gYYYYYYg...
    ...gYYwwYYg...
    ...gYwwwwYg...
    ...gYYwwYYg...
    ...gYYYYYYg...
    ..kKKKKKKKKk..
    ...kkkkkkkk...
    ..............
    `,
    { h: PAL.stoneLight, k: PAL.stoneDark, K: PAL.stone, g: PAL.stoneDark, Y: PAL.straw, w: PAL.white },
  );
}

// ---- Camp items (slice 23e), ids as in core/data/camp.ts -----------------------------------------

/** A campfire: red, orange and yellow flames over two logs and a few stones. */
export function campfireIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ......r.......
    .....rRr......
    ....rRYRr.....
    ....rRYYRr....
    ...rRYYwYRr...
    ...rRYwwYRr...
    ...rRYwwYRr...
    ....rRYYRr....
    .bbBBBBBBBBbb.
    .bBBbbbbbbBBb.
    ..bbBBBBBBbb..
    .ssss....ssss.
    ..............
    `,
    { r: PAL.red, R: PAL.redLight, Y: PAL.gold, w: PAL.strawLight, b: PAL.woodDark, B: PAL.wood, s: PAL.stone },
  );
}

/** A deck chair seen from the front: a wooden frame, teal and cream striped canvas. */
export function deckChairIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ..WWWWWWWWWW..
    ..WtctctctcW..
    ..WtctctctcW..
    ..WtctctctcW..
    ..WtctctctcW..
    ..WtctctctcW..
    .WWWWWWWWWWWW.
    .WtcctcctcctW.
    ..W........W..
    ..W........W..
    .WW........WW.
    .W..........W.
    ..............
    `,
    { W: PAL.wood, t: PAL.mug, c: PAL.cream },
  );
}

/** A round dog bed from above: a blue rim, a cream cushion and a little bone. */
export function dogBedIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ..............
    ..............
    ....dddddd....
    ..ddDDDDDDdd..
    .dDDssssssDDd.
    dDDcccccccccDd
    dDDcccwwwcccDd
    dDDccccccccDDd
    .dDDDDDDDDDDd.
    ..dddddddddd..
    ..............
    ..............
    ..............
    `,
    { d: PAL.denimDark, D: PAL.denimLight, c: PAL.cream, s: PAL.whiteShade, w: PAL.white },
  );
}

/** A small tent: cream canvas with red edges, the right side in shade, a dark door with a lighter flap. */
export function tentIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ......rr......
    .....rcsr.....
    ....rccssr....
    ...rcccsssr...
    ..rccccssssr..
    .rcccccsssssr.
    rcccccDDsssssr
    rccccDDDDssssr
    rccccDLLDssssr
    rccccDLLDssssr
    rrrrrrrrrrrrrr
    ..............
    ..............
    `,
    { r: PAL.red, c: PAL.cream, s: PAL.sandLight, D: PAL.woodDeep, L: PAL.woodLight },
  );
}

/** String lights: a wire sagging between two poles, four coloured bulbs. */
export function lightsIconSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ..............
    ..............
    kk..........kk
    .kk........kk.
    ..kkkkkkkkkk..
    RR.GG.OO.YY.BB
    RR.GG.OO.YY.BB
    RR.GG.OO.YY.BB
    ..............
    ..............
    ..............
    ..............
    ..............
    `,
    { k: PAL.outlineSoft, R: PAL.redLight, B: PAL.blueFlower, G: PAL.leafHi, O: PAL.sunEdge, Y: PAL.gold },
  );
}

/** A windsock on a pole: an orange and white striped cone blowing to the right. */
export function windsockIconSprite(): Sprite {
  return fromGrid(
    `
    .WW...........
    .WW...........
    .WWooHHooHH...
    .WWooHHooHHooH
    .WWooHHooHHooH
    .WWooHHooHH...
    .WW...........
    .WW...........
    .WW...........
    .WW...........
    .WW...........
    .WW...........
    WWWW..........
    WWWW..........
    `,
    { W: PAL.wood, o: PAL.redLight, H: PAL.white },
  );
}

/** Dog treats (slice 30): two bone-shaped biscuits, a cream one and a toasted one. */
export function treatsSprite(): Sprite {
  return fromGrid(
    `
    ..............
    ..............
    .CC........CC.
    CCCCCCCCCCCCCC
    CCCCCCCCCCCCCC
    .ss........ss.
    ..............
    ..............
    ..bb......bb..
    .BBBBBBBBBBBB.
    .BBBBBBBBBBBB.
    ..dd......dd..
    ..............
    ..............
    `,
    { C: PAL.cream, s: PAL.sand, B: PAL.straw, b: PAL.strawLight, d: PAL.strawDark },
  );
}

const BUILDERS: Record<string, () => Sprite> = {
  worms: wormPackSprite,
  treats: treatsSprite,
  bamboo: () => rodSprite(ROD_ART.bamboo),
  fiberglass: () => rodSprite(ROD_ART.fiberglass),
  carbon: () => rodSprite(ROD_ART.carbon),
  braided: () => spoolSprite({ a: PAL.leafHi, b: PAL.leaf, c: PAL.leafDark, woven: true }),
  fluoro: () => spoolSprite({ a: 0xeaf6fa, b: PAL.foam, c: PAL.shallow3, woven: false, glass: true }),
  smooth: () => reelSprite(PAL.stoneLight, PAL.stone, PAL.stoneDark, PAL.white, false),
  pro: () => reelSprite(PAL.sun, PAL.gold, PAL.strawDark, PAL.white, true),
  // Baits (slice 15c), ids as in core/data/baits.ts.
  corn: cornSprite,
  maggots: maggotsSprite,
  strip: stripSprite,
  glow: glowSprite,
  // The night kit (slice 16), id as in core/data/nightKit.ts.
  lantern: lanternIconSprite,
  // Camp items (slice 23e), ids as in core/data/camp.ts.
  campfire: campfireIconSprite,
  deckchair: deckChairIconSprite,
  dogbed: dogBedIconSprite,
  tent: tentIconSprite,
  lights: lightsIconSprite,
  windsock: windsockIconSprite,
};

/** Every item id that has a shop icon. */
export const SHOP_ICON_IDS: readonly string[] = Object.keys(BUILDERS);

const cache = new Map<string, Sprite>();

/** The 16 x 16 icon for a shop item id, or undefined when there is none. Do not mutate the result. */
export function shopIconSprite(id: string): Sprite | undefined {
  const build = BUILDERS[id];
  if (!build) return undefined;
  let s = cache.get(id);
  if (!s) {
    s = build();
    cache.set(id, s);
  }
  return s;
}
