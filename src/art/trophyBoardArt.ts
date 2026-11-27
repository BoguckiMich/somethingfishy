import { fishMini } from './fishVariants';
import { PAL } from './palette';
import { sprite, TRANSPARENT, type Sprite } from './pixelGrid';

/**
 * The trophy board on the grass by the car (slice 23d), pure: a small wooden board on two posts, 2 x 2 slots, a tiny mounted fish
 * in each slot that has a trophy (the three rare fish, then the Pale One). One texture per set of mounted ids.
 */
export const TROPHY_BOARD_SIZE = { w: 40, h: 34 };
/** The slot order on the board (left to right, top to bottom). */
export const TROPHY_SLOT_IDS: readonly string[] = ['goldenTench', 'mossback', 'silverGhost', 'pale'];
/** The River bend's board (slice 25f): the same board, its own four slots (the three trophies, then the Ferryman). */
export const RIVER_SLOT_IDS: readonly string[] = ['lantern', 'barbelKing', 'ferryPike', 'ferryman'];
/** The slot order of a set of mounted fish: the river's when any of them is the river's, else the lake's. */
export const slotsFor = (mounted: readonly string[]): readonly string[] => (mounted.some((id) => RIVER_SLOT_IDS.includes(id)) ? RIVER_SLOT_IDS : TROPHY_SLOT_IDS);
const SLOT = { w: 17, h: 9, gap: 1, x0: 3, y0: 3 };
const FISH_W = 15;

const BOARD_H = 24;
const ROWS = [
  '.' + 'o'.repeat(38) + '.',
  'o' + 'l'.repeat(38) + 'o',
  ...Array.from({ length: BOARD_H - 4 }, () => 'ol' + 'w'.repeat(36) + 'wo'),
  'o' + 'D'.repeat(38) + 'o',
  '.' + 'o'.repeat(38) + '.',
];
const POST = '....olwo' + '.'.repeat(24) + 'olwo....';
const POST_END = '....oooo' + '.'.repeat(24) + 'oooo....';
const BASE = [...ROWS, ...Array.from({ length: 9 }, () => POST), POST_END].join('\n') + '\n';
const COLORS = { o: PAL.outline, l: PAL.woodLight, w: PAL.wood, D: PAL.woodDark };

const slotXY = (i: number): { x: number; y: number } => ({
  x: SLOT.x0 + (i % 2) * (SLOT.w + SLOT.gap + 1),
  y: SLOT.y0 + Math.floor(i / 2) * (SLOT.h + SLOT.gap + 1),
});

/** The board with these species mounted (ids outside the four slots are ignored). */
export function trophyBoardSprite(mounted: readonly string[]): Sprite {
  const base = sprite(BASE, COLORS);
  const px = base.pixels;
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < base.width && y < base.height) px[y * base.width + x] = c;
  };
  slotsFor(mounted).forEach((id, i) => {
    const { x, y } = slotXY(i);
    // The slot: a dark recess (the shelf), lighter once something hangs in it.
    const has = mounted.includes(id);
    for (let sy = 0; sy < SLOT.h; sy++) for (let sx = 0; sx < SLOT.w; sx++) put(x + sx, y + sy, has ? PAL.woodDark : PAL.wood);
    if (!has) {
      // An empty slot: two small nails, so the board reads as waiting for more.
      put(x + 3, y + 4, PAL.woodDark);
      put(x + SLOT.w - 4, y + 4, PAL.woodDark);
      return;
    }
    const fish = fishMini(id, FISH_W);
    const ox = x + Math.floor((SLOT.w - fish.width) / 2);
    const oy = y + Math.floor((SLOT.h - fish.height) / 2);
    for (let fy = 0; fy < fish.height; fy++) {
      for (let fx = 0; fx < fish.width; fx++) {
        const c = fish.pixels[fy * fish.width + fx];
        if (c !== TRANSPARENT) put(ox + fx, oy + fy, c);
      }
    }
    put(x + 1, y + 1, PAL.gold); // a gold nail in the corner of every mounted slot
  });
  return base;
}

/** Texture key of the board for a set of mounted fish (the same set always gives the same key). */
export const trophyBoardKey = (mounted: readonly string[]): string => `trophyboard:${slotsFor(mounted).filter((id) => mounted.includes(id)).join('+') || 'none'}`;
