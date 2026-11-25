import { isValidDate } from '../daily/dates';
import { WAKE_MINUTE } from '../bedtime';
import { timeOfDay } from '../clock';
import {
  BLINK_DAY_LINES,
  BLINK_NIGHT_LINES,
  CHAPTERS,
  JOURNAL,
  JOURNAL_BLINK_DAY,
  JOURNAL_BLINK_NIGHT,
  JOURNAL_PALE,
  JOURNAL_Q7_LATE,
  JOURNAL_TOTAL,
  PALE_BEAT,
  STORY_LINES,
  STORY_TUNING,
  type ChapterDef,
  type JournalDef,
  type JournalIcon,
  type Thinker,
} from '../data/story';
import type { PlayerState } from '../inventory';
import { speciesById } from '../data/fish';
import { doneCount as bundlesDone } from '../checklist/checklist';
import { questsOf } from '../quests/quests';
import { speciesCaught } from '../fishLog';

/**
 * Story chapters (slice 21), pure. "Today" is injected (the device's real local date, as for the bait
 * box); nothing here reads a clock. The save keeps the date each chapter was *seen* on, so a chapter
 * the player never saw is offered again. Chapters follow PROGRESS (milestones), strictly in order, and at
 * most `STORY_TUNING.perDay` are seen per real date.
 */
export interface StoryState {
  /** Chapter id -> the date it was seen on. */
  done: Record<string, string>;
  /** Pajkel lines waiting to be said (ids of STORY_LINES), oldest first. */
  queue: string[];
  /** The Pale One bonus card was shown. */
  pale: boolean;
  /** The date the Pale One card was shown (the journal's order); older saves have none. */
  paleOn?: string;
  /** Q4 was told as the night blink (the journal's version); missing = the day bottle. */
  blinkNight?: boolean;
  /** The night blink was shown later, as a bonus, after Q4 was told by day (blinkNight is then true too). */
  blinkLater?: true;
  /** Q7 was told after the road was already fixed (the journal's alternative thought). */
  q7Late?: boolean;
  /** How many journal pages she had seen when she last opened the Story tab (the dot). */
  looked?: number;
}

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export const newStory = (): StoryState => ({ done: {}, queue: [], pale: false });
export const storyOf = (p: PlayerState): StoryState => normalizeStory(p.story);

const ALL: readonly ChapterDef[] = Object.values(CHAPTERS).flat();
export const chapterById = (id: string): ChapterDef | undefined => ALL.find((c) => c.id === id);
export const chaptersOf = (place: string): readonly ChapterDef[] => (has(CHAPTERS, place) ? CHAPTERS[place] : []);
export const lineText = (id: string): string | undefined => (has(STORY_LINES, id) ? STORY_LINES[id] : undefined);

/** The latest date a chapter was seen on, or null. */
export function lastSeenDate(s: StoryState): string | null {
  let last: string | null = null;
  for (const d of Object.values(s.done)) if (last === null || d > last) last = d;
  return last;
}

/** Progress flags recorded once (stored only when true; older saves have none, see storyMilestones for what is derived). */
export interface MilestoneFlags {
  /** A daily quest was claimed. */
  quest?: true;
  /** A fish was caught in deep water. */
  deep?: true;
  /** She played at 21:00 or later on the game clock. */
  night?: true;
}

export function normalizeMilestones(v: unknown): MilestoneFlags {
  const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out: MilestoneFlags = {};
  if (o.quest === true) out.quest = true;
  if (o.deep === true) out.deep = true;
  if (o.night === true) out.night = true;
  return out;
}

/** A flag was reached: the new player (the same object when nothing changes). */
export function withFlag(p: PlayerState, flag: keyof MilestoneFlags): PlayerState {
  const m = normalizeMilestones(p.milestones);
  return m[flag] ? p : { ...p, milestones: { ...m, [flag]: true } };
}

/** The minute of the game clock counts as a night visit (21:00 up to, not including, 05:00). */
export const isNightVisit = (minute: number): boolean => minute >= STORY_TUNING.nightFromMinute || minute < WAKE_MINUTE;

/** Flags that can be read off the rest of the save (a claimed quest today, a deep species in the log), merged with the stored ones. */
export function recordMilestones(p: PlayerState): PlayerState {
  let out = p;
  if (questsOf(p).list.some((q) => q.claimed)) out = withFlag(out, 'quest');
  if (Object.keys(p.log).some((id) => speciesById(id)?.zone === 'deep')) out = withFlag(out, 'deep');
  return out;
}

/** Which chapter's milestone is met, by chapter id; pure, derived from the player (old saves included). */
export function storyMilestones(p: PlayerState): Record<string, boolean> {
  const m = normalizeMilestones(recordMilestones(p).milestones);
  const bundles = bundlesDone(p);
  return {
    Q1: speciesCaught(p.log) > 0,
    Q2: m.quest === true,
    Q3: m.deep === true,
    Q4: m.night === true || bundles >= STORY_TUNING.q4FallbackBundles,
    Q5: bundles >= 1,
    Q6: p.rodId === 'carbon',
    Q7: bundles >= STORY_TUNING.q7Bundles,
  };
}

/** How many chapters were seen on this real date (a clock set back counts later dates too). */
export function seenToday(s: StoryState, today: string): number {
  return Object.values(s.done).filter((d) => d >= today).length;
}

/** True when another chapter may be told on this date: fewer than `STORY_TUNING.perDay` were seen today. */
export function slotFree(s: StoryState, today: string, catchUp = false): boolean {
  return isValidDate(today) && (catchUp || seenToday(s, today) < STORY_TUNING.perDay);
}

/**
 * Today's chapter at this place: the next unseen one (strict order, never skipping), when its milestone is met
 * (`milestones`, by chapter id; see storyMilestones) and the day's cap is not reached; else null. `catchUp` ignores
 * the day's cap (the road is fixed, so the rest of the story should not trail behind); order and milestones still apply.
 */
export function todaysChapter(s: StoryState, today: string, place: string, milestones: Readonly<Record<string, boolean>>, catchUp = false): ChapterDef | null {
  if (!slotFree(s, today, catchUp)) return null;
  const next = chaptersOf(place).find((c) => !has(s.done, c.id)) ?? null;
  return next && milestones[next.id] === true ? next : null;
}

/** Appends lines to the queue (unknown ids dropped, the oldest dropped past the cap). */
export function queueLines(s: StoryState, ids: readonly string[]): StoryState {
  const queue = [...s.queue, ...ids.filter((id) => has(STORY_LINES, id))].slice(-STORY_TUNING.queueMax);
  return { ...s, queue };
}

/**
 * The next waiting line, taken off the queue, when Pajkel can speak (`canSpeak`); null (nothing
 * changes) when he cannot or nothing waits.
 */
export function nextLine(s: StoryState, canSpeak: boolean): { story: StoryState; id: string; text: string } | null {
  if (!canSpeak || s.queue.length === 0) return null;
  const [id, ...rest] = s.queue;
  return { story: { ...s, queue: rest }, id, text: STORY_LINES[id] };
}

/**
 * She has seen a chapter: it is recorded with today's date and its Pajkel lines are queued
 * (`lines` overrides the chapter's own, for the two versions of Q4). Seeing it twice changes nothing.
 */
export function markSeen(s: StoryState, id: string, today: string, lines?: readonly string[], night?: boolean, late?: boolean): StoryState {
  const chapter = chapterById(id);
  if (!chapter || !isValidDate(today) || has(s.done, id)) return s;
  const next: StoryState = { ...s, done: { ...s.done, [id]: today }, ...(id === 'Q4' && night ? { blinkNight: true } : {}), ...(id === 'Q7' && late ? { q7Late: true } : {}) };
  return queueLines(next, lines ?? chapter.after);
}

/** The lines Q4 queues, by version. */
export const blinkLines = (night: boolean): readonly string[] => (night ? BLINK_NIGHT_LINES : BLINK_DAY_LINES);

/** Which version of Q4 plays: the night blink needs Pajkel asleep in the car and a dark sky. */
export const blinkIsNight = (pajkelAsleepInCar: boolean, nightSky: boolean): boolean => pajkelAsleepInCar && nightSky;

/**
 * A chapter that should wait: the night blink before midnight while Pajkel is not yet asleep in the car
 * (it would fall back to the day bottle). Midnight sends him to the car, then it can play.
 */
export function chapterWaits(chapter: ChapterDef, minute: number, pajkelInCar: boolean): boolean {
  return chapter.kind === 'blink' && timeOfDay(minute) === 'night' && minute >= 12 * 60 && !pajkelInCar;
}

/** Q4 was told by day: the first night Pajkel sleeps in the car under a night sky, the blink plays once more as a bonus beat. */
export const secondBlinkDue = (s: StoryState, nightSky: boolean, pajkelInCar: boolean): boolean =>
  has(s.done, 'Q4') && s.blinkNight !== true && s.blinkLater !== true && nightSky && pajkelInCar;

/** The bonus blink was seen: the journal page becomes the night version and Pajkel's night lines queue. Twice changes nothing. */
export function markSecondBlink(s: StoryState): StoryState {
  if (!has(s.done, 'Q4') || s.blinkNight === true || s.blinkLater === true) return s;
  return queueLines({ ...s, blinkNight: true, blinkLater: true }, BLINK_NIGHT_LINES);
}

/** The lines Q7 queues: the usual, or the alternative when the road was already fixed. */
export const q7Lines = (roadFixed: boolean): readonly string[] => (roadFixed ? ['q7Road'] : ['q7']);

/** The Pale One bonus beat has not been shown yet. */
export const paleBeatDue = (s: StoryState): boolean => !s.pale;

/** The card was shown: remembered once, and Pajkel's line queued. */
export function markPaleSeen(s: StoryState, today?: string): StoryState {
  if (s.pale) return s;
  return queueLines({ ...s, pale: true, ...(today !== undefined && isValidDate(today) ? { paleOn: today } : {}) }, PALE_BEAT.after);
}

/** Anything saved -> a valid StoryState (never throws): unknown chapters, bad dates and unknown lines are dropped. */
export function normalizeStory(v: unknown): StoryState {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return newStory();
  const o = v as Record<string, unknown>;
  const done: Record<string, string> = {};
  if (typeof o.done === 'object' && o.done !== null && !Array.isArray(o.done)) {
    for (const [id, date] of Object.entries(o.done)) if (chapterById(id) && isValidDate(date)) done[id] = date;
  }
  const queue = Array.isArray(o.queue) ? o.queue.filter((id): id is string => typeof id === 'string' && has(STORY_LINES, id)) : [];
  const out: StoryState = { done, queue: queue.slice(-STORY_TUNING.queueMax), pale: o.pale === true };
  if (o.pale === true && isValidDate(o.paleOn)) out.paleOn = o.paleOn;
  if (o.blinkNight === true && has(done, 'Q4')) out.blinkNight = true;
  if (o.blinkLater === true && has(done, 'Q4')) out.blinkLater = true;
  if (o.q7Late === true && has(done, 'Q7')) out.q7Late = true;
  if (typeof o.looked === 'number' && Number.isFinite(o.looked) && o.looked >= 1) out.looked = Math.min(Math.floor(o.looked), JOURNAL_TOTAL + 2);
  return out;
}

/** One page of the story journal (slice 22d). */
export interface JournalEntry {
  /** The chapter id, or 'pale' for the bonus page. */
  id: string;
  icon: JournalIcon;
  /** The bottle's note, or the one-line description of the moment. */
  text: string;
  by: Thinker;
  thought: string;
}

/**
 * The pages she has seen, oldest first (by the date each was seen on; chapter order inside a day; a page with no date,
 * the Pale One of an older save, goes after the others; Q8 is last). Unseen chapters never show. `roadFixed` is the
 * Q8 card: it is not a daily chapter, so it is not in the story state.
 */
export function journalEntries(s: StoryState, roadFixed = false): JournalEntry[] {
  const page = (id: string, def: JournalDef, text: string): JournalEntry => ({ id, icon: def.icon, text, by: def.by, thought: def.thought });
  const rows: { entry: JournalEntry; date: string | null; rank: number }[] = [];
  ALL.forEach((chapter, rank) => {
    if (!has(s.done, chapter.id)) return;
    const def = chapter.id === 'Q4' ? (s.blinkNight ? JOURNAL_BLINK_NIGHT : JOURNAL_BLINK_DAY) : chapter.id === 'Q7' && s.q7Late ? JOURNAL_Q7_LATE : has(JOURNAL, chapter.id) ? JOURNAL[chapter.id] : undefined;
    if (def) rows.push({ entry: page(chapter.id, def, def.text ?? chapter.text ?? ''), date: s.done[chapter.id], rank });
  });
  if (s.pale) rows.push({ entry: page('pale', JOURNAL_PALE, JOURNAL_PALE.text ?? ''), date: s.paleOn ?? null, rank: ALL.length });
  rows.sort((a, b) => {
    if (a.date === null || b.date === null) return a.date === b.date ? a.rank - b.rank : a.date === null ? 1 : -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : a.rank - b.rank;
  });
  const out = rows.map((r) => r.entry);
  if (roadFixed) out.push(page('Q8', JOURNAL.Q8, JOURNAL.Q8.text ?? ''));
  return out;
}

/** "Chapter n of 7": the chapters seen (the Pale One and the road-fixed pages are bonuses and do not count). */
export const journalChapterCount = (s: StoryState, roadFixed = false): number => journalEntries(s, roadFixed).filter((e) => e.id !== 'pale' && e.id !== 'Q8').length;

/** A page was added since she last opened the Story tab. */
export const journalHasNew = (s: StoryState, roadFixed = false): boolean => journalEntries(s, roadFixed).length > (s.looked ?? 0);

/** She opened the Story tab: everything so far is read. */
export function markJournalLooked(s: StoryState, roadFixed = false): StoryState {
  const n = journalEntries(s, roadFixed).length;
  return n === (s.looked ?? 0) ? s : { ...s, looked: n };
}

/** Nothing worth saving (a fresh game stores no key). */
export const storyIsEmpty = (s: StoryState): boolean => Object.keys(s.done).length === 0 && s.queue.length === 0 && !s.pale;
