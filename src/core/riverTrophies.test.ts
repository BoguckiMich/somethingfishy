import { describe, expect, it } from 'vitest';
import { FERRY_WINDOW, FERRYMAN, PALE_ONE } from './data/legendary';
import { FERRY_PIKE_BAND, LAKE_ID, RARE_RULES, RARE_TUNING, RIVER_ID, trophyIdsAt } from './data/rare';
import { speciesById } from './data/fish';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { weatherEffects } from './daily/weather';
import { ferryCreak, ferryWindowOpen } from './eerie';
import { rollHookedFish } from './fish';
import { placesOf, whereWhen } from './fishLog';
import { boardIds, boardShows, normalizeTrophies, rareCanSpawn, rollRare, type RareCast } from './rare';
import { ferrymanCanSpawn, inFerrymanWindow, rollLegendary, slipsAway } from './legendary';
import { seededRng } from './random';
import { poolAt, zoneAt } from './location';
import { newPlayer } from './inventory';
import { boatNote } from './moments/moments';
import { ferrymanBeatDue, journalEntries, markFerrymanSeen, newStory, normalizeStory, storyIsEmpty } from './story/story';

/**
 * The River bend's rare trophies, the board and the Ferryman (slice 25f, docs/RIVER_BEND.md section 5): conditions, place gating,
 * the cast distance band, the Ferryman's window and the creak timing, the saved state.
 */
const hm = (h: number, m = 0) => h * 60 + m;
const river = (c: Partial<RareCast> & Pick<RareCast, 'minute'>): RareCast => ({ placeId: RIVER_ID, zone: 'shallow', distanceM: 5, ...c });

const LANTERN: RareCast = river({ bandId: 'riffle', distanceM: 6, minute: hm(23), weather: 'rain', baitId: 'maggots' });
const KING: RareCast = river({ bandId: 'pool', zone: 'deep', distanceM: 33, minute: hm(18, 30), weather: 'overcast', baitId: 'strip' });
const PIKE: RareCast = river({ bandId: 'seam', distanceM: 22, minute: hm(13), weather: 'windy', baitId: 'worm' });

describe('Rainbow trout "Lantern": rain + night + riffle + maggots', () => {
  it('needs every condition', () => {
    expect(rareCanSpawn('lantern', LANTERN)).toBe(true);
    expect(rareCanSpawn('lantern', { ...LANTERN, weather: 'overcast' })).toBe(false);
    expect(rareCanSpawn('lantern', { ...LANTERN, weather: undefined })).toBe(false);
    expect(rareCanSpawn('lantern', { ...LANTERN, minute: hm(12) })).toBe(false); // day
    expect(rareCanSpawn('lantern', { ...LANTERN, minute: hm(19) })).toBe(false); // dusk
    expect(rareCanSpawn('lantern', { ...LANTERN, bandId: 'seam' })).toBe(false);
    expect(rareCanSpawn('lantern', { ...LANTERN, bandId: 'pool' })).toBe(false);
    expect(rareCanSpawn('lantern', { ...LANTERN, baitId: 'worm' })).toBe(false);
    expect(rareCanSpawn('lantern', { ...LANTERN, baitId: undefined })).toBe(false);
  });
  it('night runs from 20:00 past midnight to 05:00', () => {
    for (const [h, m, ok] of [[20, 0, true], [3, 0, true], [4, 59, true], [5, 0, false], [19, 59, false]] as const) {
      expect(rareCanSpawn('lantern', { ...LANTERN, minute: hm(h, m) }), `${h}:${m}`).toBe(ok);
    }
  });
});

describe('The Barbel King: overcast + dusk + bend pool + fish strip', () => {
  it('needs every condition', () => {
    expect(rareCanSpawn('barbelKing', KING)).toBe(true);
    expect(rareCanSpawn('barbelKing', { ...KING, weather: 'rain' })).toBe(false);
    expect(rareCanSpawn('barbelKing', { ...KING, minute: hm(14) })).toBe(false);
    expect(rareCanSpawn('barbelKing', { ...KING, minute: hm(20) })).toBe(false);
    expect(rareCanSpawn('barbelKing', { ...KING, bandId: 'seam' })).toBe(false);
    expect(rareCanSpawn('barbelKing', { ...KING, baitId: 'corn' })).toBe(false);
    expect(rareCanSpawn('barbelKing', { ...KING, baitId: undefined })).toBe(false);
  });
  it('dusk is 18:00 to 19:59', () => {
    expect(rareCanSpawn('barbelKing', { ...KING, minute: hm(18) })).toBe(true);
    expect(rareCanSpawn('barbelKing', { ...KING, minute: hm(19, 59) })).toBe(true);
    expect(rareCanSpawn('barbelKing', { ...KING, minute: hm(17, 59) })).toBe(false);
  });
});

describe('The Ferry pike: windy + day + the seam under the rope (18-26 m), any bait', () => {
  it('needs every condition, any bait', () => {
    expect(rareCanSpawn('ferryPike', PIKE)).toBe(true);
    for (const baitId of ['worm', 'corn', 'maggots', 'strip', 'glow', undefined]) expect(rareCanSpawn('ferryPike', { ...PIKE, baitId }), String(baitId)).toBe(true);
    expect(rareCanSpawn('ferryPike', { ...PIKE, weather: 'sunny' })).toBe(false);
    expect(rareCanSpawn('ferryPike', { ...PIKE, minute: hm(19) })).toBe(false);
    expect(rareCanSpawn('ferryPike', { ...PIKE, minute: hm(6) })).toBe(false);
    expect(rareCanSpawn('ferryPike', { ...PIKE, bandId: 'riffle' })).toBe(false);
  });
  it('the cast must land 18 to 26 m: 18 is in, 26 is out (the whole seam)', () => {
    expect(FERRY_PIKE_BAND).toEqual({ fromM: 18, toM: 26 });
    for (const [d, ok] of [[17.9, false], [18, true], [22, true], [25.9, true], [26, false], [30, false], [12, false]] as const) {
      expect(rareCanSpawn('ferryPike', { ...PIKE, distanceM: d }), `${d} m`).toBe(ok);
    }
  });
  it('the seam is 12-26 m of the river: the rule sits inside it', () => {
    const seam = RIVER_BEND.zones.find((z) => z.id === 'seam')!;
    expect(FERRY_PIKE_BAND.fromM).toBeGreaterThanOrEqual(seam.fromM);
    expect(FERRY_PIKE_BAND.toM).toBeLessThanOrEqual(seam.toM);
    expect(zoneAt(RIVER_BEND, 18).id).toBe('seam');
    expect(zoneAt(RIVER_BEND, 25.9).id).toBe('seam');
  });
});

describe('place gating: the river trophies are the river\'s, the lake\'s are the lake\'s', () => {
  it('the river conditions at the lake (or with no place) never spawn a river trophy', () => {
    for (const c of [LANTERN, KING, PIKE]) {
      const id = RARE_RULES.find((r) => r.placeId === RIVER_ID && rareCanSpawn(r.speciesId, c))!.speciesId;
      expect(rareCanSpawn(id, { ...c, placeId: LAKE_ID }), id).toBe(false);
      expect(rareCanSpawn(id, { ...c, placeId: undefined }), id).toBe(false);
    }
  });
  it('the lake conditions at the river never spawn a lake trophy', () => {
    const lake: Record<string, RareCast> = {
      goldenTench: { zone: 'deep', distanceM: 20, minute: hm(6), weather: 'rain', baitId: 'worm' },
      mossback: { zone: 'deep', distanceM: 32, minute: hm(14), weather: 'fog', baitId: 'corn' },
      silverGhost: { zone: 'shallow', distanceM: 8, minute: hm(12), weather: 'sunny', baitId: 'maggots' },
    };
    for (const [id, c] of Object.entries(lake)) {
      expect(rareCanSpawn(id, c), id).toBe(true);
      expect(rareCanSpawn(id, { ...c, placeId: LAKE_ID }), id).toBe(true);
      expect(rareCanSpawn(id, { ...c, placeId: RIVER_ID, bandId: 'pool' }), id).toBe(false);
    }
  });
  it('the boards list their own trophies', () => {
    expect(trophyIdsAt(LAKE_ID)).toEqual(['goldenTench', 'mossback', 'silverGhost']);
    expect(trophyIdsAt(RIVER_ID)).toEqual(['lantern', 'barbelKing', 'ferryPike']);
    const t = { goldenTench: { lengthCm: 50, weightG: 1, date: '' }, ferryPike: { lengthCm: 110, weightG: 1, date: '' }, lantern: { lengthCm: 50, weightG: 1, date: '' } };
    expect(boardIds(t, {})).toEqual(['goldenTench']);
    expect(boardIds(t, {}, RIVER_ID)).toEqual(['lantern', 'ferryPike']);
    expect(boardIds(t, { pale: {}, ferryman: {} }, RIVER_ID)).toEqual(['lantern', 'ferryPike', 'ferryman']);
    expect(boardIds(t, { pale: {}, ferryman: {} })).toEqual(['goldenTench', 'pale']);
  });
  it('a board shows only once one of its own trophies is mounted', () => {
    const lakeOnly = { goldenTench: { lengthCm: 50, weightG: 1, date: '' } };
    expect(boardShows(lakeOnly, LAKE_ID)).toBe(true);
    expect(boardShows(lakeOnly, RIVER_ID)).toBe(false);
    expect(boardShows(undefined, RIVER_ID)).toBe(false);
  });
  it('the saved board keeps the river trophies and drops anything unknown', () => {
    const good = { lantern: { lengthCm: 60, weightG: 5000, date: '2026-11-27' }, ferryPike: { lengthCm: 120, weightG: 6000, date: 'x', medal: true }, ferryman: { lengthCm: 250, weightG: 1, date: '' } };
    const n = normalizeTrophies(good);
    expect(Object.keys(n)).toEqual(['lantern', 'ferryPike']); // the Ferryman is a legendary, kept in the log
    expect(n.ferryPike).toEqual({ lengthCm: 120, weightG: 6000, date: '', medal: true });
  });
});

describe('rolling the river trophies in a cast', () => {
  const roll = (c: RareCast, seed: number, n = 3000): number => {
    const rng = seededRng(seed);
    let hits = 0;
    for (let i = 0; i < n; i++) if (rollRare(c, rng)) hits++;
    return hits / n;
  };
  it('about 20% of landed casts when all conditions hold, and the rng is not drawn otherwise', () => {
    for (const c of [LANTERN, KING, PIKE]) {
      const share = roll(c, 9);
      expect(share).toBeGreaterThan(0.17);
      expect(share).toBeLessThan(0.23);
    }
    const spy = () => {
      throw new Error('rng must not be drawn');
    };
    expect(rollRare({ ...LANTERN, weather: 'sunny' }, spy)).toBeUndefined();
    expect(rollRare({ ...PIKE, distanceM: 26 }, spy)).toBeUndefined();
  });
  it('the whole landed-cast roll at the river: with the conditions they appear, at the lake never', () => {
    const count = (loc: typeof RIVER_BEND, minute: number, distanceM: number, bait: string, weather: Parameters<typeof weatherEffects>[0]) => {
      const fx = weatherEffects(weather, minute);
      const zone = zoneAt(loc, distanceM);
      const rng = seededRng(3);
      let n = 0;
      for (let i = 0; i < 1500; i++) {
        const h = rollHookedFish(zone.fishZone, 'day', rng, undefined, { placeId: loc.id, bandId: zone.id, distanceM, minute }, bait, undefined, fx, poolAt(loc, distanceM));
        if (speciesById(h.speciesId)?.rarity === 'trophy') n++;
      }
      return n;
    };
    expect(count(RIVER_BEND, hm(23), 6, 'maggots', 'rain')).toBeGreaterThan(200);
    expect(count(RIVER_BEND, hm(18, 30), 33, 'strip', 'overcast')).toBeGreaterThan(200);
    expect(count(RIVER_BEND, hm(13), 22, 'worm', 'windy')).toBeGreaterThan(200);
    expect(count(RIVER_BEND, hm(13), 27, 'worm', 'windy')).toBe(0);
    expect(count(QUIET_LAKE, hm(23), 6, 'maggots', 'rain')).toBe(0);
    expect(count(QUIET_LAKE, hm(18, 30), 33, 'strip', 'overcast')).toBe(0);
    expect(count(QUIET_LAKE, hm(13), 22, 'worm', 'windy')).toBe(0);
  });
  it('the weighted pool never holds a trophy or a legendary', () => {
    for (const z of RIVER_BEND.zones) for (const id of Object.keys(poolAt(RIVER_BEND, z.fromM).species)) expect(['trophy', 'legendary']).not.toContain(speciesById(id)?.rarity);
  });
});

describe('the Ferryman: dusk, the deep pool by the far post, the carbon rod', () => {
  it('is a legendary of the river, never bagged or sold', () => {
    const sp = speciesById('ferryman')!;
    expect(sp.rarity).toBe('legendary');
    expect(sp.basePrice).toBe(0);
    expect(slipsAway('ferryman')).toBe(true);
    expect(sp.fact).toBe('Sturgeons are older than the dinosaurs, and this one acts like it.');
  });
  it('the window is the clock\'s dusk, 18:00 to 19:59', () => {
    expect(inFerrymanWindow(hm(18))).toBe(true);
    expect(inFerrymanWindow(hm(19, 59))).toBe(true);
    expect(inFerrymanWindow(hm(17, 59))).toBe(false);
    expect(inFerrymanWindow(hm(20))).toBe(false);
    expect(inFerrymanWindow(hm(18) + 1440)).toBe(true);
  });
  it('needs the river, the pool, 30 m or more (the carbon rod) and dusk', () => {
    const ok = (p: string | undefined, band: string | undefined, d: number, m: number) => ferrymanCanSpawn(p, band, d, m);
    expect(ok(RIVER_ID, 'pool', 33, hm(18, 30))).toBe(true);
    expect(ok(RIVER_ID, 'pool', 30, hm(18))).toBe(true);
    expect(ok(RIVER_ID, 'pool', 29.9, hm(18, 30))).toBe(false);
    expect(ok(RIVER_ID, 'pool', 26, hm(18, 30))).toBe(false); // the fiberglass rod's reach
    expect(ok(RIVER_ID, 'seam', 33, hm(18, 30))).toBe(false);
    expect(ok(RIVER_ID, 'pool', 33, hm(12))).toBe(false);
    expect(ok(RIVER_ID, 'pool', 33, hm(3))).toBe(false);
    expect(ok(LAKE_ID, 'deep', 35, hm(18, 30))).toBe(false);
    expect(ok(undefined, undefined, 35, hm(18, 30))).toBe(false);
    expect(FERRYMAN.minDistanceM).toBeGreaterThan(RIVER_BEND.zones.find((z) => z.id === 'pool')!.fromM); // only past the fiberglass rod's reach
  });
  it('rolls with its chance inside the window, the Pale One stays the lake\'s', () => {
    const rng = seededRng(4);
    let ferry = 0;
    for (let i = 0; i < 3000; i++) if (rollLegendary(35, hm(18, 30), rng, RIVER_ID, 'pool')?.id === 'ferryman') ferry++;
    expect(ferry / 3000).toBeGreaterThan(FERRYMAN.chance - 0.04);
    expect(ferry / 3000).toBeLessThan(FERRYMAN.chance + 0.04);
    const spy = () => {
      throw new Error('rng must not be drawn');
    };
    expect(rollLegendary(35, hm(3), spy, RIVER_ID, 'pool')).toBeUndefined(); // the Pale One's hour at the river: nothing
    expect(rollLegendary(35, hm(18, 30), spy, LAKE_ID)).toBeUndefined(); // the Ferryman's hour at the lake: nothing
    let pale = 0;
    const r2 = seededRng(6);
    for (let i = 0; i < 2000; i++) if (rollLegendary(35, hm(3), r2)?.id === PALE_ONE.speciesId) pale++;
    expect(pale).toBeGreaterThan(300);
  });
  it('the whole landed-cast roll: at the river at dusk it bites, at the lake never', () => {
    const rng = seededRng(7);
    const seen = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      seen.add(rollHookedFish('deep', 'dusk', rng, undefined, { placeId: RIVER_ID, bandId: 'pool', distanceM: 35, minute: hm(18, 30) }, undefined, undefined, undefined, poolAt(RIVER_BEND, 35)).speciesId);
    }
    expect(seen.has('ferryman')).toBe(true);
    const lake = seededRng(8);
    for (let i = 0; i < 1500; i++) {
      expect(rollHookedFish('deep', 'dusk', lake, undefined, { placeId: LAKE_ID, distanceM: 35, minute: hm(18, 30) }, undefined, undefined, undefined, poolAt(QUIET_LAKE, 35)).speciesId).not.toBe('ferryman');
    }
  });
  it('is on the river\'s log card with its place and time', () => {
    const sp = speciesById('ferryman')!;
    expect(placesOf(sp)).toEqual(['River bend']);
    expect(whereWhen(sp)).toBe('Deep pool, 30 m or more · dusk');
    for (const id of trophyIdsAt(RIVER_ID)) {
      expect(placesOf(speciesById(id)!)).toEqual(['River bend']);
      expect(whereWhen(speciesById(id)!)).toBe(RARE_RULES.find((r) => r.speciesId === id)!.where);
    }
  });
});

describe('the Ferryman\'s eerie window: the rope creaks by itself, the current slows', () => {
  it('only at the river and only at dusk', () => {
    expect(ferryWindowOpen(RIVER_ID, hm(18, 30))).toBe(true);
    expect(ferryWindowOpen(RIVER_ID, hm(12))).toBe(false);
    expect(ferryWindowOpen(LAKE_ID, hm(18, 30))).toBe(false);
  });
  it('nothing before the first creak, then one every period', () => {
    expect(ferryCreak(-1)).toMatchObject({ progress: 0, current: 1, sway: 0, index: -1, soundDue: false });
    expect(ferryCreak(0).current).toBe(1);
    expect(ferryCreak(FERRY_WINDOW.firstMs - 1).progress).toBe(0);
    const start = FERRY_WINDOW.firstMs;
    expect(ferryCreak(start + 1).progress).toBeGreaterThan(0);
    expect(ferryCreak(start + FERRY_WINDOW.creakMs).progress).toBe(0); // over
    expect(ferryCreak(start + FERRY_WINDOW.periodMs + 100).index).toBe(1);
    expect(ferryCreak(start + 100).index).toBe(0);
    expect(ferryCreak(start + FERRY_WINDOW.periodMs * 5 + 500).progress).toBeGreaterThan(0);
  });
  it('the current is slowest in the middle of a creak and back to normal at its ends; the sway is bounded', () => {
    const start = FERRY_WINDOW.firstMs;
    const mid = ferryCreak(start + FERRY_WINDOW.creakMs / 2);
    expect(mid.current).toBeCloseTo(FERRY_WINDOW.slowTo, 5);
    expect(ferryCreak(start + 5).current).toBeGreaterThan(0.99);
    let maxSway = 0;
    for (let t = 0; t < 4 * FERRY_WINDOW.periodMs; t += 50) {
      const c = ferryCreak(t);
      expect(c.current).toBeGreaterThanOrEqual(FERRY_WINDOW.slowTo - 1e-9);
      expect(c.current).toBeLessThanOrEqual(1);
      maxSway = Math.max(maxSway, Math.abs(c.sway));
    }
    expect(maxSway).toBeGreaterThan(1);
    expect(maxSway).toBeLessThanOrEqual(FERRY_WINDOW.swayPx);
  });
  it('the sound is due a moment into each creak, once per index', () => {
    const start = FERRY_WINDOW.firstMs;
    expect(ferryCreak(start + FERRY_WINDOW.soundAtMs - 1).soundDue).toBe(false);
    expect(ferryCreak(start + FERRY_WINDOW.soundAtMs).soundDue).toBe(true);
    expect(ferryCreak(start + FERRY_WINDOW.creakMs + 10).soundDue).toBe(false);
    expect(ferryCreak(start + FERRY_WINDOW.periodMs + FERRY_WINDOW.soundAtMs).index).toBe(1);
  });
  it('a creak ends before the next begins', () => {
    expect(FERRY_WINDOW.creakMs).toBeLessThan(FERRY_WINDOW.periodMs);
    expect(FERRY_WINDOW.soundAtMs).toBeLessThan(FERRY_WINDOW.creakMs);
  });
});

describe('the Ferryman\'s card, the journal page and the save', () => {
  it('shows once, remembers the date, queues Pajkel\'s line and adds a river journal page', () => {
    const s0 = newStory();
    expect(ferrymanBeatDue(s0)).toBe(true);
    const s1 = markFerrymanSeen(s0, '2026-11-27');
    expect(ferrymanBeatDue(s1)).toBe(false);
    expect(s1).toMatchObject({ ferryman: true, ferrymanOn: '2026-11-27', queue: ['ferryman'] });
    expect(markFerrymanSeen(s1, '2026-11-28')).toBe(s1);
    const page = journalEntries(s1).find((e) => e.id === 'ferryman');
    expect(page).toMatchObject({ place: 'river-bend', icon: 'pale' });
    expect(page!.text).toMatch(/barnacle shaped like a W/);
  });
  it('is normalised: only a real true survives, with a valid date; it makes the story non-empty', () => {
    expect(normalizeStory({ done: {}, queue: [], pale: false, ferryman: true, ferrymanOn: '2026-11-27' })).toMatchObject({ ferryman: true, ferrymanOn: '2026-11-27' });
    const bad = normalizeStory({ done: {}, queue: [], pale: false, ferryman: 'yes', ferrymanOn: '2026-11-27' });
    expect(bad).not.toHaveProperty('ferryman');
    expect(bad).not.toHaveProperty('ferrymanOn');
    expect(normalizeStory({ ferryman: true, ferrymanOn: 'tomorrow' })).not.toHaveProperty('ferrymanOn');
    expect(storyIsEmpty(markFerrymanSeen(newStory(), '2026-11-27'))).toBe(false);
    expect(storyIsEmpty(newStory())).toBe(true);
  });
});

describe('hints: the half-hint of each river trophy, the notice board rumours and the paper boat note', () => {
  it('every river trophy has a half-hint that does not give the whole recipe away', () => {
    for (const id of trophyIdsAt(RIVER_ID)) {
      const hint = speciesById(id)!.logHint!;
      expect(hint.length, id).toBeGreaterThan(20);
      expect(hint, id).not.toMatch(/maggots|fish strip|strip/i);
    }
  });
  it('a paper boat note says a river hint not yet caught, never a lake one; none when all are caught', () => {
    const lantern = speciesById('lantern')!.logHint!;
    let said = new Set<string | undefined>();
    const rng = seededRng(11);
    for (let i = 0; i < 400; i++) said.add(boatNote({}, RIVER_ID, rng));
    expect(said.has(undefined)).toBe(true); // not every boat has a note
    expect(said.has(lantern)).toBe(true);
    for (const text of said) if (text) expect(trophyIdsAt(RIVER_ID).map((id) => speciesById(id)!.logHint)).toContain(text);
    said = new Set();
    for (let i = 0; i < 200; i++) said.add(boatNote({ lantern: {}, barbelKing: {}, ferryPike: {} }, RIVER_ID, rng));
    expect([...said]).toEqual([undefined]);
    // at the lake no boat comes, but the rule is by place anyway: the lake's hints are not the river's
    said = new Set();
    for (let i = 0; i < 400; i++) said.add(boatNote({}, LAKE_ID, rng));
    expect(said.has(lantern)).toBe(false);
  });
  it('the player starts with nothing mounted', () => {
    expect(boardShows(newPlayer().trophies, RIVER_ID)).toBe(false);
  });
  it('RARE_TUNING still says 20% and a 2.5 s slip', () => {
    expect(RARE_TUNING.chance).toBe(0.2);
    expect(RARE_TUNING.slipAfterMs).toBe(2500);
  });
});
