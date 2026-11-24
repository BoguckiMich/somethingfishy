import { describe, expect, it } from 'vitest';
import {
  activeGlints,
  allSeen,
  castCount,
  glintPhase,
  isSeen,
  markCast,
  markSeen,
  normalizeSeen,
  pickTip,
  signAction,
  TIP_MAX_CHARS,
  type TipFacts,
} from './tips';

const base: TipFacts = { canCast: true, baitTotal: 10, seen: allSeen(), bagFull: false, boxWaiting: false, questReady: false, storyWaiting: false };

describe('pickTip', () => {
  it('says nothing when nothing applies (no line, no frame)', () => {
    expect(pickTip(base)).toBeNull();
  });
  it('out of bait wins over everything', () => {
    const t = pickTip({ ...base, canCast: false, baitTotal: 0, seen: [], bagFull: true, questReady: true });
    expect(t?.id).toBe('bait');
    expect(t?.text).toBe('Out of worms, visit the Shop');
    expect(t?.once).toBe(false);
  });
  it('points to the bait picker when other bait is left', () => {
    expect(pickTip({ ...base, canCast: false, baitTotal: 3 })?.text).toBe('Out of worms, choose another bait');
  });
  it('teaches casting for the first 3 casts, then goes away', () => {
    expect(pickTip({ ...base, seen: [] })?.text).toBe('Hold to charge, release to cast');
    expect(pickTip({ ...base, seen: ['cast1', 'cast2'] })?.id).toBe('cast');
    expect(pickTip({ ...base, seen: ['cast1', 'cast2', 'cast3'] })).toBeNull();
  });
  it('orders the one-off lines: bag full, box, quest, story', () => {
    const all = { ...base, bagFull: true, boxWaiting: true, questReady: true, storyWaiting: true, seen: ['cast1', 'cast2', 'cast3'] };
    expect(pickTip(all)?.id).toBe('bagFull');
    expect(pickTip({ ...all, bagFull: false })?.id).toBe('box');
    expect(pickTip({ ...all, bagFull: false, boxWaiting: false })?.id).toBe('quest');
    expect(pickTip({ ...all, bagFull: false, boxWaiting: false, questReady: false })?.id).toBe('story');
    expect(pickTip({ ...all, bagFull: false, boxWaiting: false, questReady: false })?.once).toBe(true);
  });
  it('the box line goes quiet once the crate was tapped', () => {
    expect(pickTip({ ...base, boxWaiting: true, seen: ['cast1', 'cast2', 'cast3'] })?.text).toBe('A package! Tap the crate');
    expect(pickTip({ ...base, boxWaiting: true, seen: allSeen() })).toBeNull();
  });
  it('the cast lesson comes before the one-off lines', () => {
    expect(pickTip({ ...base, seen: [], bagFull: true })?.id).toBe('cast');
  });
});

describe('tip texts', () => {
  it('all fit the game width', () => {
    const facts: TipFacts[] = [
      { ...base, canCast: false, baitTotal: 0 },
      { ...base, canCast: false, baitTotal: 4 },
      { ...base, seen: [] },
      { ...base, bagFull: true },
      { ...base, boxWaiting: true, seen: ['cast1', 'cast2', 'cast3'] },
      { ...base, questReady: true },
      { ...base, storyWaiting: true },
    ];
    for (const f of facts) {
      const t = pickTip(f);
      expect(t).not.toBeNull();
      expect(t!.text.length).toBeLessThanOrEqual(TIP_MAX_CHARS);
    }
  });
});

describe('seen flags', () => {
  it('normalises junk, unknown ids and duplicates', () => {
    expect(normalizeSeen(undefined)).toEqual([]);
    expect(normalizeSeen('car')).toEqual([]);
    expect(normalizeSeen(['sign', 'nope', 'sign', 7, 'car'])).toEqual(['car', 'sign']);
  });
  it('marks once and ignores unknown ids', () => {
    expect(markSeen(undefined, 'dog')).toEqual(['dog']);
    expect(markSeen(['dog'], 'dog')).toEqual(['dog']);
    expect(markSeen(['dog'], 'zzz')).toEqual(['dog']);
    expect(isSeen(['dog'], 'dog')).toBe(true);
    expect(isSeen(undefined, 'dog')).toBe(false);
  });
  it('counts casts up to 3', () => {
    let seen: string[] = [];
    for (let i = 0; i < 5; i++) seen = markCast(seen);
    expect(castCount(seen)).toBe(3);
    expect(castCount(markCast([]))).toBe(1);
    expect(castCount(undefined)).toBe(0);
  });
  it('keeps the glint flags when casts are counted', () => {
    expect(markCast(['car'])).toEqual(['car', 'cast1']);
  });
});

describe('activeGlints', () => {
  const present = { car: true, sign: true, dog: true, crate: true };
  it('everything twinkles on a fresh game', () => {
    expect(activeGlints([], present)).toEqual(['car', 'sign', 'dog', 'crate']);
  });
  it('a tapped thing stops', () => {
    expect(activeGlints(['sign', 'dog'], present)).toEqual(['car', 'crate']);
  });
  it('a thing that is not there does not twinkle', () => {
    expect(activeGlints([], { ...present, crate: false, dog: false })).toEqual(['car', 'sign']);
    expect(activeGlints([], {})).toEqual([]);
  });
});

describe('glintPhase', () => {
  it('twinkles for under a second every 4 s', () => {
    expect(glintPhase(0, 0)).toBe(0);
    expect(glintPhase(450, 0)).toBeCloseTo(0.5);
    expect(glintPhase(2000, 0)).toBe(-1);
    expect(glintPhase(4000, 0)).toBe(0);
  });
  it('staggers the things so they do not flash together', () => {
    expect(glintPhase(0, 1)).toBe(-1);
    expect(glintPhase(3000, 1)).toBe(0);
  });
});

describe('signAction', () => {
  it('opens the bottle when it floats on the water', () => {
    expect(signAction({ bottleOnWater: true, chapterWaiting: true, calm: true })).toBe('bottle');
  });
  it('starts the waiting chapter when the lake is calm', () => {
    expect(signAction({ bottleOnWater: false, chapterWaiting: true, calm: true })).toBe('chapter');
  });
  it('opens the quests otherwise', () => {
    expect(signAction({ bottleOnWater: false, chapterWaiting: true, calm: false })).toBe('quests');
    expect(signAction({ bottleOnWater: false, chapterWaiting: false, calm: true })).toBe('quests');
  });
});
