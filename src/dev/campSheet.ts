import { BED_FRONT_FROM, BED_SIZE, CAMPFIRE_FRAMES, CAMPFIRE_SIZE, POLE_SIZE, TENT_SIZE, WINDSOCK_LEVELS, WINDSOCK_SIZE, campfireSprite, dogBedSprite, lightPoleSprite, tentSprite, windsockSprite } from '../art/campArt';
import { DOG_BED_SPOT } from '../scenes/companions/behaviour';
import { Pix, dogSprite } from '../art/characters';
import { TRANSPARENT } from '../art/pixelGrid';
import { emptyChairSprite, pajkelSittingSprite } from '../art/characters';
import { CAMP_IDS } from '../core/data/camp';
import { dayLook } from '../art/dayCycle';
import { PAL } from '../art/palette';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';
import { shopIconSprite } from '../art/shopIconArt';

/**
 * Dev-only contact sheet of the camp items (served at /dev/camp-sheet.html, not part of the build): the six shop icons, then every scene
 * sprite on grass by day and by night (the campfire's three frames, the windsock's three strengths and two flaps, the deck chair with
 * Pajkel next to his red camp chair). `?scale=4` changes the zoom.
 */
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const scale = Number(new URLSearchParams(location.search).get('scale')) || 6;
document.body.style.cssText = `margin:0;background:${hex(PAL.stoneDark)};color:#fff;font:12px monospace`;

function tinted(rgba: Uint8ClampedArray, tint: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (out[i] * ((tint >> 16) & 255)) / 255;
    out[i + 1] = (out[i + 1] * ((tint >> 8) & 255)) / 255;
    out[i + 2] = (out[i + 2] * (tint & 255)) / 255;
  }
  return out;
}

function cell(s: Sprite, label: string, k: number, bg: number, tint = 0xffffff): HTMLElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.style.cssText = `width:${s.width * k}px;height:${s.height * k}px;image-rendering:pixelated;background:${hex(bg)}`;
  c.getContext('2d')!.putImageData(new ImageData(tinted(spriteToRgba(s), tint) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
  const d = document.createElement('div');
  d.append(c, document.createElement('br'), label);
  return d;
}

const row = (cells: HTMLElement[]): void => {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;gap:12px;align-items:flex-end;padding:8px 14px;border-bottom:1px solid #0006;flex-wrap:wrap';
  r.append(...cells);
  document.body.append(r);
};

// The shop icons (16 x 16) at x scale*2 and at the real 48 px the shop shows.
row(CAMP_IDS.map((id) => cell(shopIconSprite(id)!, `${id} icon`, scale * 2, PAL.woodLight)));
row(CAMP_IDS.map((id) => cell(shopIconSprite(id)!, `${id} 48px`, 3, PAL.woodLight)));

for (const [label, minute, bg] of [['day 12:00', 12 * 60, PAL.grass1], ['night 23:00', 23 * 60, 0x2c4a3a]] as const) {
  const tint = dayLook(minute).worldTint;
  const cells: HTMLElement[] = [];
  for (let f = 0; f < CAMPFIRE_FRAMES; f++) cells.push(cell(campfireSprite(f), `fire ${f} ${CAMPFIRE_SIZE.w}x${CAMPFIRE_SIZE.h}`, scale, bg, tint));
  cells.push(cell(tentSprite(), `tent ${TENT_SIZE.w}x${TENT_SIZE.h}`, scale, bg, tint));
  cells.push(cell(lightPoleSprite(), `pole ${POLE_SIZE.w}x${POLE_SIZE.h}`, scale, bg, tint));
  cells.push(cell(dogBedSprite(), `bed ${BED_SIZE.w}x${BED_SIZE.h}`, scale, bg, tint));
  for (let l = 0; l < WINDSOCK_LEVELS; l++) for (const f of [0, 1] as const) cells.push(cell(windsockSprite(l, f), `sock ${l}/${f} ${WINDSOCK_SIZE.w}x${WINDSOCK_SIZE.h}`, scale / 2, bg, tint));
  row(cells);
  void label;
}

row([
  cell(pajkelSittingSprite('sit', 0), 'camp chair (red)', scale / 2, PAL.woodLight),
  cell(pajkelSittingSprite('sit', 0, true), 'deck chair', scale / 2, PAL.woodLight),
  cell(pajkelSittingSprite('sipDrink', 0, true), 'deck, sip', scale / 2, PAL.woodLight),
  cell(emptyChairSprite(), 'empty red', scale / 2, PAL.woodLight),
  cell(emptyChairSprite(true), 'empty deck', scale / 2, PAL.woodLight),
]);

// Bestia asleep in her bed (slice 27), both breath frames, as the scene stacks them: the bed, her, then the bed's front rim over her.
{
  const cells: HTMLElement[] = [];
  for (const [label, minute, bg] of [['day', 12 * 60, PAL.grass1], ['night', 23 * 60, 0x2c4a3a]] as const) {
    const tint = dayLook(minute).worldTint;
    for (const breath of [0, 1]) {
      const p = new Pix(32, 26);
      const bed = dogBedSprite();
      p.blit(bed, 2, 14);
      p.blit(dogSprite({ shape: 'curl', tail: 0, perked: false, step: breath }), 0, DOG_BED_SPOT.y - 23 - 541);
      for (let y = BED_FRONT_FROM; y < BED_SIZE.h; y++) for (let x = 0; x < BED_SIZE.w; x++) {
        const c = bed.pixels[y * bed.width + x];
        if (c !== TRANSPARENT) p.set(2 + x, 14 + y, c);
      }
      cells.push(cell(p.done(), `${label} breath ${breath}`, scale, bg, tint));
    }
  }
  row(cells);
}
// `?only=nap` shows just that last row.
if (new URLSearchParams(location.search).get('only') === 'nap') [...document.body.children].slice(0, -1).forEach((e) => e.remove());
