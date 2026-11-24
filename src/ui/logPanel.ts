import { FONT, FS, LINE } from '../font';
import { fishSizeClass, fishSprite } from '../art/fishArt';
import { fishSilhouette } from '../art/fishVariants';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';
import { isLegendary, POOL_SPECIES, SPECIES, type Species } from '../core/data/fish';
import { formatCatchSize } from '../core/fish';
import { bestStar, goldCount, lockedHint, speciesCaught, whereWhen, type FishLog } from '../core/fishLog';
import { knowledgeRows, type KnowledgeRow } from '../core/fishKnowledge';
import { shopIconSprite } from '../art/shopIconArt';
import { halfSunSprite, moonSprite, sunSprite, wavesSprite } from '../art/clockIconArt';

import { starRow } from './starRow';
import { starSprite } from '../art/starArt';
import { spriteCanvas } from './spriteCanvas';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** A fish sprite on a canvas, scaled by whole pixels. */
export function fishCanvas(sprite: Sprite, maxW: number, maxScale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const rgba = spriteToRgba(sprite);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), sprite.width, sprite.height), 0, 0);
  const scale = Math.max(1, Math.min(maxScale, Math.floor(maxW / sprite.width), Math.floor(40 / sprite.height)));
  canvas.style.cssText = `width:${sprite.width * scale}px;height:${sprite.height * scale}px;image-rendering:pixelated`;
  return canvas;
}

/** A fish sprite fitted into a `box` x `box` px square (a whole-pixel scale when it fits at 1x or more, else shrunk), for the bag and shop lists. */
export function fishBoxCanvas(sprite: Sprite, box: number): HTMLElement {
  const canvas = fishCanvas(sprite, box, 1);
  const fit = Math.min(box / sprite.width, box / sprite.height);
  const scale = Math.min(3, fit);
  canvas.style.cssText = `width:${Math.round(sprite.width * scale)}px;height:${Math.round(sprite.height * scale)}px;image-rendering:pixelated`;
  const slot = el('div', `flex:none;width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center`);
  slot.append(canvas);
  return slot;
}

const artOf =(s: Species, log: FishLog, maxW: number, maxScale: number): HTMLCanvasElement => {
  const entry = log[s.id];
  if (!entry) return fishCanvas(fishSilhouette(s.id), maxW, maxScale);
  // A legendary always shows at its full size: it is a huge fish whatever the record says.
  return fishCanvas(fishSprite(s.id, isLegendary(s) ? 2 : fishSizeClass(s.id, entry.bestLengthCm)), maxW, maxScale);
};

const TIME_SPRITES = { sun: sunSprite, half: halfSunSprite, moon: moonSprite } as const;

/** The depth icon and the time icons of a locked species, each 9 x 9 drawn at 2x (18 px). */
function hintIcons(s: Species, px: number): HTMLElement {
  const h = lockedHint(s);
  const row = el('div', 'display:flex;align-items:center;justify-content:center;gap:4px');
  row.append(spriteCanvas(wavesSprite(h.depth === 'deep' ? 3 : 1), px));
  for (const t of h.times) row.append(spriteCanvas(TIME_SPRITES[t](), px));
  return row;
}

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
  const t = el('button', base + ';cursor:pointer');
  t.className = entry && isLegendary(s) ? 'rb-box rb-legend' : 'rb-box';
  t.type = 'button';
  t.addEventListener('click', () => onOpen(s.id));
  const art = el('div', 'height:44px;display:flex;align-items:center;justify-content:center');
  art.append(artOf(s, log, 66, 3));
  t.append(art);
  if (entry) {
    t.append(el('div', 'line-height:1', s.name));
    const stars = starRow(bestStar(log, s), 2);
    if (stars) t.append(stars);
  } else {
    t.append(el('div', `color:${COLORS.dim};line-height:0.8`, '???'));
    t.append(hintIcons(s, 18));
  }
  return t;
}

/** The card a tap on a locked tile opens: the depth and time spelled out at body size. */
function lockedCard(s: Species, onBack: () => void): HTMLElement {
  const col = el('div', 'display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center');
  col.append(
    el('div', `font:${FS.heading}px/${LINE} ${FONT};color:${COLORS.dim}`, '???'),
    hintIcons(s, 36),
    el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, lockedHint(s).text),
  );
  const back = woodButton('Back', onBack, { variant: 'wood' });
  back.style.cssText += ';width:100%;margin-top:4px';
  col.append(back);
  return col;
}

/** One knowledge line: dim "???" when locked, else the text (with the bait's icon). */
function knowledgeLine(r: KnowledgeRow): HTMLElement {
  const row = el('div', `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2px 6px;font-size:${FS.small}px;line-height:${LINE};color:${r.unlocked ? COLORS.cream : COLORS.dim}`);
  for (const id of r.baitIds) {
    const icon = shopIconSprite(id);
    if (icon) row.append(spriteCanvas(icon, 16));
  }
  row.append(el('span', '', r.text));
  return row;
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
    ...[starRow(bestStar(log, s), 2)].filter((x): x is HTMLCanvasElement => !!x),
    el('div', `font-size:${FS.body}px;color:${COLORS.cream}`, `Caught x${entry.count}`),
    el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, s.fact),
    el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, whereWhen(s)),
  );
  const rows = knowledgeRows(s, entry.count);
  if (rows.length) {
    const know = el('div', 'display:flex;flex-direction:column;gap:3px;width:100%;margin-top:2px');
    for (const r of rows) know.append(knowledgeLine(r));
    col.append(know);
  }
  const back = woodButton('Back', onBack, { variant: 'wood' });
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
      if (open && !log[open.id]) {
        body.append(lockedCard(open, () => { selected = null; panel.refresh(true); }));
        return;
      }
      if (open && log[open.id]) {
        body.append(detail(open, log, () => { selected = null; panel.refresh(); }));
        return;
      }
      const gold = el('div', `display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;font-size:${FS.body}px;line-height:${LINE};color:${COLORS.gold}`);
      gold.append('Gold', spriteCanvas(starSprite('gold'), 18), `${goldCount(log)}/${POOL_SPECIES.length}`);
      body.append(gold);
      const grid = el('div', 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px');
      for (const s of SPECIES) grid.append(tile(s, log, (id) => { selected = id; panel.refresh(); }));
      body.append(grid);
    },
    onClose,
  );
  return panel;
}
