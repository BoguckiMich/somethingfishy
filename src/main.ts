import Phaser from 'phaser';
import { pageParams } from './urlParams';
import { sound } from './audio/sound';
import { isSandbox } from './core/save';
import { loadFonts } from './font';
import { pickRenderScale } from './renderScale';
import { LakeScene } from './scenes/LakeScene';
import { setupUpdateToast } from './ui/updateToast';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

// Sound unlocks on the first tap; dev-flag URLs (the sandbox) never write the settings.
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  storage = undefined;
}
sound.init(storage, !isSandbox([...pageParams().keys()]));

// Phaser draws text on a canvas, so the pixel font must be ready before any text is created.
setupUpdateToast();

void loadFonts().then(() => {
  const k = pickRenderScale();
  const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH * k, // backing store at device resolution; LakeScene zooms its camera by k
  height: GAME_HEIGHT * k,
  pixelArt: true,
  audio: { noAudio: true }, // all sound is ours (src/audio), none of it goes through Phaser
  backgroundColor: '#1b2b3a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LakeScene],
  });
  // pixelArt makes the canvas nearest-neighbour; when the CSS size is not the backing size (non-integer
  // phone scale) a smooth resample keeps the hi-res text clean instead of dropping pixels.
  game.events.once(Phaser.Core.Events.READY, () => {
    const exact = Math.abs(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT) * (window.devicePixelRatio || 1) - k) < 0.02;
    if (!exact) game.canvas.style.imageRendering = 'auto';
  });
});
