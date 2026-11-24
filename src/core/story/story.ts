import { daysBetween, isValidDate } from '../daily/dates';
import { BLINK_DAY_LINES, BLINK_NIGHT_LINES, CHAPTERS, PALE_BEAT, STORY_LINES, STORY_TUNING, type ChapterDef } from '../data/story';
import type { PlayerState } from '../inventory';

/**
 * Story chapters (slice 21), pure. "Today" is injected (the device's real local date, as for the bait
 * box); nothing here reads a clock. The save keeps the date each chapter was *seen* on, so a chapter
 * the player never saw is offered again, the clock going backwards never gives a second chapter, and
 * skipped days never pile up (one chapter per date, always the next unseen one).
 */
export interface StoryState {
  /** Chapter id -> the date it was seen on. */
  done: Record<string, string>;
  /** Pajkel lines waiting to be said (ids of STORY_LINES), oldest first. */
  queue: string[];
  /** The Pale One bonus card was shown. */
  pale: boolean;
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

/** True when a chapter may be told on this date: none was seen today, and the clock was not set back. */
export function slotFree(s: StoryState, today: string): boolean {
  if (!isValidDate(today)) return false;
  const last = lastSeenDate(s);
  return last === null || daysBetween(last, today) >= 1;
}

/** Today's chapter at this place: the first one not seen yet, when today's slot is free; else null. */
export function todaysChapter(s: StoryState, today: string, place: string): ChapterDef | null {
  if (!slotFree(s, today)) return null;
  return chaptersOf(place).find((c) => !has(s.done, c.id)) ?? null;
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
export function markSeen(s: StoryState, id: string, today: string, lines?: readonly string[]): StoryState {
  const chapter = chapterById(id);
  if (!chapter || !isValidDate(today) || has(s.done, id)) return s;
  return queueLines({ ...s, done: { ...s.done, [id]: today } }, lines ?? chapter.after);
}

/** The lines Q4 queues, by version. */
export const blinkLines = (night: boolean): readonly string[] => (night ? BLINK_NIGHT_LINES : BLINK_DAY_LINES);

/** Which version of Q4 plays: the night blink needs Pajkel asleep in the car and a dark sky. */
export const blinkIsNight = (pajkelAsleepInCar: boolean, nightSky: boolean): boolean => pajkelAsleepInCar && nightSky;

/** The Pale One bonus beat has not been shown yet. */
export const paleBeatDue = (s: StoryState): boolean => !s.pale;

/** The card was shown: remembered once, and Pajkel's line queued. */
export function markPaleSeen(s: StoryState): StoryState {
  if (s.pale) return s;
  return queueLines({ ...s, pale: true }, PALE_BEAT.after);
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
  return { done, queue: queue.slice(-STORY_TUNING.queueMax), pale: o.pale === true };
}

/** Nothing worth saving (a fresh game stores no key). */
export const storyIsEmpty = (s: StoryState): boolean => Object.keys(s.done).length === 0 && s.queue.length === 0 && !s.pale;
