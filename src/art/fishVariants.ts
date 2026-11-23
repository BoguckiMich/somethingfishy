import { shrinkSprite, silhouetteOf } from './fishScale';
import { FISH_ART, FISH_LARGE } from './fishSprites';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * Every fish in every size: large (hand-drawn), medium and small (code shrink of the large one),
 * the catch-bar icon and the log silhouette. A species whose shrink comes out mushy gets a
 * hand-drawn grid in `FISH_OVERRIDES` instead. Classes: 0 small, 1 medium, 2 large.
 */

export type FishClass = 0 | 1 | 2;
export const FISH_CLASSES: readonly FishClass[] = [0, 1, 2];

/** Width of each class as a share of the large sprite. */
const CLASS_SHARE: Record<FishClass, number> = { 0: 0.55, 1: 0.75, 2: 1 };
/** Catch-bar icon width: a third of the large one, kept within these bounds. */
export const FISH_ICON_WIDTH_RANGE: readonly [number, number] = [9, 15];

export type VariantName = 'small' | 'medium' | 'icon';

/**
 * Hand-drawn replacements, full sprite grids including the outline (`o` = outline, the other
 * letters are the species' own colour letters).
 */
export const FISH_OVERRIDES: Record<string, Partial<Record<VariantName, string>>> = {};

const cache = new Map<string, Sprite>();
const memo = (key: string, make: () => Sprite): Sprite => {
  let s = cache.get(key);
  if (!s) cache.set(key, (s = make()));
  return s;
};

function shrink(id: string, width: number): Sprite {
  const art = FISH_ART[id];
  const thin = [...(art.thin ?? '')].map((ch) => art.colors[ch]);
  return shrinkSprite(FISH_LARGE[id], Math.min(width, FISH_LARGE[id].width), { protect: [art.colors[art.eye]], thin });
}

function variant(id: string, name: VariantName, width: number): Sprite {
  return memo(`${id}:${name}`, () => {
    const grid = FISH_OVERRIDES[id]?.[name];
    if (grid) return sprite(grid, { ...FISH_ART[id].colors, o: PAL.outline });
    return shrink(id, width);
  });
}

function art(id: string): Sprite {
  const large = FISH_LARGE[id];
  if (!large) throw new Error(`fish art: unknown species ${id}`);
  return large;
}

/** A fish at a size class (0 small, 1 medium, 2 large), facing right. */
export function fishVariant(id: string, cls: FishClass): Sprite {
  const large = art(id);
  if (cls === 2) return large;
  return variant(id, cls === 1 ? 'medium' : 'small', Math.round(large.width * CLASS_SHARE[cls]));
}

/** The small fish for the catch bar's marker. */
export function fishIcon(id: string): Sprite {
  const large = art(id);
  const [lo, hi] = FISH_ICON_WIDTH_RANGE;
  return variant(id, 'icon', Math.min(hi, Math.max(lo, Math.round(large.width / 3))));
}

/** Flat dark shadow of the large sprite, for fish not caught yet in the log. */
export function fishSilhouette(id: string): Sprite {
  return memo(`${id}:silhouette`, () => silhouetteOf(art(id), PAL.outlineSoft));
}
