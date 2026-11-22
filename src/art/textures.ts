import type Phaser from 'phaser';
import { HEART, STICK, alexSprite, allDogFrames, dogKey, dogSprite, pajkelSittingSprite, pajkelWalkSprite, type PajPose, type PajWalkPose } from './characters';
import { FAR_SHORE_Y, W } from './layout';
import { Raster } from './raster';
import {
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
  alex: ['alex0', 'alex1'],
  heart: 'heart',
  stick: 'stick',
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
  createCharacterTextures(scene);
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

export const pajSitKey = (pose: PajPose, breath: 0 | 1) => `paj:${pose}:${breath}`;
export const pajWalkKey = (pose: PajWalkPose) => `pajw:${pose}`;
export { dogKey };

/** Alex, Pajkel (seated and walking), the dog, plus the small props. */
function createCharacterTextures(scene: Phaser.Scene): void {
  addRaster(scene, TEX.alex[0], Raster.fromSprite(alexSprite(0)));
  addRaster(scene, TEX.alex[1], Raster.fromSprite(alexSprite(1)));
  for (const pose of ['sit', 'sip', 'cheer', 'look'] as PajPose[]) {
    for (const b of [0, 1] as const) addRaster(scene, pajSitKey(pose, b), Raster.fromSprite(pajkelSittingSprite(pose, b)));
  }
  for (const pose of ['stand', 'walk0', 'walk1', 'walk2', 'walk3', 'throw'] as PajWalkPose[]) {
    addRaster(scene, pajWalkKey(pose), Raster.fromSprite(pajkelWalkSprite(pose)));
  }
  for (const f of allDogFrames()) addRaster(scene, dogKey(f), Raster.fromSprite(dogSprite(f)));
  addRaster(scene, TEX.heart, Raster.fromSprite(HEART));
  addRaster(scene, TEX.stick, Raster.fromSprite(STICK));
}
