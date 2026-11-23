import { describe, expect, it } from 'vitest';
import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';
import { shrinkSprite, silhouetteOf } from './fishScale';

const O = PAL.outline;
const colorsOf = (s: Sprite) => new Set(Array.from(s.pixels).filter((c) => c !== TRANSPARENT));
const opaque = (s: Sprite) => Array.from(s.pixels).map((c) => c !== TRANSPARENT);

/** A 16x8 outlined test fish: ring of outline, two body colours, a red eye. */
const FISH = sprite(
  `
  ................
  ..oooooooooooo..
  .oaaaaaaaaaaaao.
  oaaaaaaaaaaaeaao
  obbbbbbbbbbbbbbo
  .obbbbbbbbbbbbo.
  ..oooooooooooo..
  ................
`,
  { o: O, a: 0x558844, b: 0xddddaa, e: 0xd9433a },
);

describe('shrinkSprite', () => {
  it('returns the requested width and a proportional height', () => {
    const s = shrinkSprite(FISH, 12, { protect: [0xd9433a] });
    expect(s.width).toBe(12);
    expect(Math.abs(s.height - (FISH.height * 12) / FISH.width)).toBeLessThanOrEqual(1.5);
  });

  it('only uses colours that exist in the source (no blending)', () => {
    for (const w of [8, 10, 12, 14]) {
      const s = shrinkSprite(FISH, w, { protect: [0xd9433a] });
      const src = colorsOf(FISH);
      for (const c of colorsOf(s)) expect(src.has(c)).toBe(true);
    }
  });

  it('keeps a closed outline: no body pixel touches transparency', () => {
    const s = shrinkSprite(FISH, 11, { protect: [0xd9433a] });
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= s.width || y >= s.height ? TRANSPARENT : s.pixels[y * s.width + x]);
    expect(colorsOf(s).has(O)).toBe(true);
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = at(x, y);
        if (c === TRANSPARENT || c === O) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(at(x + dx, y + dy)).not.toBe(TRANSPARENT);
      }
    }
  });

  it('keeps the protected eye colour', () => {
    expect(colorsOf(shrinkSprite(FISH, 9, { protect: [0xd9433a] })).has(0xd9433a)).toBe(true);
  });

  it('keeps thin (unoutlined) pixels such as barbels when asked', () => {
    const withBarbel = sprite(
      `
  ................
  ..oooooooo......
  .oaaaaaaaaoWW...
  oaaaaaaaeaaoW...
  .oaaaaaaaaao....
  ..ooooooooo.....
  ................
`,
      { o: O, a: 0x558844, e: 0xd9433a, W: 0xccccbb },
    );
    const s = shrinkSprite(withBarbel, 12, { protect: [0xd9433a], thin: [0xccccbb] });
    expect(colorsOf(s).has(0xccccbb)).toBe(true);
  });

  it('never upsizes', () => {
    expect(() => shrinkSprite(FISH, 40)).toThrow();
  });
});

describe('silhouetteOf', () => {
  it('paints every opaque pixel one flat colour and keeps the alpha mask', () => {
    const sil = silhouetteOf(FISH, 0x101820);
    expect(sil.width).toBe(FISH.width);
    expect(sil.height).toBe(FISH.height);
    expect(opaque(sil)).toEqual(opaque(FISH));
    expect(colorsOf(sil)).toEqual(new Set([0x101820]));
  });
});
