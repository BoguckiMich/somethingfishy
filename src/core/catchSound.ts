import { isGoldOrBetter, type Tier } from './data/stars';
import type { CatchOutcome } from './fishLog';

/** Which jingle a landed fish gets (slice 27). */
export type CatchJingle = 'catch' | 'fanfare' | 'trophy' | 'medal';

export interface CatchSoundFacts {
  /** How the log took the catch: normal, a new species or a new record. */
  outcome: CatchOutcome['kind'];
  /** The tier on show (already raised by a perfect catch). */
  star: Tier;
  /** The catch was perfect (the sweet spot). */
  perfect: boolean;
  /** A rare trophy fish (it goes on the trophy board). */
  trophy: boolean;
  /** The Pale One, which slips away: it keeps the plain fanfare (its own eerie scene). */
  slips: boolean;
}

/**
 * The stinger for a catch (pure): a rare trophy gets its own warm one, a medal (perfect gold) its bright metal one, the Pale One the old
 * fanfare, a new species / record / gold / perfect catch the fanfare, and an everyday catch the short arpeggio.
 */
export function catchJingle(f: CatchSoundFacts): CatchJingle {
  if (f.slips) return 'fanfare';
  if (f.trophy) return 'trophy';
  if (f.star === 'medal') return 'medal';
  return f.outcome === 'normal' && !isGoldOrBetter(f.star) && !f.perfect ? 'catch' : 'fanfare';
}
