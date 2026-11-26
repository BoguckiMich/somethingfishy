import type { QuestReward } from '../quests/quests';

/**
 * The Quiet Lake checklist "The Doorstep" (slice 20): bundles of slots Pajkel's road needs filled.
 * A slot wants a given species, a fish of a minimum star, or a payment of coins. Tunable data.
 */
export type ChecklistSlot =
  | { kind: 'species'; id: string }
  /** Any one of these species ("perch or pike"); `label` is what the slot says. */
  | { kind: 'anyOf'; ids: readonly string[]; label: string }
  | { kind: 'star'; min: 'silver' | 'gold' }
  /** A river fish with a story told by its catch (slice 25e): caught at dusk, while {dog} played fetch, or perfectly. `label` is what the slot says. */
  | { kind: 'tag'; tag: CatchTag; label: string }
  | { kind: 'coins'; amount: number };

/** What a river catch can carry (stored on the bag fish): caught at dusk, while Bestia played fetch, or perfectly. All three also need the fish to come from the River bend. */
export type CatchTag = 'dusk' | 'fetch' | 'perfect';

export interface ChecklistBundle {
  id: string;
  name: string;
  /** One dim line under the name. */
  flavour: string;
  slots: readonly ChecklistSlot[];
  /** Paid once, when the last slot is filled. */
  reward: QuestReward;
}

const sp = (id: string): ChecklistSlot => ({ kind: 'species', id });

export const CHECKLIST_TITLE = 'The Doorstep';

const any = (label: string, ...ids: string[]): ChecklistSlot => ({ kind: 'anyOf', ids, label });
const tag = (t: CatchTag, label: string): ChecklistSlot => ({ kind: 'tag', tag: t, label });

export const CHECKLIST: readonly ChecklistBundle[] = [
  {
    id: 'dawn-chorus', name: 'Dawn Chorus', flavour: 'Early fish for early birds.',
    slots: [sp('roach'), sp('rudd'), sp('bleak')],
    reward: { coins: 60, worms: 0, bait: { id: 'corn', n: 10 } },
  },
  {
    id: 'night-shift', name: 'Night Shift', flavour: 'Things that bite after bedtime.',
    slots: [sp('eel'), sp('zander'), sp('catfish')],
    reward: { coins: 200, worms: 0, bait: { id: 'glow', n: 3 } },
  },
  {
    id: 'bottom-of-things', name: 'The Bottom of Things', flavour: 'Ask the ones who live down there.',
    slots: [sp('bream'), sp('tench'), sp('crucian'), sp('carp')],
    reward: { coins: 150, worms: 0, bait: { id: 'strip', n: 10 } },
  },
  {
    id: 'shiny-ones', name: 'Shiny Ones', flavour: "Show the lake you're serious.",
    slots: [{ kind: 'star', min: 'gold' }, { kind: 'star', min: 'gold' }, { kind: 'star', min: 'gold' }],
    reward: { coins: 300, worms: 0 },
  },
  {
    id: 'duck-tax', name: 'Duck Tax', flavour: 'For the duck. You know why.',
    slots: [sp('bleak')],
    reward: { coins: 0, worms: 5 },
  },
  {
    id: 'petrol', name: 'Petrol Money', flavour: "The DS4 won't drive on vibes.",
    slots: [{ kind: 'coins', amount: 500 }],
    reward: { coins: 0, worms: 0 },
  },
];

/** The bundle the dev flag `&cl=done` leaves open. */
export const PETROL_ID = 'petrol';

/**
 * The River bend checklist "Against the Current" (slice 25e): STORY.md section 5 plus RIVER_BEND.md decision 7 (the sixth bundle,
 * a perfect catch at the river). Bundle ids are saved: never rename. Rewards are tuned like the lake's (coins, a pack of bait, worms).
 */
export const RIVER_CHECKLIST_TITLE = 'Against the Current';

export const RIVER_CHECKLIST: readonly ChecklistBundle[] = [
  {
    id: 'swift-water', name: 'Swift Water', flavour: 'Fish that never sit still.',
    slots: [sp('trout'), sp('grayling'), sp('chub')],
    reward: { coins: 150, worms: 0, bait: { id: 'maggots', n: 10 } },
  },
  {
    id: 'the-hunter', name: 'The Hunter', flavour: 'It hits the surface like a slap.',
    slots: [sp('asp'), any('perch or pike', 'perch', 'pike')],
    reward: { coins: 200, worms: 0, bait: { id: 'strip', n: 10 } },
  },
  {
    id: 'ferry-fare', name: 'Ferry Fare', flavour: 'W. always charged the fare. Even to fish.',
    slots: [{ kind: 'coins', amount: 800 }],
    reward: { coins: 0, worms: 0 },
  },
  {
    id: 'upstream-mail', name: 'Upstream Mail', flavour: 'The Ferryman works the evening shift.',
    slots: [tag('dusk', 'a dusk catch'), tag('dusk', 'a dusk catch'), tag('dusk', 'a dusk catch')],
    reward: { coins: 250, worms: 0, bait: { id: 'glow', n: 3 } },
  },
  {
    id: 'stick-for-the-road', name: 'A Stick for the Road', flavour: 'She has her priorities.',
    slots: [tag('fetch', 'a fish caught while {dog} fetches')],
    reward: { coins: 0, worms: 8 },
  },
  {
    id: 'ferrymans-toll', name: "Ferryman's Toll", flavour: 'Pay it with a perfect catch.',
    slots: [tag('perfect', 'a perfect river catch')],
    reward: { coins: 300, worms: 0 },
  },
];

/** A place's checklist: what the panel is called, what the map button says, and its bundles. */
export interface PlaceChecklist {
  id: string;
  title: string;
  /** What the panel's header says (short enough to fit; the title shows in the line under it). */
  panelTitle: string;
  /** "Quiet Lake checklist" on the map and notice-board buttons. */
  label: string;
  bundles: readonly ChecklistBundle[];
}

export const CHECKLISTS: readonly PlaceChecklist[] = [
  { id: 'quiet-lake', title: CHECKLIST_TITLE, panelTitle: CHECKLIST_TITLE, label: 'Quiet Lake checklist', bundles: CHECKLIST },
  { id: 'river-bend', title: RIVER_CHECKLIST_TITLE, panelTitle: 'River checklist', label: 'River bend checklist', bundles: RIVER_CHECKLIST },
];

/** The checklist of a place (Quiet Lake's for anything unknown). */
export const checklistFor = (place: string | undefined): PlaceChecklist => CHECKLISTS.find((c) => c.id === place) ?? CHECKLISTS[0];

/** Every bundle of every place (the saved state keeps one flat map, bundle ids are unique). */
export const ALL_BUNDLES: readonly ChecklistBundle[] = CHECKLISTS.flatMap((c) => c.bundles);
