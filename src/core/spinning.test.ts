import { describe, expect, it } from 'vitest';
import { CHARGE_HALF_CYCLE_MS } from './casting';
import { STARTER_BAR_GEAR } from './data/barGear';
import { speciesById, SPECIES } from './data/fish';
import { QUIET_LAKE, RIVER_BEND } from './data/locations';
import { RODS } from './data/rods';
import { LURES, PREDATORS, SPIN_ROD, SPIN_SPECIES, SPIN_TUNING as T, lureById } from './data/spinning';
import { weatherEffects } from './daily/weather';
import type { GameEvent } from './events';
import { fightProfile, rollHookedFish } from './fish';
import { beginFight } from './fight';
import { INITIAL_STATE, spinBarGear, step, type FishingInput, type FishingState, type SessionContext } from './fishingSession';
import { lineGearOf } from './lineFight';
import { zoneAt } from './location';
import { seededRng, type Rng } from './random';
import {
  depthFit, favouriteLureIds, followCandidates, followerGapM, justAfterBurst, lyingStill, newSpin, pauseFitOf, pressSpin, releaseSpin, rhythmFit,
  rollFollower, snagChance, snapFate, tickSpin, type Follower, type SpinEnv, type SpinState,
} from './spinning';

const always = (v: number): Rng => () => v;
const env = (over: Partial<SpinEnv> = {}): SpinEnv => ({ location: RIVER_BEND, time: 'day', flow: 1, minute: 12 * 60, ...over });
const lakeEnv = (over: Partial<SpinEnv> = {}): SpinEnv => env({ location: QUIET_LAKE, ...over });

const follower = (over: Partial<Follower> = {}): Follower => ({ speciesId: 'asp', lengthCm: 50, weightG: 1200, interest: 1, followMs: 1000, ...over });
const reeling = (s: SpinState): SpinState => ({ ...s, holding: true, phaseMs: 0, bursts: 1 });
/** A spin state in the seam, a wobbler, with a keen follower: ready to strike. */
const keen = (over: Partial<SpinState> = {}): SpinState => ({ ...newSpin('wobbler', 22, RIVER_BEND), depth: 0.3, follower: follower(), ...over });

describe('the strike and the hook (slice 32)', () => {
  it('a strike with the thumb down sets the hook at once', () => {
    const r = tickSpin(reeling(keen()), 16, env(), always(0));
    expect(r.events).toEqual([{ type: 'strike', speciesId: 'asp', hookGraceMs: 0 }]);
    expect(r.outcome).toMatchObject({ kind: 'hooked', hooked: { speciesId: 'asp', lengthCm: 50 } });
  });

  it('a strike with the thumb up opens a 0.6 s window; the thumb going down inside it sets the hook', () => {
    const paused = { ...keen(), phaseMs: 100, bursts: 1 };
    const r = tickSpin(paused, 16, env(), always(0));
    expect(r.events).toEqual([{ type: 'strike', speciesId: 'asp', hookGraceMs: 600 }]);
    expect(r.outcome.kind).toBe('going');
    expect(r.spin.strikeWindowMs).toBe(600);
    // 500 ms later the thumb goes down.
    let s = r.spin;
    for (let i = 0; i < 31; i++) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    expect(s.strikeWindowMs).toBeGreaterThan(0);
    const hook = pressSpin(s, env(), always(0));
    expect(hook.outcome).toMatchObject({ kind: 'hooked', hooked: { speciesId: 'asp' } });
    expect(hook.spin.holding).toBe(true);
  });

  it('a missed strike is a nip: the lure carries on and the same cast can still get another strike', () => {
    const r0 = tickSpin({ ...keen(), phaseMs: 100, bursts: 1 }, 16, env(), always(0));
    let s = r0.spin;
    const events: GameEvent[] = [];
    // 700 ms with the thumb up: the window runs out.
    for (let i = 0; i < 45; i++) {
      const r = tickSpin(s, 16, env(), always(0.9999));
      s = r.spin;
      events.push(...r.events);
    }
    expect(events.filter((e) => e.type === 'nip')).toEqual([{ type: 'nip', speciesId: 'asp' }]);
    expect(s.strikeWindowMs).toBeUndefined();
    expect(s.follower).toBeDefined();
    expect(s.follower!.interest).toBeLessThan(1);
    expect(s.cooldownMs).toBeGreaterThanOrEqual(0);
    // The cast goes on: after the cooldown the fish strikes again.
    let again: GameEvent | undefined;
    for (let i = 0; i < 200 && !again; i++) {
      const r = tickSpin({ ...s, follower: { ...s.follower!, interest: 1 } }, 16, env(), always(0));
      again = r.events.find((e) => e.type === 'strike');
      s = { ...r.spin, follower: s.follower, strikeWindowMs: undefined, cooldownMs: Math.max(0, s.cooldownMs - 16) };
    }
    expect(again).toMatchObject({ type: 'strike' });
  });

  it('a nip never costs the lure', () => {
    let s = tickSpin({ ...keen(), phaseMs: 100, bursts: 1 }, 16, env(), always(0)).spin;
    const events: GameEvent[] = [];
    for (let i = 0; i < 60; i++) {
      const r = tickSpin(s, 16, env(), always(0.9999));
      s = r.spin;
      events.push(...r.events);
    }
    expect(events.some((e) => e.type === 'lureLost' || e.type === 'snag')).toBe(false);
  });

  it('the strike is likeliest on the pause just after a burst', () => {
    const rate = (s: SpinState) => {
      let n = 0;
      for (let seed = 1; seed <= 4000; seed++) if (tickSpin(s, 16, env(), seededRng(seed)).events.some((e) => e.type === 'strike')) n++;
      return n;
    };
    const base = keen({ distanceM: 22 });
    const after = rate({ ...base, holding: false, phaseMs: 300, bursts: 1 });
    const later = rate({ ...base, holding: false, phaseMs: 3000, bursts: 1 });
    const reel = rate({ ...base, holding: true, phaseMs: 300, bursts: 1 });
    expect(after).toBeGreaterThan(later * 2);
    expect(later).toBeGreaterThan(reel);
    expect(justAfterBurst({ holding: false, bursts: 1, phaseMs: 300 })).toBe(true);
    expect(justAfterBurst({ holding: false, bursts: 0, phaseMs: 300 })).toBe(false);
    expect(justAfterBurst({ holding: false, bursts: 1, phaseMs: 1500 })).toBe(false);
  });
});

describe('the follower', () => {
  it('follows at least 0.5 s before a strike is possible', () => {
    const young = reeling(keen({ follower: follower({ followMs: 100 }) }));
    for (let i = 0; i < 20; i++) expect(tickSpin(young, 16, env(), always(0)).events.some((e) => e.type === 'strike')).toBe(false);
    const old = reeling(keen({ follower: follower({ followMs: T.minFollowMs }) }));
    expect(tickSpin(old, 16, env(), always(0)).events.some((e) => e.type === 'strike')).toBe(true);
  });

  it('from a fresh follow, no cast ever strikes within 500 ms of the follow', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seededRng(seed);
      let s = newSpin('wobbler', 22, RIVER_BEND);
      let followAt = -1;
      for (let ms = 0; ms < 30_000; ms += 16) {
        if (ms % 3000 === 640) s = pressSpin(s, env(), rng).spin;
        if (ms % 3000 === 0 && ms > 0) s = releaseSpin(s);
        const r = tickSpin(s, 16, env(), rng);
        s = r.spin;
        for (const e of r.events) {
          if (e.type === 'follow') followAt = ms;
          if (e.type === 'strike') expect(ms - followAt).toBeGreaterThanOrEqual(T.minFollowMs - 16);
        }
        if (r.outcome.kind !== 'going') break;
      }
    }
  });

  it('a follower that is bored loses interest and leaves', () => {
    // A pike wants a long pause before a burst and bursts of 1.6 s at most; an endless burst bores it.
    let s: SpinState = reeling(keen({ follower: follower({ speciesId: 'pike', interest: 0.6 }), depth: 0.7 }));
    const events: GameEvent[] = [];
    for (let i = 0; i < 600 && !events.some((e) => e.type === 'followLost'); i++) {
      const r = tickSpin({ ...s, distanceM: 30 }, 16, env(), always(0.9999));
      s = r.spin;
      events.push(...r.events);
    }
    expect(events.find((e) => e.type === 'followLost')).toEqual({ type: 'followLost', speciesId: 'pike' });
    expect(s.follower).toBeUndefined();
  });

  it('only predators follow: never a peaceful fish, at any band, hour, weather or lure', () => {
    const seen = new Set<string>();
    const weathers = [undefined, ...(['sunny', 'overcast', 'rain', 'windy', 'fog'] as const).map((w) => weatherEffects(w))];
    for (const loc of [QUIET_LAKE, RIVER_BEND]) {
      for (const time of ['dawn', 'day', 'dusk', 'night'] as const) {
        for (const fx of weathers) {
          for (const lure of LURES) {
            for (let m = 1; m < 40; m += 3) for (const depth of [0, 0.5, 1]) for (const c of followCandidates(lure, depth, m, { location: loc, time, fx, flow: 1 })) seen.add(c.id);
          }
        }
      }
    }
    for (const id of seen) expect(PREDATORS).toContain(id);
    expect(PREDATORS.every((id) => seen.has(id))).toBe(true);
    // And the roll itself: thousands of follows, nothing peaceful (or a trophy other than the Ferry pike).
    const rng = seededRng(5);
    const who = new Set<string>();
    for (let i = 0; i < 20_000; i++) {
      const m = 2 + (i % 38);
      const lure = LURES[i % 3];
      const f = rollFollower({ ...newSpin(lure.id, m, RIVER_BEND), depth: (i % 5) / 4 }, lure, env({ time: (['dawn', 'day', 'dusk', 'night'] as const)[i % 4], fx: weatherEffects('windy') }), rng);
      if (f) who.add(f.speciesId);
    }
    for (const id of who) expect([...PREDATORS, 'ferryPike']).toContain(id);
  });

  it('the lure that suits the depth and the species raises the follow chance', () => {
    const total = (lure: string, depth: number, m: number, loc = RIVER_BEND) => followCandidates(lureById(lure)!, depth, m, env({ location: loc })).reduce((a, c) => a + c.w, 0);
    // The pool (28 m, pike and perch): the jig runs deep.
    expect(total('jig', 0.85, 28)).toBeGreaterThan(total('spinner', 0.12, 28));
    // The seam (20 m, asp): the wobbler and the spinner suit it, the jig does not.
    expect(total('wobbler', 0.45, 20)).toBeGreaterThan(total('jig', 0.85, 20));
    // A pike wants depth: the same jig at the surface is worth less.
    expect(total('jig', 0.85, 28)).toBeGreaterThan(total('jig', 0, 28));
  });

  it('the right rhythm raises interest, the wrong one loses it', () => {
    const interestAfter = (species: string, holding: boolean, phaseMs: number, depth: number, lastPauseMs = 5000) => {
      const s = keen({ follower: follower({ speciesId: species, interest: 0.6, followMs: 0 }), holding, phaseMs, depth, lastPauseMs, bursts: 1, cooldownMs: 99_999 });
      return tickSpin(s, 100, env(), always(0.9999)).spin.follower!.interest;
    };
    // Trout and asp: a long steady burst near the top is right.
    expect(interestAfter('trout', true, 2000, 0.2)).toBeGreaterThan(0.6);
    // The same burst is far too long for a perch (twitches) and a pike (short bursts).
    expect(interestAfter('perch', true, 2000, 0.5)).toBeLessThan(0.6);
    expect(interestAfter('pike', true, 3000, 0.7)).toBeLessThan(0.6);
    // A pike likes a long pause, a trout a short one.
    expect(interestAfter('pike', false, 2000, 0.7)).toBeGreaterThan(0.6);
    expect(interestAfter('trout', false, 4000, 0.2)).toBeLessThan(0.6);
    // A pike wants a long pause BEFORE the burst too.
    expect(interestAfter('pike', true, 300, 0.7, 200)).toBeLessThan(interestAfter('pike', true, 300, 0.7, 4000));
    // Depth matters: the pike at the surface is not interested.
    expect(interestAfter('pike', false, 2000, 0)).toBeLessThan(interestAfter('pike', false, 2000, 0.7));
  });

  it('every predator has a taste, and every favourite lure is a lure', () => {
    for (const id of PREDATORS) {
      expect(SPIN_SPECIES[id]).toBeDefined();
      expect(favouriteLureIds(id, LURES).length).toBeGreaterThan(0);
    }
    expect(favouriteLureIds('pike', LURES)).toEqual(['jig']);
    expect(favouriteLureIds('trout', LURES)).toEqual(['spinner', 'wobbler']);
    expect(favouriteLureIds('roach', LURES)).toEqual([]);
    expect(depthFit(0.2, 'trout')).toBe(1);
    expect(rhythmFit({ holding: true, phaseMs: 100, lastPauseMs: 5000 }, 'pike')).toBe(1);
    expect(pauseFitOf(600, 'pike')).toBeCloseTo(0.5);
    expect(followerGapM({ followMs: 0 })).toBe(3);
    expect(followerGapM({ followMs: 60_000 })).toBe(0.4);
  });
});

describe('the Ferry pike and the other trophies', () => {
  const underTheRope = (_lure: string, over: Partial<SpinEnv> = {}) => env({ fx: weatherEffects('windy'), minute: 12 * 60, ...over });
  const count = (lure: string, e: SpinEnv, m: number, n = 30_000) => {
    const rng = seededRng(77);
    let followers = 0;
    let ferry = 0;
    for (let i = 0; i < n; i++) {
      const f = rollFollower({ ...newSpin(lure, m, RIVER_BEND), depth: 0.5 }, lureById(lure)!, e, rng);
      if (f) followers++;
      if (f?.speciesId === 'ferryPike') ferry++;
    }
    return { followers, ferry };
  };

  it('a lure can bring the Ferry pike, under its exact conditions only (windy, day, seam 18-26 m)', () => {
    expect(count('wobbler', underTheRope('wobbler'), 22).ferry).toBeGreaterThan(100);
    // Each condition missing: never.
    expect(count('wobbler', underTheRope('wobbler'), 15).ferry).toBe(0); // the seam, but not under the rope
    expect(count('wobbler', underTheRope('wobbler'), 27).ferry).toBe(0); // the pool
    expect(count('wobbler', underTheRope('wobbler', { time: 'dusk', minute: 18 * 60 + 30 }), 22).ferry).toBe(0);
    expect(count('wobbler', underTheRope('wobbler', { fx: weatherEffects('sunny') }), 22).ferry).toBe(0);
    expect(count('wobbler', underTheRope('wobbler', { fx: undefined }), 22).ferry).toBe(0);
    expect(count('wobbler', underTheRope('wobbler', { minute: undefined }), 22).ferry).toBe(0);
    expect(count('wobbler', underTheRope('wobbler', { location: QUIET_LAKE }), 22).ferry).toBe(0);
  });

  it('the soft jig gives the Ferry pike a small bonus', () => {
    const jig = count('jig', underTheRope('jig'), 22);
    const wob = count('wobbler', underTheRope('wobbler'), 22);
    // Share of the follows (the lures bring different numbers of followers): 0.2 x 1.25 against 0.2.
    expect(jig.ferry / jig.followers).toBeGreaterThan((wob.ferry / wob.followers) * 1.05);
  });

  it('no other trophy and no legendary ever follows a lure, whatever the weather, hour, band or bait-like conditions', () => {
    const rng = seededRng(12);
    const bad = SPECIES.filter((s) => (s.rarity === 'trophy' || s.rarity === 'legendary') && s.id !== 'ferryPike').map((s) => s.id);
    for (let i = 0; i < 20_000; i++) {
      const loc = i % 2 ? RIVER_BEND : QUIET_LAKE;
      const lure = LURES[i % 3];
      const weather = (['rain', 'fog', 'sunny', 'overcast', 'windy'] as const)[i % 5];
      const f = rollFollower({ ...newSpin(lure.id, 1 + (i % 39), loc), depth: 0.5 }, lure, { location: loc, time: (['dawn', 'day', 'dusk', 'night'] as const)[i % 4], fx: weatherEffects(weather), minute: (i * 37) % 1440, flow: 1 }, rng);
      if (f) expect(bad).not.toContain(f.speciesId);
    }
  });
});

describe('sizes: spinning brings bigger fish', () => {
  it('a skew below 1 gives longer fish than the float rig rolls', () => {
    const mean = (mul: number) => {
      const rng = seededRng(3);
      let sum = 0;
      for (let i = 0; i < 4000; i++) sum += rollHookedFish('deep', 'day', rng, 'pike', undefined, undefined, undefined, undefined, undefined, mul).lengthCm;
      return sum / 4000;
    };
    expect(mean(T.sizeSkewMul)).toBeGreaterThan(mean(1) + 4);
  });
  it('the float rig rolls exactly as before (no skew argument = x1)', () => {
    const a = rollHookedFish('shallow', 'day', seededRng(9), 'roach');
    const b = rollHookedFish('shallow', 'day', seededRng(9), 'roach', undefined, undefined, undefined, undefined, undefined, 1);
    expect(a).toEqual(b);
  });
});

describe('where the lure is', () => {
  const press = (s: SpinState) => pressSpin(s, env(), always(0.9999)).spin;
  const run = (s: SpinState, ms: number, e = env()) => {
    let st = s;
    for (let t = 0; t < ms; t += 16) st = tickSpin(st, 16, e, always(0.9999)).spin;
    return st;
  };

  it('holding reels it in at the reel speed and it rises; letting go pauses it and it sinks', () => {
    let s = run(press(newSpin('spinner', 25, RIVER_BEND)), 2000);
    expect(s.distanceM).toBeCloseTo(25 - 2 * T.reelMps, 0);
    expect(s.depth).toBeCloseTo(0.12, 1);
    s = run(releaseSpin(s), 1000);
    expect(s.distanceM).toBeCloseTo(25 - 2 * T.reelMps, 0);
    expect(s.depth).toBeGreaterThan(0.4);
  });

  it('the spinner sinks to the bottom, the wobbler hangs mid-water, the jig hops off the bottom on each burst', () => {
    expect(run(newSpin('spinner', 25, RIVER_BEND), 5000).depth).toBeGreaterThanOrEqual(T.bottomAt);
    const wob = run(newSpin('wobbler', 25, RIVER_BEND), 20_000);
    expect(wob.depth).toBeCloseTo(0.55, 2);
    expect(wob.bottomMs).toBe(0);
    const jigDown = run(newSpin('jig', 25, RIVER_BEND), 4000);
    expect(jigDown.depth).toBeGreaterThanOrEqual(T.bottomAt);
    const hopped = press(jigDown);
    expect(hopped.depth).toBeCloseTo(1 - lureById('jig')!.hop, 5);
    expect(run(hopped, 3000).depth).toBeCloseTo(lureById('jig')!.reelDepth, 1);
  });

  it('a lure that reaches the dock untouched is just out: back to idle, nothing lost', () => {
    let s: SpinState = press(newSpin('spinner', 3, RIVER_BEND));
    let out = false;
    const events: GameEvent[] = [];
    for (let i = 0; i < 300 && !out; i++) {
      const r = tickSpin(s, 16, env({ time: 'night' }), always(0.9999));
      s = r.spin;
      events.push(...r.events);
      out = r.outcome.kind === 'out';
    }
    expect(out).toBe(true);
    expect(s.distanceM).toBe(0);
    expect(events).toEqual([{ type: 'lureOut', lure: 'spinner' }]);
  });

  it('a lure lying still on the bottom gets no bites: no follower, no strike', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seededRng(seed);
      let s: SpinState = { ...newSpin('jig', 22, RIVER_BEND), depth: 1 };
      const events: GameEvent[] = [];
      for (let ms = 0; ms < 60_000; ms += 16) {
        const r = tickSpin(s, 16, env(), rng);
        s = r.spin;
        events.push(...r.events);
      }
      expect(events.filter((e) => e.type === 'follow' || e.type === 'strike')).toEqual([]);
    }
    expect(lyingStill({ holding: false, depth: 1 })).toBe(true);
    expect(lyingStill({ holding: true, depth: 1 })).toBe(false);
    // A follower already there does not strike at a still lure on the bottom either.
    expect(tickSpin({ ...keen(), depth: 1, holding: false, phaseMs: 100, bursts: 1 }, 16, env(), always(0)).events.some((e) => e.type === 'strike')).toBe(false);
  });

  it('the same lure moving does get bites', () => {
    let follows = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seededRng(seed);
      let s: SpinState = press(newSpin('wobbler', 24, RIVER_BEND));
      for (let ms = 0; ms < 8000; ms += 16) {
        const r = tickSpin(s, 16, env(), rng);
        s = r.spin;
        if (r.events.some((e) => e.type === 'follow')) follows++;
      }
    }
    expect(follows).toBeGreaterThan(5);
  });
});

describe('moving water', () => {
  it('the lake has no drift at all', () => {
    let s = newSpin('spinner', 20, QUIET_LAKE);
    expect(s.drift).toBeUndefined();
    for (let i = 0; i < 400; i++) s = tickSpin(s, 16, lakeEnv(), always(0.9999)).spin;
    expect(s.drift).toBeUndefined();
    expect('drift' in pressSpin(s, lakeEnv(), always(0.9999)).spin).toBe(false);
  });

  it('at the river a paused lure drifts at the bobber speed (15 s to the eddy), faster with the flow', () => {
    const run = (ms: number, flow = 1) => {
      let s = newSpin('wobbler', 20, RIVER_BEND);
      for (let t = 0; t < ms; t += 16) s = tickSpin(s, 16, env({ flow }), always(0.9999)).spin;
      return s;
    };
    expect(run(0).drift).toBe(0);
    expect(run(7500).drift).toBeCloseTo(0.5, 1);
    expect(run(16_000).drift).toBe(1);
    expect(run(7500, 2).drift).toBeCloseTo(1, 1);
    // The distance is not changed by the drift: it is sideways only.
    expect(run(7500).distanceM).toBe(20);
  });

  it('reeling brings it straight in: no drift while the thumb is down, the drift straightens out', () => {
    let s = newSpin('wobbler', 28, RIVER_BEND);
    for (let t = 0; t < 5000; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    const drifted = s.drift!;
    expect(drifted).toBeGreaterThan(0.2);
    s = pressSpin(s, env(), always(0.9999)).spin;
    for (let t = 0; t < 1000; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    expect(s.drift!).toBeLessThan(drifted);
  });

  it('the seam bonus applies to following (the same idea as the float: the seam bites sooner while it drifts)', () => {
    const chance = (m: number, drift: number) => {
      let n = 0;
      for (let seed = 1; seed <= 6000; seed++) if (rollFollower({ ...newSpin('wobbler', m, RIVER_BEND), depth: 0.45, drift }, lureById('wobbler')!, env(), seededRng(seed))) n++;
      return n;
    };
    const seam = chance(20, 0);
    const settled = chance(20, 1);
    expect(seam).toBeGreaterThan(settled * 2); // 1.35 against the eddy's 0.4
  });
});

describe('snags and losses', () => {
  const lain = (m: number): SpinState => ({ ...newSpin('spinner', m, RIVER_BEND), depth: 1, bottomMs: T.snagArmMs, snagArmed: true });

  it('a lure that never lay on the bottom for 3 s cannot snag, whatever the roll', () => {
    let s: SpinState = { ...newSpin('spinner', 28, RIVER_BEND), depth: 1 };
    // 2.9 s on the bottom.
    for (let t = 0; t < 2900; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    expect(s.snagArmed).toBe(false);
    const r = pressSpin(s, env(), always(0));
    expect(r.outcome.kind).toBe('going');
    expect(r.events).toEqual([]);
  });

  it('after 3 s on the bottom the next reel-in rolls once: snag = the lure is gone, never brought back', () => {
    let s: SpinState = { ...newSpin('spinner', 28, RIVER_BEND), depth: 1 };
    for (let t = 0; t < 3100; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    expect(s.snagArmed).toBe(true);
    const r = pressSpin(s, env(), always(0));
    expect(r.outcome.kind).toBe('snag');
    expect(r.events).toEqual([{ type: 'snag', lure: 'spinner' }, { type: 'lureLost', lure: 'spinner', cause: 'snag', bringBack: false }]);
    // No snag on that roll: one roll only; the lure is reeled, and the next reel-in does not roll again.
    const miss = pressSpin(s, env(), always(0.9999));
    expect(miss.outcome.kind).toBe('going');
    expect(miss.spin.snagArmed).toBe(false);
    expect(pressSpin(releaseSpin(miss.spin), env(), always(0)).outcome.kind).toBe('going');
  });

  it('reeling before the 3 s resets the clock', () => {
    let s: SpinState = { ...newSpin('spinner', 28, RIVER_BEND), depth: 1 };
    for (let t = 0; t < 2000; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    s = releaseSpin(pressSpin(s, env(), always(0.9999)).spin);
    s = { ...s, depth: 1 };
    for (let t = 0; t < 2000; t += 16) s = tickSpin(s, 16, env(), always(0.9999)).spin;
    expect(s.snagArmed).toBe(false);
  });

  it('the snag chance by band: 1 % riffle / shallow, 2 % seam, 3 % pool / deep', () => {
    expect(snagChance(RIVER_BEND, 5)).toBe(0.01);
    expect(snagChance(RIVER_BEND, 20)).toBe(0.02);
    expect(snagChance(RIVER_BEND, 30)).toBe(0.03);
    expect(snagChance(QUIET_LAKE, 8)).toBe(0.01);
    expect(snagChance(QUIET_LAKE, 28)).toBe(0.03);
    for (const [m, p] of [[5, 0.01], [20, 0.02], [30, 0.03]] as const) {
      const rng = seededRng(21);
      let n = 0;
      const N = 40_000;
      for (let i = 0; i < N; i++) if (pressSpin(lain(m), env(), rng).outcome.kind === 'snag') n++;
      expect(n / N).toBeGreaterThan(p * 0.8);
      expect(n / N).toBeLessThan(p * 1.2);
    }
  });

  it('a snapped line loses the lure 85 % of the time (else the fish spits it); 1 in 5 lost ones washes up for Bestia', () => {
    const rng = seededRng(4);
    let lost = 0;
    let spat = 0;
    let back = 0;
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const e = snapFate('wobbler', rng);
      if (e.type === 'lureLost') {
        lost++;
        expect(e.cause).toBe('snapped');
        if (e.bringBack) back++;
      } else {
        expect(e.type).toBe('lureSpat');
        spat++;
      }
    }
    expect(lost / N).toBeGreaterThan(0.83);
    expect(lost / N).toBeLessThan(0.87);
    expect(spat + lost).toBe(N);
    expect(back / lost).toBeGreaterThan(0.18);
    expect(back / lost).toBeLessThan(0.22);
  });
});

describe('inside the session', () => {
  const [, fiberglass, carbon] = RODS;
  void fiberglass;
  const spinCtx = (over: Partial<SessionContext> = {}): SessionContext => ({
    location: RIVER_BEND, rod: RODS[0], barGear: STARTER_BAR_GEAR, rng: seededRng(1), timeOfDay: () => 'day', minute: () => 12 * 60,
    rig: () => 'spin', lureId: () => 'wobbler', ...over,
  });
  const run = (inputs: FishingInput[], ctx: SessionContext, from: FishingState = INITIAL_STATE) => {
    let state = from;
    const events: GameEvent[] = [];
    for (const input of inputs) {
      const r = step(state, input, ctx);
      state = r.state;
      events.push(...r.events);
    }
    return { state, events };
  };
  const fullCast: FishingInput[] = [{ type: 'press' }, { type: 'tick', dtMs: CHARGE_HALF_CYCLE_MS }, { type: 'release' }];

  it('a spin cast reaches 30 m with the spinning rod, whatever the equipped rod (the float rig keeps its own)', () => {
    const spin = run(fullCast, spinCtx());
    expect(spin.state).toMatchObject({ kind: 'casting', distanceM: 30, lure: 'wobbler' });
    expect(spin.events).toEqual([{ type: 'cast', distanceM: 30, zone: 'deep', locationId: 'river-bend', lure: 'wobbler' }]);
    const float = run(fullCast, spinCtx({ rig: undefined, lureId: undefined }));
    expect(float.state).toMatchObject({ kind: 'casting', distanceM: 14 });
    expect(float.state).not.toHaveProperty('lure');
    expect(float.events[0]).not.toHaveProperty('lure');
    expect(SPIN_ROD.maxCastM).toBe(30);
  });

  it('the float rig is untouched: rig float, or spin without a lure, is a float cast', () => {
    for (const ctx of [spinCtx({ rig: () => 'float' }), spinCtx({ lureId: () => undefined })]) {
      const r = run([...fullCast, { type: 'landed' }], ctx);
      expect(r.state.kind).toBe('waiting');
    }
  });

  it('landing starts the retrieve (no fish is rolled yet): the lure on the surface, thumb up', () => {
    const r = run([...fullCast, { type: 'landed' }], spinCtx());
    expect(r.state).toMatchObject({ kind: 'spinning', distanceM: 30, spin: { lure: 'wobbler', depth: 0, holding: false, startM: 30 } });
  });

  it('press reels, release pauses, cancel pauses; the state follows the lure (distance and band)', () => {
    let st = run([...fullCast, { type: 'landed' }], spinCtx()).state;
    st = step(st, { type: 'press' }, spinCtx()).state;
    expect(st).toMatchObject({ kind: 'spinning', spin: { holding: true } });
    for (let i = 0; i < 200; i++) st = step(st, { type: 'tick', dtMs: 16 }, spinCtx({ rng: always(0.9999) })).state;
    expect(st).toMatchObject({ kind: 'spinning', zone: 'shallow' });
    expect((st as { distanceM: number }).distanceM).toBeLessThan(30 - 4);
    st = step(st, { type: 'cancel' }, spinCtx()).state;
    expect(st).toMatchObject({ spin: { holding: false } });
  });

  it('reaching the dock untouched goes back to idle with a lureOut event and nothing lost', () => {
    let st: FishingState = { kind: 'spinning', distanceM: 2, zone: 'shallow', spin: { ...newSpin('spinner', 2, RIVER_BEND), holding: true } };
    const events: GameEvent[] = [];
    for (let i = 0; i < 200 && st.kind === 'spinning'; i++) {
      const r = step(st, { type: 'tick', dtMs: 16 }, spinCtx({ lureId: () => 'spinner', timeOfDay: () => 'night', rng: always(0.9999) }));
      st = r.state;
      events.push(...r.events);
    }
    expect(st.kind).toBe('idle');
    expect(events).toEqual([{ type: 'lureOut', lure: 'spinner' }]);
  });

  it('a snag goes to retrieving (the empty line is reeled in) with the lure gone', () => {
    const s: SpinState = { ...newSpin('jig', 28, RIVER_BEND), depth: 1, bottomMs: 3500, snagArmed: true };
    const r = step({ kind: 'spinning', distanceM: 28, zone: 'deep', spin: s }, { type: 'press' }, spinCtx({ rng: always(0) }));
    expect(r.state).toMatchObject({ kind: 'retrieving', distanceM: 28 });
    expect(r.events.map((e) => e.type)).toEqual(['snag', 'lureLost']);
  });

  it('a hooked fish starts the normal fight at the lure\'s distance, on the spinning rod\'s flex', () => {
    const s: SpinState = { ...keen(), holding: true, bursts: 1, distanceM: 21.5 };
    const ctx = spinCtx({ barGear: carbon.barGear, catchStyle: () => 'line', rng: always(0) });
    const r = step({ kind: 'spinning', distanceM: 21.5, zone: 'shallow', spin: s }, { type: 'tick', dtMs: 16 }, ctx);
    expect(r.state).toMatchObject({ kind: 'fighting', lure: 'wobbler', hooked: { speciesId: 'asp' } });
    expect((r.state as { line: { startM: number } }).line.startM).toBeCloseTo(21.5 - T.reelMps * 0.016, 1);
    expect(r.events.map((e) => e.type)).toEqual(['strike', 'hooked']);
    expect(r.events[1]).toMatchObject({ type: 'hooked', lure: 'wobbler' });
    // The spinning rod's zone sits between the fiberglass and the carbon rod: its flex too.
    expect(SPIN_ROD.barGear.zoneSize).toBeGreaterThan(RODS[1].barGear.zoneSize);
    expect(SPIN_ROD.barGear.zoneSize).toBeLessThan(carbon.barGear.zoneSize);
    const flex = (z: number) => lineGearOf({ ...STARTER_BAR_GEAR, zoneSize: z }).flexS;
    expect(flex(SPIN_ROD.barGear.zoneSize)).toBeGreaterThan(flex(RODS[1].barGear.zoneSize));
    expect(flex(SPIN_ROD.barGear.zoneSize)).toBeLessThan(flex(carbon.barGear.zoneSize));
    expect(spinBarGear(carbon.barGear).zoneSize).toBe(SPIN_ROD.barGear.zoneSize);
  });

  /** A fight on the line style with this fish, played with the thumb held forever (a snap) or never (a slip). */
  const fightOutcome = (hold: boolean, seed: number): GameEvent[] => {
    const rng = seededRng(seed);
    const fish = fightProfile(speciesById('pike')!, 60);
    const fight = beginFight('line', fish, STARTER_BAR_GEAR, rng, 15, 'pike');
    let st: FishingState = { kind: 'fighting', distanceM: 15, zone: 'deep', hooked: { speciesId: 'pike', lengthCm: 60, weightG: 1700 }, fish, ...fight, lure: 'jig' };
    const ctx = spinCtx({ rng, catchStyle: () => 'line' });
    st = step(st, { type: hold ? 'press' : 'release' }, ctx).state;
    const events: GameEvent[] = [];
    for (let i = 0; i < 20_000 && st.kind === 'fighting'; i++) {
      const r = step(st, { type: 'tick', dtMs: 16 }, ctx);
      st = r.state;
      events.push(...r.events);
    }
    return events;
  };

  it('a snapped fight loses the lure (85 %) or the fish spits it (15 %); a fishLost event names the lure', () => {
    let lost = 0;
    let spat = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const ev = fightOutcome(true, seed);
      const fl = ev.find((e) => e.type === 'fishLost');
      if (!fl || !('snapped' in fl && fl.snapped)) continue;
      expect(fl).toMatchObject({ lure: 'jig' });
      const lures = ev.filter((e) => e.type === 'lureLost' || e.type === 'lureSpat');
      expect(lures).toHaveLength(1);
      if (lures[0].type === 'lureLost') lost++;
      else spat++;
    }
    expect(lost + spat).toBeGreaterThan(100);
    expect(lost / (lost + spat)).toBeGreaterThan(0.75);
    expect(spat).toBeGreaterThan(0);
  });

  it('a hook slip or any other escape keeps the lure: no lure event at all', () => {
    let slips = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ev = fightOutcome(false, seed);
      const fl = ev.find((e) => e.type === 'fishLost');
      const lureEvents = ev.filter((e) => e.type === 'lureLost' || e.type === 'lureSpat');
      if (fl && 'snapped' in fl && fl.snapped) continue;
      if (fl) slips++;
      expect(lureEvents).toEqual([]);
    }
    expect(slips).toBeGreaterThan(20);
  });

  it('a lure catch says so on fishCaught; a float catch does not', () => {
    // Easy fish, thumb played well enough by pulsing: just look for a caught event over a few seeds.
    let caught: GameEvent | undefined;
    for (let seed = 1; seed <= 400 && !caught; seed++) {
      const rng = seededRng(seed);
      const fish = fightProfile(speciesById('chub')!, 20);
      const fight = beginFight('line', fish, STARTER_BAR_GEAR, rng, 4, 'chub');
      let st: FishingState = { kind: 'fighting', distanceM: 4, zone: 'shallow', hooked: { speciesId: 'chub', lengthCm: 20, weightG: 130 }, fish, ...fight, lure: 'spinner' };
      const ctx = spinCtx({ rng, catchStyle: () => 'line' });
      for (let i = 0; i < 4000 && st.kind === 'fighting'; i++) {
        // Pulse: 400 ms down, 300 ms up.
        const down = i % 44 < 25;
        if ((i % 44 === 0 || i % 44 === 25)) st = step(st, { type: down ? 'press' : 'release' }, ctx).state;
        const r = step(st, { type: 'tick', dtMs: 16 }, ctx);
        st = r.state;
        caught = r.events.find((e) => e.type === 'fishCaught') ?? caught;
      }
    }
    expect(caught).toMatchObject({ type: 'fishCaught', speciesId: 'chub', lure: 'spinner' });
  });

  it('the zone of a state follows the lure through the bands (river: pool, seam, riffle)', () => {
    expect([30, 20, 5].map((m) => zoneAt(RIVER_BEND, m).id)).toEqual(['pool', 'seam', 'riffle']);
  });
});

describe('data sanity', () => {
  it('three lures at 300, 600 and 450 coins; the spinning rod 2500, 30 m', () => {
    expect(LURES.map((l) => [l.id, l.price])).toEqual([['spinner', 300], ['wobbler', 600], ['jig', 450]]);
    expect(SPIN_ROD).toMatchObject({ price: 2500, maxCastM: 30 });
    expect(T.hookGraceMs).toBe(600);
    expect(T.minFollowMs).toBe(500);
    expect(T.snagArmMs).toBe(3000);
    expect(T.snagPct).toMatchObject({ riffle: 0.01, seam: 0.02, pool: 0.03 });
    expect(T.snapLoseChance).toBe(0.85);
    expect(T.bringBackOneIn).toBe(5);
  });
});
