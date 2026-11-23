import { describe, expect, it } from 'vitest';
import { SPECIES } from '../core/data/fish';
import { FISH_ART, FISH_LARGE } from './fishSprites';
import { FISH_CLASSES, FISH_ICON_WIDTH_RANGE, fishIcon, fishSilhouette, fishVariant } from './fishVariants';
import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';

const IDS = SPECIES.map((s) => s.id);
const colorsOf = (s: Sprite) => new Set(Array.from(s.pixels).filter((c) => c !== TRANSPARENT));
const opaque = (s: Sprite) => Array.from(s.pixels).map((c) => c !== TRANSPARENT);

describe('large fish sprites', () => {
  it('has hand art for every species in the roster', () => {
    for (const id of IDS) expect(FISH_LARGE[id], id).toBeDefined();
    expect(Object.keys(FISH_LARGE).sort()).toEqual([...IDS].sort());
  });

  it('are outlined, contain their eye, and never use the outline colour inside', () => {
    for (const id of IDS) {
      const art = FISH_ART[id];
      expect(Object.values(art.colors), id).not.toContain(PAL.outline);
      const s = FISH_LARGE[id];
      expect(colorsOf(s).has(PAL.outline), id).toBe(true);
      expect(colorsOf(s).has(art.colors[art.eye]), id).toBe(true);
    }
  });

  it('roughly follow real size (px width incl. outline) and the roster order', () => {
    const w = (id: string) => FISH_LARGE[id].width;
    const want: Record<string, number> = { bleak: 18, roach: 22, rudd: 22, perch: 22, crucian: 20, tench: 28, bream: 30, carp: 34, zander: 34, eel: 40, pike: 40, catfish: 44 };
    for (const id of IDS) expect(Math.abs(w(id) - want[id]), id).toBeLessThanOrEqual(3);
    for (const id of IDS) if (id !== 'bleak') expect(w('bleak')).toBeLessThan(w(id));
    for (const big of ['catfish', 'pike', 'eel']) for (const id of IDS) if (!['catfish', 'pike', 'eel'].includes(id)) expect(w(big)).toBeGreaterThan(w(id));
    expect(w('catfish')).toBeGreaterThanOrEqual(w('pike'));
  });
});

describe('fish variants', () => {
  it('every species has all three size classes, an icon and a silhouette', () => {
    for (const id of IDS) {
      for (const cls of FISH_CLASSES) expect(fishVariant(id, cls).width, `${id}/${cls}`).toBeGreaterThan(0);
      expect(fishIcon(id).width).toBeGreaterThan(0);
      expect(fishSilhouette(id).width).toBeGreaterThan(0);
    }
  });

  it('medium is about 75% and small about 55% of the large width, icon 9-15 wide', () => {
    for (const id of IDS) {
      const large = fishVariant(id, 2).width;
      expect(large).toBe(FISH_LARGE[id].width);
      expect(Math.abs(fishVariant(id, 1).width - large * 0.75), id).toBeLessThanOrEqual(2);
      expect(Math.abs(fishVariant(id, 0).width - large * 0.55), id).toBeLessThanOrEqual(2);
      expect(fishIcon(id).width).toBeGreaterThanOrEqual(FISH_ICON_WIDTH_RANGE[0]);
      expect(fishIcon(id).width).toBeLessThanOrEqual(FISH_ICON_WIDTH_RANGE[1]);
    }
  });

  it('stay crisp: only colours of the large sprite, with outline and eye kept', () => {
    for (const id of IDS) {
      const art = FISH_ART[id];
      const src = colorsOf(FISH_LARGE[id]);
      const variants = [fishVariant(id, 0), fishVariant(id, 1), fishIcon(id)];
      for (const v of variants) {
        for (const c of colorsOf(v)) expect(src.has(c), id).toBe(true);
        expect(colorsOf(v).has(PAL.outline), id).toBe(true);
        expect(colorsOf(v).has(art.colors[art.eye]), `${id} eye`).toBe(true);
      }
    }
  });

  it('keep a closed outline (no body pixel touches transparency)', () => {
    for (const id of IDS) {
      const thin = new Set(Object.entries(FISH_ART[id].colors).filter(([k]) => FISH_ART[id].thin?.includes(k)).map(([, v]) => v));
      for (const v of [fishVariant(id, 0), fishVariant(id, 1), fishVariant(id, 2), fishIcon(id)]) {
        const at = (x: number, y: number) => (x < 0 || y < 0 || x >= v.width || y >= v.height ? TRANSPARENT : v.pixels[y * v.width + x]);
        for (let y = 0; y < v.height; y++) {
          for (let x = 0; x < v.width; x++) {
            const c = at(x, y);
            if (c === TRANSPARENT || c === PAL.outline || thin.has(c)) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(at(x + dx, y + dy), `${id} ${x},${y}`).not.toBe(TRANSPARENT);
          }
        }
      }
    }
  });

  it('keep the size order in every class: bleak smallest, catfish/pike/eel biggest', () => {
    for (const cls of FISH_CLASSES) {
      const w = (id: string) => fishVariant(id, cls).width;
      for (const id of IDS) if (id !== 'bleak') expect(w('bleak'), `${cls} ${id}`).toBeLessThanOrEqual(w(id));
      for (const big of ['catfish', 'pike', 'eel']) for (const id of IDS) if (!['catfish', 'pike', 'eel'].includes(id)) expect(w(big), `${cls} ${big}>${id}`).toBeGreaterThan(w(id));
    }
  });

  it('silhouette keeps the alpha mask of the large sprite in one flat colour', () => {
    for (const id of IDS) {
      const sil = fishSilhouette(id);
      expect(opaque(sil)).toEqual(opaque(FISH_LARGE[id]));
      expect(colorsOf(sil).size).toBe(1);
    }
  });
});
