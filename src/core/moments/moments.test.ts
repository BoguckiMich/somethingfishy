import { describe, expect, it } from 'vitest';
import { MOMENTS, MOMENT_KINDS, MOMENT_TUNING, NOTES } from '../data/moments';
import type { LayerMix } from '../eerie';
import { newPlayer } from '../inventory';
import { seededRng } from '../random';
import {
  easeMomentDim,
  momentClockRunning,
  tickMomentAge,
  claimStar,
  dipCrickets,
  inHourWindow,
  isUncanny,
  momentsAt,
  newNotes,
  newScheduler,
  noteById,
  normalizeNotes,
  notesAt,
  openBottle,
  pickMoment,
  pickNote,
  tickScheduler,
} from './moments';

const at = (h: number, m = 0) => h * 60 + m;

describe('inHourWindow', () => {
  it('is from-inclusive, to-exclusive and wraps past midnight', () => {
    expect(inHourWindow(at(6), 6, 19)).toBe(true);
    expect(inHourWindow(at(19), 6, 19)).toBe(false);
    expect(inHourWindow(at(23, 59), 21, 4)).toBe(true);
    expect(inHourWindow(at(3, 59), 21, 4)).toBe(true);
    expect(inHourWindow(at(4), 21, 4)).toBe(false);
    expect(inHourWindow(at(12), 0, 24)).toBe(true);
  });
});

describe('scheduler', () => {
  it('rolls a first gap of 90-270 s', () => {
    for (let i = 0; i < 200; i++) {
      const s = newScheduler(seededRng(i));
      expect(s.remainingMs).toBeGreaterThanOrEqual(90_000);
      expect(s.remainingMs).toBeLessThan(270_000);
    }
  });
  it('only counts down while active', () => {
    const s = { remainingMs: 100_000 };
    expect(tickScheduler(s, 5000, false, seededRng(1))).toEqual({ scheduler: s, due: false });
    expect(tickScheduler(s, 5000, true, seededRng(1))).toEqual({ scheduler: { remainingMs: 95_000 }, due: false });
  });
  it('fires when the gap runs out and starts a fresh gap', () => {
    const r = tickScheduler({ remainingMs: 1000 }, 1000, true, seededRng(3));
    expect(r.due).toBe(true);
    expect(r.scheduler.remainingMs).toBeGreaterThanOrEqual(90_000);
    expect(r.scheduler.remainingMs).toBeLessThan(270_000);
  });
  it('fires at most once per tick, however long the tick', () => {
    expect(tickScheduler({ remainingMs: 1000 }, 999_999, true, seededRng(3)).due).toBe(true);
  });
});

describe('momentsAt / pickMoment', () => {
  it('uncanny moments exist only 01:00-05:00', () => {
    for (let m = 0; m < 1440; m += 5) {
      const uncanny = momentsAt(m).filter(isUncanny);
      expect(uncanny.length > 0).toBe(m >= at(1) && m < at(5));
    }
  });
  it('follows the windows: duck by day, frog at dusk, star at night, never an empty pool', () => {
    expect(momentsAt(at(12))).toContain('duck');
    expect(momentsAt(at(12))).not.toContain('frog');
    expect(momentsAt(at(18, 30))).toEqual(expect.arrayContaining(['duck', 'frog', 'jump', 'bottle']));
    expect(momentsAt(at(22))).toContain('star');
    expect(momentsAt(at(22))).not.toContain('duck');
    expect(momentsAt(at(5, 30))).not.toContain('star');
    for (let m = 0; m < 1440; m += 10) expect(momentsAt(m).length).toBeGreaterThan(0);
  });
  it('only picks moments whose window is open, and follows the weights', () => {
    const rng = seededRng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 6000; i++) {
      const k = pickMoment(at(12), rng);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['bottle', 'duck', 'jump']);
    // weights duck 4 : bottle 2
    expect(counts.duck / counts.bottle).toBeGreaterThan(1.7);
    expect(counts.duck / counts.bottle).toBeLessThan(2.4);
  });
  it('does not repeat the last kind when there is a choice', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 500; i++) expect(pickMoment(at(12), rng, 'duck')).not.toBe('duck');
  });
  it('every kind has a positive weight and duration', () => {
    for (const k of MOMENT_KINDS) {
      expect(MOMENTS[k].weight).toBeGreaterThan(0);
      expect(MOMENTS[k].durationMs).toBeGreaterThan(0);
    }
  });

  /**
   * Simulates whole 01:00-05:00 windows (200 real seconds at 20 real minutes a day) with the real
   * scheduler and picker, a moment taking ~20 s on screen. "About 1 night in 3" must hold.
   */
  it('shows an uncanny moment on roughly one night in three', () => {
    const nights = 3000;
    const windowMs = (4 / 24) * 20 * 60 * 1000;
    const startMin = at(1);
    let withUncanny = 0;
    for (let n = 0; n < nights; n++) {
      const rng = seededRng(1000 + n);
      // The window starts at some random point of the running gap (the gap runs across the day).
      let s = { remainingMs: newScheduler(rng).remainingMs * rng() };
      let t = 0;
      let seen = false;
      let last: ReturnType<typeof pickMoment> | null = null;
      while (t < windowMs) {
        const minute = startMin + (t / windowMs) * 240;
        const r = tickScheduler(s, 1000, true, rng);
        s = r.scheduler;
        t += 1000;
        if (r.due) {
          const k = pickMoment(minute, rng, last);
          last = k;
          if (isUncanny(k)) seen = true;
          t += 20_000; // on screen: the gap does not count
        }
      }
      if (seen) withUncanny++;
    }
    const share = withUncanny / nights;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.42);
  });
});

describe('dipCrickets', () => {
  const mix: LayerMix = { water: 1, birds: 0, frogs: 0, crickets: 0.8, drone: 0 };
  it('quiets only the crickets, only while an uncanny moment is up', () => {
    expect(dipCrickets(mix, false)).toBe(mix);
    expect(dipCrickets(mix, true)).toEqual({ ...mix, crickets: 0.8 * MOMENT_TUNING.cricketDip });
  });
});

describe('notes', () => {
  it('has unique ids, twelve notes and exactly two eerie ones', () => {
    expect(new Set(NOTES.map((n) => n.id)).size).toBe(NOTES.length);
    expect(NOTES.filter((n) => n.eerie)).toHaveLength(2);
    expect(NOTES).toHaveLength(13);
  });
  it('the eerie ones are allowed only 22:00-05:00', () => {
    const eerie = (m: number) => notesAt(m).some((n) => n.eerie);
    expect(eerie(at(12))).toBe(false);
    expect(eerie(at(21, 59))).toBe(false);
    expect(eerie(at(22))).toBe(true);
    expect(eerie(at(2))).toBe(true);
    expect(eerie(at(4, 59))).toBe(true);
    expect(eerie(at(5))).toBe(false);
  });
  it('never repeats until every available note was read, then starts over', () => {
    const rng = seededRng(5);
    let notes = newNotes();
    const day = notesAt(at(12));
    const seen: string[] = [];
    for (let i = 0; i < day.length; i++) {
      const r = pickNote(notes, at(12), rng);
      seen.push(r.note.id);
      notes = r.notes;
    }
    expect(new Set(seen).size).toBe(day.length);
    expect(seen.every((id) => !noteById(id)?.eerie)).toBe(true);
    const again = pickNote(notes, at(12), rng); // a new round: allowed again
    expect(seen).toContain(again.note.id);
    expect(again.notes.read).toEqual([again.note.id]);
  });
  it('by night all twelve come round without a repeat', () => {
    const rng = seededRng(11);
    let notes = newNotes();
    const seen: string[] = [];
    for (let i = 0; i < NOTES.length; i++) {
      const r = pickNote(notes, at(23), rng);
      seen.push(r.note.id);
      notes = r.notes;
    }
    expect(new Set(seen).size).toBe(NOTES.length);
  });
  it('by day a read eerie note stays marked, so the next night offers the unseen one first', () => {
    const rng = seededRng(4);
    let notes = { read: ['warm-water'] };
    for (let i = 0; i < 10; i++) notes = pickNote(notes, at(12), rng).notes; // a full day round
    expect(notes.read).toContain('warm-water');
    expect(pickNote(notes, at(23), rng).note.id).not.toBe('warm-water');
  });
  it('ignores unknown ids in the saved list', () => {
    const r = pickNote({ read: ['gone', 'raft'] }, at(12), seededRng(1));
    expect(r.notes.read).not.toContain('gone');
    expect(r.note.id).not.toBe('raft');
  });
  it('normalises saved notes', () => {
    expect(normalizeNotes(undefined)).toEqual({ read: [] });
    expect(normalizeNotes({ read: ['raft', 'raft', 'zzz', 4] })).toEqual({ read: ['raft'] });
  });
});

describe('rewards', () => {
  it('a star gives 5-15 coins', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const p = newPlayer();
      const r = claimStar(p, seededRng(i));
      expect(r.coins).toBeGreaterThanOrEqual(5);
      expect(r.coins).toBeLessThanOrEqual(15);
      expect(r.player.coins).toBe(p.coins + r.coins);
      seen.add(r.coins);
    }
    expect(seen.size).toBe(11);
  });
  it('a bottle holds 2-5 worms about one time in four and marks its note read', () => {
    let withWorms = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const p = newPlayer();
      const r = openBottle(p, at(12), seededRng(i));
      expect(r.player.worms).toBe(p.worms + r.contents.worms);
      expect(r.player.notes?.read).toEqual([r.contents.noteId]);
      expect(noteById(r.contents.noteId)?.text).toBe(r.contents.text);
      if (r.contents.worms > 0) {
        withWorms++;
        expect(r.contents.worms).toBeGreaterThanOrEqual(2);
        expect(r.contents.worms).toBeLessThanOrEqual(5);
      }
    }
    expect(withWorms / n).toBeGreaterThan(0.21);
    expect(withWorms / n).toBeLessThan(0.29);
  });
  it('works on an old player without notes', () => {
    const { notes: _drop, ...old } = newPlayer();
    expect(openBottle(old, at(12), seededRng(9)).player.notes?.read).toHaveLength(1);
  });
});

describe('moments wait for the fish', () => {
  it('the clock stops while a fish is on the hook, in the fight or shown off, and runs otherwise', () => {
    for (const k of ['bite', 'fighting', 'caught']) expect(momentClockRunning(k)).toBe(false);
    for (const k of ['idle', 'charging', 'casting', 'waiting', 'retrieving', 'lost']) expect(momentClockRunning(k)).toBe(true);
  });

  it('a paused moment keeps the lifetime it had left, and goes on with it afterwards (also after an escape)', () => {
    const life = MOMENTS.bottle.durationMs;
    let age = tickMomentAge(0, 20_000, true);
    for (let i = 0; i < 3000; i++) age = tickMomentAge(age, 16, false); // a long fight
    expect(life - age).toBe(life - 20_000);
    age = tickMomentAge(age, 1000, true);
    expect(life - age).toBe(life - 21_000);
  });

  it('the dim eases to pausedAlpha and back, never overshooting', () => {
    let d = 1;
    for (let i = 0; i < 100; i++) d = easeMomentDim(d, true, 16);
    expect(d).toBe(MOMENT_TUNING.pausedAlpha);
    expect(easeMomentDim(1, true, 16)).toBeLessThan(1);
    for (let i = 0; i < 100; i++) d = easeMomentDim(d, false, 16);
    expect(d).toBe(1);
  });

  it('no moment starts unless she is idle or waiting: the scheduler is only fed then', () => {
    // LakeScene passes active = idle|waiting only; a due gap does not fire while inactive.
    const s = { remainingMs: 10 };
    expect(tickScheduler(s, 1000, false, seededRng(1)).due).toBe(false);
  });
});
