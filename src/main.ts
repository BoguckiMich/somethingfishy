import Phaser from 'phaser';
import { LakeScene } from './scenes/LakeScene';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: '#1b2b3a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LakeScene],
});
