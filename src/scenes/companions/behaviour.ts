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
const PAJ_WALK_SPEED = 46;
const PAJ_RUN_SPEED = 90;
const DOG_RUN_SPEED = 120;
/** Pajkel claps for a catch this long, flipping between two frames this often. */
export const CLAP_MS = 2000;
const CLAP_FLIP_MS = 150;
/** Bestia hops for a catch this long. */
export const HOP_MS = 1500;

export type DogShape = 'lie' | 'sleep' | 'sit' | 'stand' | 'run';
export type PajShape = 'sit' | 'sip' | 'cheer' | 'look' | 'stand' | 'walk' | 'throw';
export type Mode = 'dock' | 'leaving' | 'play' | 'returning';
type PlayPhase = 'throw' | 'chase' | 'bring' | 'drop' | 'zoomies' | 'rest';

interface Actor extends Point {
  /** 1 = facing right, -1 = left. */
  face: 1 | -1;
  path: Point[];
}

export interface Stick extends Point {
  state: 'hidden' | 'flying' | 'ground' | 'carried';
}

export interface Companions {
  mode: Mode;
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
    /** Dock rest time since last reaction (to lie back down). */
    restMs: number;
    sleeping: boolean;
  };
  paj: Actor & {
    shape: PajShape;
    reactMs: number;
    nextSipIn: number;
    walkMs: number;
    /** Time left clapping (alternating the cheer and sit frames). */
    clapMs: number;
  };
  stick: Stick;
  play: { phase: PlayPhase; phaseMs: number; fetches: number; target: Point; angle: number };
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
      restMs: 0,
      sleeping: false,
    },
    paj: { ...PAJ_SPOT, face: 1, path: [], shape: 'sit', reactMs: 0, nextSipIn: rand(rng, 6000, 11000), walkMs: 0, clapMs: 0 },
    stick: { x: 0, y: 0, state: 'hidden' },
    play: { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, angle: 0 },
  };
}

// ---- Player-facing hooks ----------------------------------------------------------------

/** A player press (cast/tap): everyone heads back to the dock. */
export function companionPress(s: Companions): void {
  s.idleMs = 0;
  if (s.mode === 'play' || s.mode === 'leaving') beginReturn(s);
}

export function companionEvent(s: Companions, e: GameEventKind): void {
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
    s.paj.clapMs = CLAP_MS;
    s.paj.shape = 'cheer';
    s.paj.reactMs = 0;
  } else if (e === 'fishLost') {
    setReaction(s, 'sit');
    s.paj.clapMs = 0;
    s.paj.shape = 'look';
    s.paj.reactMs = 0;
  }
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
  s.play = { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, angle: 0 };
  s.stick.state = 'hidden';
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

// ---- Tick ----------------------------------------------------------------------------------

export function tickCompanions(s: Companions, dtMs: number, ctx: CompanionContext, rng: Rng = Math.random): void {
  s.elapsed += dtMs;
  const waiting = ctx.fishing === 'idle' || ctx.fishing === 'waiting';
  if (!waiting) s.idleMs = 0;
  else s.idleMs += dtMs;

  if (s.dog.petMs > 0) s.dog.petMs = Math.max(0, s.dog.petMs - dtMs);

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
      s.play = { phase: 'throw', phaseMs: 0, fetches: 0, target: { x: 250, y: 540 }, angle: 0 };
    }
  } else if (s.mode === 'play') {
    tickPlay(s, dtMs, rng);
  } else {
    const pDone = follow(s.paj, PAJ_RUN_SPEED, dtMs);
    const dDone = follow(s.dog, DOG_RUN_SPEED, dtMs);
    s.paj.shape = pDone ? 'sit' : 'walk';
    s.dog.shape = dDone ? 'sit' : 'run';
    s.paj.walkMs += dtMs;
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
  if (s.mode !== 'dock' && s.paj.shape === 'walk') s.paj.walkMs += dtMs;
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
      d.hop = Math.abs(Math.sin(d.reactMs / 110)) * 7;
      if (d.reactMs > HOP_MS) setReaction(s, 'sit');
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
    const elapsed = CLAP_MS - p.clapMs;
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

function pickTarget(rng: Rng): Point {
  return { x: rand(rng, THROW_X[0], THROW_X[1]), y: rand(rng, THROW_Y[0], THROW_Y[1]) };
}

function tickPlay(s: Companions, dtMs: number, rng: Rng): void {
  const pl = s.play;
  const p = s.paj;
  const d = s.dog;
  pl.phaseMs += dtMs;
  p.walkMs += dtMs;
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
        d.path = [{ x: p.x + 26, y: p.y + 4 }];
      }
      break;
    }
    case 'bring': {
      s.stick.state = 'carried';
      const done = follow(d, DOG_RUN_SPEED, dtMs);
      d.shape = done ? 'sit' : 'run';
      s.stick.x = d.x + d.face * 9;
      s.stick.y = d.y - 9;
      p.shape = 'stand';
      p.face = 1;
      if (done) {
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
          pl.phase = 'zoomies';
          pl.angle = 0;
          s.stick.state = 'hidden';
        } else {
          pl.phase = 'throw';
          s.stick.state = 'hidden';
        }
        pl.phaseMs = 0;
      }
      break;
    }
    case 'zoomies': {
      p.shape = 'stand';
      pl.angle += (dtMs / 1000) * 4.6;
      const cx = p.x + 66;
      const cy = p.y + 6;
      const nx = cx + Math.cos(pl.angle) * 62;
      const ny = cy + Math.sin(pl.angle) * 28;
      d.face = nx >= d.x ? 1 : -1;
      d.x = nx;
      d.y = Math.min(584, ny);
      d.shape = 'run';
      if (pl.phaseMs > 4800) {
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
  };
}

/** 0..3 walk frame for Pajkel. */
export function pajWalkFrame(s: Companions): number {
  return Math.floor(s.paj.walkMs / 170) % 4;
}
