import { describe, expect, it } from 'vitest';
import { enqueueToast, nextToast, TOAST_QUEUE_MAX } from './toastQueue';

const idle = { fighting: false, caught: false, busy: false };

describe('toast queue', () => {
  it('drops repeats and keeps only the newest few', () => {
    expect(enqueueToast(['a'], 'a')).toEqual(['a']);
    let q: string[] = [];
    for (const t of ['a', 'b', 'c', 'd']) q = enqueueToast(q, t);
    expect(q).toEqual(['a', 'b', 'c', 'd'].slice(-TOAST_QUEUE_MAX));
  });
  it('shows nothing while fighting, in the show-off, or while another toast is up', () => {
    expect(nextToast(['a'], { ...idle, fighting: true }).show).toBeNull();
    expect(nextToast(['a'], { ...idle, caught: true }).show).toBeNull();
    expect(nextToast(['a'], { ...idle, busy: true }).show).toBeNull();
  });
  it('shows them one at a time, in order, once clear', () => {
    const r1 = nextToast(['a', 'b'], idle);
    expect(r1).toEqual({ show: 'a', pending: ['b'] });
    expect(nextToast(r1.pending, idle)).toEqual({ show: 'b', pending: [] });
    expect(nextToast([], idle).show).toBeNull();
  });
});
