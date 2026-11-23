import type { AudioGraph } from './AudioEngine';

/** Small building blocks shared by the sfx and the ambient calls: a pitched tone and a noise burst. */

export interface ToneSpec {
  type?: OscillatorType;
  /** Start frequency in Hz (already scaled by the caller's pitch variation if wanted). */
  f0: number;
  /** Frequency at the end of the tone (exponential glide); omit for a steady pitch. */
  f1?: number;
  /** Seconds after `when`. */
  at?: number;
  /** Total length in seconds (attack + decay). */
  dur: number;
  /** Seconds to rise to the peak; keep >= 4 ms to avoid clicks. */
  attack?: number;
  peak: number;
}

const FLOOR = 0.0001;

/** A single oscillator with a click-free attack/decay envelope, routed to `dest`. */
export function tone(g: AudioGraph, dest: AudioNode, when: number, s: ToneSpec): void {
  const { ctx } = g;
  const t0 = when + (s.at ?? 0);
  const attack = Math.max(0.004, s.attack ?? 0.008);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = s.type ?? 'sine';
  osc.frequency.setValueAtTime(s.f0, t0);
  if (s.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1), t0 + s.dur);
  env.gain.setValueAtTime(FLOOR, t0);
  env.gain.linearRampToValueAtTime(Math.max(FLOOR, s.peak), t0 + attack);
  env.gain.exponentialRampToValueAtTime(FLOOR, t0 + s.dur);
  osc.connect(env).connect(dest);
  osc.start(t0);
  osc.stop(t0 + s.dur + 0.03);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

export interface BurstSpec {
  filter: BiquadFilterType;
  f0: number;
  /** Optional glide of the filter frequency over the burst. */
  f1?: number;
  q?: number;
  at?: number;
  dur: number;
  attack?: number;
  peak: number;
}

/** A burst of filtered white noise with a click-free envelope. */
export function burst(g: AudioGraph, dest: AudioNode, when: number, s: BurstSpec): void {
  const { ctx } = g;
  const t0 = when + (s.at ?? 0);
  const attack = Math.max(0.004, s.attack ?? 0.006);
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = s.filter;
  filter.Q.value = s.q ?? 1;
  filter.frequency.setValueAtTime(s.f0, t0);
  if (s.f1 !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1), t0 + s.dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(FLOOR, t0);
  env.gain.linearRampToValueAtTime(Math.max(FLOOR, s.peak), t0 + attack);
  env.gain.exponentialRampToValueAtTime(FLOOR, t0 + s.dur);
  src.connect(filter).connect(env).connect(dest);
  // Start somewhere inside the 2 s buffer so no two bursts are the same hiss.
  src.start(t0, Math.random() * (g.noise.duration - s.dur - 0.1), s.dur + 0.05);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    env.disconnect();
  };
}
