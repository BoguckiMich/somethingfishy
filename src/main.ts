import Phaser from 'phaser';
import { sound } from './audio/sound';
import { isSandbox } from './core/save';
import { LakeScene } from './scenes/LakeScene';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

// Sound unlocks on the first tap; dev-flag URLs (the sandbox) never write the settings.
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  storage = undefined;
}
sound.init(storage, !isSandbox([...new URLSearchParams(location.search).keys()]));

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  audio: { noAudio: true }, // all sound is ours (src/audio), none of it goes through Phaser
  backgroundColor: '#1b2b3a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LakeScene],
});
