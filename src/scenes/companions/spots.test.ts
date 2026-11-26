import { describe, expect, it } from 'vitest';
import { DOCK } from '../../art/layout';
import { HUT_BOX, riverWaterline } from '../../art/riverArt';
import { QUIET_LAKE, RIVER_BEND } from '../../core/data/locations';
import { seededRng } from '../../core/random';
import {
  CAR_DOG,
  CAR_STAND,
  DOG_BED_SPOT,
  DOG_SPOT,
  FIRE_KEEP_OFF,
  FIRE_SPOT,
  PAJ_SPOT,
  PLAY_AREA,
  PLAY_PAJ,
  SHORE_TUNING,
  createCompanions,
  pebbleRequest,
  setCompanionSpots,
  startNap,
  startPlayNow,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const ctx: CompanionContext = { fishing: 'idle', night: false, bed: true, fire: true };
type P = { x: number; y: number };

describe('Quiet Lake companion spots (M2 groundwork B)', () => {
  const c = QUIET_LAKE.spots.companions;

  it('are exactly the constants the behaviour had before they moved into the place data', () => {
    expect(c.paj).toEqual({ x: 150, y: 406 });
    expect(c.dog).toEqual({ x: 178, y: 430 });
    expect(c.pajDown).toEqual([{ x: 148, y: 440 }, { x: 148, y: 484 }]);
    expect(c.dogDown).toEqual([{ x: 178, y: 444 }, { x: 178, y: 486 }]);
    expect(c.grassY).toBe(470);
    expect(c.playPaj).toEqual({ x: 112, y: 540 });
    expect(c.playDog).toEqual({ x: 140, y: 544 });
    expect(c.carStand).toEqual({ x: 34, y: 560 });
    expect(c.carDog).toEqual({ x: 60, y: 564 });
    expect(QUIET_LAKE.spots.playArea).toEqual({ x0: 100, x1: 322, y0: 500, y1: 554 });
    expect(QUIET_LAKE.spots.camp.fire).toEqual({ x: 106, y: 497 });
    expect(c.fireKeepOff).toEqual({ halfW: 22, below: 46, standX: 130 });
    expect(c.zigzag).toEqual({ midX: 200, rightX: [240, 320], leftX: [90, 150], y: [508, 584], homeX: [100, 124], homeY: [548, 566] });
    expect(c.shore).toEqual({
      stand: { x: 122, y: 479 },
      dogSit: { x: 150, y: 484 },
      pajDockVia: { x: 140, y: 480 },
      dogDockVia: { x: 160, y: 488 },
      pajLane: { belowY: 488, y: 484, minX: 140 },
      dogVia: { x: 150, y: 489 },
    });
  });

  it('are what the exported default names say, and the dog bed is the middle of the camp bed', () => {
    expect(PAJ_SPOT).toEqual(c.paj);
    expect(DOG_SPOT).toEqual(c.dog);
    expect(PLAY_PAJ).toEqual(c.playPaj);
    expect(CAR_STAND).toEqual(c.carStand);
    expect(CAR_DOG).toEqual(c.carDog);
    expect(PLAY_AREA).toEqual(QUIET_LAKE.spots.playArea);
    expect(FIRE_SPOT).toEqual(QUIET_LAKE.spots.camp.fire);
    expect(FIRE_KEEP_OFF).toEqual(c.fireKeepOff);
    expect(DOG_BED_SPOT).toEqual({ x: 94, y: 564 });
    expect(SHORE_TUNING.stand).toEqual(c.shore?.stand);
    expect(SHORE_TUNING.dogSit).toEqual(c.shore?.dogSit);
  });

  it('createCompanions with no spots is the same as with Quiet Lake', () => {
    const a = createCompanions(seededRng(3));
    const b = createCompanions(seededRng(3), QUIET_LAKE.spots);
    expect(b).toEqual(a);
  });
});

describe('River bend companion spots', () => {
  const sp = RIVER_BEND.spots;
  const c = sp.companions;
  /** On the landing planks or on dry ground below the river's waterline. */
  const dry = (p: P) => (p.x >= DOCK.x && p.x <= DOCK.x + DOCK.w && p.y >= DOCK.y && p.y <= DOCK.y + DOCK.h) || p.y >= riverWaterline(p.x) + 2;
  const inHut = (p: P) => p.x >= HUT_BOX.x && p.x <= HUT_BOX.x + HUT_BOX.w && p.y >= HUT_BOX.y && p.y <= HUT_BOX.y + HUT_BOX.h;

  it('every spot, waypoint and corner of the lawn is on the landing or the bank, never in the river or the hut', () => {
    const pts: P[] = [
      c.paj, c.dog, ...c.pajDown, ...c.dogDown, c.playPaj, c.playDog, c.carStand, c.carDog, sp.camp.fire,
      { x: sp.playArea.x0, y: sp.playArea.y0 }, { x: sp.playArea.x1, y: sp.playArea.y0 },
      { x: sp.playArea.x0, y: sp.playArea.y1 }, { x: sp.playArea.x1, y: sp.playArea.y1 },
      { x: c.zigzag.leftX[0], y: c.zigzag.y[0] }, { x: c.zigzag.rightX[1], y: c.zigzag.y[1] }, { x: c.zigzag.homeX[0], y: c.zigzag.homeY[0] },
    ];
    for (const p of pts) {
      expect(dry(p), `${p.x},${p.y} is dry`).toBe(true);
      expect(inHut(p), `${p.x},${p.y} is out of the hut`).toBe(false);
    }
  });

  it('has no skipping stones, so no pebble outing', () => {
    expect(sp.stones).toBeUndefined();
    expect(c.shore).toBeNull();
    const s = createCompanions(seededRng(1), sp);
    expect(pebbleRequest(s, { skips: 3, side: 0, big: false }, 'idle')).toBe('no');
    expect(s.mode).toBe('dock');
  });

  /** Runs the family for `ms` and checks every step stands on dry ground and (on the grass) inside the lawn. */
  function run(s: Companions, ms: number, rng: () => number, onGrassOnly: boolean): void {
    for (let t = 0; t < ms; t += 50) {
      tickCompanions(s, 50, ctx, rng);
      for (const a of [s.paj, s.dog]) {
        if (s.mode === 'bed' && s.bed?.phase === 'asleep') continue;
        expect(dry(a), `${s.mode} ${a.x.toFixed(0)},${a.y.toFixed(0)} on dry ground`).toBe(true);
        if (onGrassOnly && s.mode === 'play' && s.play.phase !== 'napGo') {
          expect(a.y).toBeGreaterThanOrEqual(sp.playArea.y0 - 30);
        }
      }
    }
  }

  it('they fetch on the lawn without ever stepping into the water', () => {
    for (const seed of [1, 2, 3]) {
      const rng = seededRng(seed);
      const s = createCompanions(rng, sp);
      startPlayNow(s);
      run(s, 90_000, rng, true);
    }
  });

  it('the walk from the chair to the car for a nap stays on the landing and the bank', () => {
    const rng = seededRng(5);
    const s = createCompanions(rng, sp);
    expect(startNap(s)).toBe(true);
    run(s, 20_000, rng, false);
    expect(s.mode).toBe('bed');
  });

  it('setCompanionSpots puts a live family back on the new place landing', () => {
    const rng = seededRng(7);
    const s = createCompanions(rng);
    startPlayNow(s);
    setCompanionSpots(s, sp);
    expect(s.spots).toBe(sp);
    expect(s.mode).toBe('dock');
    expect(s.paj).toMatchObject(c.paj);
    expect(s.dog).toMatchObject(c.dog);
  });
});
