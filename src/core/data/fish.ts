import type { TimeOfDay } from '../clock';
import type { FishPattern } from '../catchBar';
import type { ZoneId } from '../location';
import type { WeatherId } from './weather';

/**
 * `legendary` and `trophy` fish are not in the weighted spawn pool: they have their own rules (core/legendary.ts,
 * core/rare.ts). A trophy (slice 23d) is one of the three rare Quiet Lake fish: caught only under special conditions.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'trophy';

export interface Species {
  id: string;
  name: string;
  zone: ZoneId;
  /** When it bites (all four = any time). */
  times: TimeOfDay[];
  rarity: Rarity;
  pattern: FishPattern;
  /** Base difficulty of the fight (0..1). Size adds up to +0.10. */
  difficulty: number;
  /** Length range in cm. */
  lengthCm: [number, number];
  /** Fake-out nibbles before the real bite (inclusive range). */
  nibbles: [number, number];
  /** The `a` in weight(g) = a * length(cm)^3: body shape (eel light, bream/carp heavy). */
  bodyFactor: number;
  /** Coins when sold (used from slice 7). */
  basePrice: number;
  /** The plural of the name when it is not the same as the singular (most fish are: "2 roach"); lower case in quest text. */
  plural?: string;
  /** One short, real fact (shown in the fish log later). */
  fact: string;
  /** Shown on the log tile while the species is unknown, instead of where and when. */
  logHint?: string;
  /** How Alex shows it off: at her chest (default), or hugged head-up with the tail on the dock (too big for the chest). */
  showOff?: 'chest' | 'hug';
  /** The weather it bites best in (slice 23b): the multiplier lives in data/weather.ts. Missing = no favourite. */
  likes?: WeatherId[];
}

const ANY: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

/** The v1 roster (GAME_DESIGN section 3). Tunable data; the legendary arrives in slice 12. */
export const SPECIES: Species[] = [
  {
    id: 'roach', name: 'Roach', zone: 'shallow', times: ['dawn', 'day'], rarity: 'common', pattern: 'smooth', difficulty: 0.1,
    lengthCm: [12, 30], nibbles: [0, 1], bodyFactor: 0.0111, basePrice: 6,
    fact: 'Roach live in big schools and cope with murky water better than most fish.',
  },
  {
    id: 'rudd', name: 'Rudd', zone: 'shallow', times: ['dawn', 'day'], rarity: 'common', pattern: 'floater', difficulty: 0.15,
    lengthCm: [12, 30], nibbles: [0, 3], bodyFactor: 0.0125, basePrice: 7,
    fact: 'The rudd has an upturned mouth, which suits feeding at the water surface.',
  },
  {
    id: 'bleak', name: 'Bleak', zone: 'shallow', times: ['dawn', 'day'], rarity: 'common', pattern: 'darting', difficulty: 0.2,
    lengthCm: [8, 18], nibbles: [0, 1], bodyFactor: 0.0074, basePrice: 4,
    fact: 'Bleak swim in shoals near the surface and snap up insects that fall on the water.',
  },
  {
    id: 'perch', name: 'Perch', zone: 'shallow', times: ['day'], rarity: 'uncommon', pattern: 'darting', difficulty: 0.25,
    lengthCm: [10, 35], nibbles: [2, 4], bodyFactor: 0.0128, basePrice: 14,
    fact: 'Perch have dark vertical stripes and hunt small fish in groups.',
    likes: ['windy'],
  },
  {
    id: 'crucian', name: 'Crucian carp', zone: 'shallow', times: ANY, rarity: 'common', pattern: 'sinker', difficulty: 0.12,
    lengthCm: [10, 30], nibbles: [0, 3], bodyFactor: 0.0224, basePrice: 8,
    fact: 'Crucian carp can survive in ponds with almost no oxygen, even under winter ice.',
  },
  {
    id: 'eel', name: 'Eel', plural: 'Eels', zone: 'shallow', times: ['night'], rarity: 'uncommon', pattern: 'erratic', difficulty: 0.3,
    lengthCm: [40, 100], nibbles: [0, 3], bodyFactor: 0.0023, basePrice: 22,
    fact: 'European eels are born in the Sargasso Sea and travel thousands of kilometres to reach our waters.',
  },
  {
    id: 'ide', name: 'Ide', plural: 'Ides', zone: 'shallow', times: ['dawn', 'dusk'], rarity: 'uncommon', pattern: 'smooth', difficulty: 0.35,
    lengthCm: [20, 55], nibbles: [1, 3], bodyFactor: 0.012, basePrice: 18,
    fact: 'The ide is a silvery cousin of the roach that swims in schools and runs up rivers in spring.',
    likes: ['overcast'],
  },
  {
    id: 'asp', name: 'Asp', zone: 'shallow', times: ['day'], rarity: 'rare', pattern: 'darting', difficulty: 0.5,
    lengthCm: [30, 85], nibbles: [0, 1], bodyFactor: 0.0085, basePrice: 25,
    fact: 'The asp is a carp relative that hunts small fish and slaps the surface to stun them.',
    likes: ['windy'],
  },
  {
    id: 'bream', name: 'Bream', zone: 'deep', times: ANY, rarity: 'common', pattern: 'sinker', difficulty: 0.66,
    lengthCm: [25, 60], nibbles: [2, 4], bodyFactor: 0.0144, basePrice: 20,
    fact: 'Bream graze along the bottom for insect larvae and worms.',
    likes: ['rain'],
  },
  {
    id: 'tench', name: 'Tench', zone: 'deep', times: ['dawn', 'dusk'], rarity: 'uncommon', pattern: 'smooth', difficulty: 0.55,
    lengthCm: [25, 55], nibbles: [2, 4], bodyFactor: 0.0172, basePrice: 30,
    fact: 'The tench is covered in thick slime, and old folklore called it the doctor fish.',
    likes: ['overcast'],
  },
  {
    id: 'carp', name: 'Carp', zone: 'deep', times: ANY, rarity: 'uncommon', pattern: 'smooth', difficulty: 0.7,
    lengthCm: [35, 90], nibbles: [2, 4], bodyFactor: 0.0175, basePrice: 38,
    fact: 'Common carp can live for several decades.',
    likes: ['rain'],
  },
  {
    id: 'pike', name: 'Pike', zone: 'deep', times: ['day'], rarity: 'uncommon', pattern: 'darting', difficulty: 0.75,
    lengthCm: [40, 110], nibbles: [0, 1], bodyFactor: 0.008, basePrice: 45,
    fact: 'Pike are ambush predators that strike in a fraction of a second.',
    likes: ['windy'],
  },
  {
    id: 'zander', name: 'Zander', zone: 'deep', times: ['dusk', 'night'], rarity: 'uncommon', pattern: 'erratic', difficulty: 0.7,
    lengthCm: [35, 80], nibbles: [0, 3], bodyFactor: 0.0106, basePrice: 48,
    fact: 'Zander have large glassy eyes that help them hunt in murky water and at dusk.',
    likes: ['windy', 'overcast'],
  },
  {
    id: 'burbot', name: 'Burbot', zone: 'deep', times: ['night'], rarity: 'rare', pattern: 'erratic', difficulty: 0.65,
    lengthCm: [25, 75], nibbles: [0, 2], bodyFactor: 0.0088, basePrice: 60,
    fact: 'The burbot is the only freshwater cod and is most active at night and in winter.',
    likes: ['rain', 'fog'],
  },
  {
    id: 'catfish', name: 'Catfish', zone: 'deep', times: ['night'], rarity: 'rare', pattern: 'sinker', difficulty: 0.85,
    lengthCm: [60, 180], nibbles: [0, 3], bodyFactor: 0.0074, basePrice: 100,
    fact: 'The wels catfish is the largest freshwater fish in Europe and can pass two metres in length.',
  },
  // The River bend's own species (slice 25d, RIVER_BEND.md section 5). Which place and band they bite in lives in data/locations.ts;
  // `zone` is only their main depth class (the barbel is "deep": it feeds on the bottom and is no pushover).
  {
    id: 'trout', name: 'Brown trout', zone: 'shallow', times: ['dawn', 'dusk'], rarity: 'uncommon', pattern: 'darting', difficulty: 0.4,
    lengthCm: [20, 70], nibbles: [0, 2], bodyFactor: 0.012, basePrice: 30,
    fact: 'Brown trout read the current like a menu: they sit just behind a stone and let the river deliver.',
    likes: ['rain', 'overcast'],
  },
  {
    id: 'grayling', name: 'Grayling', zone: 'shallow', times: ['day'], rarity: 'uncommon', pattern: 'floater', difficulty: 0.3,
    lengthCm: [20, 50], nibbles: [1, 3], bodyFactor: 0.0095, basePrice: 26,
    fact: 'Grayling smell faintly of thyme, which is where their Latin name comes from. The big sail on the back is for show.',
    likes: ['sunny'],
  },
  {
    id: 'nase', name: 'Nase', zone: 'shallow', times: ['day'], rarity: 'common', pattern: 'smooth', difficulty: 0.12,
    lengthCm: [15, 45], nibbles: [0, 1], bodyFactor: 0.0116, basePrice: 6,
    fact: 'The nase scrapes algae off river stones with a sharp-edged lip, and travels in big crowds.',
    likes: ['sunny'],
  },
  {
    id: 'chub', name: 'Chub', zone: 'shallow', times: ANY, rarity: 'common', pattern: 'smooth', difficulty: 0.2,
    lengthCm: [15, 60], nibbles: [0, 2], bodyFactor: 0.016, basePrice: 9,
    fact: 'Some anglers swear a chub once winked at them; the chub has no comment.',
  },
  {
    id: 'barbel', name: 'Barbel', zone: 'deep', times: ['dusk', 'night'], rarity: 'uncommon', pattern: 'sinker', difficulty: 0.68,
    lengthCm: [30, 90], nibbles: [2, 4], bodyFactor: 0.0116, basePrice: 42,
    fact: 'Barbel feel along the river bed with four whiskers, and taste with them too.',
    likes: ['rain'],
  },
  {
    id: 'vimba', name: 'Vimba', zone: 'shallow', times: ['dawn', 'day'], rarity: 'uncommon', pattern: 'smooth', difficulty: 0.3,
    lengthCm: [20, 45], nibbles: [1, 3], bodyFactor: 0.0128, basePrice: 20,
    fact: 'Vimba swim upstream in summer to spawn, and for a few weeks their bellies glow orange.',
    likes: ['overcast'],
  },
  {
    // Trophies (slice 23d): not in the weighted pool; spawn rules and tunables in core/data/rare.ts. The fight is harder than
    // the base difficulty suggests (it also slips away after a few seconds outside the green zone). basePrice is the worth;
    // a trophy is never bagged or sold, it goes on the trophy board. `times` is only informational.
    id: 'goldenTench', name: 'Golden tench', zone: 'deep', times: ['dawn', 'dusk'], rarity: 'trophy', pattern: 'darting', difficulty: 0.8,
    lengthCm: [45, 70], nibbles: [2, 4], bodyFactor: 0.0172, basePrice: 400,
    fact: 'Golden tench are real: a pale, yellow-orange form that breeders prize. This one has a red eye.',
    logHint: 'They say a golden tench rises in the rain, when the light is low.',
  },
  {
    id: 'mossback', name: 'Old Mossback', zone: 'deep', times: ['dawn', 'day', 'dusk', 'night'], rarity: 'trophy', pattern: 'sinker', difficulty: 0.9,
    lengthCm: [85, 130], nibbles: [2, 4], bodyFactor: 0.014, basePrice: 600,
    fact: 'A carp so old that moss grows on its back. Some say it was here before the dock.',
    logHint: 'An old carp, green as the shore, comes out of the fog for a sweet bite far out.',
    showOff: 'hug',
  },
  {
    id: 'silverGhost', name: 'Silver ghost', zone: 'shallow', times: ['day'], rarity: 'trophy', pattern: 'darting', difficulty: 0.8,
    lengthCm: [24, 40], nibbles: [1, 3], bodyFactor: 0.0074, basePrice: 300,
    fact: 'A bleak so pale it is almost white. It shimmers for a moment and is gone.',
    logHint: 'On bright noons, something pale flickers in the shallows. It likes maggots.',
  },
  {
    // Legendary (slice 12): not in the weighted pool. Spawn rule and tunables: core/data/legendary.ts.
    // basePrice 0: it is never sold. `times` is only informational; the rule is the clock window.
    id: 'pale', name: 'The Pale One', zone: 'deep', times: ['night'], rarity: 'legendary', pattern: 'abyssal', difficulty: 0.9,
    lengthCm: [150, 220], nibbles: [0, 1], bodyFactor: 0.01, basePrice: 0,
    fact: 'No one has caught it twice. No one remembers why.',
    logHint: 'Deep, far water. When the clock shows 3.',
    showOff: 'hug',
  },
];

/** The species that bite through the weighted pool (everything but the legendary and the trophies). */
export const POOL_SPECIES: Species[] = SPECIES.filter((s) => s.rarity !== 'legendary' && s.rarity !== 'trophy');

export function speciesById(id: string): Species | undefined {
  return SPECIES.find((s) => s.id === id);
}

/** True for a legendary species (never in the normal pool, never bagged or sold). */
export const isLegendary = (s: Species | undefined): boolean => s?.rarity === 'legendary';

/** True for a trophy species (slice 23d): never bagged or sold, it goes on the trophy board. */
export const isTrophy = (s: Species | undefined): boolean => s?.rarity === 'trophy';

/** A legendary or a trophy: no stars, no checklist slot, no species quest, no fish-knowledge rows. */
export const isUnique = (s: Species | undefined): boolean => s?.rarity === 'legendary' || s?.rarity === 'trophy';
