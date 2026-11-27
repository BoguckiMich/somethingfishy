/**
 * Story chapters (GAME_DESIGN section 3, slice 21). Texts are copied from docs/STORY.md section 3
 * (bottle <= 90 characters, bubble <= 40, card lines <= ~38). The rules live in core/story/; the
 * pictures in scenes/StoryView.ts. Chapter and line ids are saved: never rename them.
 *
 * Every place has its own ordered chapter list (Quiet Lake Q1-Q7, River bend R1-R6 since slice 25e); the quarry
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
  | 'prints'
  /** A story card only (River bend R2, R6): it opens when she is calm, and closing it counts as seen. */
  | 'card'
  /** A story card, then Bestia's stick floats upstream out of sight (R1; plays on its own after the card). */
  | 'stick'
  /** The duck comes round the bend with a worm in its beak (R4; plays on its own). */
  | 'duckWorm';

/** A chapter's card: a title and 2-4 short lines; with `tagLast` the last line is drawn as a gate tag (R6). */
export interface ChapterCard {
  title: string;
  lines: readonly string[];
  tagLast?: boolean;
}

export interface ChapterDef {
  id: string;
  /** Place id (a `Location.id`); she must be there to get it. */
  place: string;
  kind: ChapterKind;
  /** The bottle's note (kind bottle; for blink: the day version). */
  text?: string;
  /** The card (kinds card and stick). */
  card?: ChapterCard;
  /** A sealed bottle that drifts slowly upstream instead of floating still (the river's R3). */
  drift?: true;
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
  q5a: '{dog}, did you go swimming?',
  q5b: '...{dog} is completely dry.',
  q6: 'Pale one? Like a really white bream?',
  q7: "Road trip? I'll fix the road!",
  /** Q7 told after the road was already fixed. */
  q7Road: "Good thing the road's already fixed!",
  pale: 'You caught WHAT? I was asleep?!',
  // River bend (slice 25e)
  r1: "...sticks don't do that.",
  r2: 'Back never, right? Classic W.',
  r4a: 'Is that... OUR duck? It followed us?',
  r4b: 'Fine. Duck is family now. Duck, sit.',
  r6: "Road to the quarry. I'm driving!",
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
  // River bend (slice 25e): texts from STORY.md section 3, triggers from RIVER_BEND.md decision 6 (see storyMilestones).
  'river-bend': [
    {
      id: 'R1',
      place: 'river-bend',
      kind: 'stick',
      card: { title: 'Arrival', lines: ['River bend.', 'The water here is in a hurry.', 'Mostly in one direction.'] },
      after: ['r1'],
    },
    {
      id: 'R2',
      place: 'river-bend',
      kind: 'card',
      card: { title: 'River bend', lines: ['An old hut by the bend.', 'Sign: W. - FERRY & BAIT.', 'Below it: GONE FISHING.', 'The kettle inside is still warm.'] },
      after: ['r2'],
    },
    {
      id: 'R3',
      place: 'river-bend',
      kind: 'bottle',
      drift: true,
      text: 'I ran the ferry for people. The Ferryman runs it for everything else. Be polite. — W.',
      after: [],
    },
    { id: 'R4', place: 'river-bend', kind: 'duckWorm', after: ['r4a', 'r4b'] },
    { id: 'R5', place: 'river-bend', kind: 'bottle', text: "Odd fish aren't really fish. They're dreams that swam too far from the one dreaming. — W.", after: [] },
    {
      id: 'R6',
      place: 'river-bend',
      kind: 'card',
      card: { title: 'River bend', lines: ['In the hut, a hook for a key.', 'The key is gone.', 'The tag is still there:', 'OLD QUARRY - GATE.'], tagLast: true },
      after: ['r6'],
    },
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

/** The icons of the journal (slice 22d): a picture per way a chapter is told. */
export type JournalIcon = 'bottle' | 'duck' | 'star' | 'prints' | 'car' | 'pale' | 'stick' | 'hut' | 'key';

/** Who thinks the thought: Alex is the player, Pajkel the companion. */
export type Thinker = 'alex' | 'paj';

export interface JournalDef {
  icon: JournalIcon;
  /** One-line description of a moment (bottles show their own note instead). */
  text?: string;
  by: Thinker;
  /** The thought (<= 60 characters). */
  thought: string;
}

/** What the journal says about each chapter (ids are saved: never rename). Q4 has a night and a day version. */
export const JOURNAL: Record<string, JournalDef> = {
  Q1: { icon: 'bottle', by: 'alex', thought: 'A pen pal who signs with one letter. Who are you, W.?' },
  Q2: { icon: 'duck', by: 'paj', text: 'The duck paddled up to the dock, took the sandwich and left, quacking.', thought: 'Note to self: never trust a duck.' },
  Q3: { icon: 'bottle', by: 'alex', thought: 'Forty metres down in a nine-metre lake?' },
  Q5: { icon: 'prints', by: 'paj', text: 'Wet footprints crossed the dock to the car and back, then dried.', thought: "Wet footprints. Not mine, not {dog}'s. Hm." },
  Q6: { icon: 'bottle', by: 'alex', thought: 'How do you forget catching something like that?' },
  Q7: { icon: 'bottle', by: 'paj', thought: "A doorstep to what? I'm fixing the road anyway." },
  Q8: { icon: 'car', by: 'paj', text: 'The road to the river is open. The car is packed, stick and all.', thought: 'Car packed. Stick packed. Duck not invited.' },
  // River bend (slice 25e)
  R1: { icon: 'stick', by: 'alex', text: "{dog}'s stick floated upstream, slowly, and out of sight.", thought: 'The water is in a hurry. Mostly one way. Mostly.' },
  R2: { icon: 'hut', by: 'alex', text: 'An old hut by the bend. FERRY & BAIT, then GONE FISHING. The kettle is still warm.', thought: 'Still warm. W. must have just left. Or never did.' },
  R3: { icon: 'bottle', by: 'alex', thought: 'The Ferryman. Be polite. I can do polite.' },
  R4: { icon: 'duck', by: 'paj', text: 'The duck came round the bend with a worm still in its beak. It followed us.', thought: 'Duck is family now. Nobody tell the duck.' },
  R5: { icon: 'bottle', by: 'alex', thought: 'Dreams with fins. Someone is missing them.' },
  R6: { icon: 'key', by: 'paj', text: 'In the hut, a hook for a key. The key is gone. The tag says: OLD QUARRY - GATE.', thought: "A quarry gate and no key. I'll drive anyway." },
};
export const JOURNAL_BLINK_NIGHT: JournalDef = {
  icon: 'star',
  by: 'alex',
  text: 'A star in the lake with no star above it. It blinked once, slowly, and sank.',
  thought: 'A star in the water with no star above it. It blinked.',
};
/** Q7 told after the road was already fixed (the journal's alternative thought). */
export const JOURNAL_Q7_LATE: JournalDef = { icon: 'bottle', by: 'paj', thought: "A doorstep to what? Good thing the road's already open." };
export const JOURNAL_BLINK_DAY: JournalDef = { icon: 'bottle', by: 'alex', thought: 'Count the stars tonight. Maybe. Probably.' };
export const JOURNAL_PALE: JournalDef = {
  icon: 'pale',
  by: 'alex',
  text: 'It slipped back into the dark. For a moment it looked at you. Then you forgot why.',
  thought: 'I caught it. I think. Why is it so hard to remember?',
};
/** The journal counts the seven chapters Q1-Q7 (the Pale One and the road-fixed pages are bonuses). */
export const JOURNAL_TOTAL = 7;

export const STORY_TUNING = {
  /** Chapters that may be seen on one real date (they follow progress, not the calendar). */
  perDay: 2,
  /** The same cap once the road is fixed (catch-up): a little looser, never unlimited (balance A2: a tester saw the whole story on day one). */
  catchUpPerDay: 3,
  /** The in-game minute from which a visit counts as a night visit (21:00; Q4's milestone). */
  nightFromMinute: 21 * 60,
  /** R4 (the duck) also fires on this many river catches made after R3, so it never stalls behind a time of day (RIVER_BEND.md decision 6). */
  r4FallbackCatches: 3,
  /** Q7 comes when this many checklist bundles are done. */
  q7Bundles: 5,
  /** Q4 unlocks without the night flag once this many bundles are done (day-only players get the bottle version). */
  q4FallbackBundles: 3,
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
