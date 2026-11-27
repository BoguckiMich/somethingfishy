import type { FishPattern } from './catchBar';
import type { ZoneId } from './location';

/**
 * Things that happen in the game. The core emits them; the scene reacts (sound, haptics, text),
 * and later quests/stats subscribe to them (see GAME_DESIGN §5).
 */
export type GameEvent =
  /** `lure`: a spinning cast (slice 32), the lure id; absent = the float rig. */
  | { type: 'cast'; distanceM: number; zone: ZoneId; locationId: string; lure?: string }
  | { type: 'nibble' }
  /** The bobber reached the eddy at the end of its drift (moving water, slice 25c). */
  | { type: 'driftSettled' }
  | { type: 'bite' }
  | { type: 'hooked'; zone: ZoneId; lure?: string }
  | { type: 'fishEscaped'; reason: 'tooEarly' | 'tooLate' }
  /** The catch bar was filled. `fightMs` is how long the fight took. */
  | {
      type: 'fishCaught';
      zone: ZoneId;
      pattern: FishPattern;
      difficulty: number;
      fightMs: number;
      speciesId: string;
      lengthCm: number;
      weightG: number;
      /** The fish never left the green zone during the fight (slice 23f). Missing = no. */
      perfect?: boolean;
      /** Caught on a lure (slice 32, the lure id); absent = the float rig. Quests count it; bait is not spent for it. */
      lure?: string;
    }
  /** The catch bar ran empty (classic), or the line went slack too long / snapped (line style, `snapped`). Slice 7 hooks losing the bait onto this. */
  | { type: 'fishLost'; zone: ZoneId; pattern: FishPattern; difficulty: number; speciesId: string; slipped?: boolean; snapped?: boolean; lure?: string }
  // ---- Spinning (slice 32) ----
  /** A predator started following the lure (the shadow appears). */
  | { type: 'follow'; speciesId: string; lengthCm: number }
  /** The follower lost interest and drifted off. */
  | { type: 'followLost'; speciesId: string }
  /** The follower struck. `hookGraceMs` is how long the thumb has to go down when it is up (0 = it was down: the hook sets at once). */
  | { type: 'strike'; speciesId: string; hookGraceMs: number }
  /** A strike the thumb missed: the lure carries on. */
  | { type: 'nip'; speciesId: string }
  /** The lure snagged on the bottom (the line goes tight, the lure is gone). */
  | { type: 'snag'; lure: string }
  /** A lure is gone for good: its count goes down (`applyEvent`). `bringBack`: Bestia will bring it back later (1 in 5 snapped ones, never a snag). */
  | { type: 'lureLost'; lure: string; cause: 'snapped' | 'snag'; bringBack: boolean }
  /** The line snapped but the fish spat the lure (15 %). */
  | { type: 'lureSpat'; lure: string }
  /** The lure reached the dock untouched: nothing lost, back to idle. */
  | { type: 'lureOut'; lure: string };
