import { speciesById, SPECIES } from '../core/data/fish';
import { sizeShare } from '../core/fish';
import { FISH_CLASSES, fishIcon, fishVariant, type FishClass } from './fishVariants';
import { FISH_LARGE } from './fishSprites';
import { rotateSpriteCcw, type Sprite } from './pixelGrid';

/**
 * What the scenes and panels use for fish pictures. The drawings themselves live in
 * `fishSprites.ts` / `fishVariants.ts`; this file maps a catch (species + length) to a size class
 * and builds the texture keys. Fish face right.
 */

export type FishSizeClass = FishClass;
export const FISH_SIZE_CLASSES: readonly FishSizeClass[] = FISH_CLASSES;

/** Size class of a catch: the lower, middle or upper third of the species' length range. */
export function fishSizeClass(speciesId: string, lengthCm: number): FishSizeClass {
  const sp = speciesById(speciesId);
  if (!sp) return 0;
  const share = sizeShare(sp, lengthCm);
  return share < 0.34 ? 0 : share < 0.67 ? 1 : 2;
}

export const fishKey = (id: string, cls: FishSizeClass) => `fish:${id}:${cls}`;
export const fishIconKey = (id: string) => `fishicon:${id}`;
export const fishHugKey = (id: string) => `fishhug:${id}`;

export const fishSprite = (id: string, cls: FishSizeClass): Sprite => fishVariant(id, cls);
/** A small fish for the catch bar's marker. */
export const fishIconSprite = (id: string): Sprite => fishIcon(id);

/** Species too big for the chest pose are hugged head-up: the large sprite turned a quarter turn (always the large one: it is a huge fish). */
export const HUG_SPECIES_IDS: readonly string[] = SPECIES.filter((s) => s.showOff === 'hug').map((s) => s.id);
export const isHugged = (id: string): boolean => HUG_SPECIES_IDS.includes(id);
export const fishHugSprite = (id: string): Sprite => rotateSpriteCcw(fishVariant(id, 2));

/** Every species has art (a guard for data and art drifting apart). */
export const FISH_IDS_WITH_ART: readonly string[] = SPECIES.filter((s) => FISH_LARGE[s.id]).map((s) => s.id);
