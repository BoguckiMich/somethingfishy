/**
 * Device sound preferences. Not part of SaveData and not in the export code: they live under
 * their own key and storage is injected (same pattern as profile.ts).
 */
export interface SoundSettings {
  /** Sound effects volume, 0..100 % (casting, bites, jingles, UI taps...). 0 = off. */
  sfx: number;
  /** Ambient bed volume, 0..100 % (water, birds, frogs, crickets). 0 = off. */
  ambience: number;
  /** Phone vibration (nibble, bite, catch...). On by default (A3). */
  haptics: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { sfx: 100, ambience: 100, haptics: true };

export const SOUND_SETTINGS_KEY = 'rybki.settings.v1';

/** One field: whole percent 0..100; the early on/off booleans read as 100 / 0; junk → the default. */
function volume(raw: unknown, fallback: number): number {
  if (typeof raw === 'boolean') return raw ? 100 : 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function normalizeSoundSettings(raw: Partial<Record<keyof SoundSettings, unknown>> | null | undefined): SoundSettings {
  return {
    sfx: volume(raw?.sfx, DEFAULT_SOUND_SETTINGS.sfx),
    ambience: volume(raw?.ambience, DEFAULT_SOUND_SETTINGS.ambience),
    haptics: typeof raw?.haptics === 'boolean' ? raw.haptics : DEFAULT_SOUND_SETTINGS.haptics,
  };
}

/** Slider percent → bus gain, squared so the slider feels even to the ear. */
export function volumeGain(percent: number): number {
  const v = Math.min(100, Math.max(0, percent)) / 100;
  return v * v;
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** The stored settings, or the defaults when there are none, they are broken or storage is missing. */
export function loadSoundSettings(storage: ReadableStorage | undefined): SoundSettings {
  try {
    const text = storage?.getItem(SOUND_SETTINGS_KEY);
    if (!text) return { ...DEFAULT_SOUND_SETTINGS };
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SOUND_SETTINGS };
    return normalizeSoundSettings(parsed as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** Returns false when the settings could not be stored (they still apply for this session). */
export function saveSoundSettings(storage: WritableStorage | undefined, settings: SoundSettings): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(normalizeSoundSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
