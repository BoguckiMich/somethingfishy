import { describe, expect, it } from 'vitest';
import { TRANSPARENT } from './pixelGrid';
import { TROPHY_BOARD_SIZE, TROPHY_SLOT_IDS, trophyBoardKey, trophyBoardSprite } from './trophyBoardArt';

describe('trophy board art (slice 23d)', () => {
  it('is the same size with nothing or everything mounted, and has solid pixels', () => {
    for (const ids of [[], ['goldenTench'], [...TROPHY_SLOT_IDS]]) {
      const s = trophyBoardSprite(ids);
      expect([s.width, s.height]).toEqual([TROPHY_BOARD_SIZE.w, TROPHY_BOARD_SIZE.h]);
      expect(s.pixels.some((c) => c !== TRANSPARENT)).toBe(true);
    }
  });

  it('shows mounted fish: each one changes the picture', () => {
    const none = Array.from(trophyBoardSprite([]).pixels).join(',');
    const seen = new Set<string>([none]);
    for (const id of TROPHY_SLOT_IDS) seen.add(Array.from(trophyBoardSprite([id]).pixels).join(','));
    expect(seen.size).toBe(1 + TROPHY_SLOT_IDS.length);
  });

  it('keys by the set of mounted slots, whatever the order or extras', () => {
    expect(trophyBoardKey(['mossback', 'goldenTench'])).toBe(trophyBoardKey(['goldenTench', 'mossback', 'carp']));
    expect(trophyBoardKey([])).not.toBe(trophyBoardKey(['pale']));
  });
});
