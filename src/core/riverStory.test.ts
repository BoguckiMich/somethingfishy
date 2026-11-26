import { describe, expect, it } from 'vitest';
import { ALL_BUNDLES, CHECKLIST, RIVER_CHECKLIST, checklistFor } from './data/checklist';
import { speciesById } from './data/fish';
import { CHAPTERS, JOURNAL, STORY_LINES, STORY_TUNING } from './data/story';
import { LAKE_KINDS, MOMENTS, MOMENT_KINDS, MOMENT_POOLS, RIVER_KINDS } from './data/moments';
import { newPlayer, toBagFish, type BagFish, type PlayerState } from './inventory';
import { allButPetrol, allDone, bundleDone, canFill, checklistOf, doneCount, fits, fittingSlots, giveFish, normalizeChecklist, payCoins, totalOf, withBundlesDone } from './checklist/checklist';
import { claimBoat, isUncanny, momentsAt, pickMoment } from './moments/moments';
import { seededRng } from './random';
import { normalizeSave } from './save';
import { gearUnlocked } from './gearGates';
import { journalChapterCount, journalEntries, journalTotal, markSeen, newStory, normalizeMilestones, recordRiverCatch, recordRiverVisit, storyMilestones, todaysChapter, withFlag } from './story/story';
import type { StoryState } from './story/story';

const RIVER = 'river-bend';
const at = (h: number, m = 0) => h * 60 + m;
const hooked = (speciesId: string) => ({ speciesId, lengthCm: 30, weightG: 300 });
const fish = (speciesId: string, extra: Partial<BagFish> = {}): BagFish => ({ speciesId, lengthCm: 30, weightG: 300, price: 20, ...extra });
const withBag = (bag: BagFish[], extra: Partial<PlayerState> = {}): PlayerState => ({ ...newPlayer(), bag, ...extra });
const roundTrip = (p: PlayerState) => normalizeSave(JSON.parse(JSON.stringify({ version: 1, player: p, clock: { day: 1, minute: 600 } })));
const riverStory = (ids: string[]): StoryState => ids.reduce((s, id, i) => markSeen(s, id, `2026-12-${String(i + 1).padStart(2, '0')}`), newStory());

describe('the river checklist data', () => {
  it('has six bundles with unique ids, the lake checklist is untouched', () => {
    expect(RIVER_CHECKLIST.map((b) => b.id)).toEqual(['swift-water', 'the-hunter', 'ferry-fare', 'upstream-mail', 'stick-for-the-road', 'ferrymans-toll']);
    expect(CHECKLIST).toHaveLength(6);
    expect(new Set(ALL_BUNDLES.map((b) => b.id)).size).toBe(12);
    expect(checklistFor(RIVER).title).toBe('Against the Current');
    expect(checklistFor('nowhere').id).toBe('quiet-lake');
  });
  it('only names species that live at the river', () => {
    for (const b of RIVER_CHECKLIST) {
      for (const s of b.slots) {
        const ids = s.kind === 'species' ? [s.id] : s.kind === 'anyOf' ? s.ids : [];
        for (const id of ids) expect(speciesById(id), id).toBeDefined();
      }
    }
  });
});

describe('slot rules', () => {
  it('"perch or pike" takes either', () => {
    const slot = RIVER_CHECKLIST[1].slots[1];
    expect(fits(slot, fish('perch'))).toBe(true);
    expect(fits(slot, fish('pike'))).toBe(true);
    expect(fits(slot, fish('asp'))).toBe(false);
  });
  it('the story slots need a river fish with the tag', () => {
    const dusk = RIVER_CHECKLIST[3].slots[0];
    const fetch = RIVER_CHECKLIST[4].slots[0];
    const perfect = RIVER_CHECKLIST[5].slots[0];
    expect(fits(dusk, fish('trout', { river: true, dusk: true }))).toBe(true);
    expect(fits(dusk, fish('trout', { dusk: true }))).toBe(false); // caught at the lake
    expect(fits(dusk, fish('trout', { river: true }))).toBe(false);
    expect(fits(fetch, fish('chub', { river: true, fetch: true }))).toBe(true);
    expect(fits(fetch, fish('chub', { river: true }))).toBe(false);
    expect(fits(perfect, fish('barbel', { river: true, perfect: true }))).toBe(true);
    expect(fits(perfect, fish('barbel', { perfect: true }))).toBe(false);
  });
  it('toBagFish tags only a river catch: dusk by the clock, fetch from the caller, perfect as before', () => {
    const river = toBagFish(hooked('trout'), undefined, true, at(18, 30), { place: RIVER, fetch: true });
    expect(river).toMatchObject({ river: true, dusk: true, fetch: true, perfect: true });
    const day = toBagFish(hooked('trout'), undefined, false, at(12), { place: RIVER });
    expect(day.river).toBe(true);
    expect(day.dusk).toBeUndefined();
    expect(day.fetch).toBeUndefined();
    const lake = toBagFish(hooked('perch'), undefined, true, at(18, 30), { place: 'quiet-lake', fetch: true });
    expect(lake.river).toBeUndefined();
    expect(lake.dusk).toBeUndefined();
    expect(lake.fetch).toBeUndefined();
    expect(toBagFish(hooked('perch'))).not.toHaveProperty('river');
  });
  it('three dusk fish fill Upstream Mail one at a time, and pay its reward when done', () => {
    let p = withBag([fish('trout', { river: true, dusk: true, price: 9 }), fish('chub', { river: true, dusk: true }), fish('nase', { river: true, dusk: true }), fish('asp')]);
    for (let i = 0; i < 3; i++) {
      const r = giveFish(p, 'upstream-mail', i);
      expect(r.ok).toBe(true);
      expect(r.finished).toBe(i === 2);
      p = r.player;
    }
    expect(bundleDone(p, 'upstream-mail')).toBe(true);
    expect(p.bag.map((f) => f.speciesId)).toEqual(['asp']);
    expect(p.baits?.glow).toBe(3);
    expect(p.coins).toBe(newPlayer().coins + 250);
  });
  it('Ferry Fare is a coin slot of 800', () => {
    expect(canFill(withBag([], { coins: 799 }), 'ferry-fare', 0)).toBe(false);
    const r = payCoins(withBag([], { coins: 900 }), 'ferry-fare', 0);
    expect(r.ok).toBe(true);
    expect(r.player.coins).toBe(100);
    expect(bundleDone(r.player, 'ferry-fare')).toBe(true);
  });
  it('fittingSlots only looks at the asked place', () => {
    const p = withBag([]);
    const trout = fish('trout');
    expect(fittingSlots(p, trout, RIVER).map((s) => s.bundleId)).toEqual(['swift-water']);
    expect(fittingSlots(p, trout)).toEqual([]);
    expect(fittingSlots(p, fish('roach')).map((s) => s.bundleId)).toContain('dawn-chorus');
    expect(fittingSlots(p, fish('roach'), RIVER).map((s) => s.bundleId)).not.toContain('dawn-chorus');
  });
});

describe('per-place state', () => {
  it('the lake counts stay lake-only, the river counts river-only', () => {
    const p = withBundlesDone(newPlayer(), 2, RIVER);
    expect(doneCount(p, RIVER)).toBe(2);
    expect(doneCount(p)).toBe(0);
    expect(totalOf(RIVER)).toBe(6);
    expect(allDone(allButPetrol(newPlayer(), true, RIVER), RIVER)).toBe(true);
    expect(allDone(allButPetrol(newPlayer(), true, RIVER))).toBe(false);
    const both = withBundlesDone(allButPetrol(newPlayer(), true), 1, RIVER);
    expect(doneCount(both)).toBe(6);
    expect(doneCount(both, RIVER)).toBe(1);
  });
  it('gear gates only count the lake checklist', () => {
    const p = allButPetrol(newPlayer(), true, RIVER);
    expect(gearUnlocked('fiberglass', p)).toBe(gearUnlocked('fiberglass', newPlayer()));
  });
  it('an old save (lake state only) still loads, and the river fills in empty', () => {
    const old = { ...newPlayer(), checklist: { 'dawn-chorus': [true, true, true] } };
    const loaded = roundTrip(old);
    const c = checklistOf(loaded.player);
    expect(c['dawn-chorus']).toEqual([true, true, true]);
    expect(c['swift-water']).toEqual([false, false, false]);
    expect(Object.keys(normalizeChecklist(undefined))).toHaveLength(12);
  });
  it('river progress and the fish tags survive a save round trip', () => {
    const p = withBag([fish('trout', { river: true, dusk: true, fetch: true })], { checklist: { 'swift-water': [true, false, true] } });
    const loaded = roundTrip(p).player;
    expect(loaded.checklist?.['swift-water']).toEqual([true, false, true]);
    expect(loaded.bag[0]).toMatchObject({ river: true, dusk: true, fetch: true });
    expect(loaded.bag[0].perfect).toBeUndefined();
  });
});

describe('river chapters R1-R6', () => {
  const R = CHAPTERS[RIVER];
  it('are six, in order, with real line ids and the length limits', () => {
    expect(R.map((c) => c.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
    expect(journalTotal(RIVER)).toBe(6);
    for (const c of R) {
      expect(c.place).toBe(RIVER);
      for (const id of [...(c.before ?? []), ...c.after]) expect(STORY_LINES[id], `${c.id}:${id}`).toBeTruthy();
      if (c.text) expect(c.text.length).toBeLessThanOrEqual(90);
      for (const l of c.card?.lines ?? []) expect(l.length).toBeLessThanOrEqual(38);
      expect(JOURNAL[c.id], c.id).toBeDefined();
      expect(JOURNAL[c.id].thought.length).toBeLessThanOrEqual(60);
    }
  });
  it('use the exact STORY.md texts', () => {
    expect(R[0].card?.lines).toEqual(['River bend.', 'The water here is in a hurry.', 'Mostly in one direction.']);
    expect(R[1].card?.lines).toEqual(['An old hut by the bend.', 'Sign: W. - FERRY & BAIT.', 'Below it: GONE FISHING.', 'The kettle inside is still warm.']);
    expect(R[2].text).toBe('I ran the ferry for people. The Ferryman runs it for everything else. Be polite. — W.');
    expect(R[4].text).toBe("Odd fish aren't really fish. They're dreams that swam too far from the one dreaming. — W.");
    expect(R[5].card?.lines).toEqual(['In the hut, a hook for a key.', 'The key is gone.', 'The tag is still there:', 'OLD QUARRY - GATE.']);
    expect(R[5].card?.tagLast).toBe(true);
    expect(STORY_LINES.r1).toBe("...sticks don't do that.");
    expect(STORY_LINES.r2).toBe('Back never, right? Classic W.');
    expect(STORY_LINES.r4a).toBe('Is that... OUR duck? It followed us?');
    expect(STORY_LINES.r4b).toBe('Fine. Duck is family now. Duck, sit.');
    expect(STORY_LINES.r6).toBe("Road to the quarry. I'm driving!");
  });

  it('milestones: arrival, first catch, first seam catch, dusk, first bundle, checklist done', () => {
    const m = (p: PlayerState) => storyMilestones(p);
    expect(Object.entries(m(newPlayer())).filter(([id, v]) => id.startsWith('R') && v)).toEqual([]);
    let p = recordRiverVisit(newPlayer(), at(12));
    expect(m(p)).toMatchObject({ R1: true, R2: false, R3: false, R4: false });
    p = recordRiverCatch(p, 'riffle');
    expect(m(p)).toMatchObject({ R2: true, R3: false });
    p = recordRiverCatch(p, 'seam');
    expect(m(p).R3).toBe(true);
    expect(m(p).R5).toBe(false);
    expect(m(withBundlesDone(p, 1, RIVER)).R5).toBe(true);
    expect(m(withBundlesDone(p, 5, RIVER)).R6).toBe(false);
    expect(m(withBundlesDone(p, 6, RIVER)).R6).toBe(true);
  });
  it('R4 fires on the first dusk at the river', () => {
    expect(storyMilestones(recordRiverVisit(newPlayer(), at(18, 5))).R4).toBe(true);
    expect(storyMilestones(recordRiverVisit(newPlayer(), at(12))).R4).toBe(false);
    expect(storyMilestones(recordRiverVisit(newPlayer(), at(7, 30))).R4).toBe(false);
  });
  it('R4 fallback 1: night falls with no dusk visit', () => {
    expect(storyMilestones(recordRiverVisit(newPlayer(), at(21))).R4).toBe(true);
    expect(storyMilestones(recordRiverVisit(newPlayer(), at(2))).R4).toBe(true);
  });
  it('R4 fallback 2: the third river catch after R3 (earlier catches do not count)', () => {
    let p: PlayerState = recordRiverCatch(recordRiverVisit(newPlayer(), at(12)), 'seam');
    p = recordRiverCatch(p, 'riffle'); // before R3 is told: not counted
    expect(normalizeMilestones(p.milestones).lateCatches).toBeUndefined();
    p = { ...p, story: riverStory(['R1', 'R2', 'R3']) };
    for (let i = 1; i <= 3; i++) {
      expect(storyMilestones(p).R4).toBe(false);
      p = recordRiverCatch(p, 'pool');
      expect(normalizeMilestones(p.milestones).lateCatches).toBe(i);
    }
    expect(storyMilestones(p).R4).toBe(true);
    p = recordRiverCatch(p, 'pool');
    expect(normalizeMilestones(p.milestones).lateCatches).toBe(STORY_TUNING.r4FallbackCatches);
  });
  it('flags are no-ops when already set and survive a save', () => {
    const p = recordRiverVisit(recordRiverCatch(newPlayer(), 'seam'), at(18, 30));
    expect(recordRiverVisit(p, at(18, 40))).toBe(p);
    expect(withFlag(p, 'river')).toBe(p);
    const loaded = roundTrip(p).player;
    expect(normalizeMilestones(loaded.milestones)).toMatchObject({ arrived: true, river: true, seam: true, riverDusk: true });
  });

  it('strict order and the daily cap: R3 waits for R2 even when its milestone is met', () => {
    const met = { R1: true, R2: true, R3: true, R4: true, R5: true, R6: true };
    expect(todaysChapter(newStory(), '2026-12-01', RIVER, met)?.id).toBe('R1');
    expect(todaysChapter(riverStory(['R1']), '2026-12-02', RIVER, { ...met, R2: false })).toBeNull();
    const two = markSeen(markSeen(newStory(), 'R1', '2026-12-05'), 'R2', '2026-12-05');
    expect(todaysChapter(two, '2026-12-05', RIVER, met)).toBeNull(); // 2 per real day
    expect(todaysChapter(two, '2026-12-05', RIVER, met, true)?.id).toBe('R3'); // catch-up: 3
    const three = markSeen(two, 'R3', '2026-12-05');
    expect(todaysChapter(three, '2026-12-05', RIVER, met, true)).toBeNull();
    expect(todaysChapter(three, '2026-12-06', RIVER, met)?.id).toBe('R4');
  });
  it('chapters are told at their own place only', () => {
    const met = { Q1: true, R1: true };
    expect(todaysChapter(newStory(), '2026-12-01', 'quiet-lake', met)?.id).toBe('Q1');
    expect(todaysChapter(newStory(), '2026-12-01', RIVER, met)?.id).toBe('R1');
    expect(todaysChapter(riverStory(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7']), '2026-12-20', 'quiet-lake', met)).toBeNull();
  });
  it('the journal counts chapters per place and tags the pages', () => {
    const s = markSeen(markSeen(markSeen(newStory(), 'Q1', '2026-12-01'), 'R1', '2026-12-02'), 'R2', '2026-12-02');
    expect(journalEntries(s).map((e) => [e.id, e.place])).toEqual([['Q1', 'quiet-lake'], ['R1', RIVER], ['R2', RIVER]]);
    expect(journalChapterCount(s)).toBe(1);
    expect(journalChapterCount(s, false, RIVER)).toBe(2);
    expect(journalEntries(s).find((e) => e.id === 'R1')?.icon).toBe('stick');
  });
  it('R1 queues its bubble, R4 two', () => {
    expect(markSeen(newStory(), 'R1', '2026-12-01').queue).toEqual(['r1']);
    expect(markSeen(newStory(), 'R4', '2026-12-01').queue).toEqual(['r4a', 'r4b']);
    expect(markSeen(newStory(), 'R6', '2026-12-01').queue).toEqual(['r6']);
  });
});

describe('river moments', () => {
  it('the lake and the river never share a moment', () => {
    expect(LAKE_KINDS.filter((k) => (RIVER_KINDS as readonly string[]).includes(k))).toEqual([]);
    expect([...LAKE_KINDS, ...RIVER_KINDS]).toEqual([...MOMENT_KINDS]);
    for (let m = 0; m < 1440; m += 5) {
      for (const k of momentsAt(m, 'river')) expect(MOMENT_POOLS.river).toContain(k);
      for (const k of momentsAt(m, 'lake')) expect(MOMENT_POOLS.lake).toContain(k);
      for (const k of momentsAt(m)) expect(RIVER_KINDS as readonly string[]).not.toContain(k);
    }
  });
  it('the river has the five of STORY.md section 4, each with a window and a weight', () => {
    expect([...RIVER_KINDS]).toEqual(['kingfisher', 'otter', 'lantern', 'paperBoat', 'heron']);
    for (const k of RIVER_KINDS) {
      expect(MOMENTS[k].weight).toBeGreaterThan(0);
      expect(MOMENTS[k].durationMs).toBeGreaterThan(0);
    }
  });
  it('follows the hours: kingfisher by day, otter at dawn and dusk, lantern 22-04 (uncanny), heron at dawn, boat any time', () => {
    expect(momentsAt(at(12), 'river')).toContain('kingfisher');
    expect(momentsAt(at(12), 'river')).not.toContain('otter');
    expect(momentsAt(at(6), 'river')).toEqual(expect.arrayContaining(['otter', 'heron']));
    expect(momentsAt(at(19), 'river')).toContain('otter');
    expect(momentsAt(at(19), 'river')).not.toContain('kingfisher');
    expect(momentsAt(at(23), 'river')).toContain('lantern');
    expect(momentsAt(at(12), 'river')).not.toContain('lantern');
    expect(isUncanny('lantern')).toBe(true);
    for (const k of RIVER_KINDS) if (k !== 'lantern') expect(isUncanny(k)).toBe(false);
    for (let m = 0; m < 1440; m += 10) expect(momentsAt(m, 'river')).toContain('paperBoat');
  });
  it('picks only river moments at the river, never the same twice in a row', () => {
    const rng = seededRng(11);
    let last = null as ReturnType<typeof pickMoment> | null;
    for (let i = 0; i < 400; i++) {
      const m = (i * 37) % 1440;
      const k = pickMoment(m, rng, last, 'river');
      expect(RIVER_KINDS as readonly string[]).toContain(k);
      expect(momentsAt(m, 'river')).toContain(k);
      if (last && momentsAt(m, 'river').length > 1) expect(k).not.toBe(last);
      last = k;
    }
  });
  it('a paper boat holds worms about 1 time in 4', () => {
    const p = newPlayer();
    let withWorms = 0;
    const rng = seededRng(5);
    for (let i = 0; i < 2000; i++) {
      const r = claimBoat(p, rng);
      if (r.worms > 0) {
        withWorms++;
        expect(r.worms).toBeGreaterThanOrEqual(2);
        expect(r.worms).toBeLessThanOrEqual(5);
        expect(r.player.worms).toBe(p.worms + r.worms);
      } else expect(r.player).toBe(p);
    }
    expect(withWorms / 2000).toBeGreaterThan(0.2);
    expect(withWorms / 2000).toBeLessThan(0.3);
  });
});
