import type Phaser from 'phaser';
import { PAJ_WALK_POSES, ALEX_HANDS_KEY, ALEX_HEADS, HEART, STICK, stickCarrySprite, stickGroundSprite, alexKey, alexShowOffHandsSprite, alexShowOffKey, alexShowOffSprite, alexSprite, allDogFrames, dogKey, dogSprite, pajkelSittingSprite, pajkelWalkSprite, type PajPose, type PajWalkPose } from './characters';
import { CAR_VARIANTS, carKey, carSprite } from './carArt';
import { lanternSprite } from './lanternArt';
import { BAR_INNER, STRIP_INNER, barFrameSprite } from './catchBarArt';
import { FISH_SIZE_CLASSES, fishHugKey, fishHugSprite, fishIconKey, fishIconSprite, fishKey, fishSprite, isHugged } from './fishArt';
import { BAITS } from '../core/data/baits';
import { SPECIES } from '../core/data/fish';
import { FAR_SHORE_Y, W } from './layout';
import { coinSprite, gearSprite, wormSprite, zSprite } from './iconArt';
import { MOMENT_SPRITES } from './momentArt';
import { Raster } from './raster';
import { shopIconSprite } from './shopIconArt';
import {
  BOBBER,
  BOBBER_UNDER,
  LILY_A,
  LILY_B,
  CRATE,
  NOTICE_BOARD,
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
  heart: 'heart',
  stick: 'stick',
  stickCarry: 'stickCarry',
  stickGround: 'stickGround',
  lilyA: 'lilyA',
  lilyB: 'lilyB',
  reed: 'reed',
  post: 'post',
  crate: 'crate',
  board: 'board',
  barFrame: 'barFrame',
  stripFrame: 'stripFrame',
  gear: 'gear',
  worm: 'worm',
  coin: 'coin',
  zSmall: 'zSmall',
  zBig: 'zBig',
} as const;

/** Texture key of a bait's 16 x 16 icon (the bottom-bar chip); worms use the plain worm icon. */
export const baitIconKey = (id: string): string => (id === 'worm' ? TEX.worm : `bait:${id}`);

/** Texture key of the dock lantern (unlit / lit). */
export const lanternKey = (lit: boolean) => `lantern:${lit ? 'on' : 'off'}`;

/** Texture key of a lake-moment sprite (a key of MOMENT_SPRITES). */
export const momentKey = (name: string) => `moment:${name}`;

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
  addRaster(scene, TEX.gear, Raster.fromSprite(gearSprite()));
  addRaster(scene, TEX.worm, Raster.fromSprite(wormSprite()));
  addRaster(scene, TEX.coin, Raster.fromSprite(coinSprite()));
  for (const b of BAITS) addRaster(scene, baitIconKey(b.id), Raster.fromSprite(shopIconSprite(b.id)!));
  addRaster(scene, TEX.zSmall, Raster.fromSprite(zSprite(false)));
  addRaster(scene, TEX.zBig, Raster.fromSprite(zSprite(true)));
  createCharacterTextures(scene);
  addRaster(scene, TEX.lilyA, Raster.fromSprite(LILY_A));
  addRaster(scene, TEX.lilyB, Raster.fromSprite(LILY_B));
  addRaster(scene, TEX.reed, Raster.fromSprite(REED));
  addRaster(scene, TEX.post, Raster.fromSprite(POST));
  addRaster(scene, TEX.crate, Raster.fromSprite(CRATE));
  addRaster(scene, TEX.board, Raster.fromSprite(NOTICE_BOARD));
  for (const v of CAR_VARIANTS) addRaster(scene, carKey(v), Raster.fromSprite(carSprite(v)));
  for (const lit of [false, true]) addRaster(scene, lanternKey(lit), Raster.fromSprite(lanternSprite(lit)));
  for (const [name, s] of Object.entries(MOMENT_SPRITES)) addRaster(scene, momentKey(name), Raster.fromSprite(s));
  addRaster(scene, TEX.barFrame, Raster.fromSprite(barFrameSprite(BAR_INNER.w, BAR_INNER.h)));
  addRaster(scene, TEX.stripFrame, Raster.fromSprite(barFrameSprite(STRIP_INNER.w, STRIP_INNER.h, 3)));
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
  for (const head of ALEX_HEADS) {
    for (const b of [0, 1] as const) addRaster(scene, alexKey(head, b), Raster.fromSprite(alexSprite(head, b)));
  }
  for (const b of [0, 1] as const) addRaster(scene, alexShowOffKey(b), Raster.fromSprite(alexShowOffSprite(b)));
  addRaster(scene, ALEX_HANDS_KEY, Raster.fromSprite(alexShowOffHandsSprite()));
  for (const sp of SPECIES) {
    for (const cls of FISH_SIZE_CLASSES) addRaster(scene, fishKey(sp.id, cls), Raster.fromSprite(fishSprite(sp.id, cls)));
    addRaster(scene, fishIconKey(sp.id), Raster.fromSprite(fishIconSprite(sp.id)));
    if (isHugged(sp.id)) addRaster(scene, fishHugKey(sp.id), Raster.fromSprite(fishHugSprite(sp.id)));
  }
  for (const pose of ['sit', 'sip', 'cheer', 'look'] as PajPose[]) {
    for (const b of [0, 1] as const) addRaster(scene, pajSitKey(pose, b), Raster.fromSprite(pajkelSittingSprite(pose, b)));
  }
  for (const pose of PAJ_WALK_POSES) {
    addRaster(scene, pajWalkKey(pose), Raster.fromSprite(pajkelWalkSprite(pose)));
  }
  for (const f of allDogFrames()) addRaster(scene, dogKey(f), Raster.fromSprite(dogSprite(f)));
  addRaster(scene, TEX.heart, Raster.fromSprite(HEART));
  addRaster(scene, TEX.stick, Raster.fromSprite(STICK));
  addRaster(scene, TEX.stickCarry, Raster.fromSprite(stickCarrySprite()));
  addRaster(scene, TEX.stickGround, Raster.fromSprite(stickGroundSprite()));
}
