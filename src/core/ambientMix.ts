/**
 * Which ambient layers are audible at a time of day (pure). Mirrors the `dayLook` keyframes in
 * src/art/dayCycle.ts: the sun-up day runs 06:00 to 17:30, dusk 17:30 to 20:30, night after that.
 * Layers crossfade with smoothstep ramps so there are no jumps.
 */
export interface AmbientMix {
  /** Always on. */
  water: number;
  /** By day (a dawn chorus from 05:00, gone by 19:30). */
  birds: number;
  /** At dusk (17:30 to 22:30, loudest around 19:30 to 20:30). */
  frogs: number;
  /** At night (20:00 to 05:30). */
  crickets: number;
}

const DAY = 24 * 60;
const hm = (h: number, m = 0) => h * 60 + m;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * 0 before `rise`, up to 1 at `full`, 1 until `fall`, down to 0 at `gone`. The four times
 * ascend and may run past midnight (`gone` can exceed 24:00); `minute` is wrapped around them.
 */
function trapezoid(minute: number, rise: number, full: number, fall: number, gone: number): number {
  const r = (((minute - rise) % DAY) + DAY) % DAY;
  if (r < full - rise) return smooth(r / (full - rise));
  if (r < fall - rise) return 1;
  if (r < gone - rise) return 1 - smooth((r - (fall - rise)) / (gone - fall));
  return 0;
}

export function ambientMix(minute: number): AmbientMix {
  return {
    water: 1,
    birds: trapezoid(minute, hm(5), hm(7), hm(17, 30), hm(19, 30)),
    frogs: trapezoid(minute, hm(17, 30), hm(19, 30), hm(20, 30), hm(22, 30)),
    crickets: trapezoid(minute, hm(20), hm(22), hm(28), hm(29, 30)),
  };
}
