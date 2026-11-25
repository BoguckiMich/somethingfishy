import { hereCarSprite, mapSprite } from '../art/mapArt';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';
import { MAP_PLACES, MAP_SIZE } from '../core/data/locations';
import { FONT, FS, LINE } from '../font';
import { COLORS, el } from './panel';

/** How long the tiny car takes along the road (ms). A tap skips it. */
export const ROAD_MS = 3000;

function asCanvas(s: Sprite): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(spriteToRgba(s)), s.width, s.height), 0, 0);
  return c;
}

export interface RoadCardHandle {
  /** Removes the card (fades it out); safe to call twice. */
  close(): void;
}

/**
 * The "road" card of a drive (slice 25a): the tiny road map with the car icon moving along a dotted road line from one
 * pin to the other, over a dark backdrop that fades in over the scene. It stays up until `close()` (the new place is
 * built behind it first). Tap to skip the drive: `onDone` fires once, at the end or on the tap.
 */
export function showRoadCard(fromId: string, toId: string, onDone: () => void): RoadCardHandle {
  const from = MAP_PLACES.find((p) => p.id === fromId)?.pin ?? { x: 34, y: 90 };
  const toPlace = MAP_PLACES.find((p) => p.id === toId);
  const to = toPlace?.pin ?? { x: 98, y: 64 };
  const root = el(
    'div',
    ['position:fixed', 'inset:0', 'z-index:20', 'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center', 'gap:10px', 'background:#0a0e1e', `font-family:${FONT}`, `color:${COLORS.text}`, 'opacity:0', 'transition:opacity .35s', 'touch-action:manipulation', 'cursor:pointer'].join(';'),
  );
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE.w;
  canvas.height = MAP_SIZE.h;
  canvas.style.cssText = `display:block;width:min(92vw,${MAP_SIZE.w * 2}px);aspect-ratio:${MAP_SIZE.w}/${MAP_SIZE.h};image-rendering:pixelated;border:2px solid ${COLORS.border}`;
  const g = canvas.getContext('2d')!;
  const base = asCanvas(mapSprite());
  const car = asCanvas(hereCarSprite());
  // A gently bent road from pin to pin (a quadratic curve through a control point off to the side).
  const mid = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.18, y: (from.y + to.y) / 2 - (to.x - from.x) * 0.18 };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x,
    y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y,
  });
  const draw = (t: number) => {
    g.clearRect(0, 0, MAP_SIZE.w, MAP_SIZE.h);
    g.drawImage(base, 0, 0);
    g.fillStyle = '#f3e3bf';
    for (let i = 0; i <= 40; i += 2) {
      const p = at(i / 40);
      g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 2, 2);
    }
    const p = at(t);
    g.drawImage(car, Math.round(p.x - car.width / 2), Math.round(p.y - car.height));
  };
  draw(0);
  const label = el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.gold}`, `Driving to ${toPlace?.name ?? 'the next place'}...`);
  const hint = el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.dim}`, 'Tap to skip');
  root.append(canvas, label, hint);
  document.body.append(root);
  requestAnimationFrame(() => (root.style.opacity = '1'));

  let done = false;
  let closed = false;
  let raf = 0;
  const started = performance.now();
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    draw(1);
    onDone();
  };
  const tick = (now: number) => {
    const t = Math.min(1, (now - started) / ROAD_MS);
    draw(t);
    if (t >= 1) finish();
    else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  root.addEventListener('click', finish);
  return {
    close: () => {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      root.style.opacity = '0';
      setTimeout(() => root.remove(), 400);
    },
  };
}
