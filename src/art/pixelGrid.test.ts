import { describe, expect, it } from 'vitest';
import { flipSpriteX, rotateSpriteCcw, shiftRowsDown, sprite, spriteToRgba, TRANSPARENT } from './pixelGrid';

const colors = { r: 0xff0000, g: 0x00ff80 };

describe('sprite()', () => {
  it('parses a grid, treating "." as transparent and trimming indentation', () => {
    const s = sprite(
      `
      .r.
      gr.
    `,
      colors,
    );
    expect(s.width).toBe(3);
    expect(s.height).toBe(2);
    expect(Array.from(s.pixels)).toEqual([TRANSPARENT, 0xff0000, TRANSPARENT, 0x00ff80, 0xff0000, TRANSPARENT]);
  });

  it('throws on ragged rows', () => {
    expect(() => sprite('.r.\n.r', colors)).toThrow(/ragged/);
  });

  it('throws on unknown characters', () => {
    expect(() => sprite('.rx', colors)).toThrow(/unknown character "x"/);
  });

  it('throws on an empty grid', () => {
    expect(() => sprite('  \n ', colors)).toThrow(/empty/);
  });
});

describe('spriteToRgba()', () => {
  it('produces RGBA with opaque colours and transparent holes', () => {
    const rgba = spriteToRgba(sprite('.g', colors));
    expect(Array.from(rgba)).toEqual([0, 0, 0, 0, 0x00, 0xff, 0x80, 255]);
  });
});

describe('sprite helpers', () => {
  it('flips horizontally', () => {
    const s = flipSpriteX(sprite('rg.', colors));
    expect(Array.from(s.pixels)).toEqual([TRANSPARENT, 0x00ff80, 0xff0000]);
  });

  it('shifts rows down by one, clearing the vacated row', () => {
    const s = shiftRowsDown(sprite('r\ng\n.', colors), 0, 1);
    expect(Array.from(s.pixels)).toEqual([TRANSPARENT, 0xff0000, TRANSPARENT]);
  });
});

describe('rotateSpriteCcw', () => {
  it('turns a right-facing sprite head-up: the right edge becomes the top, the top the left', () => {
    const s = sprite(`
      ab.
      .cd
    `, { a: 1, b: 2, c: 3, d: 4 });
    const r = rotateSpriteCcw(s);
    expect([r.width, r.height]).toEqual([2, 3]);
    // source (x, y) lands at (y, width - 1 - x): d(2,1) -> (1,0), b(1,0) -> (0,1), a(0,0) -> (0,2), c(1,1) -> (1,1)
    const at = (x: number, y: number) => r.pixels[y * r.width + x];
    expect(at(1, 0)).toBe(4);
    expect(at(0, 1)).toBe(2);
    expect(at(0, 2)).toBe(1);
    expect(at(1, 1)).toBe(3);
    expect(at(0, 0)).toBe(TRANSPARENT);
  });
  it('four turns are the identity', () => {
    const s = sprite('ab.\n.cd', { a: 1, b: 2, c: 3, d: 4 });
    expect(rotateSpriteCcw(rotateSpriteCcw(rotateSpriteCcw(rotateSpriteCcw(s)))).pixels).toEqual(s.pixels);
  });
});
