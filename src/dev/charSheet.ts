import { SPECIES } from '../core/data/fish';
import {
  SHOW_OFF_FISH_ANCHOR,
  allDogFrames,
  alexShowOffHandsSprite,
  alexShowOffSprite,
  alexSprite,
  dogKey,
  dogSprite,
  pajkelSittingSprite,
  pajkelWalkSprite,
  stickCarrySprite,
  STICK_CARRY_SIZE,
  DOG_SIZE,
  type PajPose,
  PAJ_WALK_POSES,
} from '../art/characters';
import { DOG_MOUTH } from '../scenes/companions/behaviour';
import { fishVariant } from '../art/fishVariants';
import { PAL } from '../art/palette';
import { TRANSPARENT, spriteToRgba, type Sprite } from '../art/pixelGrid';

/**
 * Dev-only sheet of the characters at a big scale (served at /dev/char-sheet.html, not part of
 * the build). `?mode=alex|paj|dog` limits it; `?scale=6` sets the zoom; `?species=pike` picks the
 * fish for the show-off row (default: bleak, perch, bream, pike, catfish large).
 */

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'all';
const scale = Number(params.get('scale')) || 6;

function canvasOf(s: Sprite, k: number, bg: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.style.cssText = `width:${s.width * k}px;height:${s.height * k}px;image-rendering:pixelated;background:${hex(bg)}`;
  c.getContext('2d')!.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
  return c;
}

/** Layers onto one transparent sprite (positions are the layer's top-left). */
function compose(w: number, h: number, layers: [Sprite, number, number][]): Sprite {
  const pixels = new Int32Array(w * h).fill(TRANSPARENT);
  for (const [s, ox, oy] of layers) {
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = s.pixels[y * s.width + x];
        const tx = x + ox;
        const ty = y + oy;
        if (c !== TRANSPARENT && tx >= 0 && ty >= 0 && tx < w && ty < h) pixels[ty * w + tx] = c;
      }
    }
  }
  return { width: w, height: h, pixels };
}

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; background: ${hex(PAL.stoneDark)}; color: #fff; font: 12px monospace; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #0006; }
  .cell { display: flex; flex-direction: column; gap: 2px; }
  .cap { opacity: .75; font-size: 10px; }
`;
document.head.appendChild(style);
const wrap = document.createElement('div');
document.body.appendChild(wrap);

function row(cells: [string, Sprite, number?][]): void {
  const r = document.createElement('div');
  r.className = 'row';
  for (const [label, s, bg] of cells) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = label;
    cell.append(canvasOf(s, scale, bg ?? PAL.shallow2), cap);
    r.appendChild(cell);
  }
  wrap.appendChild(r);
}

if (mode === 'all' || mode === 'alex') {
  const ids = params.get('species')?.split(',') ?? ['bleak', 'perch', 'bream', 'pike', 'catfish'];
  const sizes = (params.get('size') ?? '2').split(',').map(Number) as (0 | 1 | 2)[];
  for (const size of sizes) {
    const cells: [string, Sprite, number?][] = [];
    for (const id of ids) {
      if (!SPECIES.some((s) => s.id === id)) continue;
      const fish = fishVariant(id, size);
      const W = 56;
      const ox = Math.floor((W - 32) / 2);
      const body = alexShowOffSprite(0);
      const layers: [Sprite, number, number][] = [
        [body, ox, 0],
        [fish, ox + SHOW_OFF_FISH_ANCHOR.x - Math.floor(fish.width / 2), SHOW_OFF_FISH_ANCHOR.y - Math.floor(fish.height / 2)],
        [alexShowOffHandsSprite(), ox, 0],
      ];
      cells.push([`${id} ${size}`, compose(W, 56, layers), PAL.shallow2]);
    }
    row(cells);
  }
  row([['standing', alexSprite('forward', 0)]]);
}

if (mode === 'all' || mode === 'paj') {
  row(
    (['sit', 'sip', 'cheer', 'look'] as PajPose[]).flatMap((pose): [string, Sprite, number?][] =>
      [0, 1].map((b) => [`${pose}${b}`, pajkelSittingSprite(pose, b as 0 | 1), PAL.woodLight] as [string, Sprite, number?]),
    ),
  );
  row(PAJ_WALK_POSES.map((p): [string, Sprite, number?] => [p, pajkelWalkSprite(p), PAL.grass1]));
}

if (mode === 'all' || mode === 'dog') {
  const frames = allDogFrames();
  for (let i = 0; i < frames.length; i += 8) {
    row(frames.slice(i, i + 8).map((f): [string, Sprite, number?] => [dogKey(f), dogSprite(f), PAL.grass1]));
  }
}

if (mode === 'all' || mode === 'dog') {
  // The carried stick over the carry frames, placed like the game does (DOG_MOUTH, see behaviour.ts).
  const stick = stickCarrySprite();
  row(
    [0, 1, 2, 3].map((step): [string, Sprite, number?] => {
      const dog = dogSprite({ shape: 'run', tail: 0, perked: false, step, carry: true });
      return [`carry ${step}`, compose(DOG_SIZE.w + 8, DOG_SIZE.h, [[dog, 0, 0], [stick, DOG_SIZE.w / 2 + DOG_MOUTH.x - Math.floor(STICK_CARRY_SIZE.w / 2), DOG_SIZE.h - 1 - DOG_MOUTH.y - Math.floor(STICK_CARRY_SIZE.h / 2)]]), PAL.grass1];
    }),
  );
}
