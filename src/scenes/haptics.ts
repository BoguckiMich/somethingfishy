/** Phone vibration where supported (Android browsers; iOS Safari ignores it). Never throws. */
let enabled = true;

/** The Settings switch (A3): off = nothing vibrates. */
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked — haptics are a bonus, not required.
  }
}

/**
 * The Settings "Test vibration" button: buzzes even when the switch is off and says what the browser answered,
 * so a phone that never vibrates can tell "not supported" from "blocked" (Brave, Firefox 129+ and iOS have none or block it).
 */
export function testVibration(): 'missing' | 'refused' | 'sent' {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return 'missing';
  try {
    return navigator.vibrate([200, 100, 200]) ? 'sent' : 'refused';
  } catch {
    return 'refused';
  }
}

export const HAPTICS = {
  nibble: 12,
  bite: [70, 40, 70],
  hooked: 30,
  caught: [30, 50, 30, 50, 90],
  escaped: [20, 60, 20],
  /** The line fight (slice 28): a surge is telegraphed, it hits, the line is near the red, in the red; the line snapped. */
  lineWarn: 22,
  lineSurge: 45,
  lineStrain: 10,
  lineRed: [25, 15, 25],
  snapped: [90, 30, 60],
} satisfies Record<string, number | number[]>;
