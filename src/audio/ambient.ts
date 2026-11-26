import { nextCallDelayMs, type CallKind } from '../core/callSchedule';
import type { Rng } from '../core/random';
import { vary } from '../core/variation';
import type { AudioGraph } from './AudioEngine';
import { burst, tone } from './synth';

export const AMBIENT_LAYERS = ['water', 'birds', 'frogs', 'crickets', 'drone', 'rain', 'wind', 'fire'] as const;
export type AmbientLayer = (typeof AMBIENT_LAYERS)[number];
export type LayerGains = Record<AmbientLayer, number>;

/** Loudness of each layer at gain 1: the ambience sits well under the effects. */
const LEVEL: LayerGains = { water: 0.28, birds: 0.5, frogs: 0.42, crickets: 0.05, drone: 0.5, rain: 0.4, wind: 0.36, fire: 0.42 };
/** Seconds the layer gains take to follow the time of day (a smooth crossfade). */
const FADE_TC = 1.2;
/** The drone swells in and out more slowly than the rest (seconds). */
const DRONE_FADE_TC = 2.2;
/** Rain and wind come and go slowly, like the weather's own 10 s crossfade (seconds). */
const WEATHER_FADE_TC = 2.5;
/** The layer whose gain says whether a scheduled event is worth playing. */
const EVENT_LAYER: Record<CallKind, AmbientLayer> = { birds: 'birds', frogs: 'frogs', drops: 'rain', crackle: 'fire' };
/** A call is skipped when its layer is quieter than this. */
const AUDIBLE = 0.03;

/**
 * The ambient bed: a constant water texture, a pulsed cricket texture (both continuous), and
 * randomly spaced bird and frog calls (see core/callSchedule). Each layer has its own gain node;
 * `setTargets` moves them smoothly.
 */
export class AmbientBed {
  private layers = {} as Record<AmbientLayer, GainNode>;
  private targets: LayerGains = { water: 0, birds: 0, frogs: 0, crickets: 0, drone: 0, rain: 0, wind: 0, fire: 0 };
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
    // A throaty formant: the buzz of the pulses rings around 1 kHz instead of a dull low "boing".
    this.frogFilter.type = 'bandpass';
    this.frogFilter.frequency.value = 1000;
    this.frogFilter.Q.value = 1.4;
    this.frogFilter.connect(this.layers.frogs);

    this.buildWater();
    this.buildCrickets();
    this.buildDrone();
    this.buildRain();
    this.buildWind();
    this.buildFire();
    this.schedule('birds');
    this.schedule('frogs');
    this.schedule('drops');
    this.schedule('crackle');
  }

  /** Gains 0..1 per layer (the ambient mix, or a solo choice); eased in over about a second. */
  setTargets(t: LayerGains): void {
    this.targets = { ...t };
    const now = this.g.ctx.currentTime;
    for (const l of AMBIENT_LAYERS) this.layers[l].gain.setTargetAtTime(t[l] * LEVEL[l], now, l === 'drone' ? DRONE_FADE_TC : l === 'rain' || l === 'wind' ? WEATHER_FADE_TC : FADE_TC);
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
    // Lowered from ~4 kHz (it read as a whine on a phone speaker) to a softer tree-cricket range.
    voice(2150, 24, 1.2, 0.6);
    voice(1880, 20, 0.85, 0.45);
  }

  /**
   * The Pale One's drone: two sawtooth voices a hair apart (a slow beating around 55 Hz), a sine a
   * fifth and an octave up, all through a lowpass whose cutoff drifts, plus a breath of dark noise.
   * The saw harmonics keep it audible on a phone speaker, where the fundamental alone would vanish.
   */
  private buildDrone(): void {
    const { ctx } = this.g;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 2.2;
    const swell = ctx.createGain();
    swell.gain.value = 0.7;
    filter.connect(swell).connect(this.layers.drone);

    const lfo = (hz: number, depth: number, target: AudioParam): void => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      const amount = ctx.createGain();
      amount.gain.value = depth;
      osc.connect(amount).connect(target);
      osc.start();
      this.sources.push(osc);
    };
    lfo(0.06, 90, filter.frequency); // the cutoff slowly opens and closes
    lfo(0.11, 0.25, swell.gain); // and the whole thing breathes

    const voice = (type: OscillatorType, hz: number, level: number): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = hz;
      const gain = ctx.createGain();
      gain.gain.value = level;
      osc.connect(gain).connect(filter);
      osc.start();
      this.sources.push(osc);
    };
    voice('sawtooth', 55, 0.5);
    voice('sawtooth', 55.6, 0.5);
    voice('sine', 82.4, 0.35);
    voice('sine', 110.9, 0.18);

    const src = ctx.createBufferSource();
    src.buffer = this.g.noise;
    src.loop = true;
    src.start(0, this.rng() * 1.5);
    this.sources.push(src);
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 160;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.5;
    src.connect(rumble).connect(rumbleGain).connect(this.layers.drone);
  }

  /** A looping slice of the shared noise, started somewhere inside it. */
  private noiseLoop(): AudioBufferSourceNode {
    const src = this.g.ctx.createBufferSource();
    src.buffer = this.g.noise;
    src.loop = true;
    src.start(0, this.rng() * 1.5);
    this.sources.push(src);
    return src;
  }

  /** A slow oscillator that moves `target` by +-`depth`. */
  private wobble(hz: number, depth: number, target: AudioParam): void {
    const osc = this.g.ctx.createOscillator();
    osc.frequency.value = hz;
    const amount = this.g.ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(target);
    osc.start();
    this.sources.push(osc);
  }

  /** Rain: a steady hiss, a brighter shimmer that swells and ebbs, and a dull patter on the lake (the droplets are scheduled in `call`). */
  private buildRain(): void {
    const { ctx } = this.g;
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 700;
    const hissTop = ctx.createBiquadFilter();
    hissTop.type = 'lowpass';
    hissTop.frequency.value = 7000;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.42;
    this.wobble(0.13, 0.08, hissGain.gain);
    this.noiseLoop().connect(hiss).connect(hissTop).connect(hissGain).connect(this.layers.rain);

    const shimmer = ctx.createBiquadFilter();
    shimmer.type = 'bandpass';
    shimmer.frequency.value = 3200;
    shimmer.Q.value = 0.5;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.2;
    this.wobble(0.21, 0.08, shimmerGain.gain);
    this.noiseLoop().connect(shimmer).connect(shimmerGain).connect(this.layers.rain);

    const patter = ctx.createBiquadFilter();
    patter.type = 'lowpass';
    patter.frequency.value = 380;
    const patterGain = ctx.createGain();
    patterGain.gain.value = 0.3;
    this.noiseLoop().connect(patter).connect(patterGain).connect(this.layers.rain);
  }

  /** Wind: two band-passed noises whose centre frequencies drift slowly and whose loudness gusts, out of step. */
  private buildWind(): void {
    const { ctx } = this.g;
    const band = (hz: number, q: number, level: number, driftHz: number, drift: number, gustHz: number, gust: number): void => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = hz;
      filter.Q.value = q;
      this.wobble(driftHz, drift, filter.frequency);
      const gain = ctx.createGain();
      gain.gain.value = level;
      this.wobble(gustHz, gust, gain.gain);
      this.noiseLoop().connect(filter).connect(gain).connect(this.layers.wind);
    };
    band(420, 2.4, 0.6, 0.07, 160, 0.05, 0.3);
    band(900, 1.6, 0.3, 0.11, 280, 0.083, 0.16);
  }

  /** The fire's low, soft roar under the crackles (the snaps are scheduled in `call`). */
  private buildFire(): void {
    const { ctx } = this.g;
    const roar = ctx.createBiquadFilter();
    roar.type = 'bandpass';
    roar.frequency.value = 230;
    roar.Q.value = 0.7;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.3;
    this.wobble(0.31, 0.1, roarGain.gain);
    this.noiseLoop().connect(roar).connect(roarGain).connect(this.layers.fire);
  }

  private schedule(kind: CallKind): void {
    if (this.stopped) return;
    this.timers[kind] = setTimeout(() => {
      if (this.targets[EVENT_LAYER[kind]] > AUDIBLE && this.g.ctx.state === 'running') this.call(kind);
      this.schedule(kind);
    }, nextCallDelayMs(kind, this.rng));
  }

  /** One bird song or frog croak, with its own random pitch and length. */
  private call(kind: CallKind): void {
    const { ctx } = this.g;
    const v = vary(this.rng, 0.12);
    const t = ctx.currentTime + 0.02;
    if (kind === 'drops') {
      // A soft droplet: a tiny rising plip on the water, now and then a leaf tick beside it.
      const f0 = (900 + this.rng() * 1400) * v.pitch;
      tone(this.g, this.layers.rain, t, { f0, f1: f0 * 1.7, dur: 0.045 + this.rng() * 0.03, attack: 0.004, peak: 0.07 * v.volume });
      if (this.rng() < 0.3) burst(this.g, this.layers.rain, t, { filter: 'bandpass', f0: 3800 * v.pitch, q: 1.2, dur: 0.02, attack: 0.002, peak: 0.05 * v.volume });
    } else if (kind === 'crackle') {
      // A crackle: one to four tiny dry snaps close together; now and then a deeper pop.
      const snaps = 1 + Math.floor(this.rng() * 4);
      for (let i = 0; i < snaps; i++) {
        burst(this.g, this.layers.fire, t, { filter: 'bandpass', f0: (1400 + this.rng() * 3600) * v.pitch, q: 1.6, at: i * (0.012 + this.rng() * 0.03), dur: 0.008 + this.rng() * 0.012, attack: 0.002, peak: (0.14 + this.rng() * 0.2) * v.volume });
      }
      if (this.rng() < 0.18) tone(this.g, this.layers.fire, t, { f0: (180 + this.rng() * 80) * v.pitch, f1: 90, dur: 0.07, attack: 0.004, peak: 0.12 * v.volume });
    } else if (kind === 'birds') {
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
      // "Rib-bit": two raspy syllables, each a fast train of tiny buzzy pulses (the rasp is the
      // ~80 Hz pulse rate), the second a little higher. One or two ribbits per call.
      const ribbits = this.rng() < 0.65 ? 1 : 2;
      const base = (260 + this.rng() * 90) * v.pitch;
      const gap = 0.0125;
      const syllable = (start: number, f: number, pulses: number, peak: number): void => {
        for (let i = 0; i < pulses; i++) {
          tone(this.g, this.frogFilter, t, { type: 'sawtooth', f0: f, f1: f * 1.04, at: start + i * gap, dur: 0.011, attack: 0.004, peak });
        }
      };
      for (let r = 0; r < ribbits; r++) {
        const at = r * 0.42;
        syllable(at, base, 7, 0.3 * v.volume);
        syllable(at + 0.15, base * 1.22, 6, 0.26 * v.volume);
      }
    }
  }
}
