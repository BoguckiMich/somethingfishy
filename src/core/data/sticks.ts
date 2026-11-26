/**
 * The Stick Museum (slice 26): every stick the dog can bring, with a deadpan one-line review. Pure data, in the order they are found.
 * `variant` picks one of the three ground-stick pictures (0..2). A stick marked for the River bend is defined but never awarded at
 * Quiet Lake.
 */
export interface StickDef {
  id: string;
  name: string;
  review: string;
  /** Which of the three ground-stick shapes it is drawn with. */
  variant: 0 | 1 | 2;
  /** The place it is found at (a Location id). */
  place: 'quiet-lake' | 'river-bend';
}

export const STICKS: readonly StickDef[] = [
  { id: 'crooked-fork', name: 'The Crooked Fork', review: '10/10. Will not give back.', variant: 0, place: 'quiet-lake' },
  { id: 'wet-wednesday', name: 'Wet Wednesday', review: 'Too wet. Kept anyway.', variant: 1, place: 'quiet-lake' },
  { id: 'almost-boomerang', name: 'The Almost Boomerang', review: 'Came back once. Never again.', variant: 2, place: 'quiet-lake' },
  { id: 'sir-twigsalot', name: 'Sir Twigsalot', review: 'Knighted on the spot. Would not kneel.', variant: 0, place: 'quiet-lake' },
  { id: 'the-long-one', name: 'The Long One', review: 'Longer than it looks. It looks long.', variant: 1, place: 'quiet-lake' },
  { id: 'mr-splinter', name: 'Mr. Splinter', review: 'Firm handshake. Regrets nothing.', variant: 2, place: 'quiet-lake' },
  { id: 'bark-twain', name: 'Bark Twain', review: 'Great storyteller. Mostly bark.', variant: 0, place: 'quiet-lake' },
  { id: 'the-y-not', name: 'The Y-Not', review: 'Why a fork? Why not.', variant: 1, place: 'quiet-lake' },
  { id: 'old-reliable', name: 'Old Reliable', review: 'Chewed 400 times. Still straight.', variant: 2, place: 'quiet-lake' },
  { id: 'tiny-fiddle', name: 'The Tiny Fiddle', review: 'Smallest stick. Biggest opinions.', variant: 0, place: 'quiet-lake' },
  // Kept for the River bend (not awarded at Quiet Lake).
  { id: 'ferry-fender', name: 'The Ferry Fender', review: 'Smells of river. Approved.', variant: 1, place: 'river-bend' },
  { id: 'driftwood-duke', name: 'The Driftwood Duke', review: 'Arrived by water. Very dignified.', variant: 2, place: 'river-bend' },
  { id: 'reed-between', name: 'Reed Between the Lines', review: 'Hollow. Deeply wise.', variant: 0, place: 'river-bend' },
];

export const stickById = (id: string): StickDef | undefined => STICKS.find((s) => s.id === id);

/** The sticks of a place, in finding order. */
export const sticksAt = (placeId: string): StickDef[] => STICKS.filter((s) => s.place === placeId);
