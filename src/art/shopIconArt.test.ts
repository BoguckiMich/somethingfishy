import { describe, expect, it } from 'vitest';
import { BAITS } from '../core/data/baits';
import { LINES, REELS } from '../core/data/tackle';
import { CAMP_ITEMS } from '../core/data/camp';
import { NIGHT_KIT } from '../core/data/nightKit';
import { RODS } from '../core/data/rods';
import { RIVER_GEAR_ITEMS } from '../core/data/riverGear';
import { PAL } from './palette';
import { TRANSPARENT, type Sprite } from './pixelGrid';
import { SHOP_ICON_IDS, shopIconSprite } from './shopIconArt';

const at = (s: Sprite, x: number, y: number) => s.pixels[y * s.width + x];
const colours = (s: Sprite) => new Set([...s.pixels].filter((c) => c !== TRANSPARENT));
const same = (a: Sprite, b: Sprite) => a.pixels.every((c, i) => c === b.pixels[i]);
const icon = (id: string): Sprite => shopIconSprite(id)!;

const GROUPS: Record<string, string[]> = {
  rods: RODS.map((r) => r.id),
  lines: LINES.map((l) => l.id),
  reels: REELS.map((r) => r.id),
  baits: BAITS.map((b) => b.id),
  nightKit: [NIGHT_KIT.id],
  camp: CAMP_ITEMS.map((c) => c.id),
  riverGear: RIVER_GEAR_ITEMS.map((g) => g.id),
};

describe('shop icons', () => {
  it('cover the worm pack and every rod, line, reel and bait, and nothing else', () => {
    const wanted = ['worms', 'treats', ...Object.values(GROUPS).flat()];
    expect([...SHOP_ICON_IDS].sort()).toEqual([...wanted].sort());
    expect(shopIconSprite('nope')).toBeUndefined();
  });

  it.each(SHOP_ICON_IDS.map((id) => [id]))('%s is 16 x 16 with an outline and nothing but outline on the edge', (id) => {
    const s = icon(id);
    expect([s.width, s.height]).toEqual([16, 16]);
    expect(colours(s).has(PAL.outline)).toBe(true);
    for (let i = 0; i < 16; i++) {
      for (const [x, y] of [[i, 0], [i, 15], [0, i], [15, i]]) expect([TRANSPARENT, PAL.outline]).toContain(at(s, x, y));
    }
    // No filled pixel touches empty space on its four sides unless it is the outline.
    for (let y = 1; y < 15; y++) {
      for (let x = 1; x < 15; x++) {
        const c = at(s, x, y);
        if (c === TRANSPARENT || c === PAL.outline) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(at(s, x + dx, y + dy)).not.toBe(TRANSPARENT);
      }
    }
  });

  it.each(SHOP_ICON_IDS.map((id) => [id]))('%s is one piece (no stray pixels) and chunky', (id) => {
    const s = icon(id);
    const seen = new Set<number>();
    const stack = [s.pixels.findIndex((c) => c !== TRANSPARENT)];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i) || s.pixels[i] === TRANSPARENT) continue;
      seen.add(i);
      const x = i % s.width;
      const y = Math.floor(i / s.width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < s.width && ny < s.height) stack.push(ny * s.width + nx);
        }
      }
    }
    const opaque = s.pixels.filter((c) => c !== TRANSPARENT).length;
    expect(seen.size).toBe(opaque);
    expect(opaque).toBeGreaterThan(60);
  });

  it('tiers of one kind look different', () => {
    for (const ids of Object.values(GROUPS)) {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(same(icon(ids[i]), icon(ids[j]))).toBe(false);
    }
  });

  it('uses the intended colours', () => {
    expect(colours(icon('worms')).has(PAL.pink)).toBe(true);
    expect(colours(icon('bamboo')).has(PAL.sand)).toBe(true);
    expect(colours(icon('fiberglass')).has(PAL.straw)).toBe(true);
    expect(colours(icon('carbon')).has(PAL.red)).toBe(true); // the stripe
    expect(colours(icon('braided')).has(PAL.leaf)).toBe(true);
    expect(colours(icon('fluoro')).has(PAL.foam)).toBe(true);
    expect(colours(icon('smooth')).has(PAL.stoneLight)).toBe(true);
    expect(colours(icon('pro')).has(PAL.gold)).toBe(true);
    expect(colours(icon('corn')).has(PAL.straw)).toBe(true);
    expect(colours(icon('maggots')).has(PAL.cream)).toBe(true);
    expect(colours(icon('strip')).has(PAL.pink)).toBe(true);
    expect(colours(icon('strip')).has(PAL.stoneLight)).toBe(true); // the silver skin
    expect(colours(icon('glow')).has(PAL.firefly)).toBe(true);
    expect(colours(icon('campfire')).has(PAL.gold)).toBe(true);
    expect(colours(icon('deckchair')).has(PAL.mug)).toBe(true);
    expect(colours(icon('dogbed')).has(PAL.denimLight)).toBe(true);
    expect(colours(icon('tent')).has(PAL.cream)).toBe(true);
    expect(colours(icon('lights')).has(PAL.blueFlower)).toBe(true);
    expect(colours(icon('windsock')).has(PAL.white)).toBe(true);
    expect(colours(icon('float')).has(PAL.redLight)).toBe(true); // the bright tip
    expect(colours(icon('lead')).has(PAL.stoneLight)).toBe(true);
  });
});
