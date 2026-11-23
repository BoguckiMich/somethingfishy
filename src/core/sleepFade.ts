/**
 * The gentle fade to black while Alex sleeps (bedtime without the night kit, and naps): fade out
 * with "Time for bed...", the clock jumps in the dark, the line changes to "Good morning!", fade in.
 * Pure: `tickSleepFade` says when the scene must jump the clock; `fadeView` says what to draw.
 */
export const SLEEP_FADE = { outMs: 1800, holdMs: 2000, inMs: 1800, jumpAtMs: 900 } as const;

export interface SleepFade {
  phase: 'out' | 'hold' | 'in';
  /** Ms in the current phase. */
  ms: number;
  sleepText: string;
  wakeText: string;
  jumped: boolean;
}

export function newSleepFade(sleepText: string, wakeText: string): SleepFade {
  return { phase: 'out', ms: 0, sleepText, wakeText, jumped: false };
}

export interface FadeTick {
  fade: SleepFade;
  /** True once, on the tick the screen is dark and the line changes: jump the clock now. */
  jump: boolean;
  /** True on the tick the fade-in has finished. */
  done: boolean;
}

export function tickSleepFade(f: SleepFade, dtMs: number): FadeTick {
  let { phase, ms, jumped } = f;
  ms += dtMs;
  let jump = false;
  let done = false;
  if (phase === 'out' && ms >= SLEEP_FADE.outMs) {
    ms -= SLEEP_FADE.outMs;
    phase = 'hold';
  }
  if (phase === 'hold') {
    if (!jumped && ms >= SLEEP_FADE.jumpAtMs) {
      jumped = true;
      jump = true;
    }
    if (ms >= SLEEP_FADE.holdMs) {
      ms -= SLEEP_FADE.holdMs;
      phase = 'in';
    }
  }
  if (phase === 'in' && ms >= SLEEP_FADE.inMs) {
    ms = SLEEP_FADE.inMs;
    done = true;
  }
  return { fade: { ...f, phase, ms, jumped }, jump, done };
}

export interface FadeView {
  /** Black cover opacity 0..1. */
  alpha: number;
  text: string;
  /** Text opacity 0..1. */
  textAlpha: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function fadeView(f: SleepFade): FadeView {
  const { outMs, inMs, jumpAtMs } = SLEEP_FADE;
  if (f.phase === 'out') {
    const t = f.ms / outMs;
    return { alpha: clamp01(t), text: f.sleepText, textAlpha: clamp01((t - 0.35) / 0.65) };
  }
  if (f.phase === 'hold') {
    const wake = f.ms >= jumpAtMs;
    // The new line fades in over the first 400 ms after the swap.
    return { alpha: 1, text: wake ? f.wakeText : f.sleepText, textAlpha: wake ? clamp01((f.ms - jumpAtMs) / 400) : 1 };
  }
  const t = f.ms / inMs;
  return { alpha: clamp01(1 - t), text: f.wakeText, textAlpha: clamp01(1 - t * 1.4) };
}
