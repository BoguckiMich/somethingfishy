/**
 * Device sound preferences. Not part of SaveData and not in the export code: they live under
 * their own key and storage is injected (same pattern as profile.ts).
 */
export interface SoundSettings {
  /** Sound effects (casting, bites, jingles, UI taps...). */
  sfx: boolean;
  /** Ambient bed (water, birds, frogs, crickets). */
  ambience: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { sfx: true, ambience: true };

export const SOUND_SETTINGS_KEY = 'rybki.settings.v1';

/** Any junk becomes the default (on) for that field. */
export function normalizeSoundSettings(raw: Partial<Record<keyof SoundSettings, unknown>> | null | undefined): SoundSettings {
  return {
    sfx: typeof raw?.sfx === 'boolean' ? raw.sfx : DEFAULT_SOUND_SETTINGS.sfx,
    ambience: typeof raw?.ambience === 'boolean' ? raw.ambience : DEFAULT_SOUND_SETTINGS.ambience,
  };
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
