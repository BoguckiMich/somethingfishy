import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND_SETTINGS, loadSoundSettings, normalizeSoundSettings, saveSoundSettings, SOUND_SETTINGS_KEY } from './soundSettings';

const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SOUND_SETTINGS_KEY, initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('sound settings', () => {
  it('uses its own key', () => {
    expect(SOUND_SETTINGS_KEY).toBe('rybki.settings.v1');
  });

  it('defaults to everything on', () => {
    expect(DEFAULT_SOUND_SETTINGS).toEqual({ sfx: true, ambience: true });
    expect(loadSoundSettings(undefined)).toEqual({ sfx: true, ambience: true });
    expect(loadSoundSettings(memory())).toEqual({ sfx: true, ambience: true });
  });

  it('round-trips through storage', () => {
    const m = memory();
    expect(saveSoundSettings(m, { sfx: false, ambience: true })).toBe(true);
    expect(loadSoundSettings(m)).toEqual({ sfx: false, ambience: true });
    expect(JSON.parse(m.data.get(SOUND_SETTINGS_KEY)!)).toEqual({ sfx: false, ambience: true });
  });

  it('survives junk', () => {
    expect(loadSoundSettings(memory('{not json'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('42'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('null'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('{"sfx":"no","ambience":0}'))).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('keeps a valid field next to a broken one', () => {
    expect(loadSoundSettings(memory('{"sfx":false,"ambience":"x"}'))).toEqual({ sfx: false, ambience: true });
    expect(normalizeSoundSettings({ ambience: false })).toEqual({ sfx: true, ambience: false });
  });

  it('reports a failed write without throwing', () => {
    const broken = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveSoundSettings(broken, DEFAULT_SOUND_SETTINGS)).toBe(false);
    expect(saveSoundSettings(undefined, DEFAULT_SOUND_SETTINGS)).toBe(false);
  });
});
