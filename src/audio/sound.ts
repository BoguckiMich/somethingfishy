import { ambientMix } from '../core/ambientMix';
import { advanceReel, REEL_PRIMED } from '../core/reelClicks';
import { DEFAULT_SOUND_SETTINGS, loadSoundSettings, normalizeSoundSettings, saveSoundSettings, volumeGain, type SoundSettings } from '../core/soundSettings';
import { vary } from '../core/variation';
import { AMBIENT_LAYERS, AmbientBed, type AmbientLayer, type LayerGains } from './ambient';
import { AudioEngine } from './AudioEngine';
import { playSfx, type SfxName, type SfxOptions } from './sfx';

export { SFX_NAMES, type SfxName } from './sfx';
export { AMBIENT_LAYERS, type AmbientLayer } from './ambient';

/**
 * The one door the game uses for sound: `sound.play('plop')`, `sound.setMinute(m)`. Scenes and
 * panels never build audio nodes. Everything is a harmless no-op before the first tap, with the
 * sound turned off, or where Web Audio does not exist.
 */
class Sound {
  private engine = new AudioEngine();
  private bed: AmbientBed | null = null;
  private settings: SoundSettings = { ...DEFAULT_SOUND_SETTINGS };
  private storage: Storage | undefined;
  private persist = true;
  private minute = 12 * 60;
  private lastMinuteKey = -1;
  private debugMinute: number | null = null;
  private solo: ReadonlySet<AmbientLayer> | null = null;
  private reelAcc = REEL_PRIMED;

  /**
   * Call once at startup: loads the settings and hooks the first-tap unlock and the page
   * visibility. `persist: false` (the dev sandbox) never writes the settings.
   */
  init(storage: Storage | undefined, persist: boolean): void {
    this.storage = storage;
    this.persist = persist;
    this.settings = loadSoundSettings(storage);
    this.engine.setBuses(volumeGain(this.settings.sfx), volumeGain(this.settings.ambience));
    this.engine.onReady = (g) => {
      this.bed = new AmbientBed(g);
      this.applyMix();
    };
    this.engine.start();
  }

  get current(): SoundSettings {
    return { ...this.settings };
  }

  /** The Sounds / Ambience volumes (0..100); saved at once unless sandboxed. */
  set(settings: SoundSettings): void {
    this.settings = normalizeSoundSettings(settings);
    this.engine.setBuses(volumeGain(this.settings.sfx), volumeGain(this.settings.ambience));
    if (this.persist) saveSoundSettings(this.storage, this.settings);
  }

  play(name: SfxName, opts: SfxOptions = {}): void {
    if (this.settings.sfx <= 0) return;
    const g = this.engine.ready;
    if (!g) return;
    try {
      playSfx(g, name, vary(Math.random), opts);
    } catch {
      // sound is a bonus, never a crash
    }
  }

  /**
   * Reel clicks: call every frame while fighting with `reeling` true when the thumb is down;
   * clicks come at a steady rate only while reeling.
   */
  reel(dtMs: number, reeling: boolean): void {
    const r = advanceReel(this.reelAcc, dtMs, reeling);
    this.reelAcc = r.acc;
    if (r.clicks > 0) this.play('reel');
  }

  /** The game clock; the ambient layers crossfade with it. Cheap to call every frame. */
  setMinute(minute: number): void {
    this.minute = minute;
    if (this.debugMinute !== null) return;
    const key = Math.floor(minute);
    if (key === this.lastMinuteKey) return;
    this.lastMinuteKey = key;
    this.applyMix();
  }

  // ---- Dev sound board -------------------------------------------------------------------

  /** Dev: pins the ambient time of day (null follows the game clock again). */
  setDebugMinute(minute: number | null): void {
    this.debugMinute = minute;
    this.applyMix();
  }

  /** Dev: only these layers play, at full strength, whatever the time (null = follow the clock). */
  setSolo(layers: ReadonlySet<AmbientLayer> | null): void {
    this.solo = layers;
    this.applyMix();
  }

  private applyMix(): void {
    if (!this.bed) return;
    const mix = ambientMix(this.debugMinute ?? this.minute);
    const gains = {} as LayerGains;
    for (const l of AMBIENT_LAYERS) gains[l] = this.solo ? (this.solo.has(l) ? 1 : 0) : mix[l];
    this.bed.setTargets(gains);
  }
}

export const sound = new Sound();
