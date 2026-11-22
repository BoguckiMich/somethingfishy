import type { FishPattern } from './catchBar';
import type { ZoneId } from './location';

/**
 * Things that happen in the game. The core emits them; the scene reacts (sound, haptics, text),
 * and later quests/stats subscribe to them (see GAME_DESIGN §5).
 */
export type GameEvent =
  | { type: 'cast'; distanceM: number; zone: ZoneId; locationId: string }
  | { type: 'nibble' }
  | { type: 'bite' }
  | { type: 'hooked'; zone: ZoneId }
  | { type: 'fishEscaped'; reason: 'tooEarly' | 'tooLate' }
  /** The catch bar was filled. `fightMs` is how long the fight took. */
  | { type: 'fishCaught'; zone: ZoneId; pattern: FishPattern; difficulty: number; fightMs: number }
  /** The catch bar ran empty. Slice 7 hooks losing the bait onto this. */
  | { type: 'fishLost'; zone: ZoneId; pattern: FishPattern; difficulty: number };
