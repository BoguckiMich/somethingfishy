import { describe, expect, it } from 'vitest';
import { CHAPTERS, PALE_BEAT, STORY_LINES, STORY_TUNING } from '../data/story';
import { newPlayer } from '../inventory';
import { normalizeSave } from '../save';
import {
  blinkIsNight,
  blinkLines,
  chapterById,
  lastSeenDate,
  markPaleSeen,
  markSeen,
  newStory,
  nextLine,
  normalizeStory,
  paleBeatDue,
  queueLines,
  slotFree,
  storyIsEmpty,
  storyOf,
  todaysChapter,
} from './story';

const LAKE = 'quiet-lake';
const IDS = CHAPTERS[LAKE].map((c) => c.id);

describe('the chapter data', () => {
  it('has Q1-Q7 in order, ids unique, every line id known', () => {
    expect(IDS).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']);
    expect(new Set(IDS).size).toBe(IDS.length);
    for (const c of CHAPTERS[LAKE]) {
      for (const id of [...(c.before ?? []), ...c.after]) expect(STORY_LINES[id], `${c.id}:${id}`).toBeTruthy();
    }
    for (const id of PALE_BEAT.after) expect(STORY_LINES[id]).toBeTruthy();
  });
  it('respects the length limits (bottle 90, bubble 40, card lines 38)', () => {
    for (const c of CHAPTERS[LAKE]) if (c.text) expect(c.text.length).toBeLessThanOrEqual(90);
    for (const t of Object.values(STORY_LINES)) expect(t.length).toBeLessThanOrEqual(40);
    for (const t of PALE_BEAT.lines) expect(t.length).toBeLessThanOrEqual(38);
  });
  it('bottle chapters have a note, and Q4 has a day note too', () => {
    for (const c of CHAPTERS[LAKE]) if (c.kind === 'bottle' || c.kind === 'blink') expect(c.text).toBeTruthy();
  });
});

describe('todaysChapter: one per date, the next unseen one', () => {
  it('a fresh game gets Q1 on any valid date', () => {
    expect(todaysChapter(newStory(), '2026-11-24', LAKE)?.id).toBe('Q1');
  });
  it('gives one chapter per date, in order, over seven days', () => {
    let s = newStory();
    const seen: string[] = [];
    for (let d = 1; d <= 9; d++) {
      const today = `2026-12-${String(d).padStart(2, '0')}`;
      const c = todaysChapter(s, today, LAKE);
      if (!c) continue;
      seen.push(c.id);
      s = markSeen(s, c.id, today);
      expect(todaysChapter(s, today, LAKE)).toBeNull(); // nothing more the same day
    }
    expect(seen).toEqual(IDS); // Q8 is not a daily chapter; after Q7 nothing comes
  });
  it('replays the same chapter while it is unseen (the game was closed before)', () => {
    const s = markSeen(newStory(), 'Q1', '2026-12-01');
    expect(todaysChapter(s, '2026-12-02', LAKE)?.id).toBe('Q2');
    expect(todaysChapter(s, '2026-12-03', LAKE)?.id).toBe('Q2');
    expect(todaysChapter(s, '2026-12-09', LAKE)?.id).toBe('Q2');
  });
  it('skipped days never pile up or skip chapters', () => {
    let s = markSeen(newStory(), 'Q1', '2026-12-01');
    const c = todaysChapter(s, '2027-03-01', LAKE)!;
    expect(c.id).toBe('Q2');
    s = markSeen(s, c.id, '2027-03-01');
    expect(todaysChapter(s, '2027-03-01', LAKE)).toBeNull();
    expect(todaysChapter(s, '2027-03-02', LAKE)?.id).toBe('Q3');
  });
  it('the clock going backwards gives nothing', () => {
    const s = markSeen(newStory(), 'Q1', '2026-12-10');
    expect(slotFree(s, '2026-12-09')).toBe(false);
    expect(todaysChapter(s, '2026-12-09', LAKE)).toBeNull();
    expect(todaysChapter(s, '2026-12-10', LAKE)).toBeNull();
    expect(todaysChapter(s, '2026-12-11', LAKE)?.id).toBe('Q2');
  });
  it('a bad date or an unknown place gives nothing', () => {
    expect(todaysChapter(newStory(), 'tomorrow', LAKE)).toBeNull();
    expect(todaysChapter(newStory(), '2026-02-30', LAKE)).toBeNull();
    expect(todaysChapter(newStory(), '2026-12-01', 'river-bend')).toBeNull();
    expect(todaysChapter(newStory(), '2026-12-01', 'constructor')).toBeNull();
  });
  it('the last seen date is the latest one', () => {
    let s = markSeen(newStory(), 'Q1', '2026-12-01');
    s = markSeen(s, 'Q2', '2026-12-04');
    expect(lastSeenDate(s)).toBe('2026-12-04');
    expect(lastSeenDate(newStory())).toBeNull();
  });
});

describe('markSeen', () => {
  it('records the date and queues the chapter lines', () => {
    const s = markSeen(newStory(), 'Q2', '2026-12-02');
    expect(s.done).toEqual({ Q2: '2026-12-02' });
    expect(s.queue).toEqual(['q2a', 'q2b']);
  });
  it('seeing a chapter twice changes nothing (no second set of lines)', () => {
    const once = markSeen(newStory(), 'Q1', '2026-12-01');
    expect(markSeen(once, 'Q1', '2026-12-05')).toBe(once);
  });
  it('can override the lines (the two versions of Q4)', () => {
    expect(markSeen(newStory(), 'Q4', '2026-12-01', blinkLines(true)).queue).toEqual(['q4']);
    expect(markSeen(newStory(), 'Q4', '2026-12-01', blinkLines(false)).queue).toEqual([]);
  });
  it('ignores an unknown chapter or a bad date', () => {
    const s = newStory();
    expect(markSeen(s, 'Z9', '2026-12-01')).toBe(s);
    expect(markSeen(s, 'Q1', 'nope')).toBe(s);
  });
});

describe('the line queue', () => {
  it('plays in order, one at a time, only when Pajkel can speak', () => {
    let s = queueLines(newStory(), ['q2a', 'q2b']);
    expect(nextLine(s, false)).toBeNull();
    const a = nextLine(s, true)!;
    expect(a.text).toBe(STORY_LINES.q2a);
    s = a.story;
    const b = nextLine(s, true)!;
    expect(b.id).toBe('q2b');
    expect(nextLine(b.story, true)).toBeNull();
  });
  it('keeps lines while he sleeps and releases them in order once he wakes', () => {
    let s = markSeen(newStory(), 'Q4', '2026-12-01', blinkLines(true));
    s = queueLines(s, ['q5a']);
    for (let i = 0; i < 5; i++) expect(nextLine(s, false)).toBeNull();
    expect(nextLine(s, true)!.id).toBe('q4');
  });
  it('drops unknown ids and caps its length (oldest first out)', () => {
    expect(queueLines(newStory(), ['nope', 'toString']).queue).toEqual([]);
    const many = Array.from({ length: 20 }, () => 'q1');
    expect(queueLines(newStory(), many).queue).toHaveLength(STORY_TUNING.queueMax);
  });
  it('does not touch the state when nothing can play', () => {
    const s = newStory();
    expect(nextLine(s, true)).toBeNull();
  });
});

describe('Q4 version and the Pale One beat', () => {
  it('the night blink needs Pajkel asleep in the car and a dark sky', () => {
    expect(blinkIsNight(true, true)).toBe(true);
    expect(blinkIsNight(true, false)).toBe(false);
    expect(blinkIsNight(false, true)).toBe(false);
  });
  it('the pale beat shows once and queues Pajkel line once', () => {
    let s = newStory();
    expect(paleBeatDue(s)).toBe(true);
    s = markPaleSeen(s);
    expect(paleBeatDue(s)).toBe(false);
    expect(s.queue).toEqual(['pale']);
    expect(markPaleSeen(s)).toBe(s);
  });
  it('uses no daily slot (a beat does not count as a chapter)', () => {
    const s = markPaleSeen(newStory());
    expect(todaysChapter(s, '2026-12-01', LAKE)?.id).toBe('Q1');
  });
});

describe('normalizeStory (garbage saves)', () => {
  it('anything unreadable becomes a fresh state', () => {
    for (const bad of [undefined, null, 5, 'x', [], true]) expect(normalizeStory(bad)).toEqual(newStory());
  });
  it('drops unknown chapters, bad dates and unknown lines; keeps the good ones', () => {
    const s = normalizeStory({
      done: { Q1: '2026-12-01', Q2: 'yesterday', Z9: '2026-12-01', constructor: '2026-12-01', Q3: 7 },
      queue: ['q1', 'nope', 3, 'q2a', 'toString'],
      pale: 'yes',
    });
    expect(s.done).toEqual({ Q1: '2026-12-01' });
    expect(s.queue).toEqual(['q1', 'q2a']);
    expect(s.pale).toBe(false);
  });
  it('a broken done / queue shape is tolerated', () => {
    expect(normalizeStory({ done: [1, 2], queue: 'q1' })).toEqual(newStory());
    expect(normalizeStory({ done: null, queue: null, pale: true })).toEqual({ done: {}, queue: [], pale: true });
  });
  it('a long queue is cut to the cap', () => {
    expect(normalizeStory({ queue: Array.from({ length: 30 }, () => 'q1') }).queue).toHaveLength(STORY_TUNING.queueMax);
  });
});

describe('the story in the save', () => {
  const norm = (story: unknown) => normalizeSave({ version: 1, player: { story } }).player;
  it('an old save has no story key; storyOf reads a fresh one', () => {
    const p = norm(undefined);
    expect('story' in p).toBe(false);
    expect(storyOf(p)).toEqual(newStory());
    expect(storyOf(newPlayer())).toEqual(newStory());
  });
  it('an empty or garbage story stores nothing; a real one is kept', () => {
    expect('story' in norm({ done: {}, queue: [] })).toBe(false);
    expect('story' in norm('junk')).toBe(false);
    expect(norm({ done: { Q1: '2026-12-01' }, queue: ['q1'], pale: true }).story).toEqual({ done: { Q1: '2026-12-01' }, queue: ['q1'], pale: true });
  });
  it('storyIsEmpty', () => {
    expect(storyIsEmpty(newStory())).toBe(true);
    expect(storyIsEmpty(markPaleSeen(newStory()))).toBe(false);
  });
  it('chapterById finds Q-chapters only', () => {
    expect(chapterById('Q5')?.kind).toBe('prints');
    expect(chapterById('Q8')).toBeUndefined();
  });
});
