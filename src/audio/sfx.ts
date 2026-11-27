import type { Variation } from '../core/variation';
import type { AudioGraph } from './AudioEngine';
import { burst, tone } from './synth';

/** Every sound effect the game makes (GAME_DESIGN section 3, item 9). */
export const SFX_NAMES = [
  'cast',
  'plop',
  'nibble',
  'bite',
  'hook',
  'reel',
  'slack',
  'catch',
  'fanfare',
  'coin',
  'tap',
  'boof',
  'quack',
  'chirp',
  'sparkle',
  'clink',
  'bubbles',
  'thunk',
  'sleepyBoof',
  'trophy',
  'medal',
  'creak',
] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export interface SfxOptions {
  /** Cast power 0..1: a harder cast makes a higher, louder whoosh. */
  charge?: number;
}

/** Equal-tempered note frequency: A4 = 440 Hz, `n` semitones away. */
const note = (n: number) => 440 * 2 ** (n / 12);
// C major pentatonic-ish helpers (semitones from A4): C5 = 3, E5 = 7, G5 = 10, C6 = 15.
const C5 = note(3);
const E5 = note(7);
const G5 = note(10);
const C6 = note(15);
const E6 = note(19);

type Player = (g: AudioGraph, out: AudioNode, t: number, v: Variation, o: SfxOptions) => void;

/** A soft two-partial bell note used by the jingles. Pitch variation moves the whole tune together. */
function bell(g: AudioGraph, out: AudioNode, t: number, at: number, hz: number, dur: number, peak: number, v: Variation): void {
  tone(g, out, t, { type: 'triangle', f0: hz * v.pitch, at, dur, attack: 0.008, peak: peak * v.volume });
  tone(g, out, t, { type: 'sine', f0: hz * 2 * v.pitch, at, dur: dur * 0.6, attack: 0.008, peak: peak * 0.3 * v.volume });
}

const PLAYERS: Record<SfxName, Player> = {
  // A breathy sweep: bandpassed noise rising then falling. Higher and louder for a harder cast.
  cast: (g, out, t, v, o) => {
    const c = Math.min(1, Math.max(0, o.charge ?? 0.5));
    const base = (450 + 1100 * c) * v.pitch;
    burst(g, out, t, { filter: 'bandpass', f0: base, f1: base * 2.6, q: 1.2, dur: 0.16, attack: 0.04, peak: (0.16 + 0.22 * c) * v.volume });
    burst(g, out, t, { filter: 'bandpass', f0: base * 2.6, f1: base * 0.8, q: 1.2, at: 0.15, dur: 0.3, attack: 0.02, peak: (0.14 + 0.16 * c) * v.volume });
  },
  // A droplet: a quick falling sine plus a little splash of noise.
  plop: (g, out, t, v) => {
    tone(g, out, t, { f0: 700 * v.pitch, f1: 190 * v.pitch, dur: 0.16, attack: 0.005, peak: 0.42 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 1800 * v.pitch, q: 0.7, dur: 0.12, peak: 0.16 * v.volume });
  },
  // A tiny wooden tick.
  nibble: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: 1500 * v.pitch, f1: 1100 * v.pitch, dur: 0.05, attack: 0.004, peak: 0.16 * v.volume });
  },
  // A friendly rising "!" (two soft notes), clearly louder than the nibble.
  bite: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: note(12) * v.pitch, at: 0, dur: 0.11, attack: 0.006, peak: 0.34 * v.volume });
    tone(g, out, t, { type: 'triangle', f0: note(19) * v.pitch, at: 0.09, dur: 0.2, attack: 0.006, peak: 0.36 * v.volume });
    tone(g, out, t, { type: 'sine', f0: note(31) * v.pitch, at: 0.09, dur: 0.12, attack: 0.006, peak: 0.07 * v.volume });
  },
  // The hook strike: a snap of noise over a short thump.
  hook: (g, out, t, v) => {
    burst(g, out, t, { filter: 'highpass', f0: 1400 * v.pitch, q: 0.7, dur: 0.07, attack: 0.004, peak: 0.34 * v.volume });
    tone(g, out, t, { f0: 210 * v.pitch, f1: 90 * v.pitch, dur: 0.15, attack: 0.005, peak: 0.45 * v.volume });
  },
  // One ratchet click of the reel; called repeatedly while reeling.
  reel: (g, out, t, v) => {
    burst(g, out, t, { filter: 'bandpass', f0: 2600 * v.pitch, q: 3, dur: 0.03, attack: 0.004, peak: 0.2 * v.volume });
    tone(g, out, t, { type: 'triangle', f0: 900 * v.pitch, f1: 600 * v.pitch, dur: 0.03, attack: 0.004, peak: 0.07 * v.volume });
  },
  // The line going limp: a sagging tone and a soft breath of noise.
  slack: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: 440 * v.pitch, f1: 150 * v.pitch, dur: 0.5, attack: 0.02, peak: 0.26 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 1400 * v.pitch, f1: 300 * v.pitch, q: 0.8, dur: 0.4, attack: 0.03, peak: 0.1 * v.volume });
  },
  // Short happy arpeggio.
  catch: (g, out, t, v) => {
    bell(g, out, t, 0, C5, 0.16, 0.26, v);
    bell(g, out, t, 0.1, E5, 0.16, 0.26, v);
    bell(g, out, t, 0.2, G5, 0.16, 0.26, v);
    bell(g, out, t, 0.3, C6, 0.45, 0.3, v);
  },
  // The longer jingle for new species / records: a little melody with a held, sparkly end.
  fanfare: (g, out, t, v) => {
    const tune: [number, number, number][] = [
      [0, C5, 0.14],
      [0.12, E5, 0.14],
      [0.24, G5, 0.14],
      [0.36, C6, 0.2],
      [0.56, G5, 0.14],
      [0.68, C6, 0.16],
      [0.82, E6, 0.7],
    ];
    for (const [at, hz, dur] of tune) bell(g, out, t, at, hz, dur, 0.28, v);
    bell(g, out, t, 0.82, C6, 0.7, 0.16, v);
  },
  // The trophy stinger (a rare fish on the board): slow and warm, a low rising call (G4 C5 E5 G5) answered by a full, held C major chord
  // with a soft shimmer of high pings on top. Longer and lower than the fanfare, so a trophy never sounds like a new species.
  trophy: (g, out, t, v) => {
    const call: [number, number][] = [[0, note(-2)], [0.2, note(3)], [0.4, note(7)], [0.6, note(10)]];
    for (const [at, hz] of call) bell(g, out, t, at, hz, 0.3, 0.26, v);
    for (const hz of [C5, E5, G5, C6]) bell(g, out, t, 0.95, hz, 1.3, 0.17, v);
    bell(g, out, t, 0.95, note(-9), 1.4, 0.2, v); // a C4 underneath for warmth
    [note(34), note(38), note(41), note(46)].forEach((hz, i) => tone(g, out, t, { f0: hz * v.pitch, at: 1.05 + i * 0.12, dur: 0.4, attack: 0.004, peak: 0.05 * v.volume }));
  },
  // The medal stinger (a perfect gold catch): a quick bright "ding-ding-DING!" a fifth higher than the catch jingle, struck like a
  // metal medal (inharmonic partials), ringing out.
  medal: (g, out, t, v) => {
    const strike = (at: number, hz: number, peak: number, ring: number) => {
      tone(g, out, t, { f0: hz * v.pitch, at, dur: ring, attack: 0.002, peak: peak * v.volume });
      tone(g, out, t, { f0: hz * 2.76 * v.pitch, at, dur: ring * 0.45, attack: 0.002, peak: peak * 0.4 * v.volume });
      tone(g, out, t, { f0: hz * 5.4 * v.pitch, at, dur: ring * 0.2, attack: 0.002, peak: peak * 0.15 * v.volume });
    };
    strike(0, C6, 0.2, 0.3);
    strike(0.11, E6, 0.2, 0.3);
    strike(0.22, note(22), 0.24, 1.1);
    burst(g, out, t, { filter: 'highpass', f0: 6000, q: 0.7, at: 0.22, dur: 0.06, attack: 0.002, peak: 0.05 * v.volume });
  },
  // Two bright, ringing partials with a quick strike.
  coin: (g, out, t, v) => {
    tone(g, out, t, { f0: 1760 * v.pitch, dur: 0.28, attack: 0.004, peak: 0.2 * v.volume });
    tone(g, out, t, { f0: 2637 * v.pitch, at: 0.045, dur: 0.4, attack: 0.004, peak: 0.18 * v.volume });
    tone(g, out, t, { f0: 5274 * v.pitch, at: 0.045, dur: 0.14, attack: 0.004, peak: 0.04 * v.volume });
  },
  // A soft wooden tap.
  tap: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: 640 * v.pitch, f1: 420 * v.pitch, dur: 0.07, attack: 0.004, peak: 0.22 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 1500, dur: 0.03, attack: 0.004, peak: 0.05 * v.volume });
  },
  // A dog's "boof": a low voiced thump with breath.
  boof: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: 230 * v.pitch, f1: 105 * v.pitch, dur: 0.17, attack: 0.012, peak: 0.38 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 700 * v.pitch, f1: 300, q: 0.9, dur: 0.14, attack: 0.012, peak: 0.2 * v.volume });
  },
  // A car door closing softly: a low, short body thump with a faint latch click after it.
  thunk: (g, out, t, v) => {
    tone(g, out, t, { type: 'sine', f0: 140 * v.pitch, f1: 62 * v.pitch, dur: 0.16, attack: 0.006, peak: 0.42 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 520 * v.pitch, f1: 200, q: 0.7, dur: 0.1, attack: 0.005, peak: 0.22 * v.volume });
    tone(g, out, t, { type: 'triangle', f0: 1100 * v.pitch, f1: 800 * v.pitch, at: 0.07, dur: 0.035, attack: 0.004, peak: 0.07 * v.volume });
  },
  // The ferry rope creaking by itself (slice 25f): a low, slow sawtooth groan that wavers, with a dry rasp of rubbing fibres on top.
  creak: (g, out, t, v) => {
    tone(g, out, t, { type: 'sawtooth', f0: 96 * v.pitch, f1: 132 * v.pitch, dur: 0.9, attack: 0.18, peak: 0.07 * v.volume });
    tone(g, out, t, { type: 'sawtooth', f0: 132 * v.pitch, f1: 88 * v.pitch, at: 0.85, dur: 0.8, attack: 0.12, peak: 0.06 * v.volume });
    tone(g, out, t, { type: 'triangle', f0: 205 * v.pitch, f1: 250 * v.pitch, at: 0.3, dur: 0.7, attack: 0.2, peak: 0.03 * v.volume });
    burst(g, out, t, { filter: 'bandpass', f0: 1150 * v.pitch, f1: 700, q: 6, dur: 1.6, attack: 0.3, peak: 0.05 * v.volume });
  },
  // A dog's boof in her sleep: lower, softer and slower than the awake one, with a sigh of breath.
  sleepyBoof: (g, out, t, v) => {
    tone(g, out, t, { type: 'triangle', f0: 170 * v.pitch, f1: 85 * v.pitch, dur: 0.26, attack: 0.04, peak: 0.16 * v.volume });
    burst(g, out, t, { filter: 'lowpass', f0: 500 * v.pitch, f1: 220, q: 0.8, at: 0.05, dur: 0.3, attack: 0.07, peak: 0.1 * v.volume });
  },
  // A duck's "quack-quack": each is a buzzy saw voice (~460 Hz bending down to ~330) with its octave
  // above and a nasal band of noise around 1.7 kHz; the second is a touch lower and softer.
  quack: (g, out, t, v) => {
    const one = (at: number, hz: number, k: number) => {
      tone(g, out, t, { type: 'sawtooth', f0: hz * v.pitch, f1: hz * 0.7 * v.pitch, at, dur: 0.12, attack: 0.014, peak: 0.085 * k * v.volume });
      tone(g, out, t, { type: 'sawtooth', f0: hz * 2 * v.pitch, f1: hz * 1.4 * v.pitch, at, dur: 0.1, attack: 0.014, peak: 0.03 * k * v.volume });
      burst(g, out, t, { filter: 'bandpass', f0: 1700 * v.pitch, q: 3, at, dur: 0.1, attack: 0.012, peak: 0.06 * k * v.volume });
    };
    one(0, 460, 1);
    one(0.17, 420, 0.75);
  },
  // A kingfisher's "tsee-tsee": two thin, high, quick chirps, each sliding down a little.
  chirp: (g, out, t, v) => {
    [0, 0.12].forEach((at, i) => {
      tone(g, out, t, { f0: (4300 - i * 300) * v.pitch, f1: 3300 * v.pitch, at, dur: 0.08, attack: 0.006, peak: 0.07 * v.volume });
    });
  },
  // A wish coming true: a quick rising run of tiny high bells.
  sparkle: (g, out, t, v) => {
    const run = [note(22), note(26), note(29), note(34), note(38)];
    run.forEach((hz, i) => {
      tone(g, out, t, { f0: hz * v.pitch, at: i * 0.055, dur: 0.22, attack: 0.004, peak: (0.1 + i * 0.012) * v.volume });
    });
    tone(g, out, t, { f0: note(41) * v.pitch, at: 0.28, dur: 0.5, attack: 0.004, peak: 0.07 * v.volume });
  },
  // Glass on glass: a bright short ping (~2.9 kHz plus an inharmonic partial), then a second, softer one.
  clink: (g, out, t, v) => {
    const ping = (at: number, hz: number, k: number) => {
      tone(g, out, t, { f0: hz * v.pitch, at, dur: 0.22, attack: 0.002, peak: 0.13 * k * v.volume });
      tone(g, out, t, { f0: hz * 1.5 * v.pitch, at, dur: 0.12, attack: 0.002, peak: 0.06 * k * v.volume });
    };
    ping(0, 2900, 1);
    ping(0.11, 3400, 0.45);
    burst(g, out, t, { filter: 'highpass', f0: 3500, q: 0.7, dur: 0.02, attack: 0.002, peak: 0.05 * v.volume });
  },
  // A handful of little bloops rising from below.
  bubbles: (g, out, t, v) => {
    const bloops: [number, number, number][] = [[0, 320, 0.2], [0.09, 420, 0.16], [0.19, 360, 0.2], [0.3, 520, 0.14], [0.4, 440, 0.12]];
    for (const [at, hz, peak] of bloops) {
      tone(g, out, t, { f0: hz * v.pitch, f1: hz * 2.1 * v.pitch, at, dur: 0.08, attack: 0.006, peak: peak * v.volume });
    }
  },
};

/** Plays one effect now on the given output node. */
export function playSfx(g: AudioGraph, name: SfxName, v: Variation, o: SfxOptions = {}): void {
  PLAYERS[name](g, g.sfxBus, g.ctx.currentTime + 0.005, v, o);
}
