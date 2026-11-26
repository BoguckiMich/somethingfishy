import { describe, expect, it } from 'vitest';
import { NO_WEATHER_MIX, ambientMix, weatherMix } from './ambientMix';
import { campfireLook, tentGlow } from './camp';
import { catchJingle } from './catchSound';
import { WEATHER_IDS } from './data/weather';

const hm = (h: number, m = 0) => h * 60 + m;

describe('weather and campfire sound beds (levels only; the sound itself is unheard by the tests)', () => {
  it('rain plays only when it rains, wind is full only when windy, a hint under rain and overcast, none otherwise', () => {
    for (const w of WEATHER_IDS) {
      const m = weatherMix(w, hm(12), false);
      expect(m.rain).toBe(w === 'rain' ? 1 : 0);
    }
    expect(weatherMix('windy', hm(12), false).wind).toBe(1);
    expect(weatherMix('rain', hm(12), false).wind).toBeGreaterThan(0);
    expect(weatherMix('rain', hm(12), false).wind).toBeLessThan(0.5);
    expect(weatherMix('overcast', hm(12), false).wind).toBeGreaterThan(0);
    expect(weatherMix('sunny', hm(12), false).wind).toBe(0);
    expect(weatherMix('fog', hm(12), false).wind).toBe(0);
    expect(weatherMix(undefined, hm(12), true)).toMatchObject({ rain: 0, wind: 0 });
  });

  it('the campfire crackles only when it is owned and it is dusk or night', () => {
    expect(weatherMix('sunny', hm(23), false).fire).toBe(0);
    expect(weatherMix('sunny', hm(12), true).fire).toBe(0);
    expect(weatherMix('sunny', hm(10), true).fire).toBe(0);
    expect(weatherMix('sunny', hm(18, 30), true).fire).toBeGreaterThan(0);
    expect(weatherMix('sunny', hm(18, 30), true).fire).toBeLessThan(1);
    expect(weatherMix('sunny', hm(21), true).fire).toBe(1);
    expect(weatherMix('sunny', hm(2), true).fire).toBe(1);
    expect(weatherMix('sunny', hm(5, 30), true).fire).toBeGreaterThan(0);
    expect(weatherMix('sunny', hm(6, 30), true).fire).toBe(0);
  });

  it('the fire is quieter in the rain, and rain and wind quiet the birds', () => {
    expect(weatherMix('rain', hm(23), true).fire).toBeLessThan(weatherMix('sunny', hm(23), true).fire);
    expect(weatherMix('rain', hm(23), true).fire).toBeGreaterThan(0);
    expect(weatherMix('rain', hm(12), false).birdDuck).toBeLessThan(weatherMix('windy', hm(12), false).birdDuck);
    expect(weatherMix('windy', hm(12), false).birdDuck).toBeLessThan(1);
    expect(weatherMix('sunny', hm(12), false).birdDuck).toBe(1);
  });

  it('every level stays in 0..1 over the whole day for every weather', () => {
    for (const w of [undefined, ...WEATHER_IDS]) {
      for (let m = 0; m < 1440; m += 7) {
        const x = weatherMix(w, m, true);
        for (const v of [x.rain, x.wind, x.fire, x.birdDuck]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('leaves the clock mix alone and has a silent mix for the Pale One', () => {
    expect(ambientMix(hm(12)).water).toBe(1);
    expect(NO_WEATHER_MIX).toEqual({ rain: 0, wind: 0, fire: 0 });
  });
});

describe('campfire look', () => {
  it('rain halves the light, darkens the logs, keeps the flame low, calms the sparks and makes smoke', () => {
    const dry = campfireLook(0, 1);
    const wet = campfireLook(1, 1);
    expect(dry.glow).toBe(1);
    expect(wet.glow).toBeCloseTo(0.45, 5);
    expect(wet.damp).toBeGreaterThan(dry.damp);
    expect(wet.lowFlame).toBeGreaterThan(dry.lowFlame);
    expect(wet.sparkEveryMs).toBeGreaterThan(dry.sparkEveryMs * 2);
    expect(wet.smokeEveryMs).toBeLessThan(dry.smokeEveryMs);
    expect(wet.flicker).toBeLessThan(dry.flicker);
  });

  it('flickers more at dusk and night than by day, with more sparks', () => {
    const day = campfireLook(0, 0);
    const night = campfireLook(0, 1);
    expect(night.flicker).toBeGreaterThan(day.flicker);
    expect(night.sparkEveryMs).toBeLessThan(day.sparkEveryMs);
  });

  it('clamps nonsense inputs', () => {
    expect(campfireLook(5, 9).glow).toBeCloseTo(0.45, 5);
    expect(campfireLook(-1, -1).glow).toBe(1);
  });
});

describe('tent glow', () => {
  it('shines only when the tent is owned, with the dusk and night ramp, a little softer in rain', () => {
    expect(tentGlow(false, 1, 0)).toBe(0);
    expect(tentGlow(true, 0, 0)).toBe(0);
    expect(tentGlow(true, 1, 0)).toBe(1);
    expect(tentGlow(true, 0.5, 0)).toBe(0.5);
    expect(tentGlow(true, 1, 1)).toBeLessThan(1);
    expect(tentGlow(true, 1, 1)).toBeGreaterThan(0.5);
  });
});

describe('catch stingers', () => {
  const base = { outcome: 'normal' as const, star: 'none' as const, perfect: false, trophy: false, slips: false };
  it('an everyday catch keeps the short jingle; a record, a species, gold or a perfect catch the fanfare', () => {
    expect(catchJingle(base)).toBe('catch');
    expect(catchJingle({ ...base, star: 'silver' })).toBe('catch');
    expect(catchJingle({ ...base, outcome: 'newSpecies' })).toBe('fanfare');
    expect(catchJingle({ ...base, outcome: 'newRecord' })).toBe('fanfare');
    expect(catchJingle({ ...base, star: 'gold' })).toBe('fanfare');
    expect(catchJingle({ ...base, perfect: true })).toBe('fanfare');
  });
  it('a medal gets its own stinger, a trophy fish its own, and the Pale One keeps the fanfare', () => {
    expect(catchJingle({ ...base, star: 'medal', perfect: true })).toBe('medal');
    expect(catchJingle({ ...base, outcome: 'newSpecies', star: 'medal', perfect: true })).toBe('medal');
    expect(catchJingle({ ...base, trophy: true })).toBe('trophy');
    expect(catchJingle({ ...base, trophy: true, star: 'medal' })).toBe('trophy');
    expect(catchJingle({ ...base, slips: true, star: 'medal' })).toBe('fanfare');
  });
});
