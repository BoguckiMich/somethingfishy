/** Cap on K: at 4 a phone canvas gets very big for no visible gain; 3 keeps text and sprites sharp enough (M2 groundwork A). */
export const MAX_RENDER_SCALE = 3;

/** The K for a given fit and device pixel ratio (pure, tested): ceil(fit x dpr), clamped to 1..MAX_RENDER_SCALE. */
export function renderScaleFor(fit: number, dpr: number): number {
  // -0.02: a scale like 3.001 must not tip into the next whole number.
  return Math.min(MAX_RENDER_SCALE, Math.max(1, Math.ceil(fit * dpr - 0.02)));
}
