import { describe, expect, it } from 'vitest';
import { FAR_SHORE_Y, W, WATER_BOTTOM } from './layout';
import { PAL } from './palette';
import { TRANSPARENT } from './pixelGrid';
import { Raster } from './raster';
import { cloudRaster, dockRaster, farShoreRaster, nearShoreRaster, paintSky, reflectionRaster, waterRaster } from './scenery';
import { ALEX_HEADS, ALEX_SIZE, type AlexHead, DOG_SIZE, PAJ_SIZE, alexSprite, allDogFrames, dogKey, dogSprite, pajkelSittingSprite, pajkelWalkSprite } from './characters';
import { BOBBER, PINE_A, PINE_TALL, REED } from './sprites';

describe('palette', () => {
  it('has 32-60 unique colours', () => {
    const values = Object.values(PAL);
    expect(new Set(values).size).toBe(values.length);
    expect(values.length).toBeGreaterThanOrEqual(32);
    expect(values.length).toBeLessThanOrEqual(110);
  });
});

describe('sprites', () => {
  it('have the intended sizes', () => {
    expect([BOBBER.width, BOBBER.height]).toEqual([5, 9]);
    expect(PINE_A.width).toBe(15);
    expect(PINE_TALL.height).toBeGreaterThan(PINE_A.height * 1.8);
    expect(REED.width).toBe(11);
  });

  it('characters have the intended sizes and breathing frames', () => {
    for (const head of ALEX_HEADS) {
      const h0 = alexSprite(head, 0);
      const h1 = alexSprite(head, 1);
      expect([h0.width, h0.height, h1.width, h1.height]).toEqual([ALEX_SIZE.w, ALEX_SIZE.h, ALEX_SIZE.w, ALEX_SIZE.h]);
      expect(Array.from(h1.pixels)).not.toEqual(Array.from(h0.pixels));
    }
    const px = (h: AlexHead) => Array.from(alexSprite(h, 0).pixels);
    expect(px('left')).not.toEqual(px('forward'));
    expect(px('right')).not.toEqual(px('forward'));
    expect(px('left')).not.toEqual(px('right'));
    const p = pajkelSittingSprite('sit', 0);
    expect([p.width, p.height]).toEqual([PAJ_SIZE.w, PAJ_SIZE.h]);
    expect(Array.from(pajkelSittingSprite('sip', 0).pixels)).not.toEqual(Array.from(p.pixels));
    expect(pajkelWalkSprite('walk1').width).toBeGreaterThan(0);
  });

  it('has a distinct dog sprite for every frame key', () => {
    const frames = allDogFrames();
    expect(new Set(frames.map(dogKey)).size).toBe(frames.length);
    for (const f of frames) expect([dogSprite(f).width, dogSprite(f).height]).toEqual([DOG_SIZE.w, DOG_SIZE.h]);
  });
});

describe('scenery rasters', () => {
  it('are deterministic', () => {
    expect(Array.from(nearShoreRaster().data)).toEqual(Array.from(nearShoreRaster().data));
    expect(Array.from(farShoreRaster().data)).toEqual(Array.from(farShoreRaster().data));
  });

  it('water is fully opaque and covers the lake', () => {
    const w = waterRaster();
    expect(w.height).toBe(WATER_BOTTOM - FAR_SHORE_Y);
    for (let y = 0; y < w.height; y += 7) for (let x = 0; x < W; x += 5) expect(w.alphaAt(x, y)).toBe(255);
  });

  it('shallow water is lighter than deep water', () => {
    const w = waterRaster();
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(w.get(3, w.height - 30))).toBeGreaterThan(lum(w.get(3, 10)));
  });

  it('sky paints every pixel', () => {
    const r = new Raster(8, 40);
    paintSky(r, 0x102030, 0xa0b0c0);
    for (let y = 0; y < 40; y++) expect(r.get(3, y)).not.toBe(TRANSPARENT);
  });

  it('far shore has trees and the reflection mirrors some of them', () => {
    const shore = farShoreRaster();
    const refl = reflectionRaster(shore, 0);
    let opaque = 0;
    for (let i = 3; i < refl.data.length; i += 4) if (refl.data[i] > 0) opaque++;
    expect(opaque).toBeGreaterThan(200);
  });

  it('dock and clouds render', () => {
    expect(dockRaster().alphaAt(40, 50)).toBe(255);
    expect(cloudRaster(30, 10, 1).alphaAt(15, 8)).toBe(255);
  });
});
