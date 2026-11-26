import { BED_SIZE, CAMPFIRE_SIZE, POLE_SIZE, TENT_SIZE, WINDSOCK_RING, WINDSOCK_SIZE } from './campArt';

/**
 * Where the camp items stand (slice 23e), pure data so a test can keep them clear of the car, the trophy board, the notice-board sign, the
 * fetch lawn and the hint line. All on the grass left of the dock (the windsock on the right shore, Bestia's bed on the dock). World coordinates (360 x 640).
 *  - the tent leans in from the left edge above the car (x -6..34, y 450-494), the trophy board is right of it (x 38+);
 *  - the string lights run from the tent's ridge pole (x 14, y 451) to a pole at x 88 (y 448), above the trophy board's top (y 458);
 *  - the campfire is right of the trophy board and left of the dock (x 96-116, y 481-497), the fetch lawn starts at y 500;
 *  - Bestia's bed lies ON THE DOCK (slice 31), exactly under her lying spot beside Pajkel's chair (x 164-192, y 421-433, her feet at 178,430);
 *  - the windsock stands on the right shore (x 302-334, y 452-496), right of the notice-board sign (x 258-294).
 */
export const TENT_FEET = { x: 14, y: 494 };
export const LIGHT_POLE = { x: 85, y: 447 };
export const FIRE_FEET = { x: 106, y: 497 };
export const BED_POS = { x: 164, y: 421 };
/** The windsock's pole stands here; the cone is drawn to its left (the sprite is mirrored). */
export const SOCK_FEET = { x: 330, y: 496 };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The sprite boxes (transparent margins included), by camp item, with the id of the item that shows them. */
export function campBoxes(): Record<'tent' | 'pole' | 'fire' | 'bed' | 'sock', Box> {
  return {
    tent: { x: TENT_FEET.x - TENT_SIZE.w / 2, y: TENT_FEET.y - TENT_SIZE.h, w: TENT_SIZE.w, h: TENT_SIZE.h },
    pole: { x: LIGHT_POLE.x, y: LIGHT_POLE.y, w: POLE_SIZE.w, h: POLE_SIZE.h },
    fire: { x: FIRE_FEET.x - CAMPFIRE_SIZE.w / 2, y: FIRE_FEET.y - CAMPFIRE_SIZE.h, w: CAMPFIRE_SIZE.w, h: CAMPFIRE_SIZE.h },
    bed: { x: BED_POS.x, y: BED_POS.y, w: BED_SIZE.w, h: BED_SIZE.h },
    sock: { x: SOCK_FEET.x - (WINDSOCK_SIZE.w - WINDSOCK_RING.x), y: SOCK_FEET.y - WINDSOCK_SIZE.h, w: WINDSOCK_SIZE.w, h: WINDSOCK_SIZE.h },
  };
}

/** The windsock's origin x (a fraction of its width): mirrored, the pole sits (width - ring x) from the left edge. */
export const SOCK_ORIGIN_X = (WINDSOCK_SIZE.w - WINDSOCK_RING.x) / WINDSOCK_SIZE.w;
