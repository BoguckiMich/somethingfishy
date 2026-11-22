import type Phaser from 'phaser';
import { FAR_SHORE_Y, W } from './layout';
import { Raster } from './raster';
import {
  ANGLER,
  ANGLER_B,
  BOBBER,
  BOBBER_UNDER,
  LILY_A,
  LILY_B,
  POST,
  REED,
} from './sprites';
import {
  cloudRaster,
  dockRaster,
  farShoreRaster,
  moonRaster,
  nearShoreRaster,
  paintSky,
  reflectionRaster,
  sunRaster,
  waterRaster,
} from './scenery';

export const TEX = {
  sky: 'sky',
  farShore: 'farShore',
  reflection: ['reflect0', 'reflect1', 'reflect2'],
  water: 'water',
  nearShore: 'nearShore',
  dock: 'dock',
  clouds: ['cloud0', 'cloud1', 'cloud2'],
  sun: 'sun',
  moon: 'moon',
  bobber: 'bobber',
  bobberUnder: 'bobberUnder',
  angler: ['angler0', 'angler1'],
  lilyA: 'lilyA',
  lilyB: 'lilyB',
  reed: 'reed',
  post: 'post',
} as const;

/** Uploads a pure Raster as a Phaser canvas texture (once). */
function addRaster(scene: Phaser.Scene, key: string, r: Raster): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, r.width, r.height);
  if (!tex) throw new Error(`could not create texture ${key}`);
  const ctx = tex.getContext();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  tex.refresh();
}

/** Bakes every sprite and scenery raster into textures. Call once at scene start. */
export function createTextures(scene: Phaser.Scene): void {
  const shore = farShoreRaster();
  addRaster(scene, TEX.farShore, shore);
  TEX.reflection.forEach((key, i) => addRaster(scene, key, reflectionRaster(shore, i)));
  addRaster(scene, TEX.water, waterRaster());
  addRaster(scene, TEX.nearShore, nearShoreRaster());
  addRaster(scene, TEX.dock, dockRaster());
  addRaster(scene, TEX.clouds[0], cloudRaster(38, 12, 3));
  addRaster(scene, TEX.clouds[1], cloudRaster(26, 9, 8));
  addRaster(scene, TEX.clouds[2], cloudRaster(46, 13, 15));
  addRaster(scene, TEX.sun, sunRaster());
  addRaster(scene, TEX.moon, moonRaster());
  addRaster(scene, TEX.bobber, Raster.fromSprite(BOBBER));
  addRaster(scene, TEX.bobberUnder, Raster.fromSprite(BOBBER_UNDER));
  addRaster(scene, TEX.angler[0], Raster.fromSprite(ANGLER));
  addRaster(scene, TEX.angler[1], Raster.fromSprite(ANGLER_B));
  addRaster(scene, TEX.lilyA, Raster.fromSprite(LILY_A));
  addRaster(scene, TEX.lilyB, Raster.fromSprite(LILY_B));
  addRaster(scene, TEX.reed, Raster.fromSprite(REED));
  addRaster(scene, TEX.post, Raster.fromSprite(POST));
  if (!scene.textures.exists(TEX.sky)) {
    const sky = new Raster(W, FAR_SHORE_Y);
    paintSky(sky, 0x3f92e0, 0xaadef6);
    addRaster(scene, TEX.sky, sky);
  }
}

/** Repaints the sky gradient into its canvas texture (call when the colours change). */
export function repaintSky(scene: Phaser.Scene, top: number, bottom: number): void {
  const tex = scene.textures.get(TEX.sky) as Phaser.Textures.CanvasTexture;
  const r = new Raster(W, FAR_SHORE_Y);
  paintSky(r, top, bottom);
  tex.getContext().putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  tex.refresh();
}
