import { describe, expect, it } from 'vitest';
import { NEW_GAME_CLOCK } from './clock';
import { SHOP } from './data/shop';
import { newPlayer } from './inventory';
import {
  CURRENT_VERSION,
  SAVE_BACKUP_KEY,
  SAVE_BROKEN_KEY,
  SAVE_KEY,
  backupSave,
  clearSave,
  isSandbox,
  loadSave,
  newSave,
  normalizeSave,
  parseSave,
  saveSummary,
  startOver,
  writeSave,
  type SaveData,
} from './save';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('quota');
  },
  removeItem: (): void => {
    throw new Error('blocked');
  },
};

const fish = { speciesId: 'perch', lengthCm: 20, weightG: 150, price: 12 };

describe('newSave / startOver', () => {
  it('is a fresh player at the new-game clock', () => {
    expect(newSave()).toEqual({ version: 1, player: newPlayer(), clock: NEW_GAME_CLOCK });
  });
  it('resets everything', () => {
    const s: SaveData = { version: 1, player: { ...newPlayer(), coins: 99, bag: [fish] }, clock: { day: 5, minute: 700 } };
    expect(startOver(s)).toEqual(newSave());
  });
});

describe('normalizeSave', () => {
  it('keeps a good save as is', () => {
    const s: SaveData = {
      version: 1,
      player: { coins: 40, worms: 3, bag: [fish], rodId: 'carbon', log: { perch: { count: 2, bestLengthCm: 22, bestWeightG: 200 } }, daily: { lastBoxDate: '2026-11-22', streakTier: 3 }, quests: { date: '2026-11-23', rerollUsed: true, list: [{ kind: 'catchSpecies', params: { target: 3, speciesId: 'roach' }, progress: 3, done: true, claimed: false, reward: { coins: 25, worms: 3 } }, { kind: 'catchAtTime', params: { target: 2, timeOfDay: 'dusk' }, progress: 1, done: false, claimed: false, reward: { coins: 30, worms: 4 } }] }, notes: { read: ['recipe', 'raft'] } },
      clock: { day: 4, minute: 123.5 },
    };
    expect(normalizeSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('fixes numbers and unknown rods', () => {
    const r = normalizeSave({ version: 1, player: { coins: -5.7, worms: 'x', rodId: 'laser' }, clock: {} });
    expect(r.player.coins).toBe(0);
    expect(r.player.worms).toBe(SHOP.startWorms);
    expect(r.player.rodId).toBe('bamboo');
    const f = normalizeSave({ version: 1, player: { coins: 12.9, worms: 4.2 } });
    expect(f.player.coins).toBe(12);
    expect(f.player.worms).toBe(4);
  });
  it('keeps a known line and reel, drops unknown ones, and adds nothing to an old save', () => {
    const ok = normalizeSave({ version: 1, player: { lineId: 'fluoro', reelId: 'smooth' }, clock: {} });
    expect(ok.player).toMatchObject({ lineId: 'fluoro', reelId: 'smooth' });
    const bad = normalizeSave({ version: 1, player: { lineId: 'rope', reelId: 7 }, clock: {} });
    expect('lineId' in bad.player).toBe(false);
    expect('reelId' in bad.player).toBe(false);
    expect('lineId' in normalizeSave({ version: 1, player: {}, clock: {} }).player).toBe(false);
  });
  it('drops bad bag and log entries and caps the bag', () => {
    const bag = [fish, { ...fish, speciesId: 'dragon' }, { ...fish, lengthCm: 'x' }, null, 5, { ...fish, weightG: 0 }];
    const many = Array.from({ length: 15 }, () => fish);
    expect(normalizeSave({ player: { bag } }).player.bag).toEqual([fish]);
    expect(normalizeSave({ player: { bag: many } }).player.bag).toHaveLength(SHOP.bagSlots);
    const log = {
      perch: { count: 2, bestLengthCm: 22, bestWeightG: 200 },
      dragon: { count: 1, bestLengthCm: 1, bestWeightG: 1 },
      roach: { count: 0, bestLengthCm: 10, bestWeightG: 10 },
      rudd: { count: 1, bestLengthCm: -3, bestWeightG: 10 },
      bleak: 'nope',
    };
    expect(Object.keys(normalizeSave({ player: { log } }).player.log)).toEqual(['perch']);
  });
  it('clamps the clock', () => {
    expect(normalizeSave({ clock: { day: 0, minute: -4 } }).clock).toEqual({ day: 1, minute: 0 });
    expect(normalizeSave({ clock: { day: 3.9, minute: 99999 } }).clock.day).toBe(3);
    expect(normalizeSave({ clock: { day: 3, minute: 99999 } }).clock.minute).toBeLessThan(1440);
    expect(normalizeSave('junk').clock).toEqual(NEW_GAME_CLOCK);
  });
});

describe('parseSave', () => {
  it('reads a valid save', () => {
    expect(parseSave(JSON.stringify(newSave()))).toEqual({ ok: true, save: newSave() });
  });
  it('rejects junk and non-objects', () => {
    expect(parseSave('{nope')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseSave('[1]')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseSave('{"player":{}}')).toEqual({ ok: false, reason: 'unreadable' });
  });
  it('rejects a newer version', () => {
    expect(parseSave(JSON.stringify({ ...newSave(), version: CURRENT_VERSION + 1 }))).toEqual({ ok: false, reason: 'tooNew' });
  });
  it('applies the migration chain in order', () => {
    const migrations = {
      0: (o: unknown) => ({ ...(o as object), version: 1, player: { coins: 7 } }),
      1: (o: unknown) => ({ ...(o as object), version: 2, player: { ...(o as { player: object }).player, worms: 8 } }),
    };
    const r = parseSave(JSON.stringify({ version: 0 }), { migrations, currentVersion: 2 });
    expect(r.ok && r.save.player.coins).toBe(7);
    expect(r.ok && r.save.player.worms).toBe(8);
  });
  it('fails when a migration step is missing or throws', () => {
    expect(parseSave(JSON.stringify({ version: 0 }), { migrations: {}, currentVersion: 1 })).toEqual({ ok: false, reason: 'unreadable' });
    const bad = {
      0: () => {
        throw new Error('x');
      },
    };
    expect(parseSave(JSON.stringify({ version: 0 }), { migrations: bad, currentVersion: 1 })).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('storage', () => {
  it('fresh when nothing is stored', () => {
    expect(loadSave(memoryStorage())).toEqual({ save: newSave(), status: 'fresh' });
  });
  it('write then load round-trips (save, reload, same state)', () => {
    const s = memoryStorage();
    const save: SaveData = { version: 1, player: { ...newPlayer(), coins: 77, bag: [fish] }, clock: { day: 3, minute: 800 } };
    expect(writeSave(s, save)).toBe(true);
    expect(loadSave(s)).toEqual({ save, status: 'loaded' });
  });
  it('keeps a broken save aside and starts fresh', () => {
    const s = memoryStorage({ [SAVE_KEY]: '{oops' });
    expect(loadSave(s)).toEqual({ save: newSave(), status: 'broken' });
    expect(s.data[SAVE_BROKEN_KEY]).toBe('{oops');
  });
  it('treats a too-new save as broken', () => {
    const text = JSON.stringify({ ...newSave(), version: 9 });
    const s = memoryStorage({ [SAVE_KEY]: text });
    expect(loadSave(s).status).toBe('broken');
    expect(s.data[SAVE_BROKEN_KEY]).toBe(text);
  });
  it('never throws on bad storage', () => {
    expect(loadSave(throwing)).toEqual({ save: newSave(), status: 'fresh' });
    expect(loadSave(undefined).status).toBe('fresh');
    expect(writeSave(throwing, newSave())).toBe(false);
    expect(writeSave(undefined, newSave())).toBe(false);
    expect(() => clearSave(throwing)).not.toThrow();
    expect(() => backupSave(throwing)).not.toThrow();
  });
  it('clears and backs up', () => {
    const s = memoryStorage();
    writeSave(s, newSave());
    const raw = s.data[SAVE_KEY];
    backupSave(s);
    expect(s.data[SAVE_BACKUP_KEY]).toBe(raw);
    clearSave(s);
    expect(SAVE_KEY in s.data).toBe(false);
    backupSave(s);
    expect(s.data[SAVE_BACKUP_KEY]).toBe(raw); // nothing to copy: the old backup stays
  });
});

describe('isSandbox', () => {
  it('is false for no params, skipnames and reset', () => {
    expect(isSandbox([])).toBe(false);
    expect(isSandbox(['skipnames'])).toBe(false);
    expect(isSandbox(['skipnames', 'reset'])).toBe(false);
  });
  it('is true for any other param', () => {
    expect(isSandbox(['time'])).toBe(true);
    expect(isSandbox(['skipnames', 'debug'])).toBe(true);
  });
});

describe('saveSummary', () => {
  it('counts species and coins', () => {
    const save: SaveData = { ...newSave(), player: { ...newPlayer(), coins: 340, log: { perch: { count: 1, bestLengthCm: 1, bestWeightG: 1 } } } };
    expect(saveSummary(save)).toEqual({ species: 1, coins: 340 });
  });
});

describe('normalizeSave: daily box', () => {
  const daily = (d: unknown) => normalizeSave({ version: 1, player: { daily: d } }).player.daily;
  it('defaults when missing or not an object', () => {
    expect(daily(undefined)).toEqual({ lastBoxDate: null, streakTier: 0 });
    expect(daily('x')).toEqual({ lastBoxDate: null, streakTier: 0 });
    expect(daily([1])).toEqual({ lastBoxDate: null, streakTier: 0 });
  });
  it('drops a malformed or impossible date', () => {
    expect(daily({ lastBoxDate: '2026-1-5', streakTier: 3 })).toEqual({ lastBoxDate: null, streakTier: 0 });
    expect(daily({ lastBoxDate: '2026-13-01', streakTier: 3 })).toEqual({ lastBoxDate: null, streakTier: 0 });
    expect(daily({ lastBoxDate: 20261123, streakTier: 3 })).toEqual({ lastBoxDate: null, streakTier: 0 });
  });
  it('clamps the tier to 1..5 when there is a date', () => {
    expect(daily({ lastBoxDate: '2026-11-22', streakTier: 99 })).toEqual({ lastBoxDate: '2026-11-22', streakTier: 5 });
    expect(daily({ lastBoxDate: '2026-11-22', streakTier: -4 })).toEqual({ lastBoxDate: '2026-11-22', streakTier: 1 });
    expect(daily({ lastBoxDate: '2026-11-22', streakTier: 'x' })).toEqual({ lastBoxDate: '2026-11-22', streakTier: 1 });
    expect(daily({ lastBoxDate: '2026-11-22', streakTier: 2.9 })).toEqual({ lastBoxDate: '2026-11-22', streakTier: 2 });
  });
});

describe('normalizeSave: quests', () => {
  const good = { kind: 'catchSpecies', params: { target: 3, speciesId: 'roach' }, progress: 1, done: false, claimed: false, reward: { coins: 25, worms: 3 } };
  const quests = (q: unknown) => normalizeSave({ version: 1, player: { quests: q } }).player.quests;
  const empty = { date: null, rerollUsed: false, list: [] };
  it('defaults when missing, broken or without a valid date', () => {
    expect(quests(undefined)).toEqual(empty);
    expect(quests('x')).toEqual(empty);
    expect(quests({ date: '2026-02-30', list: [good] })).toEqual(empty);
    expect(quests({ date: '2026-11-23', list: 'x' })).toEqual(empty);
  });
  it('rolls afresh when no quest is usable', () => {
    expect(quests({ date: '2026-11-23', list: [{ ...good, kind: 'fly' }] })).toEqual(empty);
  });
  it('drops bad quests: unknown kind or species, the legendary, bad target, bad time', () => {
    const list = [
      good,
      { ...good, kind: 'nonsense' },
      { ...good, params: { target: 3, speciesId: 'dragon' } },
      { ...good, params: { target: 1, speciesId: 'pale' } },
      { ...good, params: { target: 0, speciesId: 'roach' } },
      { kind: 'catchAtTime', params: { target: 1, timeOfDay: 'day' }, progress: 0, reward: { coins: 1, worms: 1 } },
      'x',
    ];
    expect(quests({ date: '2026-11-23', list })!.list).toEqual([good]);
  });
  it('keeps at most three and clamps the numbers', () => {
    const q = quests({ date: '2026-11-23', rerollUsed: 1, list: [good, good, good, good] })!;
    expect(q.list).toHaveLength(3);
    expect(q.rerollUsed).toBe(false); // only a real true counts
    const odd = quests({ date: '2026-11-23', list: [{ ...good, progress: 99, claimed: true, reward: { coins: -5, worms: 'x' } }, { ...good, progress: -2, claimed: true, params: { target: 3.9, speciesId: 'roach' } }] })!.list;
    expect(odd[0]).toMatchObject({ progress: 3, done: true, claimed: true, reward: { coins: 0, worms: 0 } });
    expect(odd[1]).toMatchObject({ progress: 0, done: false, claimed: false, params: { target: 3 } }); // a claim needs a finished quest
  });
});

describe('normalizeSave: notes', () => {
  const notes = (n: unknown) => normalizeSave({ version: 1, player: { notes: n } }).player.notes;
  it('defaults to nothing read when missing or broken (an old save has no notes)', () => {
    expect(notes(undefined)).toEqual({ read: [] });
    expect(notes('x')).toEqual({ read: [] });
    expect(notes({ read: 'x' })).toEqual({ read: [] });
  });
  it('drops unknown ids, non-strings and duplicates', () => {
    expect(notes({ read: ['recipe', 'nope', 7, 'recipe', 'raft'] })).toEqual({ read: ['recipe', 'raft'] });
  });
});

describe('normalizeSave: night kit', () => {
  const kit = (v: unknown) => normalizeSave({ version: 1, player: { nightKit: v } }).player.nightKit;
  it('is kept only when true; an old save has no key', () => {
    expect(kit(true)).toBe(true);
    expect(kit(false)).toBeUndefined();
    expect(kit('yes')).toBeUndefined();
    expect(kit(undefined)).toBeUndefined();
    expect('nightKit' in normalizeSave({ version: 1, player: {} }).player).toBe(false);
  });
});

describe('normalizeSave: seen hints', () => {
  const seenOf = (v: unknown) => normalizeSave({ player: { seen: v } }).player.seen;
  it('stores nothing when nothing was seen (an old save has no key)', () => {
    expect('seen' in normalizeSave({ player: {} }).player).toBe(false);
    expect('seen' in newPlayer()).toBe(false);
    expect(seenOf('car')).toBeUndefined();
    expect(seenOf([])).toBeUndefined();
  });
  it('keeps known ids once, drops the rest, and round-trips', () => {
    expect(seenOf(['sign', 'zzz', 'car', 'sign', 4, 'cast1'])).toEqual(['car', 'sign', 'cast1']);
    const s = normalizeSave({ player: { seen: ['dog', 'cast1', 'cast2'] } });
    expect(normalizeSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe('weather line date (slice 23b)', () => {
  it('keeps a valid date, drops a bad one, and stores nothing by default', () => {
    expect(normalizeSave({ version: 1, player: { weatherSeen: '2026-11-24-09' }, clock: {} })?.player.weatherSeen).toBe('2026-11-24-09');
    expect(normalizeSave({ version: 1, player: { weatherSeen: 'yesterday' }, clock: {} })?.player).not.toHaveProperty('weatherSeen');
    expect(normalizeSave({ version: 1, player: {}, clock: {} })?.player).not.toHaveProperty('weatherSeen');
  });
});

describe('trophy board (slice 23d)', () => {
  const good = { goldenTench: { lengthCm: 52, weightG: 2400, date: '2026-11-24' } };
  it('stores nothing by default and keeps a good board through a round trip', () => {
    expect(normalizeSave({ version: 1, player: {}, clock: {} })?.player).not.toHaveProperty('trophies');
    const s = normalizeSave({ version: 1, player: { trophies: good }, clock: {} });
    expect(s.player.trophies).toEqual(good);
    expect(normalizeSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('drops unknown fish, bad sizes and bad dates, and stores nothing when nothing is left', () => {
    const bad = { carp: good.goldenTench, mossback: { lengthCm: 'big', weightG: 5, date: '2026-11-24' }, silverGhost: { lengthCm: 30, weightG: 200, date: 'soon' } };
    const p = normalizeSave({ version: 1, player: { trophies: bad }, clock: {} }).player;
    expect(p.trophies).toEqual({ silverGhost: { lengthCm: 30, weightG: 200, date: '' } });
    expect(normalizeSave({ version: 1, player: { trophies: { carp: good.goldenTench } }, clock: {} }).player).not.toHaveProperty('trophies');
    expect(normalizeSave({ version: 1, player: { trophies: 5 }, clock: {} }).player).not.toHaveProperty('trophies');
  });
});

describe('the last nap stamp (balance A2)', () => {
  it('is kept when it is a real time stamp and dropped otherwise', () => {
    expect(normalizeSave({ version: 1, player: { napAt: 1_764_000_000_000 }, clock: {} }).player.napAt).toBe(1_764_000_000_000);
    for (const bad of ['now', -5, 0, NaN, null, {}]) expect(normalizeSave({ version: 1, player: { napAt: bad }, clock: {} }).player).not.toHaveProperty('napAt');
    expect(normalizeSave({ version: 1, player: {}, clock: {} }).player).not.toHaveProperty('napAt');
  });
});

describe('normalizeSave: river gear (slice 25g)', () => {
  const gear = (player: unknown) => normalizeSave({ version: 1, player }).player;
  it('is kept only when true; an old save has no keys', () => {
    const p = gear({ riverFloat: true, riverLead: true });
    expect(p.riverFloat).toBe(true);
    expect(p.riverLead).toBe(true);
    const half = gear({ riverFloat: true, riverLead: 'yes' });
    expect(half.riverFloat).toBe(true);
    expect('riverLead' in half).toBe(false);
    for (const key of ['riverFloat', 'riverLead']) expect(key in gear({})).toBe(false);
    expect('riverFloat' in newPlayer()).toBe(false);
  });
});
