import { describe, expect, it } from 'vitest';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { sold } from './data/shopStock';
import { TREATS } from './data/treats';
import { FEED_TUNING, addTreats, checkFeed, cozyPending, feedDog, fedToday, normalizeFeeding, normalizeTreats, spendCozy, treatsOf } from './feeding';
import { buyTreats, newPlayer, type PlayerState } from './inventory';
import { normalizeSave } from './save';
import { STICK_TUNING, finishFetchRound, foundToday, sticksOf } from './sticks';

const DAY1 = '2026-11-26';
const DAY2 = '2026-11-27';
const withTreats = (n: number, p: PlayerState = newPlayer()): PlayerState => ({ ...p, treats: n });

/** Feeds `n` times on a date; returns the player and the bonus flags. */
function feeds(p: PlayerState, n: number, today = DAY1): { p: PlayerState; bonus: boolean[] } {
  const bonus: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const r = feedDog(p, today);
    if (!r) break;
    p = r.player;
    bonus.push(r.bonus);
  }
  return { p, bonus };
}

describe('dog treats in the shop', () => {
  it('"Dog treats x5" for 25 coins, sold with the basics at every place', () => {
    expect(TREATS).toMatchObject({ id: 'treats', name: 'Dog treats', packSize: 5, price: 25 });
    expect(sold(QUIET_LAKE.shop, TREATS.id)).toBe(true);
    expect(sold(RIVER_BEND.shop, TREATS.id)).toBe(true);
    expect(QUIET_LAKE.shop.bait).toContain(TREATS.id);
  });

  it('a pack costs 25 coins and adds 5 treats; without the coins nothing changes', () => {
    const p = { ...newPlayer(), coins: 100 };
    const r = buyTreats(p);
    expect(r.ok).toBe(true);
    expect(r.state.coins).toBe(75);
    expect(treatsOf(r.state)).toBe(5);
    expect(treatsOf(buyTreats(r.state).state)).toBe(10);
    const poor = { ...newPlayer(), coins: 24 };
    const no = buyTreats(poor);
    expect(no).toMatchObject({ ok: false, error: 'needCoins', missing: 1 });
    expect(no.state).toBe(poor);
  });

  it('can be bought at the river too', () => {
    expect(buyTreats({ ...newPlayer(), coins: 50 }, RIVER_BEND.shop).ok).toBe(true);
  });
});

describe('putting a treat in the bowl', () => {
  it('needs a treat; the count only goes down by the one fed', () => {
    expect(checkFeed(newPlayer(), DAY1)).toBe('noTreats');
    expect(feedDog(newPlayer(), DAY1)).toBeNull();
    const r = feedDog(withTreats(3), DAY1)!;
    expect(treatsOf(r.player)).toBe(2);
    expect(r.player.fedDay).toBe(DAY1);
    expect(r.player.fedDayN).toBe(1);
  });

  it('the last treat removes the key (nothing stored for zero)', () => {
    const r = feedDog(withTreats(1), DAY1)!;
    expect('treats' in r.player).toBe(false);
  });

  it('the first feed of a real day switches the cozy bonus on, later feeds that day do not', () => {
    const { p, bonus } = feeds(withTreats(3), 3);
    expect(bonus).toEqual([true, false, false]);
    expect(cozyPending(p)).toBe(true);
    expect(fedToday(p, DAY1)).toBe(3);
  });

  it('at most 3 a day, then she is full (and nothing is spent)', () => {
    expect(FEED_TUNING.perDay).toBe(3);
    const { p } = feeds(withTreats(10), 5);
    expect(treatsOf(p)).toBe(7);
    expect(checkFeed(p, DAY1)).toBe('full');
    expect(feedDog(p, DAY1)).toBeNull();
  });

  it('a new real day starts the count over and the first feed brings the bonus again', () => {
    let { p } = feeds(withTreats(10), 3);
    expect(checkFeed(p, DAY2)).toBe('ok');
    expect(fedToday(p, DAY2)).toBe(0);
    p = spendCozy(p);
    const r = feedDog(p, DAY2)!;
    expect(r.bonus).toBe(true);
    expect(r.player.fedDay).toBe(DAY2);
    expect(r.player.fedDayN).toBe(1);
  });

  it('full beats no treats in what is said, and a bad date feeds nothing', () => {
    const { p } = feeds(withTreats(3), 3);
    expect(checkFeed(p, DAY1)).toBe('full');
    expect(feedDog(withTreats(2), 'garbage')).toBeNull();
  });

  it('never mutates its input', () => {
    const p = withTreats(2);
    feedDog(p, DAY1);
    expect(p).toEqual(withTreats(2));
  });

  it('addTreats ignores zero or less and caps the bag', () => {
    expect(addTreats(newPlayer(), 0)).toEqual(newPlayer());
    expect(treatsOf(addTreats(withTreats(98), 5))).toBe(FEED_TUNING.maxTreats);
  });
});

describe('the cozy bonus makes her next fetch round a stick round', () => {
  /** Rounds 2 and 3 never bring a stick on their own (1, 4, 7 do). */
  const afterRoundOne = (): PlayerState => finishFetchRound(newPlayer(), 'quiet-lake', DAY1).player;

  it('without it round 2 brings nothing', () => {
    const r = finishFetchRound(afterRoundOne(), 'quiet-lake', DAY1);
    expect(r.found).toBeNull();
  });

  it('with it the next round brings a stick, and the bonus is used up', () => {
    const fed = feedDog(withTreats(1, afterRoundOne()), DAY1)!.player;
    expect(cozyPending(fed)).toBe(true);
    const r = finishFetchRound(fed, 'quiet-lake', DAY1);
    expect(r.found).not.toBeNull();
    expect(cozyPending(r.player)).toBe(false);
    expect(r.player.fetchRounds).toBe(2);
    // The round after is an ordinary one again.
    expect(finishFetchRound(r.player, 'quiet-lake', DAY1).found).toBeNull();
  });

  it('the 2-new-sticks-a-day cap still applies; the bonus is spent anyway', () => {
    let p = afterRoundOne(); // 1 stick today
    p = feedDog(withTreats(1, p), DAY1)!.player;
    const r = finishFetchRound(p, 'quiet-lake', DAY1); // 2nd stick today (bonus)
    expect(r.found).not.toBeNull();
    expect(foundToday(r.player, DAY1)).toBe(2);
    // Another day's first feed, but today's cap is full: nothing found, bonus spent.
    const again = feedDog({ ...r.player, treats: 2, fedDay: DAY2, fedDayN: 0 }, DAY1);
    expect(again).not.toBeNull();
    const capped = finishFetchRound(again!.player, 'quiet-lake', DAY1);
    expect(foundToday(capped.player, DAY1)).toBe(STICK_TUNING.perDay);
    expect(capped.found).toBeNull();
    expect(cozyPending(capped.player)).toBe(false);
    expect(sticksOf(capped.player)).toHaveLength(2);
  });

  it('a bonus that is never used keeps waiting (until the next finished round)', () => {
    const fed = feedDog(withTreats(1, afterRoundOne()), DAY1)!.player;
    expect(cozyPending(fed)).toBe(true);
    expect(cozyPending(spendCozy(fed))).toBe(false);
  });
});

describe('saving the feeding fields', () => {
  it('normalises junk and keeps nothing for nothing', () => {
    expect(normalizeFeeding({})).toEqual({});
    expect(normalizeFeeding({ treats: 0, fedDay: 'nope', fedDayN: 2, cozy: 'yes' })).toEqual({});
    expect(normalizeFeeding({ treats: 'many' })).toEqual({});
    expect(normalizeFeeding({ treats: -4 })).toEqual({});
    expect(normalizeTreats(2.9)).toBe(2);
    expect(normalizeTreats(5000)).toBe(FEED_TUNING.maxTreats);
    expect(normalizeTreats(NaN)).toBe(0);
  });

  it('keeps good values, clamps the day count to the daily cap and the bonus to true', () => {
    expect(normalizeFeeding({ treats: 7.8, fedDay: DAY1, fedDayN: 9, cozy: true })).toEqual({ treats: 7, fedDay: DAY1, fedDayN: 3, cozy: true });
    expect(normalizeFeeding({ fedDay: DAY1, fedDayN: 0 })).toEqual({});
  });

  it('round-trips through normalizeSave, and an old save has none of the keys', () => {
    const p = { ...newPlayer(), treats: 4, fedDay: DAY1, fedDayN: 2, cozy: true as const };
    const loaded = normalizeSave({ version: 1, player: p }).player;
    expect(loaded).toMatchObject({ treats: 4, fedDay: DAY1, fedDayN: 2, cozy: true });
    const old = normalizeSave({ version: 1, player: newPlayer() }).player;
    expect('treats' in old || 'fedDay' in old || 'fedDayN' in old || 'cozy' in old).toBe(false);
    const junk = normalizeSave({ version: 1, player: { ...newPlayer(), treats: 'x', fedDay: 5, fedDayN: -1, cozy: 1 } }).player;
    expect('treats' in junk || 'fedDay' in junk || 'fedDayN' in junk || 'cozy' in junk).toBe(false);
  });
});
