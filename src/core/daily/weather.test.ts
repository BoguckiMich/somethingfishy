import { describe, expect, it } from 'vitest';
import { WEATHER_IDS, WEATHER_TUNING, type WeatherId } from '../data/weather';
import { FOG_LIFTED_LINES, WEATHER_LINES, WEATHER_NIGHT_LINES, weatherLinesFor } from '../data/pajkelLines';
import { speciesById } from '../data/fish';
import { QUIET_LAKE } from '../data/locations';
import { candidates, fightProfile, pickSpecies, spawnWeight } from '../fish';
import { BITE_TUNING, step, type SessionContext } from '../fishingSession';
import { RODS } from '../data/rods';
import {
  fogStrength,
  likesWeather,
  normalizeWeatherSeen,
  weatherAllowsAnyTime,
  weatherEffects,
  weatherLineDue,
  weatherFlipAllowed,
  weatherForHour,
  weatherHourKey,
  weatherWeightMult,
} from './weather';

const sp = (id: string) => speciesById(id)!;
const noon = 12 * 60;
/** The i-th day after 2026-01-01 as YYYY-MM-DD (test helper only). */
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

describe('weatherForHour', () => {
  it('is deterministic and ignores invalid dates and hours', () => {
    expect(weatherForHour('2026-11-24', 13)).toBe(weatherForHour('2026-11-24', 13));
    expect(weatherForHour('nope', 3)).toBeUndefined();
    expect(weatherForHour('2026-02-30', 3)).toBeUndefined();
    expect(weatherForHour('2026-11-24', 24)).toBeUndefined();
    expect(weatherForHour('2026-11-24', -1)).toBeUndefined();
    expect(weatherForHour('2026-11-24', 1.5)).toBeUndefined();
  });
  it('spreads about evenly over the five conditions across many hours', () => {
    const counts = Object.fromEntries(WEATHER_IDS.map((w) => [w, 0])) as Record<WeatherId, number>;
    const n = 365 * 24;
    for (let i = 0; i < 365; i++) for (let h = 0; h < 24; h++) counts[weatherForHour(day(i), h)!]++;
    for (const w of WEATHER_IDS) {
      expect(counts[w]).toBeGreaterThan(n / 5 - 350);
      expect(counts[w]).toBeLessThan(n / 5 + 350);
    }
  });
  it('repeats the previous hour about a third as often as a uniform pick would', () => {
    let repeats = 0;
    let steps = 0;
    for (let i = 0; i < 365; i++) {
      for (let h = 1; h < 24; h++) {
        steps++;
        if (weatherForHour(day(i), h) === weatherForHour(day(i), h - 1)) repeats++;
      }
    }
    const rate = repeats / steps;
    expect(rate).toBeGreaterThan(0.2 / 3 - 0.025);
    expect(rate).toBeLessThan(0.2 / 3 + 0.025);
    expect(repeats).toBeGreaterThan(0);
  });
  it('changes from hour to hour', () => {
    const set = new Set<WeatherId | undefined>();
    for (let h = 0; h < 12; h++) set.add(weatherForHour('2026-11-24', h));
    expect(set.size).toBeGreaterThan(2);
  });
});

describe('weatherFlipAllowed', () => {
  it('waits for idle or waiting, and for every panel to be closed', () => {
    expect(weatherFlipAllowed('idle', false)).toBe(true);
    expect(weatherFlipAllowed('waiting', false)).toBe(true);
    for (const k of ['casting', 'bite', 'fighting', 'caught', 'reeling']) expect(weatherFlipAllowed(k, false)).toBe(false);
    expect(weatherFlipAllowed('idle', true)).toBe(false);
  });
});

describe('weatherHourKey', () => {
  it('pads the hour and rejects bad input', () => {
    expect(weatherHourKey('2026-11-24', 7)).toBe('2026-11-24-07');
    expect(weatherHourKey('2026-11-24', 23)).toBe('2026-11-24-23');
    expect(weatherHourKey('2026-11-24', 24)).toBeUndefined();
    expect(weatherHourKey('bad', 1)).toBeUndefined();
  });
});

describe('weather effects on weights', () => {
  const w = (id: string, weather: WeatherId, minute = noon) => spawnWeight(sp(id), undefined, undefined, weatherEffects(weather, minute));

  it('no weather changes nothing', () => {
    expect(spawnWeight(sp('roach'), undefined, undefined, undefined)).toBe(spawnWeight(sp('roach')));
    expect(weatherWeightMult(sp('carp'), undefined)).toBe(1);
  });
  it('sunny: shallow x1.4, deep x0.75', () => {
    expect(w('roach', 'sunny')).toBeCloseTo(spawnWeight(sp('roach')) * 1.4);
    expect(w('bream', 'sunny')).toBeCloseTo(spawnWeight(sp('bream')) * 0.75);
  });
  it('overcast: no weight change, but tench and zander bite at any time', () => {
    const fx = weatherEffects('overcast', noon);
    expect(w('carp', 'overcast')).toBe(spawnWeight(sp('carp')));
    expect(w('tench', 'overcast')).toBe(spawnWeight(sp('tench')));
    expect(candidates('deep', 'day').map((s) => s.id)).not.toContain('tench');
    const byDay = candidates('deep', 'day', fx).map((s) => s.id);
    expect(byDay).toContain('tench');
    expect(byDay).toContain('zander');
    expect(byDay).not.toContain('catfish'); // night only, and it does not like overcast
    expect(candidates('deep', 'day', weatherEffects('rain', noon)).map((s) => s.id)).not.toContain('tench');
  });
  it('rain: carp and bream x1.5, others unchanged', () => {
    expect(w('carp', 'rain')).toBeCloseTo(spawnWeight(sp('carp')) * 1.5 * 1);
    expect(w('bream', 'rain')).toBeCloseTo(spawnWeight(sp('bream')) * 1.5);
    expect(w('pike', 'rain')).toBe(spawnWeight(sp('pike')));
  });
  it('windy: perch, pike, zander x1.5', () => {
    for (const id of ['perch', 'pike', 'zander']) expect(w(id, 'windy')).toBeCloseTo(spawnWeight(sp(id)) * 1.5);
    expect(w('roach', 'windy')).toBe(spawnWeight(sp('roach')));
  });
  it('fog: rare species x2 before 10:00 only', () => {
    expect(w('catfish', 'fog', 7 * 60)).toBeCloseTo(spawnWeight(sp('catfish')) * 2);
    expect(w('catfish', 'fog', 9 * 60 + 59)).toBeCloseTo(spawnWeight(sp('catfish')) * 2);
    expect(w('catfish', 'fog', 10 * 60)).toBe(spawnWeight(sp('catfish')));
    expect(w('catfish', 'fog', 15 * 60)).toBe(spawnWeight(sp('catfish')));
    expect(w('roach', 'fog', 7 * 60)).toBe(spawnWeight(sp('roach')));
  });
  it('stacks with the fish of the day', () => {
    const fx = weatherEffects('rain', noon);
    expect(spawnWeight(sp('carp'), undefined, 'carp', fx)).toBeCloseTo(spawnWeight(sp('carp'), undefined, 'carp') * 1.5);
  });
  it('is data-driven: any species that likes a weather gets the multiplier', () => {
    const fake = { ...sp('rudd'), likes: ['rain' as const] };
    expect(likesWeather(fake, 'rain')).toBe(true);
    expect(weatherWeightMult(fake, weatherEffects('rain', noon))).toBeCloseTo(1.5);
    expect(weatherAllowsAnyTime({ ...fake, likes: ['overcast'] }, weatherEffects('overcast', noon))).toBe(true);
    expect(weatherAllowsAnyTime(fake, weatherEffects('overcast', noon))).toBe(false);
  });
  it('pickSpecies shifts toward the liked species in the rain', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const count = (fx?: ReturnType<typeof weatherEffects>) => {
      let n = 0;
      for (let i = 0; i < 4000; i++) if (['carp', 'bream'].includes(pickSpecies('deep', 'day', rng, undefined, undefined, fx).id)) n++;
      return n;
    };
    expect(count(weatherEffects('rain', noon))).toBeGreaterThan(count(undefined) * 1.1);
  });
});

describe('fog cut-off and strength', () => {
  it('the effect ends at exactly 10:00', () => {
    expect(Object.keys(weatherEffects('fog', 599).rarityWeight)).toEqual(['rare']);
    expect(Object.keys(weatherEffects('fog', 600).rarityWeight)).toEqual([]);
  });
  it('looks full, thins and is gone by 10:00', () => {
    expect(fogStrength(7 * 60)).toBe(1);
    expect(fogStrength(9 * 60)).toBeGreaterThan(0);
    expect(fogStrength(9 * 60)).toBeLessThan(1);
    expect(fogStrength(10 * 60)).toBe(0);
    expect(fogStrength(14 * 60)).toBe(0);
  });
});

describe('wait time and difficulty', () => {
  const baseCtx = (id?: WeatherId): SessionContext => ({
    location: QUIET_LAKE,
    rod: RODS[0],
    barGear: RODS[0].barGear,
    rng: () => 0.5,
    timeOfDay: () => 'day',
    weatherFx: id ? () => weatherEffects(id, noon) : undefined,
    speciesOverride: 'roach',
  });
  const wait = (id?: WeatherId) => {
    const r = step({ kind: 'casting', power: 1, distanceM: 5, zone: 'shallow' }, { type: 'landed' }, baseCtx(id));
    return r.state.kind === 'waiting' ? r.state.untilMs : -1;
  };
  it('rain makes the first wait x0.75, the others do not', () => {
    const base = wait();
    expect(base).toBeCloseTo((BITE_TUNING.firstWaitMs[0] + BITE_TUNING.firstWaitMs[1]) / 2);
    expect(wait('rain')).toBeCloseTo(base * 0.75);
    for (const id of ['sunny', 'overcast', 'windy', 'fog'] as const) expect(wait(id)).toBeCloseTo(base);
  });
  it('windy adds 0.05 to the fight, capped at 1', () => {
    const perch = sp('perch');
    const base = fightProfile(perch, 20).difficulty;
    expect(fightProfile(perch, 20, WEATHER_TUNING.windy.difficultyAdd).difficulty).toBeCloseTo(base + 0.05);
    expect(fightProfile(sp('catfish'), 180, 0.2).difficulty).toBe(1);
  });
  it('the session hands the windy difficulty to the bar', () => {
    const hooked = { speciesId: 'bream', lengthCm: 30, weightG: 500 };
    const bite = { kind: 'bite' as const, distanceM: 20, zone: 'deep' as const, hooked, windowLeftMs: 500 };
    const diff = (id?: WeatherId) => {
      const r = step(bite, { type: 'press' }, { ...baseCtx(id), speciesOverride: undefined });
      return r.state.kind === 'fighting' ? r.state.fish.difficulty : -1;
    };
    expect(diff('windy')).toBeCloseTo(diff() + 0.05);
    expect(diff('rain')).toBeCloseTo(diff());
  });
});

describe('Pajkel weather line, once per weather change', () => {
  it('is due until the hour key is stored, then again for the next hour', () => {
    expect(weatherLineDue(undefined, '2026-11-24-09')).toBe(true);
    expect(weatherLineDue('2026-11-24-08', '2026-11-24-09')).toBe(true);
    expect(weatherLineDue('2026-11-24-09', '2026-11-24-09')).toBe(false);
    expect(weatherLineDue(undefined, undefined)).toBe(false);
  });
  it('says one line per hour flip and none twice', () => {
    let seen: string | undefined;
    let said = 0;
    for (let h = 0; h < 6; h++) {
      const key = weatherHourKey('2026-11-24', h);
      for (let tick = 0; tick < 5; tick++) {
        if (weatherLineDue(seen, key)) {
          seen = key;
          said++;
        }
      }
    }
    expect(said).toBe(6);
  });
  it('normalises a saved key and old plain dates', () => {
    expect(normalizeWeatherSeen('2026-11-24-09')).toBe('2026-11-24-09');
    expect(normalizeWeatherSeen('2026-11-24')).toBe('2026-11-24-00');
    expect(normalizeWeatherSeen('2026-13-01')).toBeUndefined();
    expect(normalizeWeatherSeen('2026-11-24-25')).toBeUndefined();
    expect(normalizeWeatherSeen(5)).toBeUndefined();
  });
  it('has 2-3 short lines per weather', () => {
    for (const id of WEATHER_IDS) {
      expect(WEATHER_LINES[id].length).toBeGreaterThanOrEqual(2);
      expect(WEATHER_LINES[id].length).toBeLessThanOrEqual(3);
      for (const l of WEATHER_LINES[id]) expect(l.length).toBeLessThanOrEqual(26);
    }
    for (const l of [...FOG_LIFTED_LINES, ...Object.values(WEATHER_NIGHT_LINES).flat()]) expect(l.length).toBeLessThanOrEqual(26);
  });
  it('says what the weather is at the hour it is said (no "nice day" at night, no morning fog at noon)', () => {
    expect(weatherLinesFor('sunny', 12 * 60)).toBe(WEATHER_LINES.sunny);
    expect(weatherLinesFor('sunny', 23 * 60)).toBe(WEATHER_NIGHT_LINES.sunny);
    expect(weatherLinesFor('overcast', 19 * 60)).toBe(WEATHER_NIGHT_LINES.overcast);
    expect(weatherLinesFor('rain', 23 * 60)).toBe(WEATHER_LINES.rain);
    expect(weatherLinesFor('fog', 7 * 60)).toBe(WEATHER_LINES.fog);
    expect(weatherLinesFor('fog', 14 * 60)).toBe(FOG_LIFTED_LINES);
    expect(weatherLinesFor('fog', 2 * 60)).toBe(FOG_LIFTED_LINES);
    for (const l of WEATHER_LINES.sunny) expect(l).not.toMatch(/lake|bobber/);
  });
});
