import { BARRIER_SIZE, HERE_SIZE, PIN_SIZE, RING_SIZE, barrierSprite, hereCarSprite, mapSprite, pinSprite, selectRingSprite } from '../art/mapArt';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';
import type { NapStatus } from '../core/carMap';
import { MAP_PLACES, MAP_SIZE } from '../core/data/locations';
import { FS, LINE } from '../font';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** A sprite as a canvas the map canvas can draw from. */
function asCanvas(s: Sprite): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(spriteToRgba(s)), s.width, s.height), 0, 0);
  return c;
}

/** Hit squares are 32 css px: the map is shown at 2 css px per art pixel. */
const HIT = 32;
const SHADOW = `1px 0 ${COLORS.outline},-1px 0 ${COLORS.outline},0 1px ${COLORS.outline},0 -1px ${COLORS.outline},1px 1px ${COLORS.outline},-1px -1px ${COLORS.outline},1px -1px ${COLORS.outline},-1px 1px ${COLORS.outline}`;

/**
 * The road map (slice 18), opened by tapping the car: the map picture with a pin per place, a work-in-progress
 * barrier next to each place that is "coming soon" and a tiny car where she is. Tap a pin to read about the
 * place below the map (Quiet Lake is selected at first). "Take a nap..." closes the map and calls `onNap`.
 */
export interface MapOptions {
  onNap: () => void;
  /** Opens the Quiet Lake checklist (the map closes first). */
  onChecklist: () => void;
  /** Bundles done (of `total`) and whether the road is fixed (all done): they change the River bend pin. */
  checklist: { done: number; total: number };
  /** Whether a nap is possible right now, and why not (read on every render). */
  nap: () => NapStatus;
  /** The place she is at (slice 25a), and the dev flag ?travel=1 that opens the River bend regardless of the checklist. */
  current: string;
  travelAny: boolean;
  /** Whether she can drive right now, and why not (read on every render); `onTravel` closes the map's work and starts the drive. */
  travel: () => { available: boolean; reason: string };
  onTravel: (placeId: string) => void;
  /** Dev flag ?select=<id>: the place that is selected when the map opens (default: where she is). */
  select?: string;
}

export function showMapPanel(opts: MapOptions, onClose: () => void): PanelHandle {
  const { onNap, onChecklist, checklist } = opts;
  const roadFixed = checklist.done >= checklist.total;
  /** Open = she can fish there: Quiet Lake always, the River bend once the road is fixed (or with ?travel=1). */
  const isOpen = (p: (typeof MAP_PLACES)[number]): boolean => p.id === 'river-bend' ? roadFixed || opts.travelAny : p.status === 'open';
  const blurbOf = (p: (typeof MAP_PLACES)[number]): string =>
    p.id === 'river-bend' && !isOpen(p) ? `Finish the Quiet Lake checklist to fix the road (${checklist.done}/${checklist.total})` : p.blurb;
  let selected: string = opts.select && MAP_PLACES.some((p) => p.id === opts.select) ? opts.select : opts.current;
  const pins = { open: asCanvas(pinSprite(true)), soon: asCanvas(pinSprite(false)) };
  const ring = asCanvas(selectRingSprite());
  const barrier = asCanvas(barrierSprite());
  const car = asCanvas(hereCarSprite());
  const base = asCanvas(mapSprite());

  const panel: PanelHandle = openPanel(
    'Road map',
    (body) => {
      const map = el('div', `position:relative;width:100%;max-width:${MAP_SIZE.w * 2}px;margin:0 auto 8px;aspect-ratio:${MAP_SIZE.w}/${MAP_SIZE.h}`);
      const canvas = document.createElement('canvas');
      canvas.width = MAP_SIZE.w;
      canvas.height = MAP_SIZE.h;
      canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated';
      const g = canvas.getContext('2d')!;
      g.drawImage(base, 0, 0);
      for (const p of MAP_PLACES) {
        const { x, y } = p.pin;
        if (p.id === selected) g.drawImage(ring, x - Math.floor(RING_SIZE.w / 2), y - Math.floor(RING_SIZE.h / 2));
        if (!isOpen(p)) g.drawImage(barrier, x - BARRIER_SIZE.w - 5, y - BARRIER_SIZE.h + 1);
        if (p.id === opts.current) g.drawImage(car, x - HERE_SIZE.w - 7, y - HERE_SIZE.h);
        g.drawImage(pins[isOpen(p) ? 'open' : 'soon'], x - Math.floor(PIN_SIZE.w / 2), y - PIN_SIZE.h + 1);
      }
      map.append(canvas);

      for (const p of MAP_PLACES) {
        const left = (p.pin.x / MAP_SIZE.w) * 100;
        const top = (p.pin.y / MAP_SIZE.h) * 100;
        const on = p.id === selected;
        // Label under the pin (not a hit target itself: the pin's square is).
        const label = el(
          'div',
          [
            'position:absolute',
            `left:${left}%`,
            `top:calc(${top}% + 6px)`,
            'transform:translateX(-50%)',
            'white-space:nowrap',
            'pointer-events:none',
            `font-size:${FS.small}px`,
            `line-height:${LINE}`,
            `color:${on ? COLORS.gold : COLORS.text}`,
            `text-shadow:${SHADOW}`,
          ].join(';'),
          p.name,
        );
        const hit = el(
          'button',
          [
            'position:absolute',
            `left:calc(${left}% - ${HIT / 2}px)`,
            `top:calc(${top}% - ${HIT - 6}px)`,
            `width:${HIT}px`,
            `height:${HIT}px`,
            'padding:0',
            'border:0',
            'background:transparent',
            'cursor:pointer',
          ].join(';'),
        );
        hit.type = 'button';
        hit.setAttribute('aria-label', p.name);
        hit.addEventListener('click', () => {
          if (selected === p.id) return;
          selected = p.id;
          panel.refresh();
        });
        map.append(label, hit);
      }
      body.append(map);

      const place = MAP_PLACES.find((q) => q.id === selected) ?? MAP_PLACES[0];
      const info = el('div', 'margin-bottom:8px');
      info.append(
        el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.gold}`, place.name),
        el(
          'div',
          `font-size:${FS.body}px;line-height:${LINE};color:${isOpen(place) ? COLORS.cream : COLORS.amber}`,
          place.id === opts.current ? 'You are here' : isOpen(place) ? 'Open' : 'Coming soon',
        ),
        el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};margin-top:2px`, blurbOf(place)),
      );
      body.append(info);

      const napNow = opts.nap();
      const nap = el('div', 'display:flex;flex-direction:column;gap:8px');
      if (place.id !== opts.current && isOpen(place)) {
        const t = opts.travel();
        nap.append(
          woodButton('Drive there', () => {
            panel.close();
            opts.onTravel(place.id);
          }, t.available ? {} : { disabledReason: t.reason }),
        );
      }
      nap.append(
        woodButton(`Quiet Lake checklist ${checklist.done}/${checklist.total}`, () => {
          panel.close();
          onChecklist();
        }),
        woodButton('Nap in the car...', () => {
          panel.close();
          onNap();
        }, napNow.available ? { variant: 'wood' } : { variant: 'wood', disabledReason: napNow.reason }),
      );
      body.append(
        nap,
        el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.dim};text-align:center;margin-top:8px`, 'New places are on the way. Check back soon!'),
      );
    },
    onClose,
  );
  return panel;
}
