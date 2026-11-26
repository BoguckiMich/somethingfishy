import { describe, expect, it } from 'vitest';
import { NO_RIVER_MIX, ambientMix, riverMix, type AmbientMix } from './ambientMix';
import { WEATHER_IDS } from './data/weather';

const hm = (h: number, m = 0) => h * 60 + m;
const LAYERS = ['water', 'birds', 'frogs', 'crickets'] as const;
const dominant = (mix: AmbientMix) => (['birds', 'frogs', 'crickets'] as const).reduce((a, b) => (mix[b] > mix[a] ? b : a));

describe('ambientMix', () => {
  it('keeps the water on all day and night, every gain in 0..1', () => {
    for (let m = 0; m < 1440; m++) {
      const mix = ambientMix(m);
      expect(mix.water).toBe(1);
      for (const l of LAYERS) {
        expect(mix[l]).toBeGreaterThanOrEqual(0);
        expect(mix[l]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is birds at noon, frogs at dusk, crickets at midnight', () => {
    expect(dominant(ambientMix(hm(12)))).toBe('birds');
    expect(ambientMix(hm(12)).crickets).toBe(0);
    expect(dominant(ambientMix(hm(19, 30)))).toBe('frogs');
    expect(dominant(ambientMix(0))).toBe('crickets');
    expect(ambientMix(0).birds).toBe(0);
  });

  it('crossfades: neighbouring layers overlap at the changeovers', () => {
    const dusk = ambientMix(hm(18, 45));
    expect(dusk.birds).toBeGreaterThan(0.1);
    expect(dusk.frogs).toBeGreaterThan(0.1);
    const late = ambientMix(hm(21, 30));
    expect(late.frogs).toBeGreaterThan(0.1);
    expect(late.crickets).toBeGreaterThan(0.1);
  });

  it('has no jumps between adjacent minutes, including across midnight', () => {
    for (let m = 0; m < 1440; m++) {
      const a = ambientMix(m);
      const b = ambientMix((m + 1) % 1440);
      for (const l of LAYERS) expect(Math.abs(a[l] - b[l])).toBeLessThan(0.03);
    }
  });

  it('wraps any minute like the clock does', () => {
    expect(ambientMix(1440 + 60)).toEqual(ambientMix(60));
    expect(ambientMix(-60)).toEqual(ambientMix(1380));
  });
});

describe('riverMix (the river current layer, levels only)', () => {
  it('is silent and leaves the lake lapping alone away from a river', () => {
    for (const w of [undefined, ...WEATHER_IDS]) expect(riverMix(false, w)).toEqual(NO_RIVER_MIX);
    expect(NO_RIVER_MIX).toEqual({ current: 0, waterDuck: 1 });
  });

  it('runs steadily at the river, fuller in the rain, and ducks the lake lapping', () => {
    const steady = riverMix(true, 'sunny');
    expect(steady.current).toBeGreaterThan(0.5);
    expect(steady.waterDuck).toBeLessThan(1);
    expect(steady.waterDuck).toBeGreaterThan(0);
    expect(riverMix(true, 'rain').current).toBeGreaterThan(steady.current);
    expect(riverMix(true, 'overcast').current).toBeGreaterThan(steady.current);
    expect(riverMix(true, 'overcast').current).toBeLessThan(riverMix(true, 'rain').current);
    expect(riverMix(true, undefined)).toEqual(steady);
  });

  it('every level stays in 0..1 for every weather', () => {
    for (const w of [undefined, ...WEATHER_IDS]) {
      for (const river of [false, true]) {
        const m = riverMix(river, w);
        for (const v of [m.current, m.waterDuck]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
