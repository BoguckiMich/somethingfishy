/**
 * Pajkel and the dog: a pure behaviour state machine (no Phaser). The scene feeds it
 * `tickCompanions(dt)`, game events and player presses, then draws whatever it reports.
 * Positions are screen coordinates; sprites are anchored at their feet (bottom centre).
 */
import type { Rng } from '../../core/random';

export type GameEventKind = 'cast' | 'nibble' | 'bite' | 'hooked' | 'fishEscaped' | 'fishCaught' | 'fishLost';

export interface Point {
  x: number;
  y: number;
}

/** Where they sit on the dock (feet positions). */
export const PAJ_SPOT: Point = { x: 150, y: 406 };
export const DOG_SPOT: Point = { x: 178, y: 430 };
/** Waypoints down the dock to the grass (kept clear of the bobber and the hint text). */
const PAJ_PATH_DOWN: Point[] = [{ x: 148, y: 440 }, { x: 148, y: 484 }];
const DOG_PATH_DOWN: Point[] = [{ x: 178, y: 444 }, { x: 178, y: 486 }];
export const PLAY_PAJ: Point = { x: 112, y: 540 };
const PLAY_DOG: Point = { x: 140, y: 548 };
const THROW_X: [number, number] = [200, 320];
const THROW_Y: [number, number] = [508, 572];

export const IDLE_BEFORE_PLAY_MS = 25_000;
/** The happy spin after the last fetch: the dog flips to face the other way this many times over this long. */
export const SPIN_MS = 1000;
export const SPIN_FLIPS = 4;
const SPIN_HOP = 4;
/** Where the stick sits when carried: this far in front of the dog's feet and this high (before the bounce). */
export const DOG_MOUTH = { x: 15, y: 14 };
/** Pajkel's walk cycle advances one frame per this many pixels travelled. */
export const PAJ_STRIDE_PX = 6;
const PAJ_WALK_SPEED = 46;
const PAJ_RUN_SPEED = 90;
const DOG_RUN_SPEED = 120;
/** Pajkel claps for a catch this long, flipping between two frames this often. */
export const CLAP_MS = 2000;
const CLAP_FLIP_MS = 150;
/** Bestia hops for a catch this long. */
export const HOP_MS = 1500;
/** A new species or a record: a longer clap and a longer, higher hop. */
export const CLAP_BIG_MS = 3600;
export const HOP_BIG_MS = 2800;

/** Pajkel's speech bubble stays this long (the last FADE ms fade out). */
export const BUBBLE_MS = 3000;
export const BUBBLE_FADE_MS = 300;

export interface Bubble {
  text: string;
  /** Ms since it appeared. */
  ageMs: number;
}

export type DogShape = 'lie' | 'sleep' | 'sit' | 'stand' | 'run';
export type PajShape = 'sit' | 'sip' | 'cheer' | 'look' | 'stand' | 'walk' | 'throw' | 'carry' | 'stretch';
export type Mode = 'dock' | 'leaving' | 'play' | 'returning' | 'bed';
type PlayPhase = 'throw' | 'chase' | 'bring' | 'drop' | 'spin' | 'rest';

interface Actor extends Point {
  /** 1 = facing right, -1 = left. */
  face: 1 | -1;
  path: Point[];
}

export interface Stick extends Point {
  state: 'hidden' | 'flying' | 'ground' | 'carried';
}

// ---- Bedtime, naps and the car (slice 16) ---------------------------------------------------

/** Where Pajkel stands to get in and out of the car (feet), and where Bestia waits beside him. */
export const CAR_STAND: Point = { x: 34, y: 560 };
export const CAR_DOG: Point = { x: 60, y: 564 };
/** Phase lengths in ms and speeds in px/s of the bedtime choreography. */
export const BED_TUNING = {
  sayMs: 2400,
  callMs: 800,
  catchMs: 700,
  doorMs: 500,
  enterMs: 700,
  shutMs: 450,
  lightMs: { night: 3500, nap: 1800 },
  exitOpenMs: 700,
  stretchMs: 1700,
  /** Gives up the chase and calls it caught after this long, whatever the dog does. */
  chaseGiveUpMs: 14_000,
  /** Close enough to scoop her up. */
  catchDist: 18,
  dogRunSpeed: 105,
  pajChaseSpeed: 72,
  pajCarrySpeed: 50,
  pajHomeSpeed: 60,
  dogTrotSpeed: 75,
  /** Stretch: arms out first, then up, then out again. */
  stretchUpFromMs: 500,
  stretchUpToMs: 1200,
};

export type BedKind = 'night' | 'nap';
export type BedPhase =
  | 'say' | 'call' | 'chase' | 'catch' | 'carry' // the 02:00 sequence up to the car
  | 'walk' // a nap: both walk to the car, no chase
  | 'doorOpen' | 'enter' | 'doorShut' | 'light' | 'asleep'
  | 'exitOpen' | 'exitShut' | 'return' | 'stretch';

export interface BedState {
  kind: BedKind;
  phase: BedPhase;
  phaseMs: number;
  /** Bestia is in Pajkel's arms (drawn in his carry frames, not on her own). */
  carried: boolean;
  /** How visible each is, 0..1: they fade into the car and out of it. */
  pajA: number;
  dogA: number;
  /** The car's door is open / the interior light is on. */
  door: boolean;
  light: boolean;
}

export interface Companions {
  mode: Mode;
  /** The bedtime / nap sequence (mode 'bed'); null otherwise. */
  bed: BedState | null;
  /** Ms since the player last did something (only counts while idle/waiting). */
  idleMs: number;
  elapsed: number;
  dog: Actor & {
    shape: DogShape;
    /** Time in the current reaction, and which one. */
    reaction: 'none' | 'perk' | 'stand' | 'spin' | 'sit' | 'hop';
    reactMs: number;
    /** Time since the last tail wag started; wagMs > 0 means wagging. */
    wagMs: number;
    nextWagIn: number;
    petMs: number;
    hop: number;
    /** How long and how high the current 'hop' reaction goes. */
    hopTotalMs: number;
    hopHeight: number;
    /** Dock rest time since last reaction (to lie back down). */
    restMs: number;
    sleeping: boolean;
  };
  paj: Actor & {
    shape: PajShape;
    reactMs: number;
    nextSipIn: number;
    /** Distance walked, in pixels: drives the walk cycle so his feet match his speed. */
    walkDist: number;
    /** Time left clapping (alternating the cheer and sit frames). */
    clapMs: number;
    /** How long this clap started with (a big moment claps longer). */
    clapTotalMs: number;
  };
  stick: Stick;
  /** What Pajkel is saying right now, or null. Only one at a time: a new line replaces the old. */
  bubble: Bubble | null;
  play: { phase: PlayPhase; phaseMs: number; fetches: number; target: Point; /** Which way the dog faced when the spin began. */ spinFace: 1 | -1 };
}

export interface CompanionContext {
  /** FishingState['kind'] */
  fishing: string;
  night: boolean;
}

const rand = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

export function createCompanions(rng: Rng = Math.random): Companions {
  return {
    mode: 'dock',
    bed: null,
    idleMs: 0,
    elapsed: 0,
    dog: {
      ...DOG_SPOT,
      face: 1,
      path: [],
      shape: 'lie',
      reaction: 'none',
      reactMs: 0,
      wagMs: 0,
      nextWagIn: rand(rng, 2000, 4500),
      petMs: 0,
      hop: 0,
      hopTotalMs: HOP_MS,
      hopHeight: 7,
      restMs: 0,
      sleeping: false,
    },
    paj: { ...PAJ_SPOT, face: 1, path: [], shape: 'sit', reactMs: 0, nextSipIn: rand(rng, 6000, 11000), walkDist: 0, clapMs: 0, clapTotalMs: CLAP_MS },
    stick: { x: 0, y: 0, state: 'hidden' },
    bubble: null,
    play: { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, spinFace: 1 },
  };
}

// ---- Player-facing hooks ----------------------------------------------------------------

/** A player press (cast/tap): everyone heads back to the dock. */
export function companionPress(s: Companions): void {
  s.idleMs = 0;
  if (s.mode === 'play' || s.mode === 'leaving') beginReturn(s);
}

/** `big` (a new species or record) makes the catch reaction longer and bigger. */
export function companionEvent(s: Companions, e: GameEventKind, big = false): void {
  const d = s.dog;
  s.idleMs = 0;
  if (e === 'bite' && (s.mode === 'play' || s.mode === 'leaving')) beginReturn(s);
  if (s.mode !== 'dock') return;
  d.sleeping = false;
  d.restMs = 0;
  if (e === 'nibble') {
    if (d.reaction === 'none') setReaction(s, 'perk');
  } else if (e === 'bite') {
    setReaction(s, 'stand');
    s.paj.shape = 'look';
    s.paj.reactMs = 0;
  } else if (e === 'hooked') {
    setReaction(s, 'spin');
    s.paj.shape = 'cheer';
    s.paj.reactMs = 0;
  } else if (e === 'fishEscaped') {
    setReaction(s, 'sit');
    if (s.paj.shape === 'look' || s.paj.shape === 'cheer') s.paj.shape = 'sit';
  } else if (e === 'fishCaught') {
    setReaction(s, 'hop');
    d.hopTotalMs = big ? HOP_BIG_MS : HOP_MS;
    d.hopHeight = big ? 12 : 7;
    s.paj.clapTotalMs = big ? CLAP_BIG_MS : CLAP_MS;
    s.paj.clapMs = s.paj.clapTotalMs;
    s.paj.shape = 'cheer';
    s.paj.reactMs = 0;
  } else if (e === 'fishLost') {
    setReaction(s, 'sit');
    s.paj.clapMs = 0;
    s.paj.shape = 'look';
    s.paj.reactMs = 0;
  }
}

/** Pajkel says something: a bubble over his head for BUBBLE_MS. A new line replaces the one showing. */
export function pajSay(s: Companions, text: string): void {
  s.bubble = { text, ageMs: 0 };
}

/** The bubble's opacity: 1, fading to 0 over its last BUBBLE_FADE_MS; 0 when there is none. */
export function bubbleAlpha(b: Bubble | null): number {
  if (!b) return 0;
  return Math.max(0, Math.min(1, (BUBBLE_MS - b.ageMs) / BUBBLE_FADE_MS));
}

/** A random line from a list (a list of one gives that line; an empty list gives ''). */
export function pickLine(lines: readonly string[], rng: Rng = Math.random): string {
  return lines.length === 0 ? '' : lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))];
}

/** Pet the dog. Returns true when it happened (the scene shows the heart). */
export function petDog(s: Companions): boolean {
  s.dog.petMs = 1600;
  s.dog.wagMs = 1;
  s.dog.sleeping = false;
  s.idleMs = 0;
  if (s.mode === 'dock' && s.dog.shape === 'sleep') s.dog.shape = 'lie';
  return true;
}

/** Dev helper: jump straight into the play-on-the-grass state. */
export function startPlayNow(s: Companions): void {
  s.mode = 'play';
  Object.assign(s.paj, PLAY_PAJ, { shape: 'stand', path: [], face: 1 });
  Object.assign(s.dog, PLAY_DOG, { shape: 'sit', path: [], face: 1, reaction: 'none' });
  s.play = { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, spinFace: 1 };
  s.stick.state = 'hidden';
}

function beginBed(s: Companions, kind: BedKind, phase: BedPhase): BedState {
  s.mode = 'bed';
  s.stick.state = 'hidden';
  s.dog.reaction = 'none';
  s.dog.hop = 0;
  s.dog.wagMs = 0;
  s.dog.sleeping = false;
  s.dog.path = [];
  s.paj.path = [];
  s.idleMs = 0;
  s.bed = { kind, phase, phaseMs: 0, carried: false, pajA: 1, dogA: 1, door: false, light: false };
  return s.bed;
}

/** Still on the planks (not yet on the grass)? */
const onDock = (a: Point) => a.y < 470;

/**
 * 02:00: Pajkel says `line`, calls Bestia, she runs off, he chases and carries her to the car. It
 * starts from wherever they are (on the dock, walking back, or playing on the grass).
 */
export function startBedtime(s: Companions, line: string): void {
  const fromDock = (s.mode === 'dock' || s.mode === 'returning') && onDock(s.paj);
  beginBed(s, 'night', 'say');
  s.paj.shape = fromDock ? 'sit' : 'stand';
  s.dog.shape = fromDock ? 'lie' : 'sit';
  pajSay(s, line);
}

/** A nap: Pajkel and Bestia walk to the car (no chase). Only from the dock. */
export function startNap(s: Companions): boolean {
  if (s.mode !== 'dock') return false;
  beginBed(s, 'nap', 'walk');
  s.paj.shape = 'walk';
  s.dog.shape = 'run';
  s.paj.path = [...PAJ_PATH_DOWN, CAR_STAND].map((p) => ({ ...p }));
  s.dog.path = [...DOG_PATH_DOWN, CAR_DOG].map((p) => ({ ...p }));
  return true;
}

/** Start the game with them already asleep in the car. */
export function startInCar(s: Companions): void {
  const b = beginBed(s, 'night', 'asleep');
  b.pajA = 0;
  b.dogA = 0;
  s.paj.shape = 'stand';
  s.dog.shape = 'sit';
}

/** They are inside the car, asleep (a tap on the car then makes a "Zzz..."). */
export const isInCar = (s: Companions): boolean => s.mode === 'bed' && s.bed?.phase === 'asleep';

/** Wake them: they step out of the car and walk back to the dock. Does nothing unless they are asleep. */
export function wakeUp(s: Companions): void {
  const b = s.bed;
  if (s.mode !== 'bed' || !b || b.phase !== 'asleep') return;
  b.phase = 'exitOpen';
  b.phaseMs = 0;
  b.carried = false;
  b.door = true;
  b.pajA = 0;
  b.dogA = 0;
  Object.assign(s.paj, CAR_STAND, { shape: 'stand', face: 1, path: [] });
  Object.assign(s.dog, CAR_DOG, { shape: 'sit', face: 1, path: [], reaction: 'none' });
}

/** Which picture of the car to draw. */
export function carVariant(s: Companions): 'closed' | 'open' | 'light' {
  const b = s.bed;
  if (s.mode !== 'bed' || !b) return 'closed';
  return b.door ? 'open' : b.light ? 'light' : 'closed';
}

/** Whether each can be seen on the grass or dock (and so tapped). */
export const pajVisible = (s: Companions): boolean => s.mode !== 'bed' || (s.bed?.pajA ?? 1) > 0.01;
export const dogVisible = (s: Companions): boolean => s.mode !== 'bed' || (!s.bed?.carried && (s.bed?.dogA ?? 1) > 0.01);

/** True while Pajkel's arms are up high in the stretch (else out). */
export function pajStretchHigh(s: Companions): boolean {
  const t = s.bed?.phaseMs ?? 0;
  return t >= BED_TUNING.stretchUpFromMs && t < BED_TUNING.stretchUpToMs;
}

function setReaction(s: Companions, r: Companions['dog']['reaction']): void {
  s.dog.reaction = r;
  s.dog.reactMs = 0;
}

function beginReturn(s: Companions): void {
  s.mode = 'returning';
  s.stick.state = 'hidden';
  s.paj.path = [{ x: PAJ_PATH_DOWN[1].x, y: PAJ_PATH_DOWN[1].y }, PAJ_PATH_DOWN[0], PAJ_SPOT];
  s.dog.path = [DOG_PATH_DOWN[1], DOG_PATH_DOWN[0], DOG_SPOT];
  s.dog.reaction = 'none';
  s.dog.hop = 0;
  s.dog.wagMs = 0;
  s.paj.shape = 'walk';
  s.dog.shape = 'run';
}

function beginLeave(s: Companions): void {
  s.mode = 'leaving';
  s.paj.shape = 'walk';
  s.dog.shape = 'run';
  s.dog.reaction = 'none';
  s.paj.path = [...PAJ_PATH_DOWN, PLAY_PAJ].map((p) => ({ ...p }));
  s.dog.path = [...DOG_PATH_DOWN, PLAY_DOG].map((p) => ({ ...p }));
}

// ---- Movement -----------------------------------------------------------------------------

/** Moves `a` along its path; returns true when the path is finished. */
function follow(a: Actor, speed: number, dtMs: number): boolean {
  let budget = (speed * dtMs) / 1000;
  while (a.path.length > 0 && budget > 0) {
    const t = a.path[0];
    const dx = t.x - a.x;
    const dy = t.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.6) a.face = dx > 0 ? 1 : -1;
    if (dist <= budget) {
      a.x = t.x;
      a.y = t.y;
      budget -= dist;
      a.path.shift();
    } else {
      a.x += (dx / dist) * budget;
      a.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  return a.path.length === 0;
}

/** Walks `a` straight at `target`, stopping `stopAt` px short; returns true when it is there. */
function pursue(a: Actor, target: Point, speed: number, dtMs: number, stopAt: number): boolean {
  const dx = target.x - a.x;
  const dy = target.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.6) a.face = dx > 0 ? 1 : -1;
  if (dist <= stopAt) return true;
  const step = Math.min(dist - stopAt, (speed * dtMs) / 1000);
  a.x += (dx / dist) * step;
  a.y += (dy / dist) * step;
  return dist - step <= stopAt;
}

/** A playful run on the grass: right, left, right, then in towards the car. */
function zigzag(from: Point, rng: Rng): Point[] {
  const pts: Point[] = [];
  let right = from.x < 200;
  for (let i = 0; i < 3; i++) {
    pts.push({ x: right ? rand(rng, 240, 320) : rand(rng, 90, 150), y: rand(rng, 508, 584) });
    right = !right;
  }
  pts.push({ x: rand(rng, 100, 124), y: rand(rng, 548, 566) });
  return pts;
}

// ---- Tick ----------------------------------------------------------------------------------

export function tickCompanions(s: Companions, dtMs: number, ctx: CompanionContext, rng: Rng = Math.random): void {
  s.elapsed += dtMs;
  const pajFrom = { x: s.paj.x, y: s.paj.y };
  const waiting = ctx.fishing === 'idle' || ctx.fishing === 'waiting';
  if (!waiting) s.idleMs = 0;
  else s.idleMs += dtMs;

  if (s.dog.petMs > 0) s.dog.petMs = Math.max(0, s.dog.petMs - dtMs);
  if (s.bubble) s.bubble = s.bubble.ageMs + dtMs >= BUBBLE_MS ? null : { ...s.bubble, ageMs: s.bubble.ageMs + dtMs };

  if (s.mode === 'dock') {
    tickDock(s, dtMs, ctx, rng);
    if (s.idleMs >= IDLE_BEFORE_PLAY_MS && waiting) beginLeave(s);
  } else if (s.mode === 'leaving') {
    const pDone = follow(s.paj, PAJ_WALK_SPEED, dtMs);
    const dDone = follow(s.dog, DOG_RUN_SPEED * 0.55, dtMs);
    s.dog.shape = s.dog.path.length > 0 ? 'run' : 'sit';
    if (pDone) s.paj.shape = 'stand';
    if (pDone && dDone) {
      s.mode = 'play';
      s.play = { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, spinFace: 1 };
    }
  } else if (s.mode === 'play') {
    tickPlay(s, dtMs, rng);
  } else if (s.mode === 'bed') {
    tickBed(s, dtMs, rng);
  } else {
    const pDone = follow(s.paj, PAJ_RUN_SPEED, dtMs);
    const dDone = follow(s.dog, DOG_RUN_SPEED, dtMs);
    s.paj.shape = pDone ? 'sit' : 'walk';
    s.dog.shape = dDone ? 'sit' : 'run';
    if (pDone) {
      s.paj.face = 1;
      s.paj.x = PAJ_SPOT.x;
      s.paj.y = PAJ_SPOT.y;
    }
    if (dDone) s.dog.face = 1;
    if (pDone && dDone) {
      s.mode = 'dock';
      s.dog.restMs = 0;
      s.dog.reaction = 'sit';
      s.dog.reactMs = 0;
      s.idleMs = 0;
    }
  }
  s.paj.walkDist += Math.hypot(s.paj.x - pajFrom.x, s.paj.y - pajFrom.y);
}

function tickDock(s: Companions, dtMs: number, ctx: CompanionContext, rng: Rng): void {
  const d = s.dog;
  const p = s.paj;
  d.x = DOG_SPOT.x;
  d.y = DOG_SPOT.y;
  d.face = 1;
  p.x = PAJ_SPOT.x;
  p.y = PAJ_SPOT.y;
  p.face = 1;
  d.reactMs += dtMs;
  d.hop = 0;

  switch (d.reaction) {
    case 'perk':
      d.shape = 'lie';
      if (d.reactMs > 1500) setReaction(s, 'none');
      break;
    case 'stand':
      d.shape = 'stand';
      break;
    case 'spin':
      d.shape = 'stand';
      d.hop = Math.abs(Math.sin(d.reactMs / 130)) * 6;
      d.face = Math.floor(d.reactMs / 220) % 2 === 0 ? 1 : -1;
      if (d.reactMs > 2200) setReaction(s, 'sit');
      break;
    case 'hop':
      d.shape = 'stand';
      d.hop = Math.abs(Math.sin(d.reactMs / 110)) * d.hopHeight;
      if (d.reactMs > d.hopTotalMs) setReaction(s, 'sit');
      break;
    case 'sit':
      d.shape = 'sit';
      if (d.reactMs > 4000) setReaction(s, 'none');
      break;
    default:
      if (ctx.night && d.petMs === 0) {
        d.restMs += dtMs;
        d.sleeping = d.restMs > 1200;
      } else {
        d.restMs = 0;
        d.sleeping = false;
      }
      d.shape = d.sleeping ? 'sleep' : 'lie';
  }
  // 'stand' (bite) ends when the fish is gone or hooked; the scene's events set the next reaction,
  // and a stalled bite falls back to sitting after a while.
  if (d.reaction === 'stand' && d.reactMs > 3500) setReaction(s, 'sit');

  // Tail wag.
  if (d.wagMs > 0) {
    d.wagMs += dtMs;
    if (d.wagMs > 1300 && d.petMs === 0) {
      d.wagMs = 0;
      d.nextWagIn = rand(rng, 2500, 6000);
    }
  } else if (!d.sleeping) {
    d.nextWagIn -= dtMs;
    if (d.nextWagIn <= 0) d.wagMs = 1;
  }

  // Pajkel: breathing is the scene's job; here only reactions and the occasional sip.
  p.reactMs += dtMs;
  if (p.clapMs > 0) {
    // Clapping: the cheer and sit frames alternate quickly.
    const elapsed = p.clapTotalMs - p.clapMs;
    p.clapMs = Math.max(0, p.clapMs - dtMs);
    if (p.clapMs === 0) {
      p.shape = 'sit';
      p.reactMs = 0;
    } else {
      p.shape = Math.floor(elapsed / CLAP_FLIP_MS) % 2 === 0 ? 'cheer' : 'sit';
    }
    return;
  }
  if (p.shape === 'look' && p.reactMs > 1600) p.shape = 'sit';
  if (p.shape === 'cheer' && p.reactMs > 1900) p.shape = 'sit';
  if (p.shape === 'sip') {
    if (p.reactMs > 1500) {
      p.shape = 'sit';
      p.nextSipIn = rand(rng, 8000, 14000);
    }
  } else if (p.shape === 'sit') {
    p.nextSipIn -= dtMs;
    if (p.nextSipIn <= 0) {
      p.shape = 'sip';
      p.reactMs = 0;
    }
  }
}

function tickBed(s: Companions, dtMs: number, rng: Rng): void {
  const b = s.bed;
  if (!b) {
    s.mode = 'dock';
    return;
  }
  const p = s.paj;
  const d = s.dog;
  const T = BED_TUNING;
  b.phaseMs += dtMs;
  const go = (phase: BedPhase) => {
    b.phase = phase;
    b.phaseMs = 0;
  };
  switch (b.phase) {
    case 'say':
      if (b.phaseMs >= T.sayMs) {
        go('call');
        p.shape = 'stand';
        p.face = 1;
        d.shape = 'stand';
        d.reaction = 'stand';
      }
      break;
    case 'call':
      d.shape = 'stand';
      if (b.phaseMs >= T.callMs) {
        const dockStart = onDock(d);
        go('chase');
        d.reaction = 'none';
        p.path = onDock(p) ? PAJ_PATH_DOWN.map((q) => ({ ...q })) : [];
        d.path = [...(dockStart ? DOG_PATH_DOWN : []), ...zigzag(dockStart ? DOG_PATH_DOWN[1] : d, rng)].map((q) => ({ ...q }));
      }
      break;
    case 'chase': {
      follow(d, T.dogRunSpeed, dtMs);
      d.shape = d.path.length > 0 ? 'run' : 'sit';
      // A playful bounce while she runs.
      d.hop = d.path.length > 0 ? Math.abs(Math.sin((s.elapsed / 90) * (Math.PI / 2))) * 2 : 0;
      const walkingDown = p.path.length > 0;
      if (walkingDown) follow(p, PAJ_RUN_SPEED * 0.8, dtMs);
      else pursue(p, d, T.pajChaseSpeed, dtMs, 10);
      p.shape = 'walk';
      const close = Math.hypot(p.x - d.x, p.y - d.y) <= T.catchDist;
      if ((d.path.length === 0 && !walkingDown && close) || b.phaseMs > T.chaseGiveUpMs) {
        d.path = [];
        d.hop = 0;
        go('catch');
        p.shape = 'stand';
        p.path = [];
        if (!close) {
          // He gave up chasing: she is simply scooped up where she stopped.
          p.x = d.x - 12;
          p.y = d.y;
        }
        p.face = d.x >= p.x ? 1 : -1;
        d.shape = 'sit';
      }
      break;
    }
    case 'catch':
      d.hop = Math.abs(Math.sin(b.phaseMs / 110)) * 2;
      if (b.phaseMs >= T.catchMs) {
        d.hop = 0;
        b.carried = true;
        p.shape = 'carry';
        p.path = [{ ...CAR_STAND }];
        go('carry');
      }
      break;
    case 'carry':
      p.shape = 'carry';
      if (follow(p, T.pajCarrySpeed, dtMs)) {
        p.face = -1;
        go('doorOpen');
        b.door = true;
      }
      break;
    case 'walk': {
      const pDone = follow(p, PAJ_WALK_SPEED, dtMs);
      const dDone = follow(d, DOG_RUN_SPEED * 0.55, dtMs);
      p.shape = pDone ? 'stand' : 'walk';
      d.shape = dDone ? 'sit' : 'run';
      if (pDone && dDone) {
        p.face = -1;
        d.face = -1;
        go('doorOpen');
        b.door = true;
      }
      break;
    }
    case 'doorOpen':
      if (b.phaseMs >= T.doorMs) go('enter');
      break;
    case 'enter': {
      const t = Math.min(1, b.phaseMs / T.enterMs);
      b.pajA = 1 - t;
      b.dogA = 1 - t;
      p.x = CAR_STAND.x - 6 * t;
      p.y = CAR_STAND.y - 4 * t;
      if (!b.carried) {
        d.x = CAR_DOG.x - 12 * t;
        d.y = CAR_DOG.y - 4 * t;
      }
      if (t >= 1) {
        b.door = false;
        go('doorShut');
      }
      break;
    }
    case 'doorShut':
      if (b.phaseMs >= T.shutMs) {
        b.light = true;
        go('light');
      }
      break;
    case 'light':
      if (b.phaseMs >= T.lightMs[b.kind]) {
        b.light = false;
        go('asleep');
      }
      break;
    case 'asleep':
      break;
    case 'exitOpen': {
      const t = Math.min(1, b.phaseMs / T.exitOpenMs);
      b.pajA = t;
      b.dogA = t;
      p.x = CAR_STAND.x - 6 * (1 - t);
      p.y = CAR_STAND.y - 4 * (1 - t);
      d.x = CAR_DOG.x - 12 * (1 - t);
      d.y = CAR_DOG.y - 4 * (1 - t);
      if (t >= 1) {
        b.door = false;
        go('exitShut');
      }
      break;
    }
    case 'exitShut':
      if (b.phaseMs >= T.shutMs) {
        go('return');
        p.shape = 'walk';
        d.shape = 'run';
        p.path = [...PAJ_PATH_DOWN].reverse().concat(PAJ_SPOT).map((q) => ({ ...q }));
        d.path = [...DOG_PATH_DOWN].reverse().concat(DOG_SPOT).map((q) => ({ ...q }));
      }
      break;
    case 'return': {
      const pDone = follow(p, T.pajHomeSpeed, dtMs);
      const dDone = follow(d, T.dogTrotSpeed, dtMs);
      p.shape = pDone ? 'stand' : 'walk';
      d.shape = dDone ? 'sit' : 'run';
      if (pDone && dDone) {
        Object.assign(p, PAJ_SPOT, { face: 1 });
        Object.assign(d, DOG_SPOT, { face: 1 });
        go('stretch');
        p.shape = 'stretch';
      }
      break;
    }
    case 'stretch':
      p.shape = 'stretch';
      if (b.phaseMs >= T.stretchMs) {
        s.mode = 'dock';
        s.bed = null;
        p.shape = 'sit';
        d.restMs = 0;
        d.reaction = 'sit';
        d.reactMs = 0;
        s.idleMs = 0;
      }
      break;
  }
}

function pickTarget(rng: Rng): Point {
  return { x: rand(rng, THROW_X[0], THROW_X[1]), y: rand(rng, THROW_Y[0], THROW_Y[1]) };
}

function tickPlay(s: Companions, dtMs: number, rng: Rng): void {
  const pl = s.play;
  const p = s.paj;
  const d = s.dog;
  pl.phaseMs += dtMs;
  switch (pl.phase) {
    case 'throw': {
      p.shape = 'throw';
      p.face = 1;
      if (s.stick.state === 'hidden' && pl.phaseMs > 350) {
        pl.target = pickTarget(rng);
        s.stick.state = 'flying';
        s.stick.x = p.x + 6;
        s.stick.y = p.y - 44;
      }
      if (s.stick.state === 'flying') {
        const t = Math.min(1, (pl.phaseMs - 350) / 900);
        s.stick.x = p.x + 6 + (pl.target.x - p.x - 6) * t;
        s.stick.y = p.y - 44 + (pl.target.y - (p.y - 44)) * t - Math.sin(Math.PI * t) * 46;
        if (t >= 1) {
          s.stick.state = 'ground';
          s.stick.x = pl.target.x;
          s.stick.y = pl.target.y;
        }
        if (pl.phaseMs > 500 && d.path.length === 0) d.path = [{ ...pl.target }];
      }
      if (pl.phaseMs > 700) p.shape = 'stand';
      follow(d, DOG_RUN_SPEED, dtMs);
      d.shape = d.path.length > 0 ? 'run' : 'sit';
      if (s.stick.state === 'ground' && d.path.length === 0 && Math.hypot(d.x - pl.target.x, d.y - pl.target.y) < 4) {
        pl.phase = 'bring';
        pl.phaseMs = 0;
        s.stick.state = 'carried';
        s.stick.x = d.x + d.face * DOG_MOUTH.x;
        s.stick.y = d.y - DOG_MOUTH.y;
        d.path = [{ x: p.x + 26, y: p.y + 4 }];
      }
      break;
    }
    case 'bring': {
      s.stick.state = 'carried';
      const done = follow(d, DOG_RUN_SPEED, dtMs);
      d.shape = done ? 'sit' : 'run';
      // A proud trot: a slight bounce in time with the strides, the stick held at the snout.
      d.hop = done ? 0 : Math.abs(Math.sin(s.elapsed / 90 * (Math.PI / 2))) * 2;
      s.stick.x = d.x + d.face * DOG_MOUTH.x;
      s.stick.y = d.y - d.hop - DOG_MOUTH.y;
      p.shape = 'stand';
      p.face = 1;
      if (done) {
        d.hop = 0;
        s.stick.state = 'ground';
        s.stick.x = d.x;
        s.stick.y = d.y;
        pl.phase = 'drop';
        pl.phaseMs = 0;
        pl.fetches++;
      }
      break;
    }
    case 'drop': {
      d.shape = 'sit';
      p.shape = 'stand';
      if (pl.phaseMs > 1300) {
        if (pl.fetches >= 2 + Math.floor(rng() * 2)) {
          pl.phase = 'spin';
          s.stick.state = 'hidden';
        } else {
          pl.phase = 'throw';
          s.stick.state = 'hidden';
        }
        pl.phaseMs = 0;
      }
      break;
    }
    case 'spin': {
      // Happy spin on the spot: the dog flips to face the other way SPIN_FLIPS times (two turns
      // around), hopping a little on each, tail wagging.
      p.shape = 'stand';
      if (pl.phaseMs <= dtMs) pl.spinFace = d.face; // (first tick of the phase)
      const slot = SPIN_MS / SPIN_FLIPS;
      const flips = Math.min(SPIN_FLIPS, Math.floor(pl.phaseMs / slot) + 1); // the first flip is immediate
      d.face = (flips % 2 === 0 ? pl.spinFace : -pl.spinFace) as 1 | -1;
      d.shape = 'stand';
      d.reaction = 'spin';
      d.hop = Math.abs(Math.sin((Math.PI * (pl.phaseMs % slot)) / slot)) * SPIN_HOP;
      d.wagMs = 1 + pl.phaseMs;
      if (pl.phaseMs >= SPIN_MS) {
        d.face = pl.spinFace;
        d.hop = 0;
        d.wagMs = 0;
        d.reaction = 'none';
        pl.phase = 'rest';
        pl.phaseMs = 0;
        d.path = [{ x: p.x + 30, y: p.y + 4 }];
      }
      break;
    }
    case 'rest': {
      p.shape = 'stand';
      const done = follow(d, DOG_RUN_SPEED * 0.6, dtMs);
      d.shape = done ? 'sit' : 'run';
      if (pl.phaseMs > 4200) {
        pl.phase = 'throw';
        pl.phaseMs = 0;
        pl.fetches = 0;
        s.stick.state = 'hidden';
      }
      break;
    }
  }
}

// ---- Views for the renderer --------------------------------------------------------------

export interface DogView {
  shape: DogShape;
  tail: number;
  perked: boolean;
  step: number;
  /** Carrying the stick in its mouth. */
  carry: boolean;
}

export function dogView(s: Companions): DogView {
  const d = s.dog;
  const wagging = d.wagMs > 0 && d.shape !== 'sleep';
  const wagFrame = wagging ? Math.floor(d.wagMs / 140) % 3 : 0;
  const tail = d.shape === 'lie' ? (wagging ? wagFrame : 0) : wagging ? wagFrame % 2 : 0;
  return {
    shape: d.shape,
    tail,
    perked: d.reaction === 'perk' || d.reaction === 'stand' || d.reaction === 'spin' || d.reaction === 'hop' || d.petMs > 0,
    step: Math.floor(s.elapsed / 90) % 4,
    carry: s.stick.state === 'carried',
  };
}

/** 0..3 walk frame for Pajkel. */
export function pajWalkFrame(s: Companions): number {
  return Math.floor(s.paj.walkDist / PAJ_STRIDE_PX) % 4;
}
