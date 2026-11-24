import type { QuestsState } from '../core/quests/quests';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * The notice-board sign on the shore (slice 22c), pure: two posts and a plank board, 24 x 26 px (its feet at
 * the bottom middle). The board shows cream paper notes, one per unfinished quest; a quest that can be claimed
 * is a note with a gold pin that flutters in two frames (it replaces the red "!"); a story chapter that is
 * waiting is a red wax seal on a cream note. Which notes show is `SignLook`, one texture per look.
 */
export const SIGN_SIZE = { w: 24, h: 26 };

/** One quest slot on the board: nothing (no quest, or claimed), a plain note, or a done note with a gold pin. */
export type SignNote = 'off' | 'note' | 'claim';

export interface SignLook {
  /** The three quest slots, left to right. */
  slots: readonly [SignNote, SignNote, SignNote];
  /** A story chapter is waiting: the sealed note. */
  seal: boolean;
  /** The flutter frame of the claimable notes. */
  flutter: 0 | 1;
}

/** The slots for today's quests: finished and claimed ones leave the board. */
export function signSlots(q: QuestsState): [SignNote, SignNote, SignNote] {
  const slot = (i: number): SignNote => {
    const quest = q.list[i];
    return !quest || quest.claimed ? 'off' : quest.done ? 'claim' : 'note';
  };
  return [slot(0), slot(1), slot(2)];
}

/** A stable texture key per look (flutter only matters when a note can flutter). */
export function signKey(look: SignLook): string {
  const flutter = look.slots.includes('claim') ? look.flutter : 0;
  return `sign:${look.slots.map((s) => (s === 'off' ? '-' : s === 'note' ? 'n' : 'c')).join('')}${look.seal ? 's' : ''}${flutter}`;
}

/** Where the glint twinkles: the top middle of the board. */
export const SIGN_GLINT = { x: 12, y: 2 };

// 24 x 16 board (outline, a light top edge, a dark cork-like face for the paper to show on) and two posts.
const BASE = `
.oooooooooooooooooooooo.
ollllllllllllllllllllllo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
olDDDDDDDDDDDDDDDDDDDDwo
owwwwwwwwwwwwwwwwwwwwwwo
.oooooooooooooooooooooo.
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...olwo..........olwo...
...oooo..........oooo...
`;

const COLORS = { o: PAL.outline, l: PAL.woodLight, w: PAL.wood, D: PAL.woodDark };

const NOTE_X = [3, 10, 17] as const;
const NOTE_Y = 3;
// 4 x 5 cream paper with two grey "writing" lines.
const NOTE = ['cccc', 'gggc', 'cccc', 'ggcc', 'cccc'] as const;
const SEAL = ['.ooo.', 'oRrRo', 'oRRRo', 'oRRDo', '.ooo.'] as const;
const SEAL_COLORS: Record<string, number> = { o: PAL.outline, R: PAL.red, r: PAL.redLight, D: PAL.redDark };

/** The sign for a look. */
export function signSprite(look: SignLook): Sprite {
  const base = sprite(BASE, COLORS);
  const px = base.pixels;
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < base.width && y < base.height) px[y * base.width + x] = c;
  };
  const paper = (ch: string) => (ch === 'c' ? PAL.cream : PAL.stoneLight);
  const drawNote = (x0: number, y0: number, rows: readonly string[], shiftBottom = 0) => {
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => put(x0 + rx + (ry >= rows.length - 2 ? shiftBottom : 0), y0 + ry, paper(ch))));
  };
  look.slots.forEach((s, i) => {
    if (s === 'off') return;
    const x = NOTE_X[i];
    if (s === 'claim') {
      // A gold rim makes it the one to look at; the corner lifts a pixel in the second frame; a gold pin holds the top.
      for (let ry = -1; ry <= NOTE.length; ry++) for (let rx = -1; rx <= NOTE[0].length; rx++) if (ry < 0 || ry === NOTE.length || rx < 0 || rx === NOTE[0].length) put(x + rx, NOTE_Y + ry, PAL.sandDark);
      drawNote(x, NOTE_Y, NOTE, look.flutter);
      put(x + 1, NOTE_Y - 1, PAL.white);
      put(x + 2, NOTE_Y - 1, PAL.gold);
      put(x + 1, NOTE_Y, PAL.gold);
      put(x + 2, NOTE_Y, PAL.sandDark);
    } else {
      drawNote(x, NOTE_Y, NOTE);
      put(x + 1, NOTE_Y, PAL.stoneDark);
    }
  });
  if (look.seal) {
    // A sealed letter on the lower middle of the board.
    const x = 9;
    const y = 9;
    for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 6; rx++) put(x + rx, y + ry, ry === 1 && rx > 0 && rx < 3 ? PAL.stoneLight : PAL.cream);
    SEAL.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && put(x + 2 + rx, y + 1 + ry, SEAL_COLORS[ch])));
  }
  return base;
}
