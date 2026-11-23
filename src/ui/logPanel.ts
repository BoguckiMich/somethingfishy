import { FONT, FS, LINE } from '../font';
import { fishSizeClass, fishSprite } from '../art/fishArt';
import { fishSilhouette } from '../art/fishVariants';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';
import { isLegendary, SPECIES, type Species } from '../core/data/fish';
import { formatCatchSize } from '../core/fish';
import { speciesCaught, whereWhen, type FishLog } from '../core/fishLog';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** A fish sprite on a canvas, scaled by whole pixels. */
function fishCanvas(sprite: Sprite, maxW: number, maxScale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const rgba = spriteToRgba(sprite);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), sprite.width, sprite.height), 0, 0);
  const scale = Math.max(1, Math.min(maxScale, Math.floor(maxW / sprite.width), Math.floor(40 / sprite.height)));
  canvas.style.cssText = `width:${sprite.width * scale}px;height:${sprite.height * scale}px;image-rendering:pixelated`;
  return canvas;
}

const artOf = (s: Species, log: FishLog, maxW: number, maxScale: number): HTMLCanvasElement => {
  const entry = log[s.id];
  if (!entry) return fishCanvas(fishSilhouette(s.id), maxW, maxScale);
  // A legendary always shows at its full size: it is a huge fish whatever the record says.
  return fishCanvas(fishSprite(s.id, isLegendary(s) ? 2 : fishSizeClass(s.id, entry.bestLengthCm)), maxW, maxScale);
};

function tile(s: Species, log: FishLog, onOpen: (id: string) => void): HTMLElement {
  const entry = log[s.id];
  const base = [
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:flex-start',
    'gap:2px',
    'padding:6px 3px',
    'min-height:112px',
    'min-width:0',
    `background:${entry ? COLORS.woodLight : '#2a1a12'}`,
    `color:${COLORS.text}`,
    `font:${FS.small}px/${LINE} ${FONT}`,
    'text-align:center',
  ].join(';');
  const t = el(entry ? 'button' : 'div', base + (entry ? ';cursor:pointer' : ''));
  t.className = entry && isLegendary(s) ? 'rb-box rb-legend' : 'rb-box';
  if (t instanceof HTMLButtonElement) {
    t.type = 'button';
    t.addEventListener('click', () => onOpen(s.id));
  }
  const art = el('div', 'height:44px;display:flex;align-items:center;justify-content:center');
  art.append(artOf(s, log, 66, 3));
  t.append(art);
  if (entry) {
    t.append(el('div', 'line-height:1', s.name));
  } else {
    t.append(el('div', `color:${COLORS.dim};line-height:0.8`, '???'));
    const [where, when] = s.logHint ? s.logHint.split(/(?<=\.) /) : whereWhen(s).split(' · ');
    const hint = `font-size:${FS.tiny}px;line-height:1.2;color:${COLORS.dim}`;
    t.append(el('div', hint, where), el('div', hint, when));
  }
  return t;
}

function detail(s: Species, log: FishLog, onBack: () => void): HTMLElement {
  const entry = log[s.id]!;
  const col = el('div', 'display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center');
  const art = el('div', `box-sizing:border-box;width:100%;height:96px;display:flex;align-items:center;justify-content:center;background:${COLORS.woodLight}`);
  art.className = isLegendary(s) ? 'rb-box rb-legend' : 'rb-box';
  art.append(artOf(s, log, 150, 6));
  col.append(
    art,
    el('div', `font:${FS.heading}px/${LINE} ${FONT};color:${COLORS.text}`, s.name),
    el('div', `font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold}`, `Record: ${formatCatchSize(entry.bestLengthCm, entry.bestWeightG)}`),
    el('div', `font-size:${FS.body}px;color:${COLORS.cream}`, `Caught x${entry.count}`),
    el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, s.fact),
    el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, whereWhen(s)),
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
