import { describe, expect, it } from 'vitest';
import { STRIP_ICON_SIZE, stripFishSprite, stripNetSprite } from './catchBarArt';
import { PAL } from './palette';
import { TRANSPARENT } from './pixelGrid';
import { SIGN_SIZE, signKey, signSlots, signSprite, type SignLook } from './signArt';
import { newQuests, type Quest } from '../core/quests/quests';

const quest = (over: Partial<Quest>): Quest => ({
  kind: 'catchAny',
  params: { target: 2 },
  progress: 0,
  done: false,
  claimed: false,
  reward: { coins: 10, worms: 1 },
  ...over,
});

const look = (over: Partial<SignLook> = {}): SignLook => ({ slots: ['off', 'off', 'off'], seal: false, flutter: 0, ...over });
const count = (s: { pixels: Int32Array }, c: number) => s.pixels.filter((p) => p === c).length;
const solid = (s: { pixels: Int32Array }) => s.pixels.filter((p) => p !== TRANSPARENT).length;

describe('signSlots', () => {
  it('is empty without quests', () => {
    expect(signSlots(newQuests())).toEqual(['off', 'off', 'off']);
  });
  it('shows a note per unfinished quest, a pinned one when it can be claimed, nothing once claimed', () => {
    const q = { ...newQuests(), list: [quest({}), quest({ done: true }), quest({ done: true, claimed: true })] };
    expect(signSlots(q)).toEqual(['note', 'claim', 'off']);
  });
});

describe('signSprite', () => {
  it('is 24 x 26 with transparent corners', () => {
    const s = signSprite(look());
    expect([s.width, s.height]).toEqual([SIGN_SIZE.w, SIGN_SIZE.h]);
    expect(s.pixels[0]).toBe(TRANSPARENT);
  });
  it('draws a cream note per slot', () => {
    const none = count(signSprite(look()), PAL.cream);
    expect(none).toBe(0);
    const one = count(signSprite(look({ slots: ['note', 'off', 'off'] })), PAL.cream);
    const three = count(signSprite(look({ slots: ['note', 'note', 'note'] })), PAL.cream);
    expect(one).toBeGreaterThan(8);
    expect(three).toBe(one * 3);
  });
  it('pins a claimable note with gold and flutters in two frames', () => {
    expect(count(signSprite(look({ slots: ['note', 'off', 'off'] })), PAL.gold)).toBe(0);
    const a = signSprite(look({ slots: ['claim', 'off', 'off'], flutter: 0 }));
    const b = signSprite(look({ slots: ['claim', 'off', 'off'], flutter: 1 }));
    expect(count(a, PAL.gold)).toBeGreaterThan(0);
    expect(a.pixels).not.toEqual(b.pixels);
  });
  it('shows the red wax seal only when a chapter waits', () => {
    expect(count(signSprite(look()), PAL.red)).toBe(0);
    expect(count(signSprite(look({ seal: true })), PAL.red)).toBeGreaterThan(3);
  });
  it('has one key per look (flutter only counts for a claimable note)', () => {
    expect(signKey(look({ flutter: 1 }))).toBe(signKey(look({ flutter: 0 })));
    expect(signKey(look({ slots: ['claim', 'off', 'off'], flutter: 1 }))).not.toBe(signKey(look({ slots: ['claim', 'off', 'off'], flutter: 0 })));
    expect(signKey(look({ seal: true }))).not.toBe(signKey(look()));
  });
});

describe('strip icons', () => {
  it('are 9 x 9 and not empty', () => {
    for (const s of [stripFishSprite(), stripNetSprite()]) {
      expect([s.width, s.height]).toEqual([STRIP_ICON_SIZE, STRIP_ICON_SIZE]);
      expect(solid(s)).toBeGreaterThan(15);
    }
  });
});
