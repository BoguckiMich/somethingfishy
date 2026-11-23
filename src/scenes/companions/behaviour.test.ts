import { describe, expect, it } from 'vitest';
import { RECORD_LINES } from '../../core/data/pajkelLines';
import {
  BUBBLE_FADE_MS,
  BUBBLE_MS,
  CLAP_BIG_MS,
  CLAP_MS,
  DOG_MOUTH,
  DOG_SPOT,
  HOP_BIG_MS,
  HOP_MS,
  IDLE_BEFORE_PLAY_MS,
  PAJ_STRIDE_PX,
  SPIN_FLIPS,
  SPIN_MS,
  companionEvent,
  companionPress,
  createCompanions,
  dogView,
  pajSay,
  pajWalkFrame,
  petDog,
  pickLine,
  bubbleAlpha,
  startPlayNow,
  tickCompanions,
  type Companions,
  type CompanionContext,
} from './behaviour';

const rng = () => 0.5;
const idle: CompanionContext = { fishing: 'idle', night: false };

function run(s: Companions, ms: number, ctx: CompanionContext = idle): void {
  for (let t = 0; t < ms; t += 50) tickCompanions(s, 50, ctx, rng);
}

describe('dog reactions on the dock', () => {
  it('lies down by default', () => {
    const s = createCompanions(rng);
    run(s, 500);
    expect(dogView(s).shape).toBe('lie');
  });

  it('perks its ears on a nibble, then relaxes', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'nibble');
    run(s, 100);
    expect(dogView(s).perked).toBe(true);
    run(s, 2000);
    expect(dogView(s).perked).toBe(false);
  });

  it('stands on a bite and spins (hops) when hooked, then sits after the fish escapes', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'bite');
    run(s, 100);
    expect(dogView(s).shape).toBe('stand');
    expect(s.paj.shape).toBe('look');
    companionEvent(s, 'hooked');
    run(s, 300);
    expect(dogView(s).shape).toBe('stand');
    expect(s.dog.hop).toBeGreaterThan(0);
    expect(s.paj.shape).toBe('cheer');
    companionEvent(s, 'fishEscaped');
    run(s, 100);
    expect(dogView(s).shape).toBe('sit');
    run(s, 4500);
    expect(dogView(s).shape).toBe('lie');
  });

  it('sleeps at night and wakes on a nibble', () => {
    const s = createCompanions(rng);
    run(s, 3000, { fishing: 'waiting', night: true });
    expect(dogView(s).shape).toBe('sleep');
    companionEvent(s, 'nibble');
    run(s, 100, { fishing: 'waiting', night: true });
    expect(dogView(s).shape).toBe('lie');
  });

  it('wags its tail now and then', () => {
    const s = createCompanions(rng);
    const tails = new Set<number>();
    for (let t = 0; t < 12000; t += 50) {
      tickCompanions(s, 50, { fishing: 'charging', night: false }, rng);
      tails.add(dogView(s).tail);
    }
    expect(tails.size).toBeGreaterThan(1);
  });
});

describe('Pajkel', () => {
  it('sips from the thermos from time to time', () => {
    const s = createCompanions(rng);
    const shapes = new Set<string>();
    for (let t = 0; t < 20000; t += 50) {
      tickCompanions(s, 50, { fishing: 'charging', night: false }, rng);
      shapes.add(s.paj.shape);
    }
    expect(shapes.has('sip')).toBe(true);
  });
});

describe('idle play on the grass', () => {
  it('only starts after about 25 s of idle or waiting', () => {
    const s = createCompanions(rng);
    run(s, IDLE_BEFORE_PLAY_MS - 1000);
    expect(s.mode).toBe('dock');
    run(s, 1500);
    expect(s.mode).toBe('leaving');
  });

  it('does not count time while the player is casting or fighting', () => {
    const s = createCompanions(rng);
    run(s, 40000, { fishing: 'hooked', night: false });
    expect(s.mode).toBe('dock');
  });

  it('walks to the grass and plays fetch', () => {
    const s = createCompanions(rng);
    run(s, IDLE_BEFORE_PLAY_MS + 1000);
    run(s, 15000);
    expect(s.mode).toBe('play');
    expect(s.paj.y).toBeGreaterThan(480);
    const phases = new Set<string>();
    const sticks = new Set<string>();
    for (let t = 0; t < 40000; t += 50) {
      tickCompanions(s, 50, idle, rng);
      phases.add(s.play.phase);
      sticks.add(s.stick.state);
    }
    expect(phases.has('chase') || phases.has('bring')).toBe(true);
    expect(phases.has('spin')).toBe(true);
    expect(phases.has('zoomies' as never)).toBe(false);
    expect(sticks.has('flying')).toBe(true);
    expect(sticks.has('carried')).toBe(true);
  });

  it('brings the stick back in its mouth: carried at the snout, trotting with a slight bounce', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    let carried = 0;
    let peakHop = 0;
    for (let t = 0; t < 30000; t += 50) {
      tickCompanions(s, 50, idle, rng);
      if (s.play.phase === 'bring' && s.stick.state === 'carried') {
        carried++;
        expect(dogView(s).carry).toBe(true);
        expect(s.stick.x).toBeCloseTo(s.dog.x + s.dog.face * DOG_MOUTH.x);
        expect(s.stick.y).toBeCloseTo(s.dog.y - s.dog.hop - DOG_MOUTH.y);
        peakHop = Math.max(peakHop, s.dog.hop);
      } else {
        expect(dogView(s).carry).toBe(false);
      }
      if (s.play.phase === 'spin') break;
    }
    expect(carried).toBeGreaterThan(10);
    expect(peakHop).toBeGreaterThan(0.5);
    expect(peakHop).toBeLessThanOrEqual(3);
  });

  it('after the last fetch the dog spins on the spot (flips facing, hops, wags), then rests; no zoomies', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    let spinStart = -1;
    const faces: number[] = [];
    let faceBefore: number = s.dog.face;
    let peakHop = 0;
    let wagged = false;
    const spot = { x: 0, y: 0 };
    let t = 0;
    for (; t < 60000; t += 50) {
      const before = s.dog.face;
      tickCompanions(s, 50, idle, rng);
      if (s.play.phase === 'spin') {
        if (spinStart < 0) {
          faceBefore = before;
          spinStart = t;
          spot.x = s.dog.x;
          spot.y = s.dog.y;
        }
        faces.push(s.dog.face);
        peakHop = Math.max(peakHop, s.dog.hop);
        wagged ||= dogView(s).tail > 0;
        expect(s.dog.x).toBeCloseTo(spot.x);
        expect(s.dog.y).toBeCloseTo(spot.y);
        expect(dogView(s).carry).toBe(false);
      } else if (spinStart >= 0) {
        break;
      }
    }
    expect(spinStart).toBeGreaterThan(0);
    expect(s.play.phase).toBe('rest');
    expect(s.dog.hop).toBe(0);
    expect(s.dog.wagMs).toBe(0);
    const flips = [faceBefore, ...faces].filter((f, i, all) => i > 0 && f !== all[i - 1]).length;
    expect(flips).toBe(SPIN_FLIPS);
    expect(faces.length * 50).toBeGreaterThanOrEqual(SPIN_MS - 100);
    expect(faces.length * 50).toBeLessThanOrEqual(SPIN_MS + 100);
    expect(peakHop).toBeGreaterThan(1);
    expect(wagged).toBe(true);
  });

  it('heads back to the dock on a press and sits down', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    run(s, 2000);
    companionPress(s);
    expect(s.mode).toBe('returning');
    run(s, 15000, { fishing: 'charging', night: false });
    expect(s.mode).toBe('dock');
    expect(s.paj.shape).toBe('sit');
    expect(s.dog.x).toBeCloseTo(DOG_SPOT.x);
  });

  it('heads back on a bite too', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    companionEvent(s, 'bite');
    expect(s.mode).toBe('returning');
  });
});

describe("Pajkel's walk cycle", () => {
  it('steps by distance: a frame per stride, so faster walking does not slide his feet', () => {
    const s = createCompanions(rng);
    run(s, IDLE_BEFORE_PLAY_MS + 1000);
    const frames = new Set<number>();
    let last = { x: s.paj.x, y: s.paj.y };
    let dist = 0;
    let frameAtStart = pajWalkFrame(s);
    let changes = 0;
    let prevFrame = frameAtStart;
    for (let t = 0; t < 8000 && s.mode === 'leaving'; t += 50) {
      tickCompanions(s, 50, idle, rng);
      dist += Math.hypot(s.paj.x - last.x, s.paj.y - last.y);
      last = { x: s.paj.x, y: s.paj.y };
      const f = pajWalkFrame(s);
      frames.add(f);
      if (f !== prevFrame) changes++;
      prevFrame = f;
    }
    expect(frames.size).toBe(4);
    // One frame change per stride, give or take the first and last partial strides.
    expect(Math.abs(changes - dist / PAJ_STRIDE_PX)).toBeLessThanOrEqual(1.5);
  });

  it('does not step while standing still', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    const f = pajWalkFrame(s);
    run(s, 1000);
    expect(pajWalkFrame(s)).toBe(f);
  });
});

describe('petting', () => {
  it('wags and wakes the dog', () => {
    const s = createCompanions(rng);
    run(s, 3000, { fishing: 'waiting', night: true });
    expect(dogView(s).shape).toBe('sleep');
    expect(petDog(s)).toBe(true);
    run(s, 100, { fishing: 'waiting', night: true });
    expect(dogView(s).shape).toBe('lie');
    expect(s.dog.wagMs).toBeGreaterThan(0);
  });
});

describe('reactions to the fight result', () => {
  it('Pajkel claps for ~2 s on a catch, alternating the cheer and sit frames, then settles', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'hooked');
    run(s, 2500);
    companionEvent(s, 'fishCaught');
    const seen = new Set<string>();
    for (let t = 0; t < CLAP_MS - 100; t += 50) {
      tickCompanions(s, 50, { fishing: 'caught', night: false }, rng);
      seen.add(s.paj.shape);
    }
    expect([...seen].sort()).toEqual(['cheer', 'sit']);
    run(s, 300, { fishing: 'caught', night: false });
    expect(s.paj.shape).toBe('sit');
    expect(s.paj.clapMs).toBe(0);
  });

  it('Bestia hops (a y bounce while standing) for ~1.5 s on a catch, then sits', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'fishCaught');
    let peak = 0;
    for (let t = 0; t < HOP_MS - 100; t += 50) {
      tickCompanions(s, 50, { fishing: 'caught', night: false }, rng);
      expect(dogView(s).shape).toBe('stand');
      peak = Math.max(peak, s.dog.hop);
    }
    expect(peak).toBeGreaterThan(4);
    run(s, 300, { fishing: 'caught', night: false });
    expect(dogView(s).shape).toBe('sit');
    expect(s.dog.hop).toBe(0);
  });

  it('a big moment (new species or record) makes Pajkel clap and Bestia hop longer and higher', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'fishCaught', true);
    let peak = 0;
    for (let t = 0; t < HOP_BIG_MS - 100; t += 50) {
      tickCompanions(s, 50, { fishing: 'caught', night: false }, rng);
      expect(dogView(s).shape).toBe('stand');
      peak = Math.max(peak, s.dog.hop);
    }
    expect(HOP_BIG_MS).toBeGreaterThan(HOP_MS);
    expect(peak).toBeGreaterThan(7);
    expect(s.paj.clapMs).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (let t = HOP_BIG_MS - 100; t < CLAP_BIG_MS - 100; t += 50) {
      tickCompanions(s, 50, { fishing: 'caught', night: false }, rng);
      seen.add(s.paj.shape);
    }
    expect(CLAP_BIG_MS).toBeGreaterThan(CLAP_MS);
    expect([...seen].sort()).toEqual(['cheer', 'sit']);
    run(s, 400, { fishing: 'caught', night: false });
    expect(s.paj.clapMs).toBe(0);
    expect(dogView(s).shape).toBe('sit');
  });

  it('a lost fish gets small reactions: Pajkel looks, Bestia sits; a catch also stops any clap on loss', () => {
    const s = createCompanions(rng);
    companionEvent(s, 'hooked');
    companionEvent(s, 'fishLost');
    run(s, 100, { fishing: 'lost', night: false });
    expect(s.paj.shape).toBe('look');
    expect(dogView(s).shape).toBe('sit');
    run(s, 2000, { fishing: 'retrieving', night: false });
    expect(s.paj.shape).toBe('sit');
  });

  it('the fight keeps them on the dock (idle timer does not run)', () => {
    const s = createCompanions(rng);
    run(s, 40_000, { fishing: 'fighting', night: false });
    expect(s.mode).toBe('dock');
  });
});

describe("Pajkel's speech bubble", () => {
  it('starts empty, shows a line for BUBBLE_MS and then goes away', () => {
    const s = createCompanions(rng);
    expect(s.bubble).toBeNull();
    pajSay(s, 'New record!');
    expect(s.bubble).toEqual({ text: 'New record!', ageMs: 0 });
    run(s, BUBBLE_MS - 100);
    expect(s.bubble?.text).toBe('New record!');
    run(s, 150);
    expect(s.bubble).toBeNull();
  });
  it('a new line replaces the old one and restarts the timer', () => {
    const s = createCompanions(rng);
    pajSay(s, 'one');
    run(s, 2000);
    pajSay(s, 'two');
    expect(s.bubble).toEqual({ text: 'two', ageMs: 0 });
    run(s, 2000);
    expect(s.bubble?.text).toBe('two');
  });
  it('keeps ticking while he walks (the bubble is per Pajkel, not per place)', () => {
    const s = createCompanions(rng);
    startPlayNow(s);
    pajSay(s, 'hi');
    run(s, 1000);
    expect(s.bubble?.text).toBe('hi');
  });
  it('fades over the last BUBBLE_FADE_MS', () => {
    expect(bubbleAlpha(null)).toBe(0);
    expect(bubbleAlpha({ text: 'x', ageMs: 0 })).toBe(1);
    expect(bubbleAlpha({ text: 'x', ageMs: BUBBLE_MS - BUBBLE_FADE_MS })).toBe(1);
    expect(bubbleAlpha({ text: 'x', ageMs: BUBBLE_MS - BUBBLE_FADE_MS / 2 })).toBeCloseTo(0.5);
    expect(bubbleAlpha({ text: 'x', ageMs: BUBBLE_MS })).toBe(0);
  });
  it('pickLine picks by the random number and survives odd lists', () => {
    expect(pickLine(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickLine(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pickLine(['a', 'b', 'c'], () => 0.999)).toBe('c');
    expect(pickLine([], () => 0.5)).toBe('');
  });
  it('the record lines are short plain ASCII that fit one line at 360 px', () => {
    expect(RECORD_LINES).toEqual(["That's a beast... hehe", 'New record!', 'Look at the size of it!']);
    for (const l of RECORD_LINES) {
      expect(l).toMatch(/^[\x20-\x7e]+$/);
      expect(l.length).toBeLessThanOrEqual(25);
    }
  });
});
