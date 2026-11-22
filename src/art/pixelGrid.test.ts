import { describe, expect, it } from 'vitest';
import { flipSpriteX, shiftRowsDown, sprite, spriteToRgba, TRANSPARENT } from './pixelGrid';

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
