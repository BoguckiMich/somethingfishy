import { describe, expect, it } from 'vitest';
import { CHAPTERS, JOURNAL, JOURNAL_BLINK_DAY, JOURNAL_BLINK_NIGHT, JOURNAL_PALE, JOURNAL_Q7_LATE, PALE_BEAT, STORY_LINES, STORY_TUNING } from '../data/story';
import { newPlayer } from '../inventory';
import { withBundlesDone } from '../checklist/checklist';
import { normalizeSave } from '../save';
import {
  blinkIsNight,
  blinkLines,
  chapterWaits,
  markSecondBlink,
  secondBlinkDue,
  isNightVisit,
  q7Lines,
  journalChapterCount,
  journalEntries,
  journalHasNew,
  markJournalLooked,
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
  storyMilestones,
  todaysChapter,
  withFlag,
  recordMilestones,
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

const ALL = { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true };
const only = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));
const seenIds = (ids: string[]) => ids.reduce((s, id, i) => markSeen(s, id, `2026-11-${String(i + 1).padStart(2, '0')}`), newStory());

describe('todaysChapter: milestones, strict order, two per date', () => {
  it('each chapter waits for its own milestone', () => {
    let s = newStory();
    expect(todaysChapter(s, '2026-11-24', LAKE, {})).toBeNull();
    for (let i = 0; i < IDS.length; i++) {
      const id = IDS[i];
      const day = `2026-12-${String(10 + i).padStart(2, '0')}`;
      expect(todaysChapter(s, day, LAKE, { ...ALL, [id]: false })).toBeNull(); // everything else met, this one not
      expect(todaysChapter(s, day, LAKE, only(id))?.id).toBe(id);
      s = markSeen(s, id, day);
    }
  });
  it('strict order: a later milestone never brings its chapter before the previous one is seen', () => {
    expect(todaysChapter(newStory(), '2026-12-01', LAKE, only('Q2', 'Q3', 'Q7'))).toBeNull();
    const s = markSeen(newStory(), 'Q1', '2026-12-01');
    expect(todaysChapter(s, '2026-12-02', LAKE, only('Q1', 'Q3'))).toBeNull(); // Q2 is next, its milestone is open
    expect(todaysChapter(s, '2026-12-02', LAKE, only('Q2', 'Q3'))?.id).toBe('Q2');
  });
  it('at most 2 chapters per real date; the third waits for the next date', () => {
    let s = newStory();
    for (const id of ['Q1', 'Q2']) {
      const c = todaysChapter(s, '2026-12-01', LAKE, ALL)!;
      expect(c.id).toBe(id);
      s = markSeen(s, c.id, '2026-12-01');
    }
    expect(slotFree(s, '2026-12-01')).toBe(false);
    expect(todaysChapter(s, '2026-12-01', LAKE, ALL)).toBeNull();
    expect(todaysChapter(s, '2026-12-02', LAKE, ALL)?.id).toBe('Q3');
  });
  it('after Q7 nothing more comes', () => {
    expect(todaysChapter(seenIds(IDS), '2027-01-01', LAKE, ALL)).toBeNull();
  });
  it('keeps offering the same chapter while it is unseen, and skipped days never pile up', () => {
    const s = markSeen(newStory(), 'Q1', '2026-12-01');
    expect(todaysChapter(s, '2026-12-03', LAKE, ALL)?.id).toBe('Q2');
    expect(todaysChapter(s, '2027-03-09', LAKE, ALL)?.id).toBe('Q2');
  });
  it('the clock going backwards cannot add chapters past the cap', () => {
    let s = markSeen(newStory(), 'Q1', '2026-12-10');
    s = markSeen(s, 'Q2', '2026-12-10');
    expect(slotFree(s, '2026-12-09')).toBe(false);
    expect(todaysChapter(s, '2026-12-09', LAKE, ALL)).toBeNull();
    expect(todaysChapter(s, '2026-12-11', LAKE, ALL)?.id).toBe('Q3');
  });
  it('a bad date or an unknown place gives nothing', () => {
    expect(todaysChapter(newStory(), 'tomorrow', LAKE, ALL)).toBeNull();
    expect(todaysChapter(newStory(), '2026-02-30', LAKE, ALL)).toBeNull();
    expect(todaysChapter(newStory(), '2026-12-01', 'river-bend', ALL)).toBeNull();
    expect(todaysChapter(newStory(), '2026-12-01', 'constructor', ALL)).toBeNull();
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
    expect(todaysChapter(s, '2026-12-01', LAKE, ALL)?.id).toBe('Q1');
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

describe('the story journal (22d)', () => {
  const seen = (ids: string[], night = false): ReturnType<typeof newStory> => {
    let s = newStory();
    ids.forEach((id, i) => (s = markSeen(s, id, `2026-12-0${i + 1}`, undefined, night)));
    return s;
  };
  it('is empty for a fresh game: unseen chapters never show', () => {
    expect(journalEntries(newStory())).toEqual([]);
    expect(journalChapterCount(newStory())).toBe(0);
    expect(journalEntries(seen(['Q1'])).map((e) => e.id)).toEqual(['Q1']);
  });
  it('lists seen chapters oldest first, by the date seen', () => {
    // Q2 seen before Q1 (a clock oddity): the date wins.
    const s = markSeen(markSeen(newStory(), 'Q2', '2026-12-01'), 'Q1', '2026-12-02');
    expect(journalEntries(s).map((e) => e.id)).toEqual(['Q2', 'Q1']);
  });
  it('shows the bottle note for bottles and a description for moments', () => {
    const [q1, q2] = journalEntries(seen(['Q1', 'Q2']));
    expect(q1.text).toBe(CHAPTERS['quiet-lake'][0].text);
    expect(q1.icon).toBe('bottle');
    expect(q2.icon).toBe('duck');
    expect(q2.text).toBe(JOURNAL.Q2.text);
    expect(q2.by).toBe('paj');
  });
  it('Q4 has a night and a day version, stored when it was seen', () => {
    const day = journalEntries(seen(['Q4']))[0];
    expect(day.thought).toBe(JOURNAL_BLINK_DAY.thought);
    expect(day.icon).toBe('bottle');
    expect(day.text).toBe(chapterById('Q4')?.text);
    const night = markSeen(newStory(), 'Q4', '2026-12-04', blinkLines(true), true);
    expect(night.blinkNight).toBe(true);
    expect(journalEntries(night)[0]).toMatchObject({ icon: 'star', thought: JOURNAL_BLINK_NIGHT.thought });
    expect(normalizeStory(JSON.parse(JSON.stringify(night))).blinkNight).toBe(true);
    expect(normalizeStory({ done: { Q1: '2026-12-01' }, blinkNight: true }).blinkNight).toBeUndefined();
  });
  it('the Pale One page sits by its date (or last without one) and is a bonus; Q8 comes last and needs the road', () => {
    let s = markSeen(newStory(), 'Q1', '2026-12-01');
    s = markPaleSeen(s, '2026-12-02');
    s = markSeen(s, 'Q2', '2026-12-03');
    expect(journalEntries(s).map((e) => e.id)).toEqual(['Q1', 'pale', 'Q2']);
    expect(journalEntries(s)[1].thought).toBe(JOURNAL_PALE.thought);
    expect(journalEntries(markPaleSeen(markSeen(newStory(), 'Q1', '2026-12-01'))).map((e) => e.id)).toEqual(['Q1', 'pale']);
    expect(journalChapterCount(s)).toBe(2);
    expect(journalEntries(s, true).map((e) => e.id)).toEqual(['Q1', 'pale', 'Q2', 'Q8']);
    expect(journalChapterCount(s, true)).toBe(2);
  });
  it('all seven chapters make 7 of 7 (the road-fixed page is a bonus)', () => {
    const s = seen(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']);
    expect(journalChapterCount(s, true)).toBe(7);
    expect(journalEntries(s, true).map((e) => e.id)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']);
  });
  it('every thought fits 60 characters and every page has a text', () => {
    const s = { ...seen(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']), pale: true };
    for (const e of [...journalEntries(s, true), ...journalEntries({ ...s, blinkNight: true }, true)]) {
      expect(e.thought.length, e.id).toBeLessThanOrEqual(60);
      expect(e.text.length, e.id).toBeGreaterThan(0);
    }
  });
  it('the dot: new pages since she last looked', () => {
    let s = seen(['Q1']);
    expect(journalHasNew(s)).toBe(true);
    s = markJournalLooked(s);
    expect(journalHasNew(s)).toBe(false);
    expect(markJournalLooked(s)).toBe(s);
    s = markSeen(s, 'Q2', '2026-12-09');
    expect(journalHasNew(s)).toBe(true);
    expect(journalHasNew(newStory())).toBe(false);
    expect(journalHasNew(markJournalLooked(s), true)).toBe(true); // the road is fixed: Q8
  });
  it('looked survives a save round trip', () => {
    const s = markJournalLooked(seen(['Q1', 'Q2']));
    expect(normalizeStory(JSON.parse(JSON.stringify(s))).looked).toBe(2);
    expect(normalizeStory({ done: {}, looked: -3 }).looked).toBeUndefined();
  });
});

describe('storyMilestones (derived from the player, old saves included)', () => {
  const deepLog = { bream: { count: 1, bestLengthCm: 30, bestWeightG: 500 } };
  const perch = { perch: { count: 1, bestLengthCm: 20, bestWeightG: 100 } };
  it('a fresh player has none', () => {
    expect(Object.values(storyMilestones(newPlayer())).some(Boolean)).toBe(false);
  });
  it('Q1: any catch in the log', () => {
    expect(storyMilestones({ ...newPlayer(), log: perch }).Q1).toBe(true);
  });
  it('Q3: a deep species in the log (an old save) or the flag; a shallow one is not enough', () => {
    expect(storyMilestones({ ...newPlayer(), log: perch }).Q3).toBe(false);
    expect(storyMilestones({ ...newPlayer(), log: deepLog }).Q3).toBe(true);
    expect(storyMilestones(withFlag(newPlayer(), 'deep')).Q3).toBe(true);
  });
  it('Q2: a claimed quest in the stored list or the flag', () => {
    const p = newPlayer();
    const quest = { kind: 'catchAny', params: {}, progress: 1, done: true, claimed: true, reward: { coins: 1 } } as never;
    expect(storyMilestones({ ...p, quests: { date: '2026-12-01', rerollUsed: false, list: [quest] } }).Q2).toBe(true);
    expect(storyMilestones(withFlag(p, 'quest')).Q2).toBe(true);
    expect(storyMilestones(p).Q2).toBe(false);
  });
  it('Q4: only the night flag', () => {
    expect(storyMilestones(newPlayer()).Q4).toBe(false);
    expect(storyMilestones(withFlag(newPlayer(), 'night')).Q4).toBe(true);
  });
  it('Q5 / Q7: checklist bundles done (1 and 5)', () => {
    expect(storyMilestones(withBundlesDone(newPlayer(), 0)).Q5).toBe(false);
    const one = storyMilestones(withBundlesDone(newPlayer(), 1));
    expect([one.Q5, one.Q7]).toEqual([true, false]);
    expect(storyMilestones(withBundlesDone(newPlayer(), 4)).Q7).toBe(false);
    expect(storyMilestones(withBundlesDone(newPlayer(), 5)).Q7).toBe(true);
  });
  it('Q6: the carbon rod', () => {
    expect(storyMilestones({ ...newPlayer(), rodId: 'fiberglass' }).Q6).toBe(false);
    expect(storyMilestones({ ...newPlayer(), rodId: 'carbon' }).Q6).toBe(true);
  });
  it('an old save with Q1-Q3 seen: Q4 waits for the night, the flags survive a save round trip', () => {
    const old = { ...newPlayer(), log: deepLog, story: seenIds(['Q1', 'Q2', 'Q3']) };
    expect(todaysChapter(storyOf(old), '2027-01-01', LAKE, storyMilestones(old))).toBeNull();
    const night = withFlag(old, 'night');
    expect(todaysChapter(storyOf(night), '2027-01-01', LAKE, storyMilestones(night))?.id).toBe('Q4');
    expect(normalizeSave({ version: 1, player: night, clock: {} }).player.milestones).toEqual({ night: true });
  });
  it('recordMilestones keeps the same object when nothing is new', () => {
    const p = newPlayer();
    expect(recordMilestones(p)).toBe(p);
    expect(recordMilestones({ ...p, log: deepLog }).milestones).toEqual({ deep: true });
  });
});

describe('night visits and the Q4 fallback', () => {
  it('a visit counts from 21:00 to 05:00, also after midnight', () => {
    expect(isNightVisit(20 * 60 + 59)).toBe(false);
    expect(isNightVisit(21 * 60)).toBe(true);
    expect(isNightVisit(0)).toBe(true);
    expect(isNightVisit(2 * 60)).toBe(true);
    expect(isNightVisit(5 * 60 - 1)).toBe(true);
    expect(isNightVisit(5 * 60)).toBe(false);
    expect(isNightVisit(12 * 60)).toBe(false);
  });
  it('Q4 also unlocks after three bundles (day players get the day version)', () => {
    expect(storyMilestones(newPlayer()).Q4).toBe(false);
    expect(STORY_TUNING.q4FallbackBundles).toBe(3);
    expect(storyMilestones(withBundlesDone(newPlayer(), STORY_TUNING.q4FallbackBundles - 1)).Q4).toBe(false);
    expect(storyMilestones(withBundlesDone(newPlayer(), STORY_TUNING.q4FallbackBundles)).Q4).toBe(true);
  });
});

describe('the second-chance blink', () => {
  const day = (): ReturnType<typeof newStory> => markSeen(newStory(), 'Q4', '2026-12-04', blinkLines(false));
  it('is due after the day version, at night, with Pajkel in the car', () => {
    expect(secondBlinkDue(day(), true, true)).toBe(true);
    expect(secondBlinkDue(day(), false, true)).toBe(false);
    expect(secondBlinkDue(day(), true, false)).toBe(false);
    expect(secondBlinkDue(newStory(), true, true)).toBe(false);
  });
  it('never for the night version or once already shown', () => {
    expect(secondBlinkDue(markSeen(newStory(), 'Q4', '2026-12-04', blinkLines(true), true), true, true)).toBe(false);
    expect(secondBlinkDue(markSecondBlink(day()), true, true)).toBe(false);
  });
  it('marks the night version, queues his night lines and keeps done; twice changes nothing', () => {
    const s = markSecondBlink(day());
    expect(s.blinkNight).toBe(true);
    expect(s.blinkLater).toBe(true);
    expect(s.done).toEqual(day().done);
    expect(s.queue).toEqual(['q4']);
    expect(markSecondBlink(s)).toBe(s);
    expect(markSecondBlink(newStory())).toEqual(newStory());
    expect(journalEntries(s).find((e) => e.id === 'Q4')?.thought).toBe(JOURNAL_BLINK_NIGHT.thought);
  });
  it('is saved only when Q4 is done', () => {
    expect(normalizeStory(JSON.parse(JSON.stringify(markSecondBlink(day())))).blinkLater).toBe(true);
    expect(normalizeStory({ done: { Q1: '2026-12-01' }, blinkLater: true }).blinkLater).toBeUndefined();
  });
});

describe('chapterWaits: the night blink waits for Pajkel in the car', () => {
  const blink = chapterById('Q4')!;
  it('waits 20:00-23:59 while he is not in the car', () => {
    expect(chapterWaits(blink, 22 * 60, false)).toBe(true);
    expect(chapterWaits(blink, 20 * 60, false)).toBe(true);
    expect(chapterWaits(blink, 23 * 60 + 59, false)).toBe(true);
  });
  it('does not wait once he is in the car, by day, after midnight, or for other chapters', () => {
    expect(chapterWaits(blink, 22 * 60, true)).toBe(false);
    expect(chapterWaits(blink, 14 * 60, false)).toBe(false);
    expect(chapterWaits(blink, 60, false)).toBe(false);
    expect(chapterWaits(chapterById('Q1')!, 22 * 60, false)).toBe(false);
  });
});

describe('catching up once the road is fixed', () => {
  const two = (): ReturnType<typeof newStory> => markSeen(markSeen(newStory(), 'Q1', '2026-12-01'), 'Q2', '2026-12-01');
  it('raises the daily cap to 3, but not the order or the milestones', () => {
    expect(todaysChapter(two(), '2026-12-01', LAKE, ALL)).toBeNull();
    expect(todaysChapter(two(), '2026-12-01', LAKE, ALL, true)?.id).toBe('Q3');
    const three = markSeen(two(), 'Q3', '2026-12-01');
    expect(todaysChapter(three, '2026-12-01', LAKE, ALL, true)).toBeNull();
    expect(slotFree(three, '2026-12-02', true)).toBe(true);
    expect(todaysChapter(two(), '2026-12-01', LAKE, only('Q4', 'Q5'), true)).toBeNull();
    expect(slotFree(two(), '2026-12-01', true)).toBe(true);
    expect(slotFree(two(), 'tomorrow', true)).toBe(false);
  });
  it('Q7 late: the line, the stored flag and the journal thought', () => {
    expect(q7Lines(true)).toEqual(['q7Road']);
    expect(q7Lines(false)).toEqual(['q7']);
    const base = seenIds(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
    const late = markSeen(base, 'Q7', '2026-12-07', q7Lines(true), undefined, true);
    expect(late.q7Late).toBe(true);
    expect(late.queue).toContain('q7Road');
    expect(journalEntries(late).find((e) => e.id === 'Q7')?.thought).toBe(JOURNAL_Q7_LATE.thought);
    const normal = markSeen(base, 'Q7', '2026-12-07', q7Lines(false));
    expect(normal.q7Late).toBeUndefined();
    expect(journalEntries(normal).find((e) => e.id === 'Q7')?.thought).toBe(JOURNAL.Q7.thought);
    expect(normalizeStory(JSON.parse(JSON.stringify(late))).q7Late).toBe(true);
    expect(normalizeStory({ done: { Q1: '2026-12-01' }, q7Late: true }).q7Late).toBeUndefined();
  });
});
