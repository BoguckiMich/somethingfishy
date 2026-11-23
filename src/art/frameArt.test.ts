import { describe, expect, it } from 'vitest';
import { FRAME_STYLES, frameRuns, frameSprite, woodGrainSprite } from './frameArt';
import { TRANSPARENT } from './pixelGrid';

const at = (s: { width: number; pixels: Int32Array }, x: number, y: number) => s.pixels[y * s.width + x];

describe('frameSprite', () => {
  const st = FRAME_STYLES.panel;
  const s = frameSprite(16, 16, st);

  it('has the requested size', () => {
    expect([s.width, s.height]).toEqual([16, 16]);
  });

  it('cuts stepped corners and outlines the edge', () => {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [15, 0], [14, 0], [15, 1], [0, 15], [1, 15], [0, 14], [15, 15], [14, 15], [15, 14]]) {
      expect(at(s, x, y)).toBe(TRANSPARENT);
    }
    expect(at(s, 8, 0)).toBe(st.outline);
    expect(at(s, 0, 8)).toBe(st.outline);
    expect(at(s, 15, 8)).toBe(st.outline);
    expect(at(s, 8, 15)).toBe(st.outline);
    expect(at(s, 2, 0)).toBe(st.outline); // the step of the corner
    expect(at(s, 1, 1)).toBe(st.outline);
  });

  it('is lit top-left and dark bottom-right', () => {
    expect(at(s, 8, 1)).toBe(st.lit[0]);
    expect(at(s, 1, 8)).toBe(st.lit[0]);
    expect(at(s, 8, 14)).toBe(st.dark[0]);
    expect(at(s, 14, 8)).toBe(st.dark[0]);
    expect(at(s, 8, 2)).toBe(st.lit[1]);
    expect(at(s, 8, 13)).toBe(st.dark[1]);
  });

  it('leaves the interior transparent unless it has a fill', () => {
    expect(at(s, 8, 8)).toBe(TRANSPARENT);
    const filled = frameSprite(16, 16, FRAME_STYLES.buttonGold);
    expect(at(filled, 8, 8)).toBe(FRAME_STYLES.buttonGold.fill);
  });

  it('pressed swaps the light and the dark', () => {
    const p = frameSprite(16, 16, FRAME_STYLES.buttonGold, true);
    const n = frameSprite(16, 16, FRAME_STYLES.buttonGold);
    expect(at(n, 8, 1)).toBe(FRAME_STYLES.buttonGold.lit[0]);
    expect(at(p, 8, 1)).toBe(FRAME_STYLES.buttonGold.dark[0]);
    expect(at(p, 8, 14)).toBe(FRAME_STYLES.buttonGold.lit[0]);
  });

  it('is deterministic', () => {
    expect(frameSprite(12, 9, st)).toEqual(frameSprite(12, 9, st));
  });
});

describe('frameRuns', () => {
  it('covers exactly the opaque pixels of the sprite, with no overlaps', () => {
    const style = FRAME_STYLES.hud;
    const sp = frameSprite(23, 15, style);
    const painted = new Int32Array(sp.width * sp.height).fill(TRANSPARENT);
    for (const r of frameRuns(23, 15, style)) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          expect(painted[y * sp.width + x]).toBe(TRANSPARENT);
          painted[y * sp.width + x] = r.color;
        }
      }
    }
    expect(painted).toEqual(sp.pixels);
  });

  it('merges a flat fill into few rects', () => {
    expect(frameRuns(200, 100, FRAME_STYLES.buttonGold).length).toBeLessThan(40);
  });
});

describe('woodGrainSprite', () => {
  const g = woodGrainSprite(16, 16);
  it('is a small tile in a few close wood shades', () => {
    expect([g.width, g.height]).toEqual([16, 16]);
    const colours = new Set(g.pixels);
    expect(colours.size).toBeGreaterThanOrEqual(2);
    expect(colours.size).toBeLessThanOrEqual(3);
    expect(colours.has(TRANSPARENT)).toBe(false);
  });
  it('is mostly the base colour (subtle)', () => {
    const base = g.pixels[0];
    const counts = new Map<number, number>();
    for (const c of g.pixels) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeGreaterThan(g.pixels.length * 0.7);
    expect(base).toBeDefined();
  });
  it('is deterministic', () => {
    expect(woodGrainSprite(16, 16)).toEqual(g);
  });
});
