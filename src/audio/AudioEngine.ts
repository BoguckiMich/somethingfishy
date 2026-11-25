/**
 * The Web Audio plumbing: one AudioContext, a master gain and two buses (sfx, ambience), and one
 * shared white-noise buffer. Browsers keep audio locked until a gesture, so the context is only
 * built (and resumed) from the first pointerdown / keydown / touchend. Everything is a no-op when
 * Web Audio is missing. No secure-context-only API is used, so plain http on the LAN works.
 */
export interface AudioGraph {
  ctx: AudioContext;
  /** Everything goes through here; ramped to 0 when the page is hidden. */
  master: GainNode;
  sfxBus: GainNode;
  ambBus: GainNode;
  /** About 2 s of white noise, shared by every noisy sound. */
  noise: AudioBuffer;
}

type AudioContextCtor = new () => AudioContext;

const BUS_TIME_CONSTANT = 0.05;

function makeNoise(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class AudioEngine {
  private graph: AudioGraph | null = null;
  private failed = false;
  private paused = false;
  private started = false;
  private sfxGain = 1;
  private ambGain = 1;
  /** Called once when the graph exists (the ambient bed starts here). */
  onReady: (g: AudioGraph) => void = () => undefined;

  /** Hooks the unlock gestures and the page visibility. Safe to call once at startup. */
  start(): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(type, unlock, true);
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? this.pause() : this.resume()));
    window.addEventListener('pagehide', () => this.pause());
    window.addEventListener('pageshow', () => {
      if (document.visibilityState === 'visible') this.resume();
    });
  }

  /** The graph once unlocked, running and not paused; null otherwise, so sounds are dropped (not queued) while suspended. */
  get ready(): AudioGraph | null {
    return this.graph && !this.paused && this.graph.ctx.state === 'running' ? this.graph : null;
  }

  /** Called from a user gesture: builds the context on first use, resumes it when it slept. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.graph) {
        const Ctor: AudioContextCtor | undefined =
          (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = document.visibilityState === 'hidden' ? 0 : 0.8;
        // A gentle limiter so a burst of sounds never clips.
        try {
          const limiter = ctx.createDynamicsCompressor();
          limiter.threshold.value = -6;
          limiter.knee.value = 6;
          limiter.ratio.value = 4;
          limiter.attack.value = 0.003;
          limiter.release.value = 0.25;
          master.connect(limiter);
          limiter.connect(ctx.destination);
        } catch {
          master.connect(ctx.destination);
        }
        const sfxBus = ctx.createGain();
        const ambBus = ctx.createGain();
        sfxBus.gain.value = this.sfxGain;
        ambBus.gain.value = this.ambGain;
        sfxBus.connect(master);
        ambBus.connect(master);
        this.graph = { ctx, master, sfxBus, ambBus, noise: makeNoise(ctx) };
        this.onReady(this.graph);
      }
      if (this.graph.ctx.state !== 'running' && document.visibilityState !== 'hidden') void this.graph.ctx.resume().catch(() => undefined);
    } catch {
      this.failed = true; // no audio, the game stays silent
    }
  }

  /** Silent while the page is hidden. */
  private pause(): void {
    this.paused = true;
    const g = this.graph;
    if (!g) return;
    try {
      const now = g.ctx.currentTime;
      g.master.gain.cancelScheduledValues(now);
      g.master.gain.setValueAtTime(g.master.gain.value, now);
      g.master.gain.linearRampToValueAtTime(0, now + 0.015);
      window.setTimeout(() => {
        if (this.paused) void g.ctx.suspend().catch(() => undefined);
      }, 20);
    } catch {
      // ignore
    }
  }

  private resume(): void {
    this.paused = false;
    const g = this.graph;
    if (!g) return;
    try {
      g.master.gain.cancelScheduledValues(g.ctx.currentTime);
      g.master.gain.setValueAtTime(0, g.ctx.currentTime);
      g.master.gain.linearRampToValueAtTime(0.8, g.ctx.currentTime + 0.4);
      void g.ctx.resume().catch(() => undefined);
    } catch {
      // ignore
    }
  }

  /** Ramps the buses to these gains, 0..1 (no click). Remembered for when the context is created. */
  setBuses(sfx: number, ambience: number): void {
    this.sfxGain = sfx;
    this.ambGain = ambience;
    const g = this.graph;
    if (!g) return;
    try {
      g.sfxBus.gain.setTargetAtTime(sfx, g.ctx.currentTime, BUS_TIME_CONSTANT);
      g.ambBus.gain.setTargetAtTime(ambience, g.ctx.currentTime, BUS_TIME_CONSTANT);
    } catch {
      // ignore
    }
  }
}
