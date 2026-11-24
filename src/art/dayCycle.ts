/**
 * Day/night look. Pure: keyframes over the 24h clock, interpolated per colour channel.
 * The scene reads `dayLook(minute)` every frame and applies it to the sky, the water and tints.
 */

export const MINUTES_PER_DAY = 24 * 60;

export interface DayLook {
  skyTop: number;
  skyBottom: number;
  /** Multiplied onto the water texture. */
  waterTint: number;
  /** Multiplied onto scenery (hills, trees, shore, dock, angler). */
  worldTint: number;
  cloudTint: number;
  /** 0..1 */
  starAlpha: number;
  sunAlpha: number;
  moonAlpha: number;
  fireflyAlpha: number;
}

interface Keyframe extends DayLook {
  /** Minute of day. */
  at: number;
}

const hm = (h: number, m = 0) => h * 60 + m;

/** Sorted by `at`. The last keyframe wraps into the first one at midnight. */
export const KEYFRAMES: readonly Keyframe[] = [
  { at: hm(0), skyTop: 0x0b1134, skyBottom: 0x1c2b62, waterTint: 0x4c5c9c, worldTint: 0x5c6aa6, cloudTint: 0x3a4678, starAlpha: 1, sunAlpha: 0, moonAlpha: 1, fireflyAlpha: 1 },
  { at: hm(4, 30), skyTop: 0x1f2658, skyBottom: 0x6b5290, waterTint: 0x8a86c0, worldTint: 0x7e78b0, cloudTint: 0x6a5a98, starAlpha: 0.6, sunAlpha: 0, moonAlpha: 0.8, fireflyAlpha: 0.5 },
  { at: hm(6), skyTop: 0x6f86c8, skyBottom: 0xffb287, waterTint: 0xffd6cc, worldTint: 0xffc8b0, cloudTint: 0xffc2b0, starAlpha: 0, sunAlpha: 1, moonAlpha: 0.25, fireflyAlpha: 0 },
  { at: hm(8), skyTop: 0x5aaae2, skyBottom: 0xc3e8f0, waterTint: 0xfff4ea, worldTint: 0xfff0dc, cloudTint: 0xfff6ec, starAlpha: 0, sunAlpha: 1, moonAlpha: 0, fireflyAlpha: 0 },
  { at: hm(12), skyTop: 0x3f92e0, skyBottom: 0xaadef6, waterTint: 0xffffff, worldTint: 0xffffff, cloudTint: 0xffffff, starAlpha: 0, sunAlpha: 1, moonAlpha: 0, fireflyAlpha: 0 },
  { at: hm(17, 30), skyTop: 0x5a9cd8, skyBottom: 0xffd699, waterTint: 0xffe6cc, worldTint: 0xffdfb0, cloudTint: 0xffe0b8, starAlpha: 0, sunAlpha: 1, moonAlpha: 0, fireflyAlpha: 0 },
  { at: hm(19), skyTop: 0x4d4b9c, skyBottom: 0xff8c5a, waterTint: 0xf0b6c0, worldTint: 0xe6a2a8, cloudTint: 0xf4a090, starAlpha: 0.15, sunAlpha: 1, moonAlpha: 0.2, fireflyAlpha: 0.6 },
  { at: hm(20, 30), skyTop: 0x1f2662, skyBottom: 0x8a4c8c, waterTint: 0x9a98c8, worldTint: 0x8a84b4, cloudTint: 0x7a5c98, starAlpha: 0.6, sunAlpha: 0, moonAlpha: 1, fireflyAlpha: 1 },
  { at: hm(22), skyTop: 0x0c1236, skyBottom: 0x1e2e68, waterTint: 0x505fa0, worldTint: 0x606ea8, cloudTint: 0x3c487c, starAlpha: 1, sunAlpha: 0, moonAlpha: 1, fireflyAlpha: 1 },
];

export function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    return Math.round(ca + (cb - ca) * t) & 255;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The look at `minute` of the day (any real number; wraps at 24h). */
export function dayLook(minute: number): DayLook {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const last = KEYFRAMES.length - 1;
  let i = 0;
  while (i < last && KEYFRAMES[i + 1].at <= m) i++;
  const a = KEYFRAMES[i];
  const b = i === last ? KEYFRAMES[0] : KEYFRAMES[i + 1];
  const end = i === last ? MINUTES_PER_DAY : b.at;
  const t = (m - a.at) / (end - a.at);
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    waterTint: lerpColor(a.waterTint, b.waterTint, t),
    worldTint: lerpColor(a.worldTint, b.worldTint, t),
    cloudTint: lerpColor(a.cloudTint, b.cloudTint, t),
    starAlpha: lerp(a.starAlpha, b.starAlpha, t),
    sunAlpha: lerp(a.sunAlpha, b.sunAlpha, t),
    moonAlpha: lerp(a.moonAlpha, b.moonAlpha, t),
    fireflyAlpha: lerp(a.fireflyAlpha, b.fireflyAlpha, t),
  };
}

export interface ArcPosition {
  /** 0..1 across the sky, left to right. */
  x: number;
  /** 0 = on the horizon, 1 = highest point. */
  height: number;
  /** False when below the horizon (progress outside 0..1). */
  up: boolean;
}

function arc(progress: number): ArcPosition {
  const up = progress >= 0 && progress <= 1;
  const p = Math.min(1.1, Math.max(-0.1, progress));
  return { x: 0.08 + 0.84 * p, height: Math.pow(Math.max(0, Math.sin(Math.PI * p)), 0.7), up };
}

/** Sun: rises 05:00, sets 19:30 (peaks around 12:15). */
export function sunArc(minute: number): ArcPosition {
  return arc((minute - hm(5)) / hm(14, 30));
}

/** Moon: rises 19:00, sets 06:00 (the next morning). */
export function moonArc(minute: number): ArcPosition {
  const since = (((minute - hm(19)) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return arc(since / hm(11));
}

/**
 * The colours of the letterbox bands on a tall phone (slice 22c): the page above the game follows the sky's
 * top colour, the page below follows the grass the game ends in (darkened by the world tint at night).
 */
export function letterboxBands(look: DayLook): { top: number; bottom: number } {
  const grass = lerpColor(0x3a7436, 0x56963e, 0.5); // between PAL.grass0 and grass1: the mottled lawn along the bottom edge reads as this
  const ch = (s: number) => Math.round((((grass >> s) & 255) * ((look.worldTint >> s) & 255)) / 255);
  return { top: look.skyTop, bottom: (ch(16) << 16) | (ch(8) << 8) | ch(0) };
}

/** 0xRRGGBB as a CSS colour. */
export const cssColor = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
