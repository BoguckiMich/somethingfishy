import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  normalizeSoundSettings,
  saveSoundSettings,
  SOUND_SETTINGS_KEY,
  volumeGain,
} from './soundSettings';

const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SOUND_SETTINGS_KEY, initial);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('sound settings', () => {
  it('uses its own key', () => {
    expect(SOUND_SETTINGS_KEY).toBe('rybki.settings.v1');
  });

  it('defaults to full volume for both', () => {
    expect(DEFAULT_SOUND_SETTINGS).toEqual({ sfx: 100, ambience: 100 });
    expect(loadSoundSettings(undefined)).toEqual({ sfx: 100, ambience: 100 });
    expect(loadSoundSettings(memory())).toEqual({ sfx: 100, ambience: 100 });
  });

  it('round-trips through storage', () => {
    const m = memory();
    expect(saveSoundSettings(m, { sfx: 0, ambience: 40 })).toBe(true);
    expect(loadSoundSettings(m)).toEqual({ sfx: 0, ambience: 40 });
    expect(JSON.parse(m.data.get(SOUND_SETTINGS_KEY)!)).toEqual({ sfx: 0, ambience: 40 });
  });

  it('reads the old on/off toggles as full / silent', () => {
    expect(loadSoundSettings(memory('{"sfx":false,"ambience":true}'))).toEqual({ sfx: 0, ambience: 100 });
  });

  it('clamps and rounds volumes to whole percents', () => {
    expect(normalizeSoundSettings({ sfx: 150, ambience: -3 })).toEqual({ sfx: 100, ambience: 0 });
    expect(normalizeSoundSettings({ sfx: 33.6, ambience: 50 })).toEqual({ sfx: 34, ambience: 50 });
  });

  it('survives junk', () => {
    expect(loadSoundSettings(memory('{not json'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('42'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('null'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(loadSoundSettings(memory('{"sfx":"no","ambience":null}'))).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(normalizeSoundSettings({ sfx: Number.NaN, ambience: Infinity })).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('keeps a valid field next to a broken one', () => {
    expect(loadSoundSettings(memory('{"sfx":20,"ambience":"x"}'))).toEqual({ sfx: 20, ambience: 100 });
    expect(normalizeSoundSettings({ ambience: 0 })).toEqual({ sfx: 100, ambience: 0 });
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

describe('volumeGain', () => {
  it('maps 0..100 to a gain on a perceptual (squared) curve', () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(100)).toBe(1);
    expect(volumeGain(50)).toBeCloseTo(0.25);
  });
});
