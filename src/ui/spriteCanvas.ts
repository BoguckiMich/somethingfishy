import { spriteToRgba, type Sprite } from '../art/pixelGrid';

/** A sprite on a canvas shown `px` pixels wide (a whole multiple of its width keeps it crisp), pixelated. */
export function spriteCanvas(sprite: Sprite, px: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const rgba = spriteToRgba(sprite);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), sprite.width, sprite.height), 0, 0);
  const h = Math.round((px * sprite.height) / sprite.width);
  canvas.style.cssText = `display:block;flex:none;width:${px}px;height:${h}px;image-rendering:pixelated`;
  return canvas;
}
