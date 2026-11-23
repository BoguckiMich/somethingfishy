import { PAL } from '../art/palette';
import { spriteToRgba } from '../art/pixelGrid';
import { SHOP_ICON_IDS, shopIconSprite } from '../art/shopIconArt';

/** Dev-only contact sheet of the shop icons at x1, x3 and x6 on a light and a dark background (/dev/icon-sheet.html). */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
document.body.style.cssText = `margin:0;background:${hex(PAL.stoneDark)};color:#fff;font:12px monospace`;
for (const id of SHOP_ICON_IDS) {
  const s = shopIconSprite(id)!;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid #0006';
  row.append(id.padEnd(11, ' '));
  for (const bg of [PAL.sandLight, PAL.woodDeep]) {
    for (const k of [1, 3, 6]) {
      const c = document.createElement('canvas');
      c.width = s.width;
      c.height = s.height;
      c.style.cssText = `width:${s.width * k}px;height:${s.height * k}px;image-rendering:pixelated;background:${hex(bg)};padding:4px`;
      c.getContext('2d')!.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
      row.append(c);
    }
  }
  document.body.append(row);
}
