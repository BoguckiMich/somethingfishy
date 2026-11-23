import { MOMENT_SPRITES } from '../art/momentArt';
import { PAL } from '../art/palette';
import { spriteToRgba } from '../art/pixelGrid';

/** Dev-only contact sheet of the lake-moment sprites at x8 on water and on dark water (/dev/moment-sheet.html). */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
document.body.style.cssText = `margin:0;background:${hex(PAL.stoneDark)};color:#fff;font:12px monospace`;
for (const [name, s] of Object.entries(MOMENT_SPRITES)) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid #0006';
  for (const bg of [PAL.shallow1, PAL.deep0]) {
    const c = document.createElement('canvas');
    c.width = s.width;
    c.height = s.height;
    c.style.cssText = `width:${s.width * 8}px;height:${s.height * 8}px;image-rendering:pixelated;background:${hex(bg)};padding:6px`;
    c.getContext('2d')!.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
    row.append(c);
  }
  row.append(`${name} ${s.width}x${s.height}`);
  document.body.append(row);
}
