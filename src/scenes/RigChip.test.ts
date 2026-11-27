import { describe, expect, it } from 'vitest';
import { addBait, chooseBait, chooseLure, chooseFloatRig, addLure, loseLure, newPlayer, type PlayerState } from '../core/inventory';
import { BRING_FIRST_MS, nextBringAt, spinDevFlags, baitCueText, baitRunOutToast, lureLostToasts, rigChipView } from './RigChip';

const withRod = (p: PlayerState): PlayerState => ({ ...p, spinRod: true });

describe('rigChipView', () => {
  it('shows the worm and its count on the float rig', () => {
    const p = { ...newPlayer(), worms: 7 };
    expect(rigChipView(p)).toEqual({ rig: 'float', id: 'worm', count: 7 });
  });
  it('shows the chosen bait on the float rig', () => {
    const p = chooseBait(addBait(newPlayer(), 'corn', 4), 'corn').state;
    expect(rigChipView(p)).toEqual({ rig: 'float', id: 'corn', count: 4 });
  });
  it('shows the lure and its count on the spinning rig', () => {
    const p = chooseLure(addLure(withRod(newPlayer()), 'wobbler', 3), 'wobbler').state;
    expect(rigChipView(p)).toEqual({ rig: 'spin', id: 'wobbler', count: 3 });
  });
  it('goes back to the float when she picks a bait again', () => {
    const p = chooseFloatRig(chooseLure(addLure(withRod(newPlayer()), 'spinner', 1), 'spinner').state);
    expect(rigChipView(p).rig).toBe('float');
  });
  it('falls back to the float chip when the last lure is lost', () => {
    const spin = chooseLure(addLure(withRod(newPlayer()), 'spinner', 1), 'spinner').state;
    expect(rigChipView(loseLure(spin, 'spinner', false)).rig).toBe('float');
  });
});

describe('bait toasts', () => {
  it('cues the spent bait by name', () => {
    expect(baitCueText('corn')).toBe('-1 corn');
    expect(baitCueText('worm')).toBe('-1 worm');
  });
  it('says when the chosen bait ran out and what is used now', () => {
    const before = chooseBait(addBait({ ...newPlayer(), worms: 5 }, 'corn', 1), 'corn').state;
    const after = { ...before, baits: {} };
    expect(baitRunOutToast(before, after)).toBe('Out of corn, using worms');
  });
  it('is silent while the bait lasts', () => {
    const before = chooseBait(addBait(newPlayer(), 'corn', 3), 'corn').state;
    expect(baitRunOutToast(before, before)).toBeUndefined();
  });
});

describe('lureLostToasts', () => {
  const two = chooseLure(addLure(addLure(withRod(newPlayer()), 'spinner', 1), 'wobbler', 1), 'spinner').state;
  it('a snapped line takes the lure: it went with it, and the last of its kind moves the chip on', () => {
    const after = loseLure(two, 'spinner', false);
    expect(lureLostToasts(two, after, 'spinner', 'snapped')).toEqual(['The spinner went with it.', 'Lost your last spinner, using the wobbler.']);
  });
  it('losing the only lure sends her back to the float', () => {
    const one = chooseLure(addLure(withRod(newPlayer()), 'jig', 1), 'jig').state;
    expect(lureLostToasts(one, loseLure(one, 'jig', false), 'jig', 'snapped')).toEqual(['The soft jig went with it.', 'Lost your last soft jig.']);
  });
  it('says only the second sentence after a snag (the snag already spoke)', () => {
    const one = chooseLure(addLure(withRod(newPlayer()), 'jig', 1), 'jig').state;
    expect(lureLostToasts(one, loseLure(one, 'jig', false), 'jig', 'snag')).toEqual(['Lost your last soft jig.']);
  });
  it('stays quiet about the count while she still has more of the same lure', () => {
    const three = chooseLure(addLure(withRod(newPlayer()), 'spinner', 3), 'spinner').state;
    expect(lureLostToasts(three, loseLure(three, 'spinner', false), 'spinner', 'snapped')).toEqual(['The spinner went with it.']);
  });
});

describe('spinDevFlags', () => {
  const flags = (q: string) => spinDevFlags(newPlayer(), new URLSearchParams(q));
  it('does nothing without a flag', () => {
    expect(flags('')).toEqual(newPlayer());
  });
  it('?spinrod=1 owns the rod only', () => {
    const p = flags('spinrod=1');
    expect(p.spinRod).toBe(true);
    expect(rigChipView(p).rig).toBe('float');
  });
  it('?lures=all gives 5 of each lure and the rod', () => {
    const p = flags('lures=all');
    expect(p.spinRod).toBe(true);
    expect(p.lures).toEqual({ spinner: 5, wobbler: 5, jig: 5 });
  });
  it('?lure=jig chooses it with the rod and the spin rig on', () => {
    expect(rigChipView(flags('lure=jig'))).toEqual({ rig: 'spin', id: 'jig', count: 5 });
    expect(rigChipView(flags('lures=all&lure=wobbler'))).toEqual({ rig: 'spin', id: 'wobbler', count: 5 });
  });
  it('?rig=spin puts the spin rig on, with spinners when she has nothing', () => {
    expect(rigChipView(flags('rig=spin'))).toEqual({ rig: 'spin', id: 'spinner', count: 5 });
  });
});

describe('nextBringAt', () => {
  it('waits a minute after a lure washes up, never while nothing waits', () => {
    expect(nextBringAt(false, null, 5000)).toBeNull();
    expect(nextBringAt(true, null, 5000)).toBe(5000 + BRING_FIRST_MS);
  });
  it('keeps the time already set and forgets it when nothing waits any more', () => {
    expect(nextBringAt(true, 9000, 12_000)).toBe(9000);
    expect(nextBringAt(false, 9000, 12_000)).toBeNull();
  });
});
