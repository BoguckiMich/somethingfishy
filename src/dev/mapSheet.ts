import { barrierSprite, hereCarSprite, mapSprite, pinSprite, selectRingSprite } from '../art/mapArt';
import { PAL } from '../art/palette';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';

/** Dev-only contact sheet of the road-map art at x1 and x3 on a light background (/dev/map-sheet.html). */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
document.body.style.cssText = `margin:0;background:${hex(PAL.sandLight)};color:#222;font:12px monospace`;
const sprites: [string, Sprite][] = [
  ['map', mapSprite()],
  ['pin open', pinSprite(true)],
  ['pin locked', pinSprite(false)],
  ['selected ring', selectRingSprite()],
  ['you are here', hereCarSprite()],
  ['barrier (work in progress)', barrierSprite()],
];
for (const [name, s] of sprites) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;padding:6px 10px;border-bottom:1px solid #0003';
  row.append(name);
  for (const k of s.width > 100 ? [1, 3] : [1, 3, 8]) {
    const c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    c.style.cssText = `width:${s.width * k}px;height:${s.height * k}px;image-rendering:pixelated`;
    c.getContext('2d')!.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
    row.append(c);
  }
  document.body.append(row);
}
