import { describe, expect, it } from 'vitest';
import { CAR_SIZE } from './carArt';
import { CAMPFIRE_FRAMES, WINDSOCK_LEVELS, WINDSOCK_SIZE, campfireSprite, dogBedSprite, lightPoleSprite, tentSprite, windsockSprite, TENT_SIZE, CAMPFIRE_SIZE, BED_SIZE, POLE_SIZE } from './campArt';
import { SOCK_FEET, SOCK_ORIGIN_X, campBoxes, type Box } from './campLayout';
import { emptyChairSprite, pajkelSittingSprite } from './characters';
import { SIGN_SIZE } from './signArt';
import { TROPHY_BOARD_SIZE } from './trophyBoardArt';
import { TRANSPARENT, type Sprite } from './pixelGrid';
import { CAR_DOG, CAR_STAND, PLAY_AREA, PLAY_PAJ, DOG_SPOT, PAJ_SPOT } from '../scenes/companions/behaviour';

const opaque = (s: Sprite) => s.pixels.filter((c) => c !== TRANSPARENT).length;
const same = (a: Sprite, b: Sprite) => a.pixels.every((c, i) => c === b.pixels[i]);

describe('camp sprites', () => {
  it('have the sizes the layout counts on and something drawn on the feet row', () => {
    const all: [Sprite, { w: number; h: number }][] = [
      [campfireSprite(0), CAMPFIRE_SIZE],
      [tentSprite(), TENT_SIZE],
      [lightPoleSprite(), POLE_SIZE],
      [dogBedSprite(), BED_SIZE],
      [windsockSprite(1, 0), WINDSOCK_SIZE],
    ];
    for (const [s, size] of all) {
      expect([s.width, s.height]).toEqual([size.w, size.h]);
      expect(opaque(s)).toBeGreaterThan(40);
      const feet = s.pixels.slice((s.height - 1) * s.width).filter((c) => c !== TRANSPARENT).length;
      expect(feet).toBeGreaterThan(0);
    }
  });

  it('flicker over three different campfire frames', () => {
    expect(CAMPFIRE_FRAMES).toBe(3);
    for (let i = 0; i < CAMPFIRE_FRAMES; i++) for (let j = i + 1; j < CAMPFIRE_FRAMES; j++) expect(same(campfireSprite(i), campfireSprite(j))).toBe(false);
  });

  it('draw the windsock differently for every strength and flap', () => {
    const all: Sprite[] = [];
    for (let l = 0; l < WINDSOCK_LEVELS; l++) for (const f of [0, 1] as const) all.push(windsockSprite(l, f));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i], all[j])).toBe(false);
  });

  it('make the deck chair differ from the camp chair, in the seated and the empty chair', () => {
    expect(same(pajkelSittingSprite('sit', 0), pajkelSittingSprite('sit', 0, true))).toBe(false);
    expect(same(emptyChairSprite(), emptyChairSprite(true))).toBe(false);
    // Only the chair changes: the head and shoulders (the top 30 rows) are the same.
    const a = pajkelSittingSprite('sit', 0);
    const b = pajkelSittingSprite('sit', 0, true);
    for (let i = 0; i < 30 * a.width; i++) expect(b.pixels[i]).toBe(a.pixels[i]);
  });
});

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

describe('camp layout', () => {
  const camp = campBoxes();
  const car = box(0, 500, CAR_SIZE.w, CAR_SIZE.h + 6);
  const trophy = box(58 - TROPHY_BOARD_SIZE.w / 2, 492 - TROPHY_BOARD_SIZE.h, TROPHY_BOARD_SIZE.w, TROPHY_BOARD_SIZE.h);
  const sign = box(276 - SIGN_SIZE.w / 2, 498 - SIGN_SIZE.h, SIGN_SIZE.w, SIGN_SIZE.h);
  const lawn = box(PLAY_AREA.x0, PLAY_AREA.y0, PLAY_AREA.x1 - PLAY_AREA.x0, PLAY_AREA.y1 - PLAY_AREA.y0);
  const dock = box(116, 362, 128, 106);
  const crate = box(192, 424, 44, 44);
  const hintLine = box(0, 567, 360, 33);
  const bar = box(0, 602, 360, 38);
  /** The spots where they stand while asleep-time walks to the car: a sprite-sized box around each. */
  const carStandPaj = box(CAR_STAND.x - 16, CAR_STAND.y - 52, 32, 52);
  const carStandDog = box(CAR_DOG.x - 16, CAR_DOG.y - 24, 32, 24);
  const others: [string, Box][] = [['car', car], ['trophy board', trophy], ['sign', sign], ['fetch lawn', lawn], ['dock', dock], ['crate', crate], ['hint line', hintLine], ['bottom bar', bar], ['car stand', carStandPaj], ['car dog', carStandDog]];

  for (const [name, b] of Object.entries(camp)) {
    it(`keeps the ${name} clear of the other shore things`, () => {
      for (const [other, ob] of others) expect(overlap(b, ob), `${name} overlaps ${other}`).toBe(false);
    });
    it(`keeps the ${name} on the screen's width (the tent may lean in from the left edge)`, () => {
      expect(b.x + b.w).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(360);
      expect(b.x + b.w <= 360 || name === 'sock').toBe(true);
    });
  }

  it('keeps the camp items clear of each other', () => {
    const names = Object.keys(camp) as (keyof typeof camp)[];
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) expect(overlap(camp[names[i]], camp[names[j]]), `${names[i]} / ${names[j]}`).toBe(false);
  });

  it('puts the windsock pole on its spot with the cone to the left, inside the screen', () => {
    expect(camp.sock.x + camp.sock.w * SOCK_ORIGIN_X).toBeCloseTo(SOCK_FEET.x, 5);
    expect(camp.sock.x + camp.sock.w).toBeLessThanOrEqual(360);
  });
});

describe('camp and the walks of the companions', () => {
  const camp = campBoxes();
  type P = { x: number; y: number };
  /** Feet positions along a polyline, every ~2 px. */
  const along = (pts: P[]): P[] => {
    const out: P[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const n = Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) / 2);
      for (let k = 0; k <= n; k++) out.push({ x: pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / n, y: pts[i].y + ((pts[i + 1].y - pts[i].y) * k) / n });
    }
    return out;
  };
  const walks: Record<string, P[]> = {
    'Pajkel dock to the lawn': [PAJ_SPOT, { x: 148, y: 440 }, { x: 148, y: 484 }, PLAY_PAJ],
    'Bestia dock to the lawn': [DOG_SPOT, { x: 178, y: 444 }, { x: 178, y: 486 }, { x: 140, y: 544 }],
    'Pajkel to the car': [{ x: 148, y: 484 }, CAR_STAND],
    'Bestia to the car': [{ x: 178, y: 486 }, CAR_DOG],
  };
  for (const [name, pts] of Object.entries(walks)) {
    it(`${name} does not cross a camp item`, () => {
      for (const f of along(pts)) {
        for (const [item, b] of Object.entries(camp)) {
          const inside = f.x > b.x - 4 && f.x < b.x + b.w + 4 && f.y > b.y && f.y < b.y + b.h + 4;
          expect(inside, `${name} at ${Math.round(f.x)},${Math.round(f.y)} is in the ${item}`).toBe(false);
        }
      }
    });
  }
});
