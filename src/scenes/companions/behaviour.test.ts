import { describe, expect, it } from 'vitest';
import {
  CLAP_BIG_MS,
  CLAP_MS,
  DOG_SPOT,
  HOP_BIG_MS,
  HOP_MS,
  IDLE_BEFORE_PLAY_MS,
  companionEvent,
  companionPress,
  createCompanions,
  dogView,
  petDog,
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
    expect(phases.has('zoomies')).toBe(true);
    expect(sticks.has('flying')).toBe(true);
    expect(sticks.has('carried')).toBe(true);
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
