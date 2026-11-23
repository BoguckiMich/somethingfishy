import { CAR_VARIANTS, CAR_SIZE, carSprite } from '../art/carArt';
import { dayLook } from '../art/dayCycle';
import { PAL } from '../art/palette';
import { spriteToRgba } from '../art/pixelGrid';

/**
 * Dev-only contact sheet of the car (served at /dev/car-sheet.html, not part of the build): each
 * variant (door closed, open, interior light) at x6 on the grass by day and by night, and at
 * the real size 1:1. `?scale=4` changes the zoom.
 */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const scale = Number(new URLSearchParams(location.search).get('scale')) || 6;
document.body.style.cssText = `margin:0;background:${hex(PAL.stoneDark)};color:#fff;font:12px monospace`;

/** Multiplies the sprite's colours by a 0xRRGGBB tint, like the game's day cycle does. */
function tinted(rgba: Uint8ClampedArray, tint: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (out[i] * ((tint >> 16) & 255)) / 255;
    out[i + 1] = (out[i + 1] * ((tint >> 8) & 255)) / 255;
    out[i + 2] = (out[i + 2] * (tint & 255)) / 255;
  }
  return out;
}

function canvasOf(rgba: Uint8ClampedArray, k: number, bg: number): HTMLCanvasElement {
  const { w, h } = CAR_SIZE;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.cssText = `width:${w * k}px;height:${h * k}px;image-rendering:pixelated;background:${hex(bg)}`;
  c.getContext('2d')!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return c;
}

for (const [label, minute] of [['day 12:00', 12 * 60], ['night 23:00', 23 * 60]] as const) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;align-items:flex-end;padding:8px 14px;border-bottom:1px solid #0006;flex-wrap:wrap';
  const tint = dayLook(minute).worldTint;
  const bg = minute === 12 * 60 ? PAL.grass1 : 0x2c4a3a;
  for (const v of CAR_VARIANTS) {
    const rgba = tinted(spriteToRgba(carSprite(v)) as Uint8ClampedArray, tint);
    const cell = document.createElement('div');
    cell.append(canvasOf(rgba, scale, bg), document.createElement('br'), `${v} · ${label}`);
    row.append(cell);
  }
  document.body.append(row);
}

// Real size, as in the game (x1, then the 2x a phone shows).
const real = document.createElement('div');
real.style.cssText = 'display:flex;gap:16px;align-items:flex-end;padding:8px 14px';
for (const v of CAR_VARIANTS) for (const k of [1, 2]) real.append(canvasOf(spriteToRgba(carSprite(v)) as Uint8ClampedArray, k, PAL.grass1));
real.append(`${CAR_SIZE.w}x${CAR_SIZE.h} px`);
document.body.append(real);
