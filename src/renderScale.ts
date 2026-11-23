/**
 * Device-resolution rendering. The game is laid out on a 360x640 grid, but the canvas backing store is
 * `K` times bigger (K = whole pixels per grid unit on the real screen), the main camera zooms by K, and
 * Phaser text is rasterised at `resolution: K`. Sprites stay chunky (nearest-neighbour at an integer
 * zoom), text gets real device pixels like the DOM panels. K is chosen once at start-up (a later
 * resize/rotation only rescales the canvas via CSS, so text is then slightly over- or under-sampled).
 */
import Phaser from 'phaser';
import { H as GAME_HEIGHT, W as GAME_WIDTH } from './art/layout';

let scaleK = 1;

/** K = ceil(on-screen CSS scale of the 360x640 canvas x devicePixelRatio), clamped to 1..4. */
export function pickRenderScale(): number {
  if (typeof window === 'undefined') return 1;
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  const dpr = window.devicePixelRatio || 1;
  // -0.02: a scale like 3.001 must not tip into 4.
  const k = Math.ceil(fit * dpr - 0.02);
  scaleK = Math.min(4, Math.max(1, k));
  return scaleK;
}

/** The scale in use (after `pickRenderScale`). */
export const renderScale = (): number => scaleK;

/** Switches every Text in the scene to the device-resolution rasteriser (call once after building the UI). */
export function sharpenTexts(scene: Phaser.Scene): void {
  for (const o of scene.children.list) if (o instanceof Phaser.GameObjects.Text) o.setResolution(scaleK);
}

/** Zooms the main camera so the 360x640 layout fills the K-times bigger canvas. */
export function applyCameraZoom(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(scaleK).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
