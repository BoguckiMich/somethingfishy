import { WORM_ID, baitById } from '../core/data/baits';
import { LURES, lureById } from '../core/data/spinning';
import { activeRig, addLure, baitCount, chooseLure, chosenBait, chosenLure, lureCount, type PlayerState } from '../core/inventory';

/**
 * The rig chip of the bottom bar (slice 32, extracted from LakeScene): the old bait chip, which now also shows the lure on the spinning rig.
 * Everything here is pure (player state in, ids and words out), so the scene only draws it. The picker that opens from the chip is
 * `ui/baitPicker.ts` (`openRigPicker`, tabs Float and Spin).
 */

export interface RigChipView {
  /** Which rig is on the line now. */
  rig: 'float' | 'spin';
  /** The bait id (`worm` too) or the lure id whose icon the chip shows. */
  id: string;
  /** How many of it are left: the number on the chip. */
  count: number;
}

/** What the chip shows: the lure and its count on the spinning rig, else the bait and its count. */
export function rigChipView(p: PlayerState): RigChipView {
  if (activeRig(p) === 'spin') {
    const id = chosenLure(p)!;
    return { rig: 'spin', id, count: lureCount(p, id) };
  }
  const id = chosenBait(p);
  return { rig: 'float', id, count: baitCount(p, id) };
}

const baitName = (id: string): string => baitById(id)?.name.toLowerCase() ?? 'worms';
const lureName = (id: string): string => lureById(id)?.name.toLowerCase() ?? 'lure';

/** The "-1 worm" cue that floats up from the chip when a bait is spent. */
export const baitCueText = (usedId: string): string => `-1 ${baitById(usedId)?.name.toLowerCase() ?? 'worm'}`;

/** After a catch used the chosen bait up (the choice moved on): the toast saying so, else undefined. */
export function baitRunOutToast(before: PlayerState, after: PlayerState): string | undefined {
  const was = chosenBait(before);
  const now = chosenBait(after);
  if (now === was || baitCount(after, was) > 0) return undefined;
  return now === WORM_ID && after.worms <= 0 ? `Out of ${baitName(was)}` : `Out of ${baitName(was)}, using ${baitName(now)}`;
}

/**
 * A lure is gone (`cause`): what the toast says. A snapped line "The spinner went with it."; and when it was the last of its kind the
 * chip moves on (to another lure she has, else back to the float rig): "Lost your last spinner, using the wobbler." / "Lost your last spinner."
 * A snag already said its own line ("Snagged on a root..."), so only the second sentence is added there.
 */
export function lureLostToasts(before: PlayerState, after: PlayerState, lureId: string, cause: 'snapped' | 'snag'): string[] {
  const out: string[] = [];
  const name = lureName(lureId);
  if (cause === 'snapped') out.push(`The ${name} went with it.`);
  if (lureCount(after, lureId) <= 0) {
    const next = activeRig(after) === 'spin' ? chosenLure(after) : undefined;
    if (activeRig(before) === 'spin' || chosenLure(before) === lureId) out.push(next ? `Lost your last ${name}, using the ${lureName(next)}.` : `Lost your last ${name}.`);
  }
  return out;
}

/**
 * The dev flags of the spinning rod (slice 32, dev server only, sandboxed so nothing is saved): `?spinrod=1` owns the rod, `?lures=all` gives
 * 5 of each lure (and the rod), `?lure=spinner|wobbler|jig` chooses that lure (5 of it if she has none; rod and spin rig on), `?rig=spin`
 * puts the spinning rig on (the rod and 5 spinners if she has nothing).
 */
export function spinDevFlags(p: PlayerState, params: URLSearchParams): PlayerState {
  let out = p;
  const lureParam = LURES.find((l) => l.id === params.get('lure'));
  if (params.get('spinrod') === '1' || params.get('lures') === 'all' || lureParam || params.get('rig') === 'spin') out = { ...out, spinRod: true };
  if (params.get('lures') === 'all') for (const l of LURES) out = addLure(out, l.id, 5 - lureCount(out, l.id) > 0 ? 5 - lureCount(out, l.id) : 0);
  if (lureParam) {
    if (lureCount(out, lureParam.id) === 0) out = addLure(out, lureParam.id, 5);
    out = chooseLure(out, lureParam.id).state;
  } else if (params.get('rig') === 'spin') {
    if (chosenLure(out) === undefined) out = addLure(out, 'spinner', 5);
    out = chooseLure(out, chosenLure(out)!).state;
  }
  return out;
}

/** Bestia fetches a washed-up lure about this long after it was lost, and again this long after each bring-back if more wait (scene ms). */
export const BRING_FIRST_MS = 60_000;
export const BRING_GAP_MS = 180_000;

/** When she may next go for a waiting lure: nothing waiting = never (null); something waiting and no time set yet = `BRING_FIRST_MS` from now; else the time already set. */
export function nextBringAt(waiting: boolean, current: number | null, nowMs: number): number | null {
  if (!waiting) return null;
  return current ?? nowMs + BRING_FIRST_MS;
}
