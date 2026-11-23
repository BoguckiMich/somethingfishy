import { describe, expect, it } from 'vitest';
import { SLEEP_FADE, fadeView, newSleepFade, tickSleepFade, type SleepFade } from './sleepFade';

/** Runs the fade in 100 ms ticks, collecting when the clock should jump and when it is done. */
function run(f: SleepFade, ms: number) {
  let t = 0;
  let jumpAt: number | null = null;
  let doneAt: number | null = null;
  let jumps = 0;
  for (; t < ms; t += 100) {
    const r = tickSleepFade(f, 100);
    f = r.fade;
    if (r.jump) {
      jumps++;
      jumpAt = t + 100;
    }
    if (r.done && doneAt === null) doneAt = t + 100;
  }
  return { f, jumpAt, doneAt, jumps };
}

describe('the sleep fade', () => {
  it('goes dark, jumps the clock once in the dark, then fades back in', () => {
    const r = run(newSleepFade('Time for bed...', 'Good morning!'), 8000);
    expect(r.jumps).toBe(1);
    expect(r.jumpAt).toBeGreaterThanOrEqual(SLEEP_FADE.outMs + SLEEP_FADE.jumpAtMs);
    expect(r.jumpAt).toBeLessThan(SLEEP_FADE.outMs + SLEEP_FADE.holdMs);
    expect(r.doneAt).toBeGreaterThan(SLEEP_FADE.outMs + SLEEP_FADE.holdMs);
    expect(r.doneAt).toBeLessThanOrEqual(SLEEP_FADE.outMs + SLEEP_FADE.holdMs + SLEEP_FADE.inMs + 100);
  });

  it('shows "Time for bed..." while darkening, then the wake line', () => {
    const f0 = newSleepFade('Time for bed...', 'Good morning!');
    expect(fadeView(f0)).toMatchObject({ alpha: 0, text: 'Time for bed...' });
    const mid = tickSleepFade(f0, SLEEP_FADE.outMs * 0.9).fade;
    expect(fadeView(mid).alpha).toBeGreaterThan(0.8);
    expect(fadeView(mid).textAlpha).toBeGreaterThan(0.5);
    // Deep in the hold, past the jump: the other line, fully dark.
    const hold = tickSleepFade(tickSleepFade(f0, SLEEP_FADE.outMs).fade, SLEEP_FADE.jumpAtMs + 500).fade;
    expect(fadeView(hold)).toMatchObject({ alpha: 1, text: 'Good morning!', textAlpha: 1 });
  });

  it('is fully dark for the whole hold and clear again at the end', () => {
    const afterOut = tickSleepFade(newSleepFade('a', 'b'), SLEEP_FADE.outMs).fade;
    expect(fadeView(afterOut).alpha).toBe(1);
    const end = run(newSleepFade('a', 'b'), 10_000).f;
    expect(fadeView(end).alpha).toBe(0);
  });

  it('a long frame cannot skip the jump', () => {
    const r = tickSleepFade(newSleepFade('a', 'b'), SLEEP_FADE.outMs + SLEEP_FADE.holdMs + 10);
    // It lands in the 'in' phase but the jump is still reported (once).
    expect(r.fade.phase).toBe('in');
    expect(r.jump).toBe(true);
    expect(tickSleepFade(r.fade, 100).jump).toBe(false);
  });
});
