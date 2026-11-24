/**
 * Pajkel and the dog: a pure behaviour state machine (no Phaser). The scene feeds it
 * `tickCompanions(dt)`, game events and player presses, then draws whatever it reports.
 * Positions are screen coordinates; sprites are anchored at their feet (bottom centre).
 */
import { GIVE_BACK_LINE, GIVE_UP_LINES } from '../../core/data/pajkelLines';
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
const PLAY_DOG: Point = { x: 140, y: 544 };

export const IDLE_BEFORE_PLAY_MS = 25_000;
/** The happy spin after the last fetch: the dog flips to face the other way this many times over this long. */
export const SPIN_MS = 1000;
export const SPIN_FLIPS = 4;
const SPIN_HOP = 4;
/** Where the stick sits when carried: this far in front of the dog's feet and this high (before the bounce). */
export const DOG_MOUTH = { x: 15, y: 14 };
/** The same in the play-bow, where her head is low. */
export const DOG_MOUTH_BOW = { x: 14, y: 4 };
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

/**
 * The sip (slice 22a): lift the cup, drink, lower it. Every 4th sip starts with a pour: he reaches for
 * the thermos, tips it over the cup in his lap, and puts it back down.
 */
export const SIP_FRAMES: readonly { shape: PajShape; ms: number }[] = [
  { shape: 'sipLift', ms: 200 },
  { shape: 'sipDrink', ms: 900 },
  { shape: 'sipLift', ms: 200 },
];
export const POUR_FRAMES: readonly { shape: PajShape; ms: number }[] = [
  { shape: 'pourReach', ms: 300 },
  { shape: 'pour', ms: 800 },
  { shape: 'pourReach', ms: 300 },
];
/** Every this-many-th sip starts with a pour. */
export const POUR_EVERY = 4;
const frameSum = (f: readonly { ms: number }[]) => f.reduce((a, b) => a + b.ms, 0);
/** How long one sip lasts, with or without the pour in front. */
export const sipTotalMs = (pour: boolean): number => frameSum(SIP_FRAMES) + (pour ? frameSum(POUR_FRAMES) : 0);

/** The frame at `ms` into a sip (null once it is over). */
export function sipFrameAt(ms: number, pour: boolean): PajShape | null {
  let t = ms;
  for (const f of pour ? [...POUR_FRAMES, ...SIP_FRAMES] : SIP_FRAMES) {
    if (t < f.ms) return f.shape;
    t -= f.ms;
  }
  return null;
}

/** Part of a sip or a pour. */
export const isSipShape = (shape: PajShape): boolean => shape === 'sipLift' || shape === 'sipDrink' || shape === 'pourReach' || shape === 'pour';
/** Sitting in the chair, whatever he is doing there. */
export const isSeatedShape = (shape: PajShape): boolean => shape === 'sit' || shape === 'cheer' || shape === 'look' || isSipShape(shape);
/** Is the cup at his chest or mouth (so it steams on a cool morning or evening)? */
export const holdsCup = (shape: PajShape): boolean => shape === 'sit' || shape === 'sipLift' || shape === 'sipDrink';
/** The steam shows at dawn, dusk and night; by day the cup is just a cup. */
export const steamShows = (period: 'dawn' | 'day' | 'dusk' | 'night'): boolean => period !== 'day';

/** Pajkel's speech bubble stays this long (the last FADE ms fade out). */
export const BUBBLE_MS = 3000;
export const BUBBLE_FADE_MS = 300;

export interface Bubble {
  text: string;
  /** Ms since it appeared. */
  ageMs: number;
}

export type DogShape = 'lie' | 'sleep' | 'sit' | 'stand' | 'run' | 'bow';
export type PajShape = 'sit' | 'sipLift' | 'sipDrink' | 'pourReach' | 'pour' | 'cheer' | 'look' | 'stand' | 'walk' | 'throw' | 'carry' | 'stretch' | 'bend';
export type Mode = 'dock' | 'leaving' | 'play' | 'returning' | 'bed';
/**
 * One round of "no take, only throw" (slice 17): he throws, she fetches (`throw`), trots back (`bring`)
 * and stops out of reach, he steps in (`tease`), she dodges (`dodge`) and runs off with it (`keepAway`),
 * he gives up (`giveUp`), walks to a spare stick (`toStick`), picks it up (`bend`) and throws again.
 * Rarely she gives it back instead (`drop`). After a few rounds: the happy `spin`, then `rest`.
 */
type PlayPhase = 'throw' | 'bring' | 'tease' | 'dodge' | 'keepAway' | 'giveUp' | 'toStick' | 'bend' | 'drop' | 'spin' | 'rest';

interface Actor extends Point {
  /** 1 = facing right, -1 = left. */
  face: 1 | -1;
  path: Point[];
}

export interface Stick extends Point {
  state: 'hidden' | 'flying' | 'ground' | 'carried';
  /** Which of the three shapes it is (it keeps its shape when she drops it). */
  variant: number;
}

/**
 * A stick lying on the grass: an `old` one she dropped, or the `spare` he is about to pick up.
 * `fadeMs` counts down once the oldest is pushed out by the cap (null = not fading).
 */
export interface GroundStick extends Point {
  kind: 'old' | 'spare';
  /** Which of the three stick shapes (0..2). */
  variant: number;
  ageMs: number;
  fadeMs: number | null;
}

export const STICK_TUNING = {
  /** Old sticks lying on the grass at once; the oldest fades out when a third would land. */
  maxOld: 2,
  fadeInMs: 300,
  /** An old stick lies this long, then fades out over fadeOutMs. */
  oldLifeMs: 30_000,
  fadeOutMs: 2000,
};

/** Which of the three stick shapes lies where: seeded by the spot, so it is the same every time. */
export const stickVariantAt = (p: Point): number => Math.abs(Math.round(p.x) * 7 + Math.round(p.y) * 13) % 3;

/** Where the companions play: the grass between the car (left), the dock (top), the right bushes and the hint line (bottom). */
export const PLAY_AREA = { x0: 100, x1: 322, y0: 500, y1: 554 };

export const PLAY_TUNING = {
  /** A round ends with her bringing it back and dropping it at his feet this often. */
  giveBackChance: 1 / 6,
  /** She stops this far from him with the stick (out of reach); he has her when he is this close. */
  keepDist: 52,
  reachDist: 28,
  /** In the rare round she brings it back she stops this close (well within his reach). */
  giveBackDist: 20,
  /** Closest he gets while chasing: she is never caught. The sprites are ~26 px wide, so their centres stay this far apart. */
  minGap: 28,
  /** Within this far of an edge (x, y) she turns back towards the middle of the lawn instead of running on along it. */
  edgeMarginX: 24,
  edgeMarginY: 10,
  teaseMaxMs: 2500,
  pajTeaseSpeed: 40,
  dodgeBowMs: 420,
  dodgeHopMs: 260,
  dodgeHopHeight: 9,
  /** The hop sideways: this far straight away from him and this far to the side. */
  dodgeAway: 26,
  dodgeSide: 22,
  /** How long the chase lasts (random in this range). */
  chaseMs: [7000, 11000] as [number, number],
  dogSpeed: 98,
  /** Now and then she slows for a moment so he nearly catches her. */
  dogSlowSpeed: 38,
  nearMissMs: 800,
  nearMissEveryMs: [2200, 3600] as [number, number],
  pajBaseSpeed: 82,
  /** He speeds up by this much per px of gap beyond 40, up to pajMaxSpeed, so she stays only a little ahead. */
  pajCatchUp: 1.5,
  pajMaxSpeed: 125,
  giveUpMs: 1700,
  /** She trots off to this far from him while he gives up. */
  giveUpDist: 60,
  /** He walks to the spare stick at this speed and stops this far short of it. */
  pajToStickSpeed: 62,
  stickStop: 8,
  bendMs: 800,
  /** The stick leaves the grass at this moment of the bend. */
  bendTakeMs: 400,
  dropMs: 1700,
  /** The spare stick lies this far from him (min, max), and sticks keep this far apart. */
  spareDist: [44, 90] as [number, number],
  stickGap: 18,
  /** A spare stick keeps this far from Bestia. */
  dogGap: 14,
  /** A throw lands this far from him (min, max). */
  throwDist: [80, 200] as [number, number],
};

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
    /** How many sips he has started (every POUR_EVERY-th starts with a pour), and whether the one under way pours. */
    sips: number;
    sipPour: boolean;
    /** How much longer he stays in the walk frame after he last moved (ms): a standing man never walks in place. */
    walkHoldMs: number;
    /** Where he was WALK_WINDOW_MS ago at most (and for how long): the yardstick for "is he really walking". */
    walkAnchor: Point & { ms: number };
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
  /** Sticks lying on the grass (old ones and the spare), drawn by the view; cleared when they go back to the dock. */
  sticks: GroundStick[];
  /** Chance that a round ends with her giving the stick back (a dev flag raises it). */
  giveBackChance: number;
  play: PlayState;
}

export interface PlayState {
  phase: PlayPhase;
  phaseMs: number;
  /** Rounds played since the last spin. */
  fetches: number;
  target: Point;
  /** Which way the dog faced when the spin began. */
  spinFace: 1 | -1;
  /** Throw phase: the target is picked / the stick has left his hand. */
  targeted: boolean;
  thrown: boolean;
  /** This round she brings it back (decided when she picks the stick up). */
  giveBack: boolean;
  /** This round is the last before the happy spin. */
  finalRound: boolean;
  /** The chase: how long it lasts, ms of slow-down left (a near miss) and until the next one. */
  chaseMs: number;
  nearMs: number;
  nearIn: number;
  /** The dodge hop. */
  hopFrom: Point;
  hopTo: Point;
  /** Which side of the spare stick he stands on (-1 left, 1 right), so his reach lands on it. */
  stickSide: 1 | -1;
  /** The chase: which way round him she slides while he blocks her way (0 = not blocked). */
  slide: 1 | -1 | 0;
}

function newPlay(): PlayState {
  return {
    phase: 'throw',
    phaseMs: 0,
    fetches: 0,
    target: { x: 250, y: 540 },
    spinFace: 1,
    targeted: false,
    thrown: false,
    giveBack: false,
    finalRound: false,
    chaseMs: 0,
    nearMs: 0,
    nearIn: 0,
    hopFrom: { x: 0, y: 0 },
    hopTo: { x: 0, y: 0 },
    stickSide: 1,
    slide: 0,
  };
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
    paj: { ...PAJ_SPOT, face: 1, path: [], shape: 'sit', reactMs: 0, nextSipIn: rand(rng, 6000, 11000), sips: 0, sipPour: false, walkHoldMs: 0, walkAnchor: { x: PAJ_SPOT.x, y: PAJ_SPOT.y, ms: 0 }, walkDist: 0, clapMs: 0, clapTotalMs: CLAP_MS },
    stick: { x: 0, y: 0, state: 'hidden', variant: 0 },
    bubble: null,
    sticks: [],
    giveBackChance: PLAY_TUNING.giveBackChance,
    play: newPlay(),
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
  s.play = newPlay();
  s.sticks = [];
  s.stick.state = 'hidden';
}

function beginBed(s: Companions, kind: BedKind, phase: BedPhase): BedState {
  s.mode = 'bed';
  s.stick.state = 'hidden';
  s.sticks = [];
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

/** The camp chair stands empty (the thermos beside it) whenever he is not sitting in it: away, or in the car. */
export const chairEmpty = (s: Companions): boolean => !(isSeatedShape(s.paj.shape) && (s.mode === 'dock' || (s.mode === 'bed' && s.bed?.phase === 'say')));

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
  // Every stick on the grass fades out over fadeOutMs instead of popping away; the one in her mouth is dropped.
  if (s.stick.state === 'carried') dropCarried(s);
  else if (s.stick.state === 'ground') layStick(s, clampArea(s.stick), 'old', s.stick.variant);
  s.stick.state = 'hidden';
  for (const g of s.sticks) if (g.fadeMs === null) g.fadeMs = STICK_TUNING.fadeOutMs;
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
  tickSticks(s, dtMs);
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
      s.play = newPlay();
      s.sticks = [];
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
  if (isSipShape(p.shape)) {
    // A reaction (look / cheer) has already replaced the shape and ends the sip; here it just runs on.
    const f = sipFrameAt(p.reactMs, p.sipPour);
    if (f) p.shape = f;
    else {
      p.shape = 'sit';
      p.reactMs = 0;
    }
  } else if (p.shape === 'sit') {
    p.nextSipIn -= dtMs;
    if (p.nextSipIn <= 0) {
      p.sips++;
      p.sipPour = p.sips % POUR_EVERY === 0;
      p.nextSipIn = rand(rng, 8000, 14000);
      p.shape = sipFrameAt(0, p.sipPour) ?? 'sit';
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

// ---- The fetch game: "no take, only throw" (slice 17) ----------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const inArea = (p: Point) => p.x >= PLAY_AREA.x0 && p.x <= PLAY_AREA.x1 && p.y >= PLAY_AREA.y0 && p.y <= PLAY_AREA.y1;
const clampArea = (p: Point): Point => ({ x: clamp(p.x, PLAY_AREA.x0, PLAY_AREA.x1), y: clamp(p.y, PLAY_AREA.y0, PLAY_AREA.y1) });

/** A stick's opacity: it fades in when it appears and out when the cap pushes it off the grass. */
export function groundStickAlpha(g: GroundStick): number {
  const fadeIn = clamp(g.ageMs / STICK_TUNING.fadeInMs, 0, 1);
  const fadeOut = g.fadeMs === null ? 1 : clamp(g.fadeMs / STICK_TUNING.fadeOutMs, 0, 1);
  return fadeIn * fadeOut;
}

function tickSticks(s: Companions, dtMs: number): void {
  if (s.sticks.length === 0) return;
  for (const g of s.sticks) {
    g.ageMs += dtMs;
    if (g.fadeMs !== null) g.fadeMs -= dtMs;
    else if (g.kind === 'old' && g.ageMs >= STICK_TUNING.oldLifeMs) g.fadeMs = STICK_TUNING.fadeOutMs; // it has lain long enough
  }
  s.sticks = s.sticks.filter((g) => g.fadeMs === null || g.fadeMs > 0);
}

/** Old sticks still lying on the grass (not fading out). */
export const oldSticks = (s: Companions): GroundStick[] => s.sticks.filter((g) => g.kind === 'old' && g.fadeMs === null);

/** Puts a stick on the grass; more than the cap of old ones makes the oldest start fading. */
function layStick(s: Companions, at: Point, kind: GroundStick['kind'], variant: number = stickVariantAt(at)): GroundStick {
  const g: GroundStick = { x: at.x, y: at.y, kind, variant, ageMs: 0, fadeMs: null };
  s.sticks.push(g);
  const old = oldSticks(s);
  for (let i = 0; i < old.length - STICK_TUNING.maxOld; i++) old[i].fadeMs = STICK_TUNING.fadeOutMs;
  return g;
}

/** The oldest old stick still lying there starts to fade (nothing fitted, so the lawn makes room). */
function fadeOldest(s: Companions): void {
  const oldest = oldSticks(s)[0];
  if (oldest) oldest.fadeMs = STICK_TUNING.fadeOutMs;
}

/** A spare stick he has not picked up yet becomes an old one (the game moves on without it). */
function settleSpares(s: Companions): void {
  for (const g of [...s.sticks]) {
    if (g.kind !== 'spare') continue;
    s.sticks = s.sticks.filter((k) => k !== g);
    layStick(s, g, 'old', g.variant);
  }
}

/** Where the carried stick sits: at the snout of whatever pose she is in. */
function holdStick(s: Companions): void {
  const d = s.dog;
  const m = d.shape === 'bow' ? DOG_MOUTH_BOW : DOG_MOUTH;
  s.stick.state = 'carried';
  s.stick.x = d.x + d.face * m.x;
  s.stick.y = d.y - d.hop - m.y;
}

/** She lets go of the stick she carries: it lies on the grass as an old one. */
function dropCarried(s: Companions): void {
  if (s.stick.state !== 'carried') return;
  layStick(s, clampArea({ x: s.dog.x + s.dog.face * 10, y: s.dog.y }), 'old', s.stick.variant);
  s.stick.state = 'hidden';
}

/** A spot for a stick: `lo`..`hi` px from `from`, on the grass and clear of the other sticks and Bestia. */
function pickSpot(s: Companions, from: Point, range: [number, number], rng: Rng): Point {
  let spot: Point = from;
  for (let i = 0; i < 10; i++) {
    const ang = rng() * Math.PI * 2;
    const r = rand(rng, range[0], range[1]);
    spot = { x: from.x + Math.cos(ang) * r, y: from.y + Math.sin(ang) * r * 0.55 };
    if (inArea(spot) && s.sticks.every((g) => dist(g, spot) >= PLAY_TUNING.stickGap) && dist(s.dog, spot) >= PLAY_TUNING.dogGap) return spot;
  }
  // Nothing fitted (a cramped lawn): it lies where it would, and the oldest old stick fades to make room.
  fadeOldest(s);
  return clampArea(spot);
}

/**
 * Where a throw lands: `throwDist` from him, on the grass, as clear of the sticks already lying
 * there (and of Bestia, who drops hers) as the best of a few tries allows.
 */
function pickTarget(s: Companions, rng: Rng): Point {
  const p = s.paj;
  const [lo, hi] = PLAY_TUNING.throwDist;
  let best: Point | null = null;
  let bestClear = -1;
  let farthest: Point = p;
  for (let i = 0; i < 40; i++) {
    const t = { x: rand(rng, PLAY_AREA.x0, PLAY_AREA.x1), y: rand(rng, PLAY_AREA.y0, PLAY_AREA.y1) };
    const dd = dist(t, p);
    if (dist(t, p) > dist(farthest, p)) farthest = t;
    if (dd < lo || dd > hi) continue;
    const clear = Math.min(dist(t, s.dog) / 2, ...s.sticks.map((g) => dist(g, t)));
    if (clear >= PLAY_TUNING.stickGap) return t;
    if (clear > bestClear) {
      bestClear = clear;
      best = t;
    }
  }
  fadeOldest(s); // nothing landed clear of the others: the oldest old stick fades to make room
  return best ?? farthest;
}

/** Shortest distance from `p` to the segment a-b. */
function segDist(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

/**
 * Where she runs next: a far point on the grass, away from him, on a line that does not run past
 * his nose (she is never caught). Several are tried and the best-scoring one is taken.
 */
function chaseWaypoint(from: Point, chaser: Point, heading: Point, rng: Rng): Point {
  let best: Point = from;
  let bestScore = -Infinity;
  const T = PLAY_TUNING;
  // Near an edge (above all the car's side) she must head back into the lawn, not along the wall.
  const ex = from.x < PLAY_AREA.x0 + T.edgeMarginX ? 1 : from.x > PLAY_AREA.x1 - T.edgeMarginX ? -1 : 0;
  const ey = from.y < PLAY_AREA.y0 + T.edgeMarginY ? 1 : from.y > PLAY_AREA.y1 - T.edgeMarginY ? -1 : 0;
  const cornered = ex !== 0 || ey !== 0;
  for (let i = 0; i < 12; i++) {
    const wp = { x: rand(rng, PLAY_AREA.x0, PLAY_AREA.x1), y: rand(rng, PLAY_AREA.y0, PLAY_AREA.y1) };
    // No sharp reversals: she turns, she does not run back past him (but at an edge turning back is the point).
    const reverses = !cornered && (wp.x - from.x) * heading.x + (wp.y - from.y) * heading.y < 0;
    const inwards = (ex === 0 || (wp.x - from.x) * ex >= 40) && (ey === 0 || (wp.y - from.y) * ey >= 12);
    const score =
      dist(wp, chaser) + 0.6 * dist(wp, from) - (segDist(chaser, from, wp) < T.minGap + 8 ? 200 : 0) - (reverses ? 300 : 0) - (cornered && !inwards ? 500 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = wp;
    }
  }
  return best;
}

function go(pl: PlayState, phase: PlayPhase): void {
  pl.phase = phase;
  pl.phaseMs = 0;
}

/** Starts a throw: he winds up; the target and the stick follow. */
function enterThrow(pl: PlayState): void {
  go(pl, 'throw');
  pl.targeted = false;
  pl.thrown = false;
}

/** A round is over: count it, and say whether it was the last before the happy spin. */
function endRound(s: Companions, rng: Rng): void {
  const pl = s.play;
  pl.fetches++;
  pl.finalRound = pl.fetches >= 2 + Math.floor(rng() * 2);
}

/**
 * He walks only while he really goes somewhere: the walk frame follows his feet, not the phase he is in.
 * Every WALK_WINDOW_MS he must have got WALK_MIN_PX away from where he was (a creep or a shuffle does not
 * count), and the walk frame stays WALK_HOLD_MS after that, so a real stride never flickers.
 */
const WALK_HOLD_MS = 150;
const WALK_WINDOW_MS = 300;
const WALK_MIN_PX = 5;

function tickPlay(s: Companions, dtMs: number, rng: Rng): void {
  tickPlayPhase(s, dtMs, rng);
  const p = s.paj;
  const a = p.walkAnchor;
  a.ms += dtMs;
  if (dist(a, p) >= WALK_MIN_PX) {
    p.walkHoldMs = WALK_HOLD_MS;
    Object.assign(a, { x: p.x, y: p.y, ms: 0 });
  } else {
    p.walkHoldMs = Math.max(0, p.walkHoldMs - dtMs);
    if (a.ms >= WALK_WINDOW_MS) Object.assign(a, { x: p.x, y: p.y, ms: 0 });
  }
  if (p.shape === 'walk' && p.walkHoldMs === 0) p.shape = 'stand';
}

function tickPlayPhase(s: Companions, dtMs: number, rng: Rng): void {
  const pl = s.play;
  const p = s.paj;
  const d = s.dog;
  const T = PLAY_TUNING;
  pl.phaseMs += dtMs;
  switch (pl.phase) {
    case 'throw': {
      p.shape = 'throw';
      if (!pl.targeted) {
        pl.targeted = true;
        pl.target = pickTarget(s, rng);
        p.face = pl.target.x >= p.x ? 1 : -1;
      }
      // The moment the new stick leaves his hand she lets the old one go and races for it.
      if (!pl.thrown && pl.phaseMs > 350) {
        pl.thrown = true;
        dropCarried(s);
        d.hop = 0;
        s.stick.state = 'flying';
        s.stick.variant = stickVariantAt(pl.target);
        s.stick.x = p.x + p.face * 6;
        s.stick.y = p.y - 44;
      }
      if (s.stick.state === 'flying') {
        const t = Math.min(1, (pl.phaseMs - 350) / 900);
        const x0 = p.x + p.face * 6;
        s.stick.x = x0 + (pl.target.x - x0) * t;
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
      if (s.stick.state === 'carried') {
        d.shape = 'stand'; // still holding the old one until the new one leaves his hand
        holdStick(s);
      } else d.shape = d.path.length > 0 ? 'run' : 'sit';
      if (s.stick.state === 'ground' && d.path.length === 0 && dist(d, pl.target) < 4) {
        go(pl, 'bring');
        pl.giveBack = rng() < s.giveBackChance;
        holdStick(s);
      }
      break;
    }
    case 'bring': {
      // A proud trot, a slight bounce in time with the strides, the stick held at the snout. She
      // stops just out of his reach (or right at his feet in the rare round she gives it back).
      const done = pursue(d, p, DOG_RUN_SPEED, dtMs, pl.giveBack ? T.giveBackDist : T.keepDist);
      d.shape = done ? 'stand' : 'run';
      d.hop = done ? 0 : Math.abs(Math.sin(s.elapsed / 90 * (Math.PI / 2))) * 2;
      p.shape = 'stand';
      p.face = d.x >= p.x ? 1 : -1;
      holdStick(s);
      if (done) {
        if (pl.giveBack) {
          // She drops it at his feet; he is so surprised he says thank you.
          layStick(s, { x: p.x + p.face * T.stickStop, y: p.y }, 'spare', s.stick.variant);
          s.stick.state = 'hidden';
          endRound(s, rng);
          pajSay(s, GIVE_BACK_LINE);
          d.shape = 'sit';
          go(pl, 'drop');
        } else {
          go(pl, 'tease');
        }
      }
      break;
    }
    case 'tease': {
      // She stands there with the stick, tail going; he steps up to her.
      d.shape = 'stand';
      d.wagMs = 1 + pl.phaseMs;
      holdStick(s);
      const close = pursue(p, d, T.pajTeaseSpeed, dtMs, T.reachDist);
      p.shape = close ? 'stand' : 'walk';
      if (close || pl.phaseMs > T.teaseMaxMs) {
        // She dodges to the side, away from him: first the bow, then the hop.
        const vx = d.x - p.x;
        const vy = d.y - p.y;
        const len = Math.hypot(vx, vy) || 1;
        const px = -vy / len;
        const py = vx / len;
        const sign = rng() < 0.5 ? 1 : -1;
        const make = (sg: number): Point => ({ x: d.x + (vx / len) * T.dodgeAway + px * sg * T.dodgeSide, y: d.y + ((vy / len) * T.dodgeAway + py * sg * T.dodgeSide) * 0.6 });
        // The side with more room: a hop into the edge would be clamped short and leave her cornered.
        const room = (q: Point) => Math.min(q.x - PLAY_AREA.x0, PLAY_AREA.x1 - q.x, (q.y - PLAY_AREA.y0) * 2.5, (PLAY_AREA.y1 - q.y) * 2.5);
        let to = make(sign);
        const other = make(-sign);
        if (!inArea(to) || (room(to) < 12 && room(other) > room(to))) to = other;
        pl.hopFrom = { x: d.x, y: d.y };
        pl.hopTo = clampArea(to);
        pl.chaseMs = rand(rng, T.chaseMs[0], T.chaseMs[1]);
        d.wagMs = 0;
        go(pl, 'dodge');
      }
      break;
    }
    case 'dodge': {
      // Play-bow (front down, rump up), then a hop sideways with the stick; he lunges at where she was.
      const bow = T.dodgeBowMs;
      if (pl.phaseMs >= bow) {
        pursue(p, pl.hopFrom, 70, dtMs, 6); // he lunges at where she was
        // ...but never into her (a hop the edge cut short leaves her close).
        const gd = dist(p, d);
        if (gd < T.minGap && gd > 0) {
          p.x = d.x + ((p.x - d.x) / gd) * T.minGap;
          p.y = d.y + ((p.y - d.y) / gd) * T.minGap;
          Object.assign(p, clampArea(p));
        }
        p.shape = 'walk';
      } else p.shape = 'stand';
      if (pl.phaseMs < bow) {
        d.shape = 'bow';
        d.wagMs = 1 + pl.phaseMs;
        d.hop = 0;
        holdStick(s);
      } else {
        const t = Math.min(1, (pl.phaseMs - bow) / T.dodgeHopMs);
        d.wagMs = 0;
        d.shape = 'run';
        d.face = pl.hopTo.x >= pl.hopFrom.x ? 1 : -1;
        d.x = pl.hopFrom.x + (pl.hopTo.x - pl.hopFrom.x) * t;
        d.y = pl.hopFrom.y + (pl.hopTo.y - pl.hopFrom.y) * t;
        d.hop = Math.sin(Math.PI * t) * T.dodgeHopHeight;
        holdStick(s);
        if (t >= 1) {
          d.hop = 0;
          d.path = [chaseWaypoint(d, p, { x: d.x - p.x, y: d.y - p.y }, rng)];
          pl.nearMs = 0;
          pl.nearIn = rand(rng, T.nearMissEveryMs[0], T.nearMissEveryMs[1]);
          go(pl, 'keepAway');
        }
      }
      break;
    }
    case 'keepAway': {
      // She trots around the grass with the stick, a little ahead of him; now and then she slows and he nearly has her.
      if (pl.nearMs > 0) pl.nearMs = Math.max(0, pl.nearMs - dtMs);
      else {
        pl.nearIn -= dtMs;
        if (pl.nearIn <= 0) {
          pl.nearMs = T.nearMissMs;
          pl.nearIn = rand(rng, T.nearMissEveryMs[0], T.nearMissEveryMs[1]);
        }
      }
      // A waypoint he has walked up to would pin her against him: forget it and choose another.
      while (d.path.length > 0 && dist(d.path[0], p) < T.minGap + 8) d.path.shift();
      // The next turn is chosen before she gets to the corner, so she curves instead of stopping.
      if (d.path.length === 0) d.path = [chaseWaypoint(d, p, { x: d.x - p.x, y: d.y - p.y }, rng)];
      else if (d.path.length === 1 && dist(d, d.path[0]) < 45) d.path.push(chaseWaypoint(d.path[0], p, { x: d.path[0].x - d.x, y: d.path[0].y - d.y }, rng));
      const dFrom = { x: d.x, y: d.y };
      follow(d, pl.nearMs > 0 ? T.dogSlowSpeed : T.dogSpeed, dtMs);
      d.shape = 'run';
      d.hop = Math.abs(Math.sin(s.elapsed / 90 * (Math.PI / 2))) * 2;
      holdStick(s);
      const gap = dist(p, d);
      const speed = Math.min(T.pajMaxSpeed, T.pajBaseSpeed + Math.max(0, gap - 40) * T.pajCatchUp);
      pursue(p, d, speed, dtMs, T.minGap);
      p.shape = 'walk';
      // She is never caught: when he blocks her way she slides round him at the edge of his reach (the side
      // her waypoint is on, or the one with more room) instead of being pinned against him.
      const g2 = dist(p, d);
      if (g2 < T.minGap - 0.05 && g2 > 0) {
        // Where she was, not where she tried to go: sliding replaces that step instead of fighting it.
        const bl = dist(dFrom, p) || 1;
        const rx = (dFrom.x - p.x) / bl;
        const ry = (dFrom.y - p.y) / bl;
        const aim = d.path[0] ?? d;
        const arc = ((pl.nearMs > 0 ? T.dogSlowSpeed : T.dogSpeed) * dtMs) / 1000 / T.minGap;
        // The point `a` radians round him (sign = which way) at the edge of his reach.
        const around = (a: number): Point => {
          const ux = rx * Math.cos(a) - ry * Math.sin(a);
          const uy = rx * Math.sin(a) + ry * Math.cos(a);
          return { x: p.x + ux * T.minGap, y: p.y + uy * T.minGap };
        };
        /** How far a spot is off the lawn. */
        const off = (q: Point) => Math.hypot(q.x - clamp(q.x, PLAY_AREA.x0, PLAY_AREA.x1), q.y - clamp(q.y, PLAY_AREA.y0, PLAY_AREA.y1));
        // Which way round: the side with room to get past him (a quarter turn on), else the way her waypoint lies.
        const pass = (sg: number) => off(around(sg * 1.75));
        if (pl.slide === 0 || off(around(pl.slide * arc)) > 3) {
          const want: 1 | -1 = -ry * (aim.x - d.x) + rx * (aim.y - d.y) >= 0 ? 1 : -1;
          const [pw, po] = [pass(want), pass(-want)];
          pl.slide = po + 2 < pw ? (-want as 1 | -1) : want;
          if (Math.min(pw, po) > 8) d.path = []; // boxed in against the edge: a new way out is chosen
        }
        const at = (sg: number): Point => around(sg * arc);
        const away = clampArea(at(pl.slide));
        d.x = away.x;
        d.y = away.y;
        const g3 = dist(p, d);
        if (g3 < T.minGap && g3 > 0) {
          // She is cornered at the edge: he gives way a step.
          p.x = d.x + ((p.x - d.x) / g3) * T.minGap;
          p.y = d.y + ((p.y - d.y) / g3) * T.minGap;
          Object.assign(p, clampArea(p));
        }
      } else pl.slide = 0;
      if (pl.phaseMs >= pl.chaseMs) {
        // She trots off a few steps, pleased with herself.
        const gap = dist(p, d) || 1;
        d.path = [clampArea({ x: p.x + ((d.x - p.x) / gap) * T.giveUpDist, y: p.y + ((d.y - p.y) / gap) * T.giveUpDist })];
        d.hop = 0;
        p.shape = 'stand';
        endRound(s, rng);
        pajSay(s, pickLine(GIVE_UP_LINES, rng));
        // Another round: a spare stick lies on the grass for him to pick up.
        if (!pl.finalRound) layStick(s, pickSpot(s, p, T.spareDist, rng), 'spare');
        go(pl, 'giveUp');
      }
      break;
    }
    case 'giveUp': {
      // He stops, shrugs and speaks; she stands off, looking pleased with herself.
      p.shape = 'stand';
      p.face = d.x >= p.x ? 1 : -1;
      const trotting = !follow(d, DOG_RUN_SPEED * 0.6, dtMs);
      d.shape = trotting ? 'run' : 'stand';
      d.hop = trotting ? Math.abs(Math.sin(s.elapsed / 90 * (Math.PI / 2))) * 2 : 0;
      if (!trotting) {
        d.face = p.x >= d.x ? 1 : -1;
        d.wagMs = 1 + pl.phaseMs;
      }
      holdStick(s);
      if (pl.phaseMs >= T.giveUpMs) {
        d.wagMs = 0;
        if (pl.finalRound) {
          dropCarried(s);
          go(pl, 'spin');
        } else {
          const spare = s.sticks.find((g) => g.kind === 'spare');
          pl.stickSide = spare && spare.x < p.x ? -1 : 1;
          go(pl, 'toStick');
        }
      }
      break;
    }
    case 'toStick': {
      const spare = s.sticks.find((g) => g.kind === 'spare');
      d.shape = 'stand';
      holdStick(s);
      if (!spare) {
        go(pl, 'bend');
        break;
      }
      const there = pursue(p, { x: spare.x - pl.stickSide * T.stickStop, y: spare.y }, T.pajToStickSpeed, dtMs, 0);
      p.shape = there ? 'stand' : 'walk';
      if (there) {
        p.face = pl.stickSide;
        go(pl, 'bend');
      }
      break;
    }
    case 'bend': {
      // A short bend to the grass; the stick is in his hand at the end.
      p.shape = 'bend';
      if (s.stick.state === 'carried') {
        d.shape = 'stand';
        holdStick(s);
      } else d.shape = 'sit';
      if (pl.phaseMs - dtMs < T.bendTakeMs && pl.phaseMs >= T.bendTakeMs) {
        const spare = s.sticks.filter((g) => g.kind === 'spare').sort((a, b) => dist(a, p) - dist(b, p))[0];
        if (spare) s.sticks = s.sticks.filter((g) => g !== spare);
      }
      if (pl.phaseMs >= T.bendMs) enterThrow(pl);
      break;
    }
    case 'drop': {
      // She sits at his feet; the stick lies between them; he says thank you.
      d.shape = 'sit';
      p.shape = 'stand';
      p.face = d.x >= p.x ? 1 : -1;
      if (pl.phaseMs >= T.dropMs) {
        if (pl.finalRound) go(pl, 'spin');
        else go(pl, 'bend');
      }
      break;
    }
    case 'spin': {
      // Happy spin on the spot: the dog flips to face the other way SPIN_FLIPS times (two turns
      // around), hopping a little on each, tail wagging.
      p.shape = 'stand';
      if (pl.phaseMs <= dtMs) {
        pl.spinFace = d.face; // (first tick of the phase)
        settleSpares(s);
      }
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
        go(pl, 'rest');
        d.path = [{ x: p.x + 30, y: clamp(p.y + 4, PLAY_AREA.y0, PLAY_AREA.y1) }];
      }
      break;
    }
    case 'rest': {
      p.shape = 'stand';
      const done = follow(d, DOG_RUN_SPEED * 0.6, dtMs);
      d.shape = done ? 'sit' : 'run';
      if (pl.phaseMs > 4200) {
        // A fresh game: he finds a stick on the grass, bends, throws.
        pl.fetches = 0;
        pl.finalRound = false;
        s.stick.state = 'hidden';
        const spot = pickSpot(s, p, T.spareDist, rng);
        layStick(s, spot, 'spare');
        pl.stickSide = spot.x < p.x ? -1 : 1;
        go(pl, 'toStick');
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
