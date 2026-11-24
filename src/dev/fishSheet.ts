import { SPECIES } from '../core/data/fish';
import { fishHugSprite, isHugged } from '../art/fishArt';
import { fishIcon, fishSilhouette, fishVariant } from '../art/fishVariants';
import { PAL } from '../art/palette';
import { trophyBoardSprite } from '../art/trophyBoardArt';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';

/**
 * Dev-only contact sheet of every fish (served at /dev/fish-sheet.html, not part of the build):
 * large / medium / small / bar icon / silhouette at x4, plus the large one at x2 on light water and
 * dark wood. `?mode=large&scale=6` shows only the large sprites for close inspection; `?only=pike,eel` limits the species.
 */

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const params = new URLSearchParams(location.search);
const largeOnly = params.get('mode') === 'large';
const scale = Number(params.get('scale')) || (largeOnly ? 6 : 4);

function canvasFor(s: Sprite, k: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.style.width = `${s.width * k}px`;
  c.style.height = `${s.height * k}px`;
  c.style.imageRendering = 'pixelated';
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
  return c;
}

function cell(label: string, s: Sprite, k: number, bg?: number, minW = 0, minH = 0): HTMLElement {
  const box = document.createElement('div');
  box.className = 'cell';
  const stage = document.createElement('div');
  stage.className = 'stage';
  if (bg !== undefined) stage.style.background = hex(bg);
  stage.style.minWidth = `${minW}px`;
  stage.style.minHeight = `${minH}px`;
  stage.appendChild(canvasFor(s, k));
  const cap = document.createElement('div');
  cap.className = 'cap';
  cap.textContent = `${label} ${s.width}x${s.height}`;
  box.append(stage, cap);
  return box;
}

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; background: ${hex(PAL.stoneDark)}; color: #fff; font: 12px monospace; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #0006; }
  .cell { display: flex; flex-direction: column; gap: 2px; }
  .stage { display: flex; align-items: center; justify-content: center; padding: 6px; background: ${hex(PAL.woodLight)}; }
  .cap { opacity: .75; font-size: 10px; }
  .name { width: 100%; font-size: 14px; font-weight: bold; }
`;
document.head.appendChild(style);

const wrap = document.createElement('div');
document.body.appendChild(wrap);

const only = params.get('only')?.split(',');
for (const sp of SPECIES) {
  if (only && !only.includes(sp.id)) continue;
  const row = document.createElement('div');
  row.className = 'row';
  const large = fishVariant(sp.id, 2);
  if (largeOnly) {
    row.append(cell('large', large, scale, PAL.shallow2, large.width * scale + 12, large.height * scale + 12));
  } else {
    row.append(
      cell('large', large, scale, PAL.shallow2),
      cell('medium', fishVariant(sp.id, 1), scale, PAL.shallow2),
      cell('small', fishVariant(sp.id, 0), scale, PAL.shallow2),
      cell('bar icon', fishIcon(sp.id), scale, PAL.barWater),
      cell('silhouette', fishSilhouette(sp.id), scale, PAL.cream),
      cell('large x2 water', large, 2, PAL.shallow1),
      cell('large x2 wood', large, 2, PAL.woodDark),
    );
    if (isHugged(sp.id)) row.append(cell('hug pose', fishHugSprite(sp.id), 4, PAL.woodDark));
  }
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = `${sp.name ?? sp.id} (${sp.id})`;
  row.append(name);
  wrap.appendChild(row);
}

// The trophy board (slice 23d) with nothing, one, and all four mounted fish, on the grass colour.
if (!only || only.includes('board')) {
  const row = document.createElement('div');
  row.className = 'row';
  for (const [label, ids] of [['empty', []], ['golden tench', ['goldenTench']], ['all four', ['goldenTench', 'mossback', 'silverGhost', 'pale']]] as const) {
    row.append(cell(`board ${label}`, trophyBoardSprite(ids), scale, PAL.grass0));
  }
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = 'Trophy board (slice 23d)';
  row.append(name);
  wrap.appendChild(row);
}
