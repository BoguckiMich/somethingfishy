import { describe, expect, it } from 'vitest';
import { POOL_SPECIES, SPECIES, speciesById } from './data/fish';
import { starFor } from './data/stars';
import { favouriteBaits, formatWeightRounded, goldFromCm, knowledgeRows, sizeRangeText } from './fishKnowledge';

const sp = (id: string) => speciesById(id)!;

describe('knowledgeRows', () => {
  it('unlocks by tier: 1 none, 5 range, 10 bait, 25 gold', () => {
    const at = (n: number) => knowledgeRows(sp('roach'), n).map((r) => r.unlocked);
    expect(at(1)).toEqual([false, false, false]);
    expect(at(4)).toEqual([false, false, false]);
    expect(at(5)).toEqual([true, false, false]);
    expect(at(9)).toEqual([true, false, false]);
    expect(at(10)).toEqual([true, true, false]);
    expect(at(24)).toEqual([true, true, false]);
    expect(at(25)).toEqual([true, true, true]);
  });

  it('locked rows are a dim "??? · catch N to learn"', () => {
    const rows = knowledgeRows(sp('roach'), 1);
    expect(rows.map((r) => r.text)).toEqual(['??? · catch 5 to learn', '??? · catch 10 to learn', '??? · catch 25 to learn']);
  });

  it('the legendary has no tiers', () => {
    expect(knowledgeRows(sp('pale'), 99)).toEqual([]);
  });

  it('the range line comes from the species data', () => {
    expect(knowledgeRows(sp('roach'), 5)[0].text).toBe('12-30 cm · 20-300 g');
  });

  it('a species without a favourite bait is not fussy', () => {
    const r = knowledgeRows(sp('roach'), 10)[1];
    expect(r.text).toBe('Not fussy: worms are fine');
    expect(r.baitIds).toEqual([]);
  });

  it('a boosted species names its bait', () => {
    const r = knowledgeRows(sp('carp'), 10)[1];
    expect(r.text).toBe('Bites best on: corn');
    expect(r.baitIds).toEqual(['corn']);
    expect(knowledgeRows(sp('pike'), 10)[1].text).toBe('Bites best on: fish strip');
  });
});

describe('favouriteBaits', () => {
  it('lists every bait that boosts the species', () => {
    expect(favouriteBaits(sp('carp')).map((b) => b.id)).toEqual(['corn']);
  });

  it('lists several baits when a species is boosted by more than one', () => {
    const baits = [
      { id: 'a', name: 'Alpha', effect: '', speciesBoost: { ids: ['carp'], factor: 2 } },
      { id: 'b', name: 'Beta', effect: '', speciesBoost: { ids: ['carp', 'pike'], factor: 2 } },
      { id: 'c', name: 'Gamma', effect: '', rarityBoost: { rarity: 'uncommon' as const, factor: 3 } },
    ];
    expect(favouriteBaits(sp('carp'), baits).map((b) => b.id)).toEqual(['a', 'b']);
    expect(favouriteBaits(sp('roach'), baits)).toEqual([]);
  });
});

describe('goldFromCm', () => {
  it('is the shortest length that is gold, for every species', () => {
    for (const s of POOL_SPECIES) {
      const cm = goldFromCm(s);
      expect(starFor(s, cm)).toBe('gold');
      if (cm > s.lengthCm[0]) expect(starFor(s, cm - 1)).not.toBe('gold');
    }
    expect(goldFromCm(sp('roach'))).toBe(27);
  });
});

describe('formatting', () => {
  it('rounds weights sensibly', () => {
    expect(formatWeightRounded(19)).toBe('20 g');
    expect(formatWeightRounded(3)).toBe('5 g');
    expect(formatWeightRounded(0.4)).toBe('1 g');
    expect(formatWeightRounded(297)).toBe('300 g');
    expect(formatWeightRounded(1598)).toBe('1.6 kg');
    expect(formatWeightRounded(43157)).toBe('43 kg');
  });

  it('writes a range for every species with units once when equal', () => {
    for (const s of SPECIES) expect(sizeRangeText(s)).toMatch(/^\d+-\d+ cm · /);
    expect(sizeRangeText(sp('catfish'))).toBe('60-180 cm · 1.6-43 kg');
  });
});
