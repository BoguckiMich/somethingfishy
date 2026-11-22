/** Phone vibration where supported (Android browsers; iOS Safari ignores it). Never throws. */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked — haptics are a bonus, not required.
  }
}

export const HAPTICS = {
  nibble: 12,
  bite: [70, 40, 70],
  hooked: 30,
  caught: [30, 50, 30, 50, 90],
  escaped: [20, 60, 20],
} satisfies Record<string, number | number[]>;
