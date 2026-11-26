import { ambientMix, NO_RIVER_MIX, NO_WEATHER_MIX, riverMix, weatherMix } from '../core/ambientMix';
import type { WeatherId } from '../core/data/weather';
import { eerieMix, type EerieLevel } from '../core/eerie';
import { dipCrickets } from '../core/moments/moments';
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
  private eerie: EerieLevel = 0;
  private uncanny = false;
  private weather: WeatherId | undefined;
  private ownsFire = false;
  private debugWeather: WeatherId | null = null;
  private river = false;

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

  /** How eerie the lake is (0 normal, 1 the Pale One's window, 2 its fight): quiets the crickets, then the whole ambience, and brings the drone in. */
  setEerie(level: EerieLevel): void {
    if (level === this.eerie) return;
    this.eerie = level;
    this.applyMix();
  }

  /** An uncanny lake moment (bubbles, a dark shape) is on screen: the crickets dip while it is. */
  setUncanny(on: boolean): void {
    if (on === this.uncanny) return;
    this.uncanny = on;
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

  /** Today's weather (rain and wind beds, quieter birds) and whether the campfire is owned (its crackle at dusk and night). Cheap to call every frame. */
  setCamp(weather: WeatherId | undefined, ownsFire: boolean): void {
    if (weather === this.weather && ownsFire === this.ownsFire) return;
    this.weather = weather;
    this.ownsFire = ownsFire;
    this.applyMix();
  }

  /** The place's water runs (its background is the river): the current layer plays and the lake lapping ducks. Cheap to call every frame. */
  setRiver(on: boolean): void {
    if (on === this.river) return;
    this.river = on;
    this.applyMix();
  }

  /** Dev: pins the weather of the sound board (null follows the game's weather again). */
  setDebugWeather(weather: WeatherId | null): void {
    this.debugWeather = weather;
    this.applyMix();
  }

  /** The gains the ambient bed should have right now (also what the sound board's tests read). */
  private mix(): LayerGains {
    const minute = this.debugMinute ?? this.minute;
    const clock = dipCrickets(eerieMix(ambientMix(minute), this.eerie), this.uncanny);
    // The Pale One's fight silences the weather and the camp too.
    const wx = this.eerie === 2 ? { ...NO_WEATHER_MIX, birdDuck: 1 } : weatherMix(this.debugWeather ?? this.weather, minute, this.ownsFire || this.debugMinute !== null);
    // The river's current (M2 groundwork B); the Pale One's fight (a lake thing) silences it too.
    const rv = this.eerie === 2 ? NO_RIVER_MIX : riverMix(this.river, this.debugWeather ?? this.weather);
    const gains = { ...clock, water: clock.water * rv.waterDuck, birds: clock.birds * wx.birdDuck, rain: wx.rain, wind: wx.wind, fire: wx.fire, current: rv.current } as LayerGains;
    if (this.solo) for (const l of AMBIENT_LAYERS) gains[l] = this.solo.has(l) ? 1 : 0;
    return gains;
  }

  private applyMix(): void {
    if (!this.bed) return;
    this.bed.setTargets(this.mix());
  }
}

export const sound = new Sound();
