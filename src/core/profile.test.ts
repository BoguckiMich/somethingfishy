import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PROFILE_KEY, clearProfile, loadProfile, normalizeName, saveProfile } from './profile';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Ola   Maria  ', 'x')).toBe('Ola Maria');
  });
  it('caps at 14 characters', () => {
    expect(normalizeName('abcdefghijklmnopqrstuvwxyz', 'x')).toBe('abcdefghijklmn');
    expect(normalizeName('abcdefghijklm   zzz', 'x')).toBe('abcdefghijklm');
  });
  it('falls back when empty or blank', () => {
    expect(normalizeName('', 'Fallback')).toBe('Fallback');
    expect(normalizeName('   \t ', 'Fallback')).toBe('Fallback');
  });
});

describe('defaults', () => {
  it('has the default names', () => {
    expect(DEFAULT_PROFILE).toEqual({ player: 'Alex', companion: 'Pajkel', dog: 'Bestia' });
  });
});

describe('profile storage', () => {
  it('returns null on first launch', () => {
    expect(loadProfile(memoryStorage())).toBeNull();
  });
  it('round-trips a normalized profile', () => {
    const s = memoryStorage();
    expect(saveProfile(s, { player: '  Zed ', companion: '', dog: 'Rex' })).toBe(true);
    expect(loadProfile(s)).toEqual({ player: 'Zed', companion: 'Pajkel', dog: 'Rex' });
  });
  it('ignores corrupt data', () => {
    expect(loadProfile(memoryStorage({ [PROFILE_KEY]: '{nope' }))).toBeNull();
    expect(loadProfile(memoryStorage({ [PROFILE_KEY]: '42' }))).toBeNull();
  });
  it('survives missing or throwing storage', () => {
    expect(loadProfile(undefined)).toBeNull();
    expect(saveProfile(undefined, DEFAULT_PROFILE)).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadProfile(throwing)).toBeNull();
    expect(saveProfile(throwing, DEFAULT_PROFILE)).toBe(false);
    expect(() => clearProfile(throwing)).not.toThrow();
  });
  it('clears the profile', () => {
    const s = memoryStorage();
    saveProfile(s, DEFAULT_PROFILE);
    clearProfile(s);
    expect(loadProfile(s)).toBeNull();
  });
});
