/**
 * Player-editable names, stored on the device only. Pure: storage is injected so it can be
 * tested and so a missing/blocked localStorage just falls back to the defaults.
 */
export interface Profile {
  /** The player character. */
  player: string;
  /** The companion who sits next to the player. */
  companion: string;
  /** The dog. */
  dog: string;
}

export const DEFAULT_PROFILE: Profile = { player: 'Alex', companion: 'Pajkel', dog: 'Bestia' };

export const PROFILE_KEY = 'rybki.profile.v1';
export const MAX_NAME_LENGTH = 14;

/** Trims, collapses whitespace, caps the length; falls back when nothing is left. */
export function normalizeName(input: string, fallback: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return cleaned === '' ? fallback : cleaned;
}

export function normalizeProfile(raw: Partial<Profile> | null | undefined): Profile {
  return {
    player: normalizeName(String(raw?.player ?? ''), DEFAULT_PROFILE.player),
    companion: normalizeName(String(raw?.companion ?? ''), DEFAULT_PROFILE.companion),
    dog: normalizeName(String(raw?.dog ?? ''), DEFAULT_PROFILE.dog),
  };
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;
type RemovableStorage = Pick<Storage, 'removeItem'>;

/** The stored profile, or null when there is none (first launch) or storage is unavailable. */
export function loadProfile(storage: ReadableStorage | undefined): Profile | null {
  try {
    const text = storage?.getItem(PROFILE_KEY);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return normalizeProfile(parsed as Partial<Profile>);
  } catch {
    return null;
  }
}

/** Returns false when the profile could not be stored (it still works for this session). */
export function saveProfile(storage: WritableStorage | undefined, profile: Profile): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile(storage: RemovableStorage | undefined): void {
  try {
    storage?.removeItem(PROFILE_KEY);
  } catch {
    // ignore: nothing to clear
  }
}
