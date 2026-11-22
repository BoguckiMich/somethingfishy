import { speciesById, SPECIES } from '../core/data/fish';
import { sizeShare } from '../core/fish';
import { Pix } from './characters';
import { PAL } from './palette';
import type { Sprite } from './pixelGrid';

/**
 * Placeholder fish art, one drawing per species in three size classes (real sprites come in
 * slice 10). The fish are painted procedurally from a small spec: body depth, palette and one
 * marking, so the 12 species stay distinguishable by colour and silhouette. They face right.
 */

export type FishSizeClass = 0 | 1 | 2;
export const FISH_SIZE_CLASSES: readonly FishSizeClass[] = [0, 1, 2];

type Marking = 'none' | 'stripes' | 'bars' | 'spots' | 'scales' | 'whiskers';

interface FishLook {
  /** Sprite widths (body + tail, without the outline) for the small / medium / large class. */
  widths: [number, number, number];
  /** Body depth as a share of the length. */
  depth: number;
  /** Squareness of the body outline: 2 = ellipse, higher = more tube-like (eel). */
  roundness: number;
  back: number;
  flank: number;
  belly: number;
  fin: number;
  /** Marking colour (stripes, spots, scale glints). */
  mark: number;
  eye: number;
  marking: Marking;
  /** Forked tail. */
  fork: boolean;
  /** Fin height in pixels for the large class (smaller classes may use less). */
  finH: number;
}

const L = (widths: [number, number, number], rest: Omit<FishLook, 'widths'>): FishLook => ({ widths, ...rest });
const DARK_EYE = PAL.outline;
const RED_EYE = 0xd9433a;
const WHISKER = 0x8a8a98;

/** Fish colours live here (not in PAL) so the shared palette stays small; they are placeholders anyway. */
const LOOKS: Record<string, FishLook> = {
  roach: L([10, 13, 16], { depth: 0.28, roundness: 2, back: 0x5e7080, flank: 0xb8c4c8, belly: 0xeef0ea, fin: 0xc87858, mark: 0x8a9ca4, eye: RED_EYE, marking: 'none', fork: true, finH: 2 }),
  rudd: L([10, 13, 16], { depth: 0.3, roundness: 2, back: 0x6a7a5a, flank: 0xcfcdb0, belly: 0xf2ecd2, fin: 0xd9433a, mark: 0xa8a888, eye: 0xe8b84a, marking: 'none', fork: true, finH: 2 }),
  bleak: L([9, 11, 13], { depth: 0.19, roundness: 2.2, back: 0x6a8aa0, flank: 0xd4e0e4, belly: 0xf6f6f0, fin: 0xb4c4cc, mark: 0xa4b8c0, eye: DARK_EYE, marking: 'none', fork: true, finH: 1 }),
  perch: L([10, 14, 17], { depth: 0.3, roundness: 2, back: 0x4a6a2e, flank: 0x7fa03e, belly: 0xdcd89a, fin: 0xd9433a, mark: 0x26361a, eye: 0xe8b84a, marking: 'stripes', fork: false, finH: 2 }),
  crucian: L([9, 12, 15], { depth: 0.4, roundness: 2, back: 0x8a6a2a, flank: 0xcaa23e, belly: 0xe6cf88, fin: 0x9a7430, mark: 0xdcbc5a, eye: DARK_EYE, marking: 'none', fork: false, finH: 2 }),
  eel: L([18, 24, 30], { depth: 0.09, roundness: 5, back: 0x2c3a22, flank: 0x4c5c30, belly: 0xa2a45c, fin: 0x2c3a22, mark: 0x66763c, eye: 0xe8e0a0, marking: 'none', fork: false, finH: 1 }),
  bream: L([15, 19, 23], { depth: 0.44, roundness: 2, back: 0x6a5a3c, flank: 0xaa8c52, belly: 0xdccb9c, fin: 0x5a4a32, mark: 0xc4a468, eye: DARK_EYE, marking: 'none', fork: true, finH: 2 }),
  tench: L([15, 19, 22], { depth: 0.32, roundness: 2.2, back: 0x2a4628, flank: 0x4c6c34, belly: 0x8c9c58, fin: 0x2a4628, mark: 0x6a8a44, eye: RED_EYE, marking: 'none', fork: false, finH: 2 }),
  carp: L([18, 23, 28], { depth: 0.36, roundness: 2, back: 0x946620, flank: 0xdca62e, belly: 0xf0d890, fin: 0xb8761a, mark: 0xf8da6c, eye: DARK_EYE, marking: 'scales', fork: true, finH: 3 }),
  pike: L([20, 26, 32], { depth: 0.2, roundness: 2.8, back: 0x2c5a2a, flank: 0x4c883a, belly: 0xdcdeb2, fin: 0x6a7a2a, mark: 0xdcdf98, eye: 0xe8b84a, marking: 'spots', fork: false, finH: 2 }),
  zander: L([18, 23, 28], { depth: 0.24, roundness: 2.4, back: 0x44564c, flank: 0x7a8c78, belly: 0xd2d6c6, fin: 0x586860, mark: 0x323c38, eye: 0xeeeed2, marking: 'bars', fork: true, finH: 3 }),
  catfish: L([22, 27, 32], { depth: 0.22, roundness: 2.6, back: 0x1e2a26, flank: 0x3a4a40, belly: 0x8c8c72, fin: 0x1e2a26, mark: 0x56665a, eye: 0xd8d8b0, marking: 'whiskers', fork: false, finH: 2 }),
};

/** Size class of a catch: the lower, middle or upper third of the species' length range. */
export function fishSizeClass(speciesId: string, lengthCm: number): FishSizeClass {
  const sp = speciesById(speciesId);
  if (!sp) return 0;
  const share = sizeShare(sp, lengthCm);
  return share < 0.34 ? 0 : share < 0.67 ? 1 : 2;
}

export const fishKey = (id: string, cls: FishSizeClass) => `fish:${id}:${cls}`;
export const fishIconKey = (id: string) => `fishicon:${id}`;

/** Width of the small icon in the catch bar. */
const ICON_WIDTH: Record<string, number> = { eel: 15, catfish: 13, pike: 13, bream: 12, carp: 12, zander: 12, bleak: 9, roach: 10, rudd: 10 };

export function fishSprite(id: string, cls: FishSizeClass): Sprite {
  const look = LOOKS[id];
  if (!look) throw new Error(`fishSprite: unknown species ${id}`);
  return drawFish(id, look, look.widths[cls], cls === 2 ? look.finH : Math.max(1, look.finH - 1));
}

/** A small fish for the catch bar's marker. */
export function fishIconSprite(id: string): Sprite {
  const look = LOOKS[id];
  if (!look) throw new Error(`fishIconSprite: unknown species ${id}`);
  return drawFish(id, look, ICON_WIDTH[id] ?? 11, 1);
}

function drawFish(id: string, look: FishLook, width: number, finH: number): Sprite {
  const whisk = look.marking === 'whiskers' ? Math.max(2, Math.round(width * 0.13)) : 0;
  const bodyLen = width - whisk; // tail + body
  const bodyH = Math.max(3, Math.round(width * look.depth));
  const tailLen = Math.max(2, Math.round(bodyLen * (id === 'eel' ? 0.06 : 0.2)));
  const bx0 = Math.max(0, tailLen - 1); // body starts just inside the tail
  const bx1 = bodyLen - 1;
  const margin = finH + 1; // room for fins plus the outline
  const W = width + 2;
  const H = bodyH + margin * 2 + (look.marking === 'whiskers' ? 1 : 0);
  const p = new Pix(W, H);
  const half = bodyH / 2;
  const ox = 1; // outline margin on the left

  /** Half-height of the body at u (0 = tail end, 1 = nose), in pixels. */
  const profile = (u: number): number => {
    const peak = id === 'eel' ? 0.5 : 0.45;
    const a = u < peak ? peak : 1 - peak;
    const t = Math.min(1, Math.abs(u - peak) / a);
    const shape = Math.pow(Math.max(0, 1 - Math.pow(t, look.roundness)), 1 / look.roundness);
    // A slim tail stalk: never thinner than a third of the depth.
    return Math.max(half * 0.34, half * shape);
  };

  // Body: back / flank / belly bands, plus the markings.
  for (let x = bx0; x <= bx1; x++) {
    const u = (x - bx0) / Math.max(1, bx1 - bx0);
    const hh = profile(u);
    for (let y = 0; y < bodyH; y++) {
      const dy = y - (bodyH - 1) / 2;
      if (Math.abs(dy) > hh - 0.05 && !(Math.abs(dy) < 0.6 && bodyH % 2 === 1)) continue;
      const r = dy / half; // -1 top .. +1 bottom
      let c = r < -0.42 ? look.back : r > 0.42 ? look.belly : look.flank;
      if (look.marking === 'stripes' && r < 0.45 && r > -1 && [0.3, 0.45, 0.6, 0.74].some((s) => Math.abs(u - s) < 0.5 / (bx1 - bx0) + 0.01)) c = look.mark;
      if (look.marking === 'bars' && r < 0.15 && [0.3, 0.52, 0.72].some((s) => Math.abs(u - s) < 0.5 / (bx1 - bx0) + 0.01)) c = look.mark;
      if (look.marking === 'spots' && r > -0.55 && r < 0.45 && (x * 7 + y * 5) % 9 === 0) c = look.mark;
      if (look.marking === 'scales' && r > -0.6 && r < 0.65 && (x + 2 * y) % 4 === 0) c = look.mark;
      p.set(ox + x, margin + y, c);
    }
  }
  // Gill edge: one darker column behind the head.
  const gillX = bx0 + Math.round((bx1 - bx0) * 0.78);
  for (let y = 1; y < bodyH - 1; y++) {
    const dy = y - (bodyH - 1) / 2;
    if (Math.abs(dy) < half * 0.7 && p.get(ox + gillX, margin + y) !== -1) {
      p.set(ox + gillX, margin + y, darken(p.get(ox + gillX, margin + y), 0.82));
    }
  }

  // Tail: a flared fan behind the body, forked or rounded.
  const peduncle = Math.max(1, Math.round(profile(0) * 2));
  const tailHalf = Math.max(peduncle / 2 + 0.6, half * (id === 'eel' ? 0.5 : 0.9));
  for (let x = 0; x < tailLen; x++) {
    const k = 1 - x / Math.max(1, tailLen); // 1 at the very end
    const th = peduncle / 2 + (tailHalf - peduncle / 2) * k;
    for (let y = 0; y < bodyH + 2; y++) {
      const dy = y - 1 - (bodyH - 1) / 2;
      if (Math.abs(dy) > th) continue;
      if (look.fork && x === 0 && Math.abs(dy) < th * 0.45) continue; // the notch
      p.set(ox + x, margin + y - 1, look.fin);
    }
  }

  // Fins: dorsal on the back, small ones under the belly (eels: a low ridge along the back).
  const topAt = (x: number) => {
    for (let y = 0; y < bodyH; y++) if (p.get(ox + x, margin + y) !== -1) return margin + y;
    return margin;
  };
  const botAt = (x: number) => {
    for (let y = bodyH - 1; y >= 0; y--) if (p.get(ox + x, margin + y) !== -1) return margin + y;
    return margin + bodyH - 1;
  };
  const finSpan = (u0: number, u1: number, height: number, down: boolean) => {
    for (let x = bx0 + Math.round((bx1 - bx0) * u0); x <= bx0 + Math.round((bx1 - bx0) * u1); x++) {
      const t = (x - bx0 - (bx1 - bx0) * u0) / Math.max(1, (bx1 - bx0) * (u1 - u0));
      const h = Math.max(1, Math.round(height * (down ? 1 - Math.abs(t - 0.5) * 1.2 : 1 - t * 0.7)));
      for (let k = 1; k <= h; k++) p.set(ox + x, down ? botAt(x) + k : topAt(x) - k, look.fin);
    }
  };
  if (id === 'eel') {
    finSpan(0.15, 0.8, 1, false);
    finSpan(0.2, 0.7, 1, true);
  } else if (id === 'catfish') {
    finSpan(0.62, 0.78, 1, false);
    finSpan(0.12, 0.7, finH, true); // the long anal fin
  } else {
    finSpan(0.36, 0.68, finH, false);
    finSpan(0.2, 0.36, Math.max(1, finH - 1), true);
    finSpan(0.5, 0.62, Math.max(1, finH - 1), true);
  }

  // Eye.
  const ex = ox + bx0 + Math.round((bx1 - bx0) * 0.88);
  const ey = margin + Math.round((bodyH - 1) / 2 - half * 0.22);
  p.set(ex, ey, look.eye);
  if (id === 'zander' && width >= 18) p.set(ex, ey + 1, look.eye);

  p.outline();
  // Whiskers go on after the outline so they stay thin: three barbels from the snout.
  if (look.marking === 'whiskers') {
    const noseX = ox + bx1 + 1;
    const nyMid = margin + Math.round((bodyH - 1) / 2) + 1;
    for (let k = 1; k <= whisk; k++) {
      p.set(noseX + k, nyMid + Math.floor(k / 2), WHISKER);
      p.set(noseX + k, nyMid - 1 - Math.floor(k / 3), WHISKER);
    }
    p.set(noseX + 1, nyMid + 2, WHISKER);
    p.set(noseX + 2, nyMid + 3, WHISKER);
  }
  return p.done();
}

function darken(c: number, f: number): number {
  const ch = (s: number) => Math.round(((c >> s) & 255) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Every species has a look (a guard for data and art drifting apart). */
export const FISH_IDS_WITH_ART: readonly string[] = SPECIES.filter((s) => LOOKS[s.id]).map((s) => s.id);
