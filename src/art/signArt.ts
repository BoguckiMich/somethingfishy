import type { QuestsState } from '../core/quests/quests';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/**
 * The notice-board sign on the shore (slice 22c, made 1.5x bigger in 22d), pure: two posts and a plank board,
 * 36 x 38 px (its feet at the bottom middle). The board shows cream paper notes (6 x 7 px, with readable "writing"
 * lines), one per unfinished quest; a quest that can be claimed is a note with a 3 x 3 gold pin and a gold rim that
 * flutters in two frames; a story chapter that is waiting is a bigger cream letter with a red wax seal. Which notes
 * show is `SignLook`, one texture per look. The soft gold glow of a claimable note is drawn by the scene.
 * Two old notes are always pinned low on the board so it never looks empty: a faded "LOST" poster with a red
 * bobber (left, a nod to the bottle note) and a child's fish doodle (right); they sit clear of the quest notes
 * and of the sealed letter.
 */
export const SIGN_SIZE = { w: 36, h: 38 };

/** One quest slot on the board: nothing (no quest, or claimed), a plain note, or a done note with a gold pin. */
export type SignNote = 'off' | 'note' | 'claim';

export interface SignLook {
  /** The three quest slots, left to right. */
  slots: readonly [SignNote, SignNote, SignNote];
  /** A story chapter is waiting: the sealed letter. */
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
export const SIGN_GLINT = { x: 18, y: 3 };

const NOTE_X = [5, 15, 25] as const;
const NOTE_Y = 5;
export const NOTE_SIZE = { w: 6, h: 7 };
/** The middle of a quest note in sprite pixels (the scene puts the glow there). */
export const signNoteCenter = (i: number): { x: number; y: number } => ({ x: NOTE_X[i] + NOTE_SIZE.w / 2, y: NOTE_Y + NOTE_SIZE.h / 2 });

// 36 x 24 board (outline, a light top edge, a dark cork-like face for the paper to show on) and two 14 px posts.
const BOARD_ROWS = [
  '.' + 'o'.repeat(34) + '.',
  'o' + 'l'.repeat(34) + 'o',
  ...Array.from({ length: 20 }, () => 'ol' + 'D'.repeat(32) + 'wo'),
  'o' + 'w'.repeat(34) + 'o',
  '.' + 'o'.repeat(34) + '.',
];
const POST_ROW = '......olwo' + '.'.repeat(16) + 'olwo......';
const POST_END = '......oooo' + '.'.repeat(16) + 'oooo......';
const BASE = ['', ...BOARD_ROWS, ...Array.from({ length: 13 }, () => POST_ROW), POST_END].join('\n') + '\n';

const COLORS = { o: PAL.outline, l: PAL.woodLight, w: PAL.wood, D: PAL.woodDark };

// 6 x 7 cream paper: dark "writing" lines (c cream, g ink) so a note reads as a note, not a blob.
const NOTE = ['cccccc', 'gggggc', 'cccccc', 'ggggcc', 'cccccc', 'gggccc', 'cccccc'] as const;
// 12 x 8 sealed letter, and a 6 x 6 red wax seal over its lower right corner.
const LETTER = ['cccccccccccc', 'cgggggggcccc', 'cccccccccccc', 'cggggggcgcgc', 'cccccccccccc', 'cgggggcccccc', 'cccccccccccc', 'cccccccccccc'] as const;
const SEAL = ['.oooo.', 'oRrRRo', 'oRRRRo', 'oRRRDo', 'oRRDDo', '.oooo.'] as const;
const SEAL_COLORS: Record<string, number> = { o: PAL.outline, R: PAL.red, r: PAL.redLight, D: PAL.redDark };
const LETTER_AT = { x: 11, y: 13 };
// 6 x 7 faded "LOST" poster with a red-and-white bobber, and a 8 x 7 fish doodle (head left, tail right).
const LOST_POSTER = ['pppppp', 'pggggp', 'pppppp', 'ppRRpp', 'ppWWpp', 'pppgpp', 'pggggp'] as const;
const FISH_DOODLE = ['pppppppp', 'ppggggpg', 'pgppppgg', 'pgpgpppg', 'pgppppgg', 'ppggggpg', 'pppppppp'] as const;

/** The sign for a look. */
export function signSprite(look: SignLook): Sprite {
  const base = sprite(BASE, COLORS);
  const px = base.pixels;
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < base.width && y < base.height) px[y * base.width + x] = c;
  };
  const paper = (ch: string) => (ch === 'c' ? PAL.cream : PAL.stoneDark);
  const drawNote = (x0: number, y0: number, rows: readonly string[], shiftBottom = 0) => {
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => put(x0 + rx + (ry >= rows.length - 2 ? shiftBottom : 0), y0 + ry, paper(ch))));
  };
  // The permanent old notes, on aged paper (p), drawn first so nothing covers a quest note or the letter.
  const OLD: Record<string, number> = { p: PAL.sandLight, g: PAL.stoneDark, R: PAL.red, W: PAL.white };
  const pinOld = (x0: number, y0: number, rows: readonly string[]) =>
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && put(x0 + rx, y0 + ry, OLD[ch])));
  pinOld(3, 13, LOST_POSTER);
  put(5, 13, PAL.stoneDark); // its tack
  pinOld(25, 13, FISH_DOODLE);
  put(28, 13, PAL.stoneDark);
  look.slots.forEach((s, i) => {
    if (s === 'off') return;
    const x = NOTE_X[i];
    if (s === 'claim') {
      // A gold rim makes it the one to look at; the lower corner lifts a pixel in the second frame; a 3 x 3 gold pin holds the top.
      for (let ry = -1; ry <= NOTE_SIZE.h; ry++) for (let rx = -1; rx <= NOTE_SIZE.w; rx++) if (ry < 0 || ry === NOTE_SIZE.h || rx < 0 || rx === NOTE_SIZE.w) put(x + rx, NOTE_Y + ry, PAL.gold);
      drawNote(x, NOTE_Y, NOTE, look.flutter);
      const pin = [
        [PAL.white, PAL.gold, PAL.gold],
        [PAL.gold, PAL.gold, PAL.sandDark],
        [PAL.sandDark, PAL.sandDark, PAL.sandDark],
      ];
      pin.forEach((row, ry) => row.forEach((c, rx) => put(x + 1 + rx, NOTE_Y - 2 + ry, c)));
    } else {
      drawNote(x, NOTE_Y, NOTE);
      put(x + 2, NOTE_Y, PAL.stoneDark); // a small tack
    }
  });
  if (look.seal) {
    // A sealed letter on the lower middle of the board with a red wax seal on its corner.
    LETTER.forEach((row, ry) => [...row].forEach((ch, rx) => put(LETTER_AT.x + rx, LETTER_AT.y + ry, paper(ch))));
    SEAL.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && put(LETTER_AT.x + 8 + rx, LETTER_AT.y + 3 + ry, SEAL_COLORS[ch])));
  }
  return base;
}
