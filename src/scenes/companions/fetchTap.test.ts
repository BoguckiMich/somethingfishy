import { describe, expect, it } from 'vitest';
import { seededRng } from '../../core/random';
import { companionPress, createCompanions, fetchStickNow, startBedtime, startPlayNow, stickAt, tickCompanions, type Companions, type CompanionContext } from './behaviour';

const idle: CompanionContext = { fishing: 'idle', night: false };
const stick = (x: number, y: number, kind: 'old' | 'spare' = 'old', ageMs = 1000): Companions['sticks'][number] => ({ x, y, kind, variant: 0, ageMs, fadeMs: null });

function playing(seed = 3): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  const s = createCompanions(rng);
  startPlayNow(s);
  return { s, rng };
}

function runUntil(s: Companions, rng: () => number, until: () => boolean, maxMs = 120_000): boolean {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return true;
    tickCompanions(s, 50, idle, rng);
  }
  return until();
}

describe('stickAt (a tap on a stick on the grass)', () => {
  it('finds a stick under a finger-sized box and nothing elsewhere', () => {
    const { s } = playing();
    const g = stick(200, 520);
    s.sticks.push(g);
    expect(stickAt(s, 200, 520)).toBe(g);
    expect(stickAt(s, 212, 516)).toBe(g);
    expect(stickAt(s, 200, 535)).toBeNull();
    expect(stickAt(s, 230, 520)).toBeNull();
  });

  it('ignores a stick that is fading out and a stick that has barely appeared', () => {
    const { s } = playing();
    s.sticks.push({ ...stick(200, 520), fadeMs: 900 }, stick(120, 520, 'old', 20));
    expect(stickAt(s, 200, 520)).toBeNull();
    expect(stickAt(s, 120, 520)).toBeNull();
  });

  it('with two sticks close together the nearer one wins', () => {
    const { s } = playing();
    const a = stick(200, 520);
    const b = stick(214, 520);
    s.sticks.push(a, b);
    expect(stickAt(s, 210, 520)).toBe(b);
  });
});

describe('fetch on demand', () => {
  it('between two rounds a tap makes Pajkel take that stick and throw at once, even in the middle of the rest', () => {
    const { s, rng } = playing();
    expect(runUntil(s, rng, () => s.play.phase === 'rest', 300_000)).toBe(true);
    const g = stick(260, 530);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(true);
    expect(s.play.phase).toBe('toStick');
    expect(g.kind).toBe('spare');
    expect(s.play.fetches).toBe(0);
    expect(runUntil(s, rng, () => s.play.phase === 'throw', 20_000)).toBe(true);
    expect(s.sticks.includes(g)).toBe(false); // he picked up the one she tapped
  });

  it('the stick he was going for lies down as an old one', () => {
    const { s, rng } = playing();
    expect(runUntil(s, rng, () => s.play.phase === 'toStick', 300_000)).toBe(true);
    const target = s.sticks.find((k) => k.kind === 'spare')!;
    const g = stick(290, 540);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(true);
    expect(g.kind).toBe('spare');
    expect(target.kind).toBe('old');
    expect(s.sticks.filter((k) => k.kind === 'spare')).toEqual([g]);
  });

  it('mid-round (the throw, the chase) a tap changes nothing', () => {
    const { s, rng } = playing();
    expect(runUntil(s, rng, () => s.play.phase === 'throw', 300_000)).toBe(true);
    const g = stick(260, 530);
    s.sticks.push(g);
    const phase = s.play.phase;
    expect(fetchStickNow(s, g)).toBe(false);
    expect(s.play.phase).toBe(phase);
    expect(g.kind).toBe('old');
  });

  it('mid-chase a tap is queued with a "Next one!" and he throws that stick as soon as the round is over', () => {
    const { s, rng } = playing(4);
    expect(runUntil(s, rng, () => s.play.phase === 'tease' || s.play.phase === 'keepAway' || s.play.phase === 'bring', 300_000)).toBe(true);
    const g = stick(280, 540);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(true);
    expect(s.bubble?.text).toBe('Next one!');
    expect(s.play.queued).toBe(g);
    expect(g.kind).toBe('old');
    expect(runUntil(s, rng, () => s.play.phase === 'throw', 60_000)).toBe(true);
    expect(s.play.queued).toBeNull();
    expect(s.sticks.includes(g)).toBe(false); // he picked up the queued one
  });

  it('while he holds or throws a stick the tap is refused and queues nothing', () => {
    const { s, rng } = playing(6);
    expect(runUntil(s, rng, () => s.play.phase === 'bend' || s.play.phase === 'throw', 300_000)).toBe(true);
    const g = stick(280, 540);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(false);
    expect(s.play.queued).toBeNull();
  });

  it('any=true finds a fading stick too (so its tap can still be swallowed)', () => {
    const { s } = playing();
    s.sticks.push({ ...stick(200, 520), fadeMs: 900 });
    expect(stickAt(s, 200, 520)).toBeNull();
    expect(stickAt(s, 200, 520, true)).not.toBeNull();
  });

  it('when the last round before the spin is on, the tapped stick keeps the game going', () => {
    const { s, rng } = playing(5);
    expect(runUntil(s, rng, () => s.play.phase === 'giveUp' && s.play.finalRound, 600_000)).toBe(true);
    const g = stick(250, 530);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(true);
    expect(s.play.finalRound).toBe(false);
    expect(runUntil(s, rng, () => s.play.phase === 'throw', 20_000)).toBe(true);
  });

  it('with nothing on the grass, or no play, or asleep in the car, nothing changes', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng); // on the dock
    const g = stick(200, 520);
    s.sticks.push(g);
    expect(fetchStickNow(s, g)).toBe(false);
    expect(s.mode).toBe('dock');
    expect(stickAt(createCompanions(rng), 200, 520)).toBeNull();
    const n = createCompanions(rng);
    startPlayNow(n);
    startBedtime(n, "Time to sleep");
    const h = stick(200, 520);
    n.sticks.push(h);
    expect(fetchStickNow(n, h)).toBe(false);
  });

  it('a stick that is not on the grass any more is refused', () => {
    const { s } = playing();
    expect(fetchStickNow(s, stick(200, 520))).toBe(false);
  });
});

describe('finished rounds are counted for the museum', () => {
  it('roundsDone rises by one for each round that ends, and not for a round cut short', () => {
    const { s, rng } = playing(9);
    expect(s.roundsDone).toBe(0);
    expect(runUntil(s, rng, () => s.roundsDone >= 3, 600_000)).toBe(true);
    const n = s.roundsDone;
    companionPress(s); // they go back to the dock: no more rounds
    for (let t = 0; t < 20_000; t += 50) tickCompanions(s, 50, idle, rng);
    expect(s.roundsDone).toBe(n);
  });
});
