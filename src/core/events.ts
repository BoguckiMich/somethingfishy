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
  | { type: 'fishEscaped'; reason: 'tooEarly' | 'tooLate' };
