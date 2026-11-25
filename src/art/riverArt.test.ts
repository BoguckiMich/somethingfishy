import { describe, expect, it } from 'vitest';
import { BOBBER_X, DOCK, FAR_SHORE_TOP, FAR_SHORE_Y, FAR_WATER_Y, NEAR_SHORE_TOP, SHORE_Y, W, WATER_BOTTOM } from './layout';
import { PAL } from './palette';
import {
  barBump,
  HUT_BOX,
  HUT_FEET,
  HUT_PIPE_TOP,
  HUT_SIZE,
  hutRaster,
  LANDING_HOLE,
  RIVER_ROCKS,
  riverFarBankRaster,
  riverLandingRaster,
  riverNearBankRaster,
  riverWaterline,
  riverWaterRaster,
  rightBankEdge,
  RIGHT_BANK,
  riverRightBankRaster,
  riverRightReflectionRaster,
  rockBox,
  ROPE_FAR,
  ROPE_NEAR,
  ROPE_POST_POS,
} from './riverArt';
import { glintAlpha, makeGlints, makeStreaks, ropePoints, ropeSway, ROPE_SWAY_CALM, ROPE_SWAY_WINDY, rockFoam, STREAK_COUNT, streakAt, streakSegments } from './riverFx';
import { ALDER, boulderSprite, BOULDER_SIZES, FAR_POST, ROPE_POST, WILLOW, WILLOW_NEAR } from './riverSprites';
import { campBoxes, type Box } from './campLayout';
import { SIGN_SIZE } from './signArt';
import { TRANSPARENT } from './pixelGrid';
import { RIVER_BEND } from '../core/data/locations';

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const BOBBER_COLUMN: Box = { x: 236, y: FAR_WATER_Y, w: 40, h: SHORE_Y - FAR_WATER_Y + 18 };
const WATER_COLORS = new Set<number>([PAL.deep0, PAL.deep1, PAL.deep2, PAL.shallow0, PAL.shallow1, PAL.shallow2, PAL.shallow3]);

describe('river pictures', () => {
  it('have the lake picture sizes', () => {
    const far = riverFarBankRaster();
    expect([far.width, far.height]).toEqual([W, FAR_SHORE_Y + 4 - FAR_SHORE_TOP]);
    const water = riverWaterRaster();
    expect([water.width, water.height]).toEqual([W, WATER_BOTTOM - FAR_SHORE_Y]);
    const near = riverNearBankRaster();
    expect([near.width, near.height]).toEqual([W, 640 - NEAR_SHORE_TOP]);
    const landing = riverLandingRaster();
    expect([landing.width, landing.height]).toEqual([DOCK.w, DOCK.h]);
    const hut = hutRaster();
    expect([hut.width, hut.height]).toEqual([HUT_SIZE.w, HUT_SIZE.h]);
  });

  it('draw the trees and posts as sprites', () => {
    for (const s of [WILLOW, ALDER, FAR_POST, ROPE_POST]) expect(s.width * s.height).toBeGreaterThan(0);
    expect(WILLOW.height).toBeLessThan(30); // lower than the lake's pine ridge
  });
});

describe('river water', () => {
  const water = riverWaterRaster();
  const isWater = (x: number, y: number) => WATER_COLORS.has(water.get(x, y - FAR_SHORE_Y));

  it('is water across the whole bobber column, from the far cast to the shore', () => {
    for (let x = 236; x <= 276; x++) for (let y = FAR_WATER_Y; y < SHORE_Y - 6; y++) expect(isWater(x, y)).toBe(true);
  });

  it('is water under and around the landing and its posts', () => {
    for (let x = DOCK.x - 8; x < DOCK.x + DOCK.w + 8; x++) for (let y = DOCK.y; y < SHORE_Y - 6; y++) expect(isWater(x, y)).toBe(true);
  });

  it('has the waterline lifted by the gravel bars at the sides only', () => {
    expect(barBump(100)).toBe(0);
    expect(barBump(180)).toBe(0);
    expect(barBump(0)).toBeGreaterThan(30);
    expect(barBump(359)).toBeGreaterThan(30);
    expect(riverWaterline(0)).toBeLessThan(SHORE_Y - 30);
    expect(Math.abs(riverWaterline(180) - SHORE_Y)).toBeLessThan(6);
  });

  it('is darker under the far bank than at the riffle (the zones read by colour)', () => {
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    const avg = (y0: number, y1: number) => {
      let s = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = 140; x < 220; x++) (s += lum(water.get(x, y - FAR_SHORE_Y))), n++;
      return s / n;
    };
    expect(avg(180, 215)).toBeLessThan(avg(300, 330));
    expect(avg(300, 330)).toBeLessThan(avg(420, 440));
  });
});

describe('ferry rope', () => {
  const ends = { near: ROPE_NEAR, far: ROPE_FAR };

  it('goes from a tall post on the left gravel bank (x 40-90, off the landing) up to the far bank post', () => {
    expect(ends.near.x).toBeGreaterThanOrEqual(40);
    expect(ends.near.x).toBeLessThanOrEqual(90);
    expect(ends.near.x).toBeLessThan(DOCK.x - 20);
    expect(ends.far.x).toBeGreaterThanOrEqual(60);
    expect(ends.far.x).toBeLessThanOrEqual(120);
    expect(ends.far.y).toBeLessThan(FAR_SHORE_Y);
    // The post stands near the waterline.
    expect(Math.abs(ROPE_POST_POS.baseY - riverWaterline(ROPE_POST_POS.x))).toBeLessThan(12);
  });

  it('the rope post clears every boulder, the car and the camp', () => {
    const post: Box = { x: ROPE_POST_POS.x, y: ROPE_POST_POS.baseY - ROPE_POST.height, w: ROPE_POST.width, h: ROPE_POST.height };
    const b = campBoxes();
    for (const rock of RIVER_ROCKS) expect(overlap(post, rockBox(rock)), `rock ${rock.x},${rock.y}`).toBe(false);
    for (const box of [RIVER_BEND.spots.carHit, b.tent, b.pole, b.fire]) expect(overlap(post, box)).toBe(false);
  });

  it('stays left of the bobber column for its whole length, in every sway', () => {
    for (const sway of [-ROPE_SWAY_WINDY, 0, ROPE_SWAY_WINDY]) {
      for (const p of ropePoints(sway)) expect(p.x).toBeLessThan(236 - 8);
    }
    for (let t = 0; t < 60; t += 0.37) for (const w of [0, 1]) for (const p of ropePoints(ropeSway(t, w))) expect(p.x).toBeLessThan(BOBBER_X - 20);
  });

  it('hangs below the straight line and is fixed at both ends', () => {
    const pts = ropePoints(0);
    expect(pts[0]).toEqual({ x: ROPE_NEAR.x, y: ROPE_NEAR.y });
    expect(pts[pts.length - 1].x).toBeCloseTo(ROPE_FAR.x);
    expect(pts[pts.length - 1].y).toBeCloseTo(ROPE_FAR.y);
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.y).toBeGreaterThan((ROPE_NEAR.y + ROPE_FAR.y) / 2);
    expect(mid.x).toBeLessThan((ROPE_NEAR.x + ROPE_FAR.x) / 2 - 8); // bows downstream, visibly
    const swayed = ropePoints(3);
    expect(swayed[0]).toEqual(pts[0]);
    expect(swayed[Math.floor(pts.length / 2)].x).not.toBeCloseTo(mid.x);
  });

  it('sways more when windy than when calm', () => {
    const peak = (w: number) => Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(ropeSway(i * 0.1, w))));
    expect(peak(0)).toBeLessThanOrEqual(ROPE_SWAY_CALM + 1e-9);
    expect(peak(1)).toBeGreaterThan(peak(0) * 3);
    expect(peak(1)).toBeGreaterThanOrEqual(4);
    expect(peak(1)).toBeLessThanOrEqual(ROPE_SWAY_WINDY + 1e-9);
  });
});

describe('hut, sign and windsock', () => {
  const boxes = campBoxes();
  const sign: Box = { x: RIVER_BEND.spots.sign.x - SIGN_SIZE.w / 2, y: RIVER_BEND.spots.sign.y - SIGN_SIZE.h, w: SIGN_SIZE.w, h: SIGN_SIZE.h };

  it('the hut keeps a margin from the screen edge and does not overlap the sign, the windsock or the crate', () => {
    expect(W - (HUT_BOX.x + HUT_BOX.w)).toBeGreaterThanOrEqual(6);
    const crate: Box = { x: RIVER_BEND.spots.crate.x - 10, y: RIVER_BEND.spots.crate.y - 14, w: 20, h: 14 };
    for (const b of [sign, boxes.sock, crate, boxes.tent, boxes.fire, boxes.pole, boxes.bed]) expect(overlap(HUT_BOX, b)).toBe(false);
  });

  it('the hut is inside the screen and stands on the bank, off the bobber column', () => {
    expect(HUT_BOX.x).toBeGreaterThan(276);
    expect(HUT_BOX.x + HUT_BOX.w).toBeLessThanOrEqual(W);
    expect(HUT_FEET.y).toBeGreaterThanOrEqual(riverWaterline(HUT_BOX.x));
  });

  it('exports the stove pipe top inside the hut for the steam wisp', () => {
    expect(HUT_PIPE_TOP.x).toBeGreaterThan(HUT_BOX.x);
    expect(HUT_PIPE_TOP.x).toBeLessThan(HUT_BOX.x + HUT_BOX.w);
    expect(HUT_PIPE_TOP.y).toBeLessThanOrEqual(HUT_BOX.y + 3);
  });

  it('paints a window, a door and the sign in the hut picture', () => {
    const hut = hutRaster();
    let cream = 0;
    for (let y = 0; y < hut.height; y++) for (let x = 0; x < hut.width; x++) if (hut.get(x, y) === PAL.cream) cream++;
    expect(cream).toBeGreaterThan(20);
    expect(hut.get(0, 0)).toBe(TRANSPARENT);
  });
});

describe('boulders', () => {
  const spots = RIVER_BEND.spots;
  const boxes = campBoxes();
  const forbidden: [string, Box][] = [
    ['bobber column', BOBBER_COLUMN],
    ['landing and posts', { x: DOCK.x - 12, y: DOCK.y, w: DOCK.w + 24, h: DOCK.h }],
    ['car', spots.carHit],
    ['sign', { x: spots.sign.x - SIGN_SIZE.w / 2, y: spots.sign.y - SIGN_SIZE.h, w: SIGN_SIZE.w, h: SIGN_SIZE.h }],
    ['crate', { x: spots.crate.x - 10, y: spots.crate.y - 14, w: 20, h: 14 }],
    ['fetch lawn', { x: spots.playArea.x0, y: spots.playArea.y0, w: spots.playArea.x1 - spots.playArea.x0, h: spots.playArea.y1 - spots.playArea.y0 }],
    ['tent', boxes.tent],
    ['light pole', boxes.pole],
    ['fire', boxes.fire],
    ['bed', boxes.bed],
    ['windsock', boxes.sock],
    ['hut', HUT_BOX],
  ];

  it('three sizes exist, drawn with moss on top and a darker wet band at the foot', () => {
    expect(new Set(RIVER_ROCKS.map((r) => r.size)).size).toBe(3);
    for (const size of ['s', 'm', 'l'] as const) {
      const s = boulderSprite(size, 1);
      expect([s.width, s.height]).toEqual([BOULDER_SIZES[size].w, BOULDER_SIZES[size].h]);
      expect(s.pixels.some((p) => p === PAL.leaf || p === PAL.leafLight)).toBe(true);
      expect(s.pixels[(s.height - 1) * s.width + Math.floor(s.width / 2)]).toBe(PAL.outline);
    }
  });

  it('keep clear of the bobber column, the landing, the car, sign, crate, camp spots, fetch lawn and hut', () => {
    for (const rock of RIVER_ROCKS) for (const [name, box] of forbidden) expect(overlap(rockBox(rock), box), `${name} vs rock at ${rock.x},${rock.y}`).toBe(false);
  });

  it('near-bank rocks overlap the waterline; in-water rocks stand in water', () => {
    for (const rock of RIVER_ROCKS) {
      const b = rockBox(rock);
      const wl = riverWaterline(rock.x);
      if (rock.inWater) expect(b.y + b.h).toBeLessThan(wl);
      else {
        expect(b.y).toBeLessThanOrEqual(wl);
        expect(b.y + b.h).toBeGreaterThanOrEqual(wl);
      }
    }
  });

  it('white water trails to the left of in-water rocks only', () => {
    for (const rock of RIVER_ROCKS) {
      const f = rockFoam(rock, 1);
      if (!rock.inWater) expect(f).toEqual([]);
      else {
        expect(f.length).toBeGreaterThan(3);
        expect(f.some((r) => r.x + r.w <= rock.x - BOULDER_SIZES[rock.size].w / 2)).toBe(true);
      }
    }
  });
});

describe('ferry landing', () => {
  const landing = riverLandingRaster();
  it('breaks one plank by the shore, clear of Alex, the chair and the dog', () => {
    expect(landing.alphaAt(LANDING_HOLE.x + LANDING_HOLE.w - 2, LANDING_HOLE.y + 3)).toBe(0);
    // Alex (x 192-232 world, feet y 386), Pajkel's chair (x 130-170, y 364-412) and the dog path (x 150-194, y 406-436): all local to the landing.
    const world = { x: DOCK.x + LANDING_HOLE.x, y: DOCK.y + LANDING_HOLE.y, w: LANDING_HOLE.w, h: LANDING_HOLE.h };
    for (const b of [{ x: 192, y: 331, w: 44, h: 60 }, { x: 130, y: 364, w: 40, h: 48 }, { x: 150, y: 406, w: 44, h: 30 }]) expect(overlap(world, b)).toBe(false);
  });
});

describe('right bank', () => {
  const bank = riverRightBankRaster();
  const water = riverWaterRaster();

  it('comes down and forward: the edge starts right of x 290 at the far end and reaches the screen edge lower down', () => {
    expect(rightBankEdge(FAR_SHORE_Y)).toBeGreaterThanOrEqual(290);
    expect(rightBankEdge(FAR_WATER_Y)).toBeGreaterThanOrEqual(290);
    for (let y = FAR_SHORE_Y; y < 370; y++) expect(rightBankEdge(y + 1)).toBeGreaterThanOrEqual(rightBankEdge(y));
    expect(rightBankEdge(360)).toBeGreaterThanOrEqual(W - 8);
    expect([bank.width, bank.height]).toEqual([RIGHT_BANK.w, RIGHT_BANK.h]);
  });

  it('never touches the bobber column: no bank pixel at x 236-276, and the water under the column stays water', () => {
    for (let x = 0; x < bank.width; x++) {
      for (let y = 0; y < bank.height; y++) {
        if (bank.alphaAt(x, y) > 0) expect(RIGHT_BANK.x + x).toBeGreaterThan(280);
      }
    }
    for (let y = FAR_WATER_Y; y < 372; y++) expect(rightBankEdge(y)).toBeGreaterThan(276);
    expect(WATER_COLORS.has(water.get(260, 300 - FAR_SHORE_Y))).toBe(true);
  });

  it('has trees on it, a nearer willow with long drooping fronds, and a reflection to the left of its edge', () => {
    let opaque = 0;
    for (let i = 0; i < bank.data.length; i += 4) if (bank.data[i + 3] > 0) opaque++;
    expect(opaque).toBeGreaterThan(5000);
    expect(WILLOW_NEAR.height).toBeGreaterThan(WILLOW.height + 10);
    for (const f of [0, 1, 2]) {
      const refl = riverRightReflectionRaster(bank, f);
      let n = 0;
      for (let i = 0; i < refl.data.length; i += 4) if (refl.data[i + 3] > 0) n++;
      expect(n).toBeGreaterThan(200);
      for (let x = 0; x < refl.width; x++) for (let y = 0; y < refl.height; y++) if (refl.alphaAt(x, y) > 0) expect(RIGHT_BANK.x + x).toBeGreaterThan(276);
    }
  });
});

describe('river motion', () => {
  it('streaks are bold: near ones 14-30 px long and 2 px thick, and slant down-left with the bend', () => {
    const near = { lane: 1, phase: 0.5 };
    const d = streakAt(near, 1, 1);
    expect(d).toBeTruthy();
    expect(d!.len).toBeGreaterThanOrEqual(14);
    expect(d!.len).toBeLessThanOrEqual(30);
    expect(d!.thick).toBe(true);
    const segs = streakSegments(d!);
    expect(segs.length).toBeGreaterThan(2);
    expect(segs[segs.length - 1].y).toBeGreaterThanOrEqual(segs[0].y); // further left is lower
    expect(segs.reduce((a, s) => a + s.w, 0)).toBe(d!.len);
  });

  it('has a few dozen foam streaks that drift right to left and speed up in rain', () => {
    const streaks = makeStreaks();
    expect(streaks.length).toBe(STREAK_COUNT);
    expect(STREAK_COUNT).toBeLessThanOrEqual(40);
    const lane = streaks[streaks.length - 1];
    const xs = [0, 1, 2, 3].map((t) => streakAt(lane, t, 1)?.x ?? NaN).filter((x) => !Number.isNaN(x));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThan(xs[i - 1]);
    const s = { lane: 0.5, phase: 0.4 };
    expect(streakAt(s, 2, 1.6)).toEqual(streakAt(s, 3.2, 1)); // rain runs the same path 1.6x faster
    expect(streakAt(s, 2, 1.6)).toBeTruthy();
  });

  it('near streaks are faster and longer than far ones; none lands on the gravel', () => {
    const near = { lane: 1, phase: 0.5 };
    const far = { lane: 0, phase: 0.5 };
    const dx = (s: typeof near) => {
      const a = streakAt(s, 0.5, 1);
      const b = streakAt(s, 1.5, 1);
      return a && b ? a.x - b.x : 0;
    };
    expect(dx(near)).toBeGreaterThan(dx(far));
    for (const s of makeStreaks()) {
      for (let t = 0; t < 30; t += 0.7) {
        const d = streakAt(s, t, 1);
        if (d) expect(d.y).toBeLessThan(riverWaterline(d.x));
      }
    }
  });

  it('riffle glints stay in the near water (0-12 m) and in the water, and flicker', () => {
    for (const g of makeGlints()) {
      expect(g.y).toBeGreaterThan(270);
      expect(g.y).toBeLessThan(riverWaterline(g.x));
    }
    const g = makeGlints()[0];
    const values = Array.from({ length: 40 }, (_, i) => glintAlpha(g, i * 0.1));
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBeGreaterThan(0.5);
  });
});
