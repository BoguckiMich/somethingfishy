import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { addRaster, ensureSignTexture } from './textures';
import type { Raster } from './raster';

const fakeScene = (exists: boolean) =>
  ({ textures: { exists: () => exists, createCanvas: vi.fn(() => null) } }) as unknown as Phaser.Scene;

describe('addRaster', () => {
  it('does not build the raster when the texture already exists', () => {
    const make = vi.fn(() => ({}) as Raster);
    addRaster(fakeScene(true), 'k', make);
    expect(make).not.toHaveBeenCalled();
  });
  it('ensureSignTexture returns its key without rasterising when cached', () => {
    const scene = fakeScene(true);
    ensureSignTexture(scene, { slots: ['off', 'note', 'claim'], seal: false, flutter: 0 });
    expect((scene.textures as unknown as { createCanvas: ReturnType<typeof vi.fn> }).createCanvas).not.toHaveBeenCalled();
  });
});
