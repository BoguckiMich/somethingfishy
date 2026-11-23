import { nextCallDelayMs, type CallKind } from '../core/callSchedule';
import type { Rng } from '../core/random';
import { vary } from '../core/variation';
import type { AudioGraph } from './AudioEngine';
import { tone } from './synth';

export const AMBIENT_LAYERS = ['water', 'birds', 'frogs', 'crickets'] as const;
export type AmbientLayer = (typeof AMBIENT_LAYERS)[number];
export type LayerGains = Record<AmbientLayer, number>;

/** Loudness of each layer at gain 1: the ambience sits well under the effects. */
const LEVEL: LayerGains = { water: 0.28, birds: 0.5, frogs: 0.42, crickets: 0.05 };
/** Seconds the layer gains take to follow the time of day (a smooth crossfade). */
const FADE_TC = 1.2;
/** A call is skipped when its layer is quieter than this. */
const AUDIBLE = 0.03;

/**
 * The ambient bed: a constant water texture, a pulsed cricket texture (both continuous), and
 * randomly spaced bird and frog calls (see core/callSchedule). Each layer has its own gain node;
 * `setTargets` moves them smoothly.
 */
export class AmbientBed {
  private layers = {} as Record<AmbientLayer, GainNode>;
  private targets: LayerGains = { water: 0, birds: 0, frogs: 0, crickets: 0 };
  private frogFilter: BiquadFilterNode;
  private sources: (AudioScheduledSourceNode | undefined)[] = [];
  private timers: Partial<Record<CallKind, ReturnType<typeof setTimeout>>> = {};
  private stopped = false;

  constructor(
    private g: AudioGraph,
    private rng: Rng = Math.random,
  ) {
    const { ctx } = g;
    for (const l of AMBIENT_LAYERS) {
      const node = ctx.createGain();
      node.gain.value = 0;
      node.connect(g.ambBus);
      this.layers[l] = node;
    }
    this.frogFilter = ctx.createBiquadFilter();
    this.frogFilter.type = 'lowpass';
    this.frogFilter.frequency.value = 650;
    this.frogFilter.connect(this.layers.frogs);

    this.buildWater();
    this.buildCrickets();
    this.schedule('birds');
    this.schedule('frogs');
  }

  /** Gains 0..1 per layer (the ambient mix, or a solo choice); eased in over about a second. */
  setTargets(t: LayerGains): void {
    this.targets = { ...t };
    const now = this.g.ctx.currentTime;
    for (const l of AMBIENT_LAYERS) this.layers[l].gain.setTargetAtTime(t[l] * LEVEL[l], now, FADE_TC);
  }

  stop(): void {
    this.stopped = true;
    for (const k of Object.keys(this.timers) as CallKind[]) clearTimeout(this.timers[k]);
    for (const s of this.sources) {
      try {
        s?.stop();
      } catch {
        // already stopped
      }
    }
  }

  /** Lapping: two slowly breathing bands of looped noise. */
  private buildWater(): void {
    const { ctx } = this.g;
    const loop = (): AudioBufferSourceNode => {
      const src = ctx.createBufferSource();
      src.buffer = this.g.noise;
      src.loop = true;
      src.start(0, this.rng() * 1.5);
      this.sources.push(src);
      return src;
    };
    const lfo = (hz: number, depth: number, target: AudioParam): void => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      const amount = ctx.createGain();
      amount.gain.value = depth;
      osc.connect(amount).connect(target);
      osc.start();
      this.sources.push(osc);
    };

    // Body of the lap: dark noise swelling and ebbing.
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 420;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.55;
    lfo(0.11, 0.3, bodyGain.gain);
    lfo(0.29, 0.15, bodyGain.gain);
    loop().connect(body).connect(bodyGain).connect(this.layers.water);

    // A faint brighter wash that comes and goes a little out of step.
    const wash = ctx.createBiquadFilter();
    wash.type = 'bandpass';
    wash.frequency.value = 1300;
    wash.Q.value = 0.6;
    const washGain = ctx.createGain();
    washGain.gain.value = 0.12;
    lfo(0.19, 0.1, washGain.gain);
    lfo(0.43, 0.05, washGain.gain);
    loop().connect(wash).connect(washGain).connect(this.layers.water);
  }

  /** Crickets: two detuned voices, each chirping in grouped pulses (fast pulse x slow phrase). */
  private buildCrickets(): void {
    const { ctx } = this.g;
    const voice = (hz: number, pulseHz: number, phraseHz: number, level: number): void => {
      const carrier = ctx.createOscillator();
      carrier.frequency.value = hz;
      const pulse = ctx.createGain();
      pulse.gain.value = 0.5; // 0.5 + 0.5 * sine = 0..1
      const phrase = ctx.createGain();
      phrase.gain.value = 0.5;
      const out = ctx.createGain();
      out.gain.value = level;
      for (const [rate, target] of [[pulseHz, pulse.gain], [phraseHz, phrase.gain]] as const) {
        const osc = ctx.createOscillator();
        osc.frequency.value = rate;
        const depth = ctx.createGain();
        depth.gain.value = 0.5;
        osc.connect(depth).connect(target);
        osc.start();
        this.sources.push(osc);
      }
      carrier.connect(pulse).connect(phrase).connect(out).connect(this.layers.crickets);
      carrier.start();
      this.sources.push(carrier);
    };
    voice(4300, 17, 1.1, 0.6);
    voice(3850, 13, 0.8, 0.5);
  }

  private schedule(kind: CallKind): void {
    if (this.stopped) return;
    this.timers[kind] = setTimeout(() => {
      if (this.targets[kind] > AUDIBLE && this.g.ctx.state === 'running') this.call(kind);
      this.schedule(kind);
    }, nextCallDelayMs(kind, this.rng));
  }

  /** One bird song or frog croak, with its own random pitch and length. */
  private call(kind: CallKind): void {
    const { ctx } = this.g;
    const v = vary(this.rng, 0.12);
    const t = ctx.currentTime + 0.02;
    if (kind === 'birds') {
      const dest = this.layers.birds;
      const base = (2400 + this.rng() * 1600) * v.pitch;
      const notes = 2 + Math.floor(this.rng() * 4);
      let at = 0;
      for (let i = 0; i < notes; i++) {
        const f0 = base * (0.9 + this.rng() * 0.3);
        const dur = 0.07 + this.rng() * 0.06;
        const rising = this.rng() > 0.4;
        tone(this.g, dest, t, { f0, f1: f0 * (rising ? 1.25 : 0.8), at, dur, attack: 0.012, peak: 0.3 * v.volume });
        at += dur + 0.03 + this.rng() * 0.05;
      }
    } else {
      const pulses = 2 + Math.floor(this.rng() * 2);
      const base = (150 + this.rng() * 70) * v.pitch;
      for (let i = 0; i < pulses; i++) {
        tone(this.g, this.frogFilter, t, { type: 'triangle', f0: base, f1: base * 1.45, at: i * 0.15, dur: 0.12, attack: 0.02, peak: 0.45 * v.volume });
        tone(this.g, this.frogFilter, t, { type: 'sine', f0: base * 2.03, f1: base * 2.9, at: i * 0.15, dur: 0.1, attack: 0.02, peak: 0.12 * v.volume });
      }
    }
  }
}
