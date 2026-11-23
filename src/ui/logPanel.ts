import { fishIconSprite, fishSizeClass, fishSprite } from '../art/fishArt';
import { spriteToRgba, TRANSPARENT, type Sprite } from '../art/pixelGrid';
import { SPECIES, type Species } from '../core/data/fish';
import { formatCatchSize } from '../core/fish';
import { speciesCaught, whereWhen, type FishLog } from '../core/fishLog';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

const SILHOUETTE = 0x14101a;

/** A fish sprite on a canvas, scaled by whole pixels. `silhouette` paints every pixel dark. */
function fishCanvas(sprite: Sprite, maxW: number, maxScale: number, silhouette: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const rgba = spriteToRgba(sprite);
  if (silhouette) {
    for (let i = 0; i < sprite.pixels.length; i++) {
      if (sprite.pixels[i] === TRANSPARENT) continue;
      rgba[i * 4] = (SILHOUETTE >> 16) & 255;
      rgba[i * 4 + 1] = (SILHOUETTE >> 8) & 255;
      rgba[i * 4 + 2] = SILHOUETTE & 255;
    }
  }
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), sprite.width, sprite.height), 0, 0);
  const scale = Math.max(1, Math.min(maxScale, Math.floor(maxW / sprite.width)));
  canvas.style.cssText = `width:${sprite.width * scale}px;height:${sprite.height * scale}px;image-rendering:pixelated`;
  return canvas;
}

const artOf = (s: Species, log: FishLog, maxW: number, maxScale: number): HTMLCanvasElement => {
  const entry = log[s.id];
  if (!entry) return fishCanvas(fishIconSprite(s.id), maxW, maxScale, true);
  return fishCanvas(fishSprite(s.id, fishSizeClass(s.id, entry.bestLengthCm)), maxW, maxScale, false);
};

function tile(s: Species, log: FishLog, onOpen: (id: string) => void): HTMLElement {
  const entry = log[s.id];
  const base = [
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:flex-start',
    'gap:4px',
    'padding:6px 3px',
    'height:104px',
    'min-width:0',
    `background:${entry ? COLORS.woodLight : '#2a1a12'}`,
    `border:2px solid ${entry ? COLORS.border : COLORS.woodLight}`,
    'border-radius:2px',
    `color:${COLORS.text}`,
    'font:11px monospace',
    'text-align:center',
  ].join(';');
  const t = el(entry ? 'button' : 'div', base + (entry ? ';cursor:pointer' : ''));
  if (t instanceof HTMLButtonElement) {
    t.type = 'button';
    t.addEventListener('click', () => onOpen(s.id));
  }
  const art = el('div', 'height:44px;display:flex;align-items:center;justify-content:center');
  art.append(artOf(s, log, 66, 3));
  t.append(art);
  if (entry) {
    t.append(el('div', 'font-weight:bold;line-height:1.15', s.name));
  } else {
    t.append(el('div', `font-weight:bold;color:${COLORS.dim}`, '???'));
    const [where, when] = whereWhen(s).split(' · ');
    const hint = `font-size:9px;line-height:1.2;color:${COLORS.dim}`;
    t.append(el('div', hint, where), el('div', hint, when));
  }
  return t;
}

function detail(s: Species, log: FishLog, onBack: () => void): HTMLElement {
  const entry = log[s.id]!;
  const col = el('div', 'display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center');
  const art = el('div', `box-sizing:border-box;width:100%;height:96px;display:flex;align-items:center;justify-content:center;background:${COLORS.woodLight};border:2px solid ${COLORS.border}`);
  art.append(artOf(s, log, 150, 6));
  col.append(
    art,
    el('div', `font:bold 18px monospace;color:${COLORS.text}`, s.name),
    el('div', `font:bold 14px monospace;color:${COLORS.gold}`, `Record: ${formatCatchSize(entry.bestLengthCm, entry.bestWeightG)}`),
    el('div', `font-size:13px;color:${COLORS.cream}`, `Caught ×${entry.count}`),
    el('div', `font-size:12px;line-height:1.4;color:${COLORS.text}`, s.fact),
    el('div', `font-size:11px;color:${COLORS.cream}`, whereWhen(s)),
  );
  const back = woodButton('Back', onBack);
  back.style.cssText += ';width:100%;margin-top:4px';
  col.append(back);
  return col;
}

/** The fish log: a 3x4 grid of species, and a detail card for the ones she has caught. */
export function openLogPanel(getLog: () => FishLog, onClose: () => void, startWith?: string): PanelHandle {
  let selected: string | null = startWith ?? null;
  const panel: PanelHandle = openPanel(
    `${speciesCaught(getLog())}/${SPECIES.length} species`,
    (body) => {
      const log = getLog();
      const open = SPECIES.find((s) => s.id === selected);
      if (open && log[open.id]) {
        body.append(detail(open, log, () => { selected = null; panel.refresh(); }));
        return;
      }
      const grid = el('div', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px');
      for (const s of SPECIES) grid.append(tile(s, log, (id) => { selected = id; panel.refresh(); }));
      body.append(grid);
    },
    onClose,
  );
  return panel;
}
