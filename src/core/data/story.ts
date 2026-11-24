/**
 * Story chapters (GAME_DESIGN section 3, slice 21). Texts are copied from docs/STORY.md section 3
 * (bottle <= 90 characters, bubble <= 40, card lines <= ~38). The rules live in core/story/; the
 * pictures in scenes/StoryView.ts. Chapter and line ids are saved: never rename them.
 *
 * Every place has its own ordered chapter list (only Quiet Lake exists now); the river, the quarry
 * and the sea slot in later as more keys of CHAPTERS.
 */

/** How a chapter is told. */
export type ChapterKind =
  /** A sealed story bottle on the water; tapping it opens the note card. */
  | 'bottle'
  /** The duck takes Pajkel's sandwich (plays on its own). */
  | 'duck'
  /** The star reflection that blinks at night; the same chapter is a bottle by day or when Pajkel is awake. */
  | 'blink'
  /** Wet footprints on the dock (plays on its own). */
  | 'prints';

export interface ChapterDef {
  id: string;
  /** Place id (a `Location.id`); she must be there to get it. */
  place: string;
  kind: ChapterKind;
  /** The bottle's note (kind bottle; for blink: the day version). */
  text?: string;
  /** Pajkel lines (ids of STORY_LINES) said before the picture appears (queued if he sleeps). */
  before?: readonly string[];
  /** Pajkel lines said after she has seen the chapter (queued; they wait while he sleeps). */
  after: readonly string[];
}

export const STORY_LINES: Record<string, string> = {
  q1: 'A pen pal! Ask if they have snacks.',
  q2a: 'HEY. That was MY sandwich.',
  q2b: "...I know it's you, duck.",
  q3: 'Map says this lake is 9 metres deep.',
  q4: 'Did I miss something? Again?',
  q5a: 'Bestia, did you go swimming?',
  q5b: '...Bestia is completely dry.',
  q6: 'Pale one? Like a really white bream?',
  q7: "Road trip? I'll fix the road!",
  pale: 'You caught WHAT? I was asleep?!',
};

export const CHAPTERS: Record<string, readonly ChapterDef[]> = {
  'quiet-lake': [
    { id: 'Q1', place: 'quiet-lake', kind: 'bottle', text: 'To whoever fishes here next: the lake is deeper than it looks. Be kind to it. — W.', after: ['q1'] },
    { id: 'Q2', place: 'quiet-lake', kind: 'duck', after: ['q2a', 'q2b'] },
    {
      id: 'Q3',
      place: 'quiet-lake',
      kind: 'bottle',
      text: 'My line went down 40 metres last night. The map says 9. One of us is lying. — W.',
      before: ['q3'],
      after: [],
    },
    { id: 'Q4', place: 'quiet-lake', kind: 'blink', text: "Count the stars in the lake some night. Then count the sky. Don't tell me the answer. — W.", after: [] },
    { id: 'Q5', place: 'quiet-lake', kind: 'prints', after: ['q5a', 'q5b'] },
    { id: 'Q6', place: 'quiet-lake', kind: 'bottle', text: 'I caught the pale one once. I think. I wrote it down so I would remember. — W.', after: ['q6'] },
    { id: 'Q7', place: 'quiet-lake', kind: 'bottle', text: "This lake isn't a lake. It's a doorstep. The river knows more. Follow the bottles. — W.", after: ['q7'] },
  ],
};

/** The night version of Q4 has its own line: Pajkel was asleep in the car. The day version has none. */
export const BLINK_NIGHT_LINES: readonly string[] = ['q4'];
export const BLINK_DAY_LINES: readonly string[] = [];

/** The Pale One bonus beat: the card shown the first time it slips back, and Pajkel's line. */
export const PALE_BEAT = {
  title: 'The Pale One',
  lines: ['It slipped back into the dark.', 'For a moment it looked at you.', 'Then you forgot why.'],
  after: ['pale'],
} as const;

export const STORY_TUNING = {
  /** Real ms of calm play before today's chapter shows up. */
  delayMs: { min: 60_000, max: 90_000 },
  /** After a chapter was interrupted (a fight, a panel) the next try comes this much later. */
  retryMs: 20_000,
  /** Real ms between two queued Pajkel lines. */
  lineGapMs: { min: 3_000, max: 4_000 },
  /** Most lines kept in the queue (the saved list cannot grow without limit). */
  queueMax: 8,
  /** The night blink sinks by itself after this long if nobody taps it. */
  blinkMs: 20_000,
} as const;
