import { describe, expect, it } from 'vitest';
import { QUIET_LAKE, RIVER_BEND } from '../core/data/locations';
import { campBoxes, type Box } from './campLayout';
import { CAR_SIZE } from './carArt';
import { TRANSPARENT } from './pixelGrid';
import { STONES_SIZE, stonesSprite } from './stonesArt';
import { TROPHY_BOARD_SIZE } from './trophyBoardArt';
import { PLAY_AREA } from '../scenes/companions/behaviour';

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

describe('the skipping stones (slice 26)', () => {
  it('are a 22x10 sprite with something on the feet row', () => {
    const s = stonesSprite();
    expect([s.width, s.height]).toEqual([STONES_SIZE.w, STONES_SIZE.h]);
    expect(s.pixels.filter((c) => c !== TRANSPARENT).length).toBeGreaterThan(60);
    expect(s.pixels.slice((s.height - 1) * s.width).some((c) => c !== TRANSPARENT)).toBe(true);
  });

  it('stand on the near shore left of the dock at Quiet Lake, and the River bend leaves them out', () => {
    const at = QUIET_LAKE.spots.stones!;
    expect(at.x + STONES_SIZE.w).toBeLessThanOrEqual(116);
    expect(at.y).toBeGreaterThan(452 - 14);
    expect(RIVER_BEND.spots.stones).toBeUndefined();
  });

  it('keep clear of the camp, the trophy board, the car, the dock and the fetch lawn (picture and finger area)', () => {
    const at = QUIET_LAKE.spots.stones!;
    const pic = box(at.x, at.y, STONES_SIZE.w, STONES_SIZE.h);
    const finger = box(at.x - 9, at.y - 10, 116 - (at.x - 9), STONES_SIZE.h + 20);
    const others: [string, Box][] = [
      ['trophy board', box(58 - TROPHY_BOARD_SIZE.w / 2, 492 - TROPHY_BOARD_SIZE.h, TROPHY_BOARD_SIZE.w, TROPHY_BOARD_SIZE.h)],
      ['car', box(0, 500, CAR_SIZE.w, CAR_SIZE.h + 6)],
      ['dock', box(116, 362, 128, 106)],
      ['fetch lawn', box(PLAY_AREA.x0, PLAY_AREA.y0, PLAY_AREA.x1 - PLAY_AREA.x0, PLAY_AREA.y1 - PLAY_AREA.y0)],
    ];
    for (const [name, b] of Object.entries(campBoxes())) others.push([name, b]);
    for (const [name, b] of others) {
      expect(overlap(pic, b), `stones overlap ${name}`).toBe(false);
      // The finger area may touch the camp pole's picture margin, but never the fire, tent, bed or the other big things.
      if (name !== 'pole') expect(overlap(finger, b), `stone finger area overlaps ${name}`).toBe(false);
    }
  });
});
