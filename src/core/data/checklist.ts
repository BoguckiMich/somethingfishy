import type { QuestReward } from '../quests/quests';

/**
 * The Quiet Lake checklist "The Doorstep" (slice 20): bundles of slots Pajkel's road needs filled.
 * A slot wants a given species, a fish of a minimum star, or a payment of coins. Tunable data.
 */
export type ChecklistSlot =
  | { kind: 'species'; id: string }
  | { kind: 'star'; min: 'silver' | 'gold' }
  | { kind: 'coins'; amount: number };

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

export const CHECKLIST_TITLE = 'Quiet Lake: The Doorstep';

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
