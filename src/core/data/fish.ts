import type { TimeOfDay } from '../clock';
import type { FishPattern } from '../catchBar';
import type { ZoneId } from '../location';

export type Rarity = 'common' | 'uncommon' | 'rare';

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
  /** One short, real fact (shown in the fish log later). */
  fact: string;
}

const ANY: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

/** The v1 roster (GAME_DESIGN section 3). Tunable data; the legendary arrives in slice 12. */
export const SPECIES: Species[] = [
  {
    id: 'roach', name: 'Roach', zone: 'shallow', times: ['day'], rarity: 'common', pattern: 'smooth', difficulty: 0.1,
    lengthCm: [12, 30], nibbles: [0, 1], bodyFactor: 0.0111, basePrice: 6,
    fact: 'Roach live in big schools and cope with murky water better than most fish.',
  },
  {
    id: 'rudd', name: 'Rudd', zone: 'shallow', times: ['day'], rarity: 'common', pattern: 'floater', difficulty: 0.15,
    lengthCm: [12, 30], nibbles: [0, 3], bodyFactor: 0.0125, basePrice: 7,
    fact: 'The rudd has an upturned mouth, which suits feeding at the water surface.',
  },
  {
    id: 'bleak', name: 'Bleak', zone: 'shallow', times: ['day'], rarity: 'common', pattern: 'darting', difficulty: 0.2,
    lengthCm: [8, 18], nibbles: [0, 1], bodyFactor: 0.0074, basePrice: 4,
    fact: 'Bleak swim in shoals near the surface and snap up insects that fall on the water.',
  },
  {
    id: 'perch', name: 'Perch', zone: 'shallow', times: ['day'], rarity: 'uncommon', pattern: 'darting', difficulty: 0.25,
    lengthCm: [10, 35], nibbles: [2, 4], bodyFactor: 0.0128, basePrice: 14,
    fact: 'Perch have dark vertical stripes and hunt small fish in groups.',
  },
  {
    id: 'crucian', name: 'Crucian carp', zone: 'shallow', times: ANY, rarity: 'common', pattern: 'sinker', difficulty: 0.12,
    lengthCm: [10, 30], nibbles: [0, 3], bodyFactor: 0.0224, basePrice: 8,
    fact: 'Crucian carp can survive in ponds with almost no oxygen, even under winter ice.',
  },
  {
    id: 'eel', name: 'Eel', zone: 'shallow', times: ['night'], rarity: 'uncommon', pattern: 'erratic', difficulty: 0.3,
    lengthCm: [40, 100], nibbles: [0, 3], bodyFactor: 0.0023, basePrice: 22,
    fact: 'European eels are born in the Sargasso Sea and travel thousands of kilometres to reach our waters.',
  },
  {
    id: 'bream', name: 'Bream', zone: 'deep', times: ANY, rarity: 'common', pattern: 'sinker', difficulty: 0.66,
    lengthCm: [25, 60], nibbles: [2, 4], bodyFactor: 0.0144, basePrice: 20,
    fact: 'Bream graze along the bottom for insect larvae and worms.',
  },
  {
    id: 'tench', name: 'Tench', zone: 'deep', times: ['dawn', 'dusk'], rarity: 'uncommon', pattern: 'smooth', difficulty: 0.55,
    lengthCm: [25, 55], nibbles: [2, 4], bodyFactor: 0.0172, basePrice: 30,
    fact: 'The tench is covered in thick slime, and old folklore called it the doctor fish.',
  },
  {
    id: 'carp', name: 'Carp', zone: 'deep', times: ANY, rarity: 'uncommon', pattern: 'smooth', difficulty: 0.7,
    lengthCm: [35, 90], nibbles: [2, 4], bodyFactor: 0.0175, basePrice: 38,
    fact: 'Common carp can live for several decades.',
  },
  {
    id: 'pike', name: 'Pike', zone: 'deep', times: ['day'], rarity: 'uncommon', pattern: 'darting', difficulty: 0.75,
    lengthCm: [40, 110], nibbles: [0, 1], bodyFactor: 0.008, basePrice: 45,
    fact: 'Pike are ambush predators that strike in a fraction of a second.',
  },
  {
    id: 'zander', name: 'Zander', zone: 'deep', times: ['dusk', 'night'], rarity: 'uncommon', pattern: 'erratic', difficulty: 0.7,
    lengthCm: [35, 80], nibbles: [0, 3], bodyFactor: 0.0106, basePrice: 48,
    fact: 'Zander have large glassy eyes that help them hunt in murky water and at dusk.',
  },
  {
    id: 'catfish', name: 'Catfish', zone: 'deep', times: ['night'], rarity: 'rare', pattern: 'sinker', difficulty: 0.85,
    lengthCm: [60, 180], nibbles: [0, 3], bodyFactor: 0.0074, basePrice: 100,
    fact: 'The wels catfish is the largest freshwater fish in Europe and can pass two metres in length.',
  },
];

export function speciesById(id: string): Species | undefined {
  return SPECIES.find((s) => s.id === id);
}
