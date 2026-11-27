import { EERIE_NOTE_WINDOW, MOMENTS, MOMENT_POOLS, MOMENT_TUNING, NOTES, type MomentKind, type NoteDef } from '../data/moments';
import { BOAT_NOTE } from '../data/rare';
import type { LayerMix } from '../eerie';
import type { PlayerState } from '../inventory';
import { randInt, randRange, type Rng } from '../random';
import { unknownHints } from '../rare';

/**
 * Lake moments (slice 14), pure rules: when the next one comes, which one it is, what a tap gives.
 * Nothing here reads a clock or Math.random: time and the game minute are passed in, randomness is
 * an injected Rng. The pictures and taps live in scenes/MomentsView.ts.
 */

const MINUTES_PER_DAY = 24 * 60;

/** Is the game minute inside a window of hours (from inclusive, to exclusive; wraps past midnight)? */
export function inHourWindow(minute: number, fromHour: number, toHour: number): boolean {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const from = fromHour * 60;
  const to = toHour * 60;
  return from <= to ? m >= from && m < to : m >= from || m < to;
}

// ---- Scheduler ------------------------------------------------------------------------------

export interface Scheduler {
  /** Real ms of "active" time left until the next moment. */
  remainingMs: number;
}

export const rollGap = (rng: Rng): number => randRange(rng, MOMENT_TUNING.gapMs.min, MOMENT_TUNING.gapMs.max);

export const newScheduler = (rng: Rng): Scheduler => ({ remainingMs: rollGap(rng) });

/**
 * Advances the gap by `dtMs`, but only while `active` (the caller says so: she is idle or the bobber
 * waits, no panel, no fight, and no moment already on screen). When it runs out a moment is due and
 * a fresh gap starts counting; because the caller stops ticking while a moment is on screen, the
 * next gap really starts when that moment is over, so there is only ever one at a time.
 */
export function tickScheduler(s: Scheduler, dtMs: number, active: boolean, rng: Rng): { scheduler: Scheduler; due: boolean } {
  if (!active || dtMs <= 0) return { scheduler: s, due: false };
  const left = s.remainingMs - dtMs;
  if (left > 0) return { scheduler: { remainingMs: left }, due: false };
  return { scheduler: { remainingMs: rollGap(rng) }, due: true };
}

// ---- Picking ----------------------------------------------------------------------------------

/** The moments whose clock window is open at this game minute. */
export function momentsAt(minute: number, momentsId = 'lake'): MomentKind[] {
  const pool = MOMENT_POOLS[momentsId] ?? MOMENT_POOLS.lake;
  return pool.filter((k) => {
    const d = MOMENTS[k];
    return inHourWindow(minute, d.fromHour, d.toHour) || (d.alsoFromHour !== undefined && d.alsoToHour !== undefined && inHourWindow(minute, d.alsoFromHour, d.alsoToHour));
  });
}

/**
 * Picks the next moment by weight among those whose window is open; the same kind is not picked twice
 * in a row when anything else is available.
 *
 * Tuning of the uncanny pair ("about 1 night in 3"). A game day lasts 20 real minutes, so the
 * 01:00-05:00 window is 200 real seconds. The gap averages 180 s plus ~15-25 s of the moment itself,
 * so a night window sees about one moment (renewal rate 1 per ~200 s), a bit less when she is busy
 * with a fight. With one moment per night the chance of seeing an uncanny one is the chance that
 * the pick is uncanny: bubbles 2.5 + shape 2 = 4.5 against the 01-04 pool of jump 4 + star 2 +
 * bottle 2 = 8 (04-05 has no star: 6), i.e. 4.5 / 12.5 = 0.36 early and 4.5 / 10.5 = 0.43 in the
 * last hour, about 0.38 over the window. The test in moments.test.ts simulates whole nights.
 */
export function pickMoment(minute: number, rng: Rng, last: MomentKind | null = null, momentsId = 'lake'): MomentKind {
  let pool = momentsAt(minute, momentsId);
  if (pool.length > 1 && last) pool = pool.filter((k) => k !== last);
  const total = pool.reduce((a, k) => a + MOMENTS[k].weight, 0);
  let x = rng() * total;
  for (const k of pool) {
    x -= MOMENTS[k].weight;
    if (x < 0) return k;
  }
  return pool[pool.length - 1];
}

export const isUncanny = (k: MomentKind): boolean => MOMENTS[k].uncanny;

/** The crickets dip while an uncanny moment is on screen (the eerie mix is otherwise untouched). */
export function dipCrickets(mix: LayerMix, uncannyOnScreen: boolean): LayerMix {
  return uncannyOnScreen ? { ...mix, crickets: mix.crickets * MOMENT_TUNING.cricketDip } : mix;
}

// ---- Waiting for the fish ------------------------------------------------------------------

/**
 * Does a moment's own clock run in this fishing state? Not while a fish is on the hook, in the fight
 * or being shown off (the same states the toast queue holds back for): the moment waits, with the
 * lifetime it had left, and goes on afterwards (also when the fish got away). New moments never
 * start then either, see tickScheduler's `active` (idle or waiting only).
 */
export function momentClockRunning(stateKind: string): boolean {
  return stateKind !== 'bite' && stateKind !== 'fighting' && stateKind !== 'caught';
}

/** The moment's age after a frame: it only advances while its clock runs, so a pause keeps the lifetime left. */
export const tickMomentAge = (age: number, dtMs: number, running: boolean): number => (running ? age + Math.max(0, dtMs) : age);

/** The dim factor (1 = full, pausedAlpha = dimmed) eased toward its target over dimEaseMs. */
export function easeMomentDim(dim: number, paused: boolean, dtMs: number): number {
  const target = paused ? MOMENT_TUNING.pausedAlpha : 1;
  const step = ((1 - MOMENT_TUNING.pausedAlpha) * Math.max(0, dtMs)) / MOMENT_TUNING.dimEaseMs;
  return dim < target ? Math.min(target, dim + step) : Math.max(target, dim - step);
}

// ---- Notes ----------------------------------------------------------------------------------

/** Which bottle notes were read in the current round (ids); a note repeats only after all available ones were read. */
export interface NotesState {
  read: string[];
}

export const newNotes = (): NotesState => ({ read: [] });
export const notesOf = (p: PlayerState): NotesState => p.notes ?? newNotes();

/** Notes that may come now: the eerie ones only between 22:00 and 05:00. */
export function notesAt(minute: number): NoteDef[] {
  const night = inHourWindow(minute, EERIE_NOTE_WINDOW.fromHour, EERIE_NOTE_WINDOW.toHour);
  return NOTES.filter((n) => night || !n.eerie);
}

export const noteById = (id: string): NoteDef | undefined => NOTES.find((n) => n.id === id);

/**
 * A random unread note that is allowed now. When every allowed note has been read, a new round
 * starts for them (their read marks are forgotten; read eerie notes stay marked by day, so the
 * next night still prefers the ones not yet seen).
 */
export function pickNote(notes: NotesState, minute: number, rng: Rng): { note: NoteDef; notes: NotesState } {
  const allowed = notesAt(minute);
  const known = new Set(NOTES.map((n) => n.id));
  let read = notes.read.filter((id) => known.has(id));
  let pool = allowed.filter((n) => !read.includes(n.id));
  if (pool.length === 0) {
    const ids = new Set(allowed.map((n) => n.id));
    read = read.filter((id) => !ids.has(id));
    pool = allowed;
  }
  const note = pool[Math.floor(rng() * pool.length)] ?? pool[pool.length - 1];
  return { note, notes: { read: [...read, note.id] } };
}

/** Anything saved → a valid NotesState (unknown ids and duplicates dropped; never throws). */
export function normalizeNotes(v: unknown): NotesState {
  if (typeof v !== 'object' || v === null || !Array.isArray((v as { read?: unknown }).read)) return newNotes();
  const known = new Set(NOTES.map((n) => n.id));
  const seen = new Set<string>();
  for (const id of (v as { read: unknown[] }).read) {
    if (typeof id === 'string' && known.has(id)) seen.add(id);
  }
  return { read: [...seen] };
}

// ---- Rewards ----------------------------------------------------------------------------------

/** A tapped shooting star: 5-15 coins. */
export function claimStar(player: PlayerState, rng: Rng): { player: PlayerState; coins: number } {
  const coins = randInt(rng, MOMENT_TUNING.starCoins.min, MOMENT_TUNING.starCoins.max);
  return { player: { ...player, coins: player.coins + coins }, coins };
}

/** A caught paper boat (River bend): about 1 time in 4 it holds 2-5 worms (added at once), else it is only a boat (worms 0). */
export function claimBoat(player: PlayerState, rng: Rng): { player: PlayerState; worms: number } {
  const worms = rng() < MOMENT_TUNING.boatWormChance ? randInt(rng, MOMENT_TUNING.boatWorms.min, MOMENT_TUNING.boatWorms.max) : 0;
  return { player: worms > 0 ? { ...player, worms: player.worms + worms } : player, worms };
}

/**
 * The note a worm-less paper boat may carry (slice 25f, the River bend has no bottle moment): about one boat in two holds a folded hint
 * about a trophy of this place she has not caught yet. Undefined when none is left to hint at, or the roll says no. The rng is drawn only
 * when there is a hint to give.
 */
export function boatNote(log: Record<string, unknown>, placeId: string, rng: Rng): string | undefined {
  const hints = unknownHints(log, placeId).filter((h) => h.text !== '');
  if (hints.length === 0 || rng() >= BOAT_NOTE.chance) return undefined;
  return hints[Math.min(hints.length - 1, Math.floor(rng() * hints.length))].text;
}

export interface BottleContents {
  noteId: string;
  text: string;
  /** Worms tucked inside (0 most of the time). */
  worms: number;
}

/** A tapped bottle: the next note, and about 1 time in 4 a few worms. The worms are added at once. */
export function openBottle(player: PlayerState, minute: number, rng: Rng): { player: PlayerState; contents: BottleContents } {
  const picked = pickNote(notesOf(player), minute, rng);
  const worms = rng() < MOMENT_TUNING.bottleWormChance ? randInt(rng, MOMENT_TUNING.bottleWorms.min, MOMENT_TUNING.bottleWorms.max) : 0;
  return {
    player: { ...player, worms: player.worms + worms, notes: picked.notes },
    contents: { noteId: picked.note.id, text: picked.note.text, worms },
  };
}
