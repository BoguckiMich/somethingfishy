import { describe, expect, it } from 'vitest';
import { STICKS, sticksAt } from './data/sticks';
import { newPlayer, type PlayerState } from './inventory';
import { normalizeSave } from './save';
import { STICK_TUNING, finishFetchRound, firstSticks, foundToday, isStickRound, museumCount, nextStick, normalizeSticks, sticksOf } from './sticks';

const DAY1 = '2026-11-26';
const DAY2 = '2026-11-27';

/** Finishes `n` rounds on a date; returns the player and the ids found. */
function rounds(p: PlayerState, n: number, today = DAY1, place = 'quiet-lake'): { p: PlayerState; found: string[] } {
  const found: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = finishFetchRound(p, place, today);
    p = r.player;
    if (r.found) found.push(r.found.id);
  }
  return { p, found };
}

describe('the stick data', () => {
  it('has 10 sticks at Quiet Lake and 3 kept for the River bend, with unique ids and one-line reviews', () => {
    expect(sticksAt('quiet-lake')).toHaveLength(10);
    expect(sticksAt('river-bend')).toHaveLength(3);
    expect(new Set(STICKS.map((s) => s.id)).size).toBe(STICKS.length);
    for (const s of STICKS) {
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.review.length).toBeGreaterThan(5);
      expect(s.review.length).toBeLessThanOrEqual(40);
      expect([0, 1, 2]).toContain(s.variant);
    }
    expect(STICKS[0]).toMatchObject({ name: 'The Crooked Fork', review: '10/10. Will not give back.' });
  });
});

describe('which rounds bring a stick', () => {
  it('the first round, then every 3rd after it (1, 4, 7, ...)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(isStickRound)).toEqual([true, false, false, true, false, false, true, true]);
    expect(isStickRound(0)).toBe(false);
    expect(STICK_TUNING.every).toBe(3);
  });

  it('the very first finished round brings the first stick', () => {
    const r = finishFetchRound(newPlayer(), 'quiet-lake', DAY1);
    expect(r.found?.id).toBe('crooked-fork');
    expect(r.player.sticks).toEqual(['crooked-fork']);
    expect(r.player.fetchRounds).toBe(1);
  });

  it('rounds 2 and 3 bring nothing but are counted; round 4 brings the next one, in data order', () => {
    const a = rounds(newPlayer(), 4);
    expect(a.found).toEqual([STICKS[0].id, STICKS[1].id]);
    expect(a.p.fetchRounds).toBe(4);
  });
});

describe('the daily cap', () => {
  it('at most 2 new sticks on one real day, however many rounds', () => {
    const a = rounds(newPlayer(), 12, DAY1); // rounds 1, 4, 7, 10 are stick rounds
    expect(a.found).toHaveLength(STICK_TUNING.perDay);
    expect(foundToday(a.p, DAY1)).toBe(2);
    expect(a.p.fetchRounds).toBe(12);
  });

  it('a new real day starts the count again', () => {
    const a = rounds(newPlayer(), 7, DAY1); // 1 and 4 found, 7 is capped
    expect(a.found).toHaveLength(2);
    expect(foundToday(a.p, DAY2)).toBe(0);
    const b = rounds(a.p, 3, DAY2); // rounds 8, 9, 10: round 10 is a stick round
    expect(b.found).toEqual([STICKS[2].id]);
    expect(sticksOf(b.p)).toEqual(STICKS.slice(0, 3).map((s) => s.id));
  });

  it('a capped stick round is not made up for later', () => {
    const a = rounds(newPlayer(), 7, DAY1);
    expect(a.p.sticks).toHaveLength(2);
    const b = rounds(a.p, 1, DAY1); // round 8: not a stick round
    expect(b.found).toEqual([]);
  });
});

describe('the museum fills up', () => {
  it('never awards the River bend sticks at Quiet Lake and stops when the 10 are found', () => {
    let p: PlayerState = { ...newPlayer(), sticks: firstSticks('quiet-lake') };
    expect(nextStick(p, 'quiet-lake')).toBeNull();
    const r = finishFetchRound({ ...p, fetchRounds: 9 }, 'quiet-lake', DAY1);
    expect(r.found).toBeNull();
    expect(r.player.sticks).toHaveLength(10);
    expect(r.player.fetchRounds).toBe(10);
    p = r.player;
    expect(museumCount(p, 'quiet-lake')).toEqual({ found: 10, total: 10 });
    expect(nextStick({ ...newPlayer() }, 'river-bend')?.id).toBe('ferry-fender');
  });

  it('counts n of 10', () => {
    expect(museumCount(newPlayer(), 'quiet-lake')).toEqual({ found: 0, total: 10 });
    expect(museumCount({ ...newPlayer(), sticks: ['crooked-fork', 'tiny-fiddle'] }, 'quiet-lake')).toEqual({ found: 2, total: 10 });
    expect(firstSticks('quiet-lake', 3)).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    const p = newPlayer();
    const before = JSON.stringify(p);
    finishFetchRound(p, 'quiet-lake', DAY1);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('ignores a malformed date (no stick, the round still counts)', () => {
    const r = finishFetchRound(newPlayer(), 'quiet-lake', 'someday');
    expect(r.found).toBeNull();
    expect(r.player.fetchRounds).toBe(1);
  });
});

describe('saving the museum', () => {
  it('normalises the list: known ids only, no duplicates, found order kept', () => {
    expect(normalizeSticks(undefined)).toEqual([]);
    expect(normalizeSticks('crooked-fork')).toEqual([]);
    expect(normalizeSticks(['tiny-fiddle', 'nope', 'tiny-fiddle', 4, 'crooked-fork'])).toEqual(['tiny-fiddle', 'crooked-fork']);
  });

  it('an old save without the new fields loads and has none of the keys', () => {
    const p = normalizeSave({ version: 1, player: { coins: 10, worms: 1, bag: [] }, clock: { day: 1, minute: 600 } }).player;
    expect(p.sticks).toBeUndefined();
    expect(p.fetchRounds).toBeUndefined();
    expect(p.stickDay).toBeUndefined();
    expect(p.skipsBest).toBeUndefined();
    expect(p.skipsLineDay).toBeUndefined();
  });

  it('keeps good values and drops junk', () => {
    const good = normalizeSave({
      version: 1,
      player: { sticks: ['crooked-fork', 'x'], fetchRounds: 4.7, stickDay: DAY1, stickDayN: 2, skipsBest: 4, skipsLineDay: DAY1 },
      clock: {},
    }).player;
    expect(good).toMatchObject({ sticks: ['crooked-fork'], fetchRounds: 4, stickDay: DAY1, stickDayN: 2, skipsBest: 4, skipsLineDay: DAY1 });
    const bad = normalizeSave({ version: 1, player: { sticks: 5, fetchRounds: 'x', stickDay: 'never', stickDayN: 2, skipsBest: -3, skipsLineDay: 7 }, clock: {} }).player;
    expect(bad.sticks).toBeUndefined();
    expect(bad.fetchRounds).toBeUndefined();
    expect(bad.stickDay).toBeUndefined();
    expect(bad.stickDayN).toBeUndefined();
    expect(bad.skipsBest).toBeUndefined();
    expect(bad.skipsLineDay).toBeUndefined();
  });
});
