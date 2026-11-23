import { describe, expect, it } from 'vitest';
import { GIVE_BACK_LINE, GIVE_UP_LINES } from '../../core/data/pajkelLines';
import { seededRng } from '../../core/random';
import {
  PLAY_AREA,
  PLAY_TUNING,
  STICK_TUNING,
  companionEvent,
  companionPress,
  createCompanions,
  dogView,
  groundStickAlpha,
  isInCar,
  oldSticks,
  startBedtime,
  startPlayNow,
  tickCompanions,
  type Companions,
  type CompanionContext,
} from './behaviour';

const idle: CompanionContext = { fishing: 'idle', night: false };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ticks until `until` is true (or `maxMs` pass); returns the ms it took, or -1. */
function runUntil(s: Companions, rng: () => number, until: () => boolean, maxMs = 120_000, onTick?: () => void): number {
  for (let t = 0; t < maxMs; t += 50) {
    if (until()) return t;
    tickCompanions(s, 50, idle, rng);
    onTick?.();
  }
  return until() ? maxMs : -1;
}

function play(seed = 3): { s: Companions; rng: () => number } {
  const rng = seededRng(seed);
  const s = createCompanions(rng);
  startPlayNow(s);
  return { s, rng };
}

describe('"no take, only throw": the keep-away round', () => {
  it('she trots back with the stick but stops just out of his reach', () => {
    const { s, rng } = play();
    expect(runUntil(s, rng, () => s.play.phase === 'tease')).toBeGreaterThan(0);
    expect(s.stick.state).toBe('carried');
    const gap = dist(s.dog, s.paj);
    expect(gap).toBeGreaterThan(PLAY_TUNING.reachDist);
    expect(gap).toBeLessThanOrEqual(PLAY_TUNING.keepDist + 1);
    expect(s.sticks.filter((g) => g.kind === 'spare')).toHaveLength(0);
  });

  it('he steps towards her, she play-bows and hops sideways away from him, then runs off with the stick', () => {
    const { s, rng } = play();
    runUntil(s, rng, () => s.play.phase === 'tease');
    const before = dist(s.dog, s.paj);
    runUntil(s, rng, () => s.play.phase === 'dodge');
    expect(s.paj.shape === 'walk' || s.paj.shape === 'stand').toBe(true);
    expect(dist(s.dog, s.paj)).toBeLessThanOrEqual(PLAY_TUNING.reachDist + 1);
    expect(dist(s.dog, s.paj)).toBeLessThan(before);
    const from = { x: s.dog.x, y: s.dog.y };
    const shapes = new Set<string>();
    let peakHop = 0;
    runUntil(s, rng, () => s.play.phase === 'keepAway', 5000, () => {
      shapes.add(s.dog.shape);
      peakHop = Math.max(peakHop, s.dog.hop);
      expect(s.stick.state).toBe('carried');
    });
    expect(s.play.phase).toBe('keepAway');
    expect(shapes.has('bow')).toBe(true);
    expect(peakHop).toBeGreaterThan(4);
    // The hop went sideways and away, not back into his arms.
    expect(dist(s.dog, from)).toBeGreaterThan(PLAY_TUNING.dodgeSide * 0.5);
    expect(dist(s.dog, s.paj)).toBeGreaterThan(PLAY_TUNING.reachDist);
  });

  it('the chase stays on the grass, she stays a little ahead and he sometimes nearly catches her', () => {
    for (const seed of [1, 5, 9, 14, 23]) {
      const { s, rng } = play(seed);
      runUntil(s, rng, () => s.play.phase === 'keepAway');
      let minGap = Infinity;
      let maxGap = 0;
      const startedAt = s.elapsed;
      const end = runUntil(s, rng, () => s.play.phase !== 'keepAway', 30_000, () => {
        if (s.play.phase !== 'keepAway') return;
        const g = dist(s.dog, s.paj);
        minGap = Math.min(minGap, g);
        maxGap = Math.max(maxGap, g);
        for (const a of [s.dog, s.paj]) {
          expect(a.x).toBeGreaterThanOrEqual(PLAY_AREA.x0 - 1);
          expect(a.x).toBeLessThanOrEqual(PLAY_AREA.x1 + 1);
          expect(a.y).toBeGreaterThanOrEqual(PLAY_AREA.y0 - 1);
          expect(a.y).toBeLessThanOrEqual(PLAY_AREA.y1 + 1);
        }
      });
      expect(end).toBeGreaterThan(0);
      expect(s.elapsed - startedAt).toBeGreaterThanOrEqual(PLAY_TUNING.chaseMs[0] - 1000);
      expect(s.elapsed - startedAt).toBeLessThanOrEqual(PLAY_TUNING.chaseMs[1] + 1000);
      expect(minGap).toBeGreaterThanOrEqual(PLAY_TUNING.minGap - 1); // never caught
      expect(minGap).toBeLessThan(28); // nearly
      expect(maxGap).toBeLessThan(110); // never far ahead
    }
  });

  it('he gives up with a line, picks a spare stick up from the grass, and throws it; she drops the old one', () => {
    const { s, rng } = play();
    runUntil(s, rng, () => s.play.phase === 'giveUp');
    expect(GIVE_UP_LINES).toContain(s.bubble?.text);
    expect(s.paj.shape).toBe('stand');
    const spares = s.sticks.filter((g) => g.kind === 'spare');
    expect(spares).toHaveLength(1);
    expect(oldSticks(s)).toHaveLength(0);
    // The spare is on the grass, clear of everything.
    expect(spares[0].x).toBeGreaterThanOrEqual(PLAY_AREA.x0);
    expect(spares[0].x).toBeLessThanOrEqual(PLAY_AREA.x1);

    runUntil(s, rng, () => s.play.phase === 'bend');
    run(s, rng, 100);
    expect(s.paj.shape).toBe('bend');
    expect(s.sticks.filter((g) => g.kind === 'spare')).toHaveLength(1);
    runUntil(s, rng, () => s.play.phase === 'throw');
    expect(s.sticks.filter((g) => g.kind === 'spare')).toHaveLength(0); // it is in his hand
    expect(s.stick.state).toBe('carried'); // she still has the old one...
    runUntil(s, rng, () => s.stick.state === 'flying');
    expect(s.paj.shape).toBe('throw');
    expect(oldSticks(s)).toHaveLength(1); // ...until the new one flies
    expect(dogView(s).carry).toBe(false);
    // She races for the new stick, which lands on the grass away from the old one.
    runUntil(s, rng, () => s.play.phase === 'bring' || s.play.phase === 'drop');
    expect(dist(s.sticks[0], s.stick)).toBeGreaterThan(0);
  });

  it('old sticks stay on the grass, at most 3 (the oldest fades out), and the new throw avoids them', () => {
    const rng = seededRng(11);
    const s = createCompanions(rng);
    startPlayNow(s);
    let peak = 0;
    let faded = false;
    let rounds = 0;
    let last = '';
    for (let t = 0; t < 600_000; t += 50) {
      tickCompanions(s, 50, idle, rng);
      if (s.play.phase === 'giveUp' && last !== 'giveUp') rounds++;
      last = s.play.phase;
      peak = Math.max(peak, oldSticks(s).length);
      expect(oldSticks(s).length).toBeLessThanOrEqual(STICK_TUNING.maxOld);
      expect(s.sticks.length).toBeLessThanOrEqual(STICK_TUNING.maxOld + 3);
      if (s.sticks.some((g) => g.fadeMs !== null)) faded = true;
      for (const g of s.sticks) expect(g.x).toBeGreaterThanOrEqual(PLAY_AREA.x0 - 1);
      if (s.play.phase === 'throw' && s.stick.state === 'ground') {
        for (const g of oldSticks(s)) expect(dist(g, s.stick)).toBeGreaterThanOrEqual(PLAY_TUNING.stickGap - 1);
      }
    }
    expect(rounds).toBeGreaterThan(8);
    expect(peak).toBe(STICK_TUNING.maxOld);
    expect(faded).toBe(true);
  });

  it('a fading stick goes away after fadeOutMs and is half-visible on the way', () => {
    const rng = seededRng(2);
    const s = createCompanions(rng);
    startPlayNow(s);
    runUntil(s, rng, () => s.sticks.some((g) => g.fadeMs !== null), 600_000);
    const g = s.sticks.find((k) => k.fadeMs !== null)!;
    expect(groundStickAlpha(g)).toBeGreaterThan(0.9);
    runUntil(s, rng, () => groundStickAlpha(g) < 0.5, STICK_TUNING.fadeOutMs);
    expect(groundStickAlpha(g)).toBeLessThan(0.5);
    runUntil(s, rng, () => !s.sticks.includes(g), STICK_TUNING.fadeOutMs);
    expect(s.sticks.includes(g)).toBe(false);
  });

  it('a new stick fades in', () => {
    const { s, rng } = play();
    runUntil(s, rng, () => s.play.phase === 'giveUp');
    expect(groundStickAlpha(s.sticks[0])).toBeLessThan(0.5);
    run(s, rng, 500);
    expect(groundStickAlpha(s.sticks[0])).toBe(1);
  });
});

function run(s: Companions, rng: () => number, ms: number): void {
  for (let t = 0; t < ms; t += 50) tickCompanions(s, 50, idle, rng);
}

describe('rounds, the spin and the dock', () => {
  it('after 2 or 3 rounds she does the happy spin, drops the stick, and after the rest a new game starts with a stick from the grass', () => {
    const { s, rng } = play(9);
    let rounds = 0;
    let last = '';
    runUntil(s, rng, () => s.play.phase === 'spin', 300_000, () => {
      if (s.play.phase === 'giveUp' && last !== 'giveUp') rounds++;
      last = s.play.phase;
    });
    expect(s.play.phase).toBe('spin');
    expect(rounds).toBeGreaterThanOrEqual(2);
    expect(rounds).toBeLessThanOrEqual(3);
    expect(s.stick.state).toBe('hidden'); // she let it go
    expect(oldSticks(s).length).toBeGreaterThanOrEqual(1);
    runUntil(s, rng, () => s.play.phase === 'rest');
    runUntil(s, rng, () => s.play.phase === 'toStick');
    expect(s.sticks.filter((g) => g.kind === 'spare')).toHaveLength(1);
    expect(s.play.fetches).toBe(0);
    runUntil(s, rng, () => s.play.phase === 'throw');
    expect(s.paj.shape === 'bend' || s.paj.shape === 'throw').toBe(true);
  });

  it('a press, a bite or the bedtime clears every stick from the grass', () => {
    for (const how of ['press', 'bite', 'bed'] as const) {
      const { s, rng } = play(4);
      runUntil(s, rng, () => oldSticks(s).length >= 1 && s.play.phase === 'bring');
      expect(s.sticks.length).toBeGreaterThan(0);
      if (how === 'press') companionPress(s);
      else if (how === 'bite') companionEvent(s, 'bite');
      else startBedtime(s, 'night night');
      expect(s.sticks).toHaveLength(0);
      expect(s.stick.state).toBe('hidden');
      run(s, rng, 40_000);
      expect(s.sticks).toHaveLength(0);
    }
  });

  it('a press or a bite in any phase sends them back to the dock, and the sticks stay gone', () => {
    const phases = ['throw', 'bring', 'tease', 'dodge', 'keepAway', 'giveUp', 'toStick', 'bend', 'spin', 'rest'];
    for (const phase of phases) {
      const { s, rng } = play(6);
      expect(runUntil(s, rng, () => s.play.phase === phase, 300_000)).toBeGreaterThanOrEqual(0);
      companionEvent(s, 'bite');
      expect(s.mode).toBe('returning');
      run(s, rng, 20_000);
      expect(s.mode).toBe('dock');
      expect(s.sticks).toHaveLength(0);
      expect(s.dog.hop).toBe(0);
      expect(dogView(s).carry).toBe(false);
    }
  });

  it('bedtime at 02:00 works from every phase of the game: they end up asleep in the car', () => {
    const phases = ['throw', 'bring', 'tease', 'dodge', 'keepAway', 'giveUp', 'toStick', 'bend', 'drop', 'spin', 'rest'];
    for (const phase of phases) {
      const { s, rng } = play(8);
      s.giveBackChance = phase === 'drop' ? 1 : s.giveBackChance;
      expect(runUntil(s, rng, () => s.play.phase === phase, 300_000)).toBeGreaterThanOrEqual(0);
      startBedtime(s, 'Time to nap');
      expect(s.mode).toBe('bed');
      expect(runUntil(s, rng, () => isInCar(s), 60_000)).toBeGreaterThan(0);
      expect(s.sticks).toHaveLength(0);
      expect(dogView(s).carry).toBe(false);
    }
  });
});

describe('the rare give-back', () => {
  it('about 1 round in 6 she brings it back and drops it at his feet; he says thank you, picks it up and throws', () => {
    const { s, rng } = play();
    s.giveBackChance = 1;
    runUntil(s, rng, () => s.play.phase === 'drop');
    expect(s.bubble?.text).toBe(GIVE_BACK_LINE);
    expect(dist(s.dog, s.paj)).toBeLessThan(PLAY_TUNING.reachDist);
    expect(s.stick.state).toBe('hidden');
    const spares = s.sticks.filter((g) => g.kind === 'spare');
    expect(spares).toHaveLength(1);
    expect(dist(spares[0], s.paj)).toBeLessThan(PLAY_TUNING.reachDist + 8);
    expect(s.play.fetches).toBe(1);
    runUntil(s, rng, () => s.play.phase === 'bend');
    run(s, rng, 100);
    expect(s.paj.shape).toBe('bend');
    runUntil(s, rng, () => s.play.phase === 'throw');
    expect(s.sticks).toHaveLength(0); // the same stick is in his hand again
    runUntil(s, rng, () => s.stick.state === 'flying');
    expect(s.sticks).toHaveLength(0);
  });

  it('is rare: roughly one round in six over many rounds', () => {
    const rng = seededRng(21);
    const s = createCompanions(rng);
    startPlayNow(s);
    let gives = 0;
    let keeps = 0;
    let last = '';
    for (let t = 0; t < 4_000_000 && gives + keeps < 240; t += 50) {
      tickCompanions(s, 50, idle, rng);
      if (s.play.phase !== last) {
        if (s.play.phase === 'drop') gives++;
        if (s.play.phase === 'tease') keeps++;
        last = s.play.phase;
      }
    }
    expect(gives + keeps).toBeGreaterThanOrEqual(240);
    const share = gives / (gives + keeps);
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.27);
  });

  it('a give-back round counts towards the spin like any other', () => {
    const { s, rng } = play();
    s.giveBackChance = 1;
    let rounds = 0;
    let last = '';
    runUntil(s, rng, () => s.play.phase === 'spin', 300_000, () => {
      if (s.play.phase === 'drop' && last !== 'drop') rounds++;
      last = s.play.phase;
    });
    expect(rounds).toBeGreaterThanOrEqual(2);
    expect(rounds).toBeLessThanOrEqual(3);
    run(s, rng, 100);
    expect(oldSticks(s).length).toBe(1); // the last stick she gave back stays lying there
  });
});
