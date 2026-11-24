import type { Location } from '../location';

export const QUIET_LAKE: Location = {
  id: 'quiet-lake',
  name: 'Quiet Lake',
  maxDistanceM: 40,
  zones: [
    { id: 'shallow', name: 'Shallow water', fromM: 0, toM: 15 },
    { id: 'deep', name: 'Deep water', fromM: 15, toM: 40 },
  ],
};

/** Size of the road-map picture in art pixels (slice 18); the pins below sit inside it. */
export const MAP_SIZE = { w: 150, h: 110 };

export interface MapPlace {
  id: string;
  name: string;
  /** One or two lines shown under the map when the place is selected. */
  blurb: string;
  /** `open` is a place she can fish now; `soon` shows a work-in-progress sign and "Coming soon". */
  status: 'open' | 'soon';
  /** Where the pin stands on the map picture (art pixels): the tip of the pin. */
  pin: { x: number; y: number };
}

/** The places on the road map, in the order they are listed. Only Quiet Lake exists yet. */
export const MAP_PLACES: readonly MapPlace[] = [
  { id: QUIET_LAKE.id, name: 'Quiet Lake', blurb: 'Home. The fish know you here.', status: 'open', pin: { x: 34, y: 90 } },
  { id: 'river-bend', name: 'River bend', blurb: 'Pajkel is still fixing the road to the river.', status: 'soon', pin: { x: 98, y: 64 } },
  { id: 'old-quarry', name: 'Old quarry', blurb: 'Deep, clear water. Something down there is waiting.', status: 'soon', pin: { x: 30, y: 50 } },
  { id: 'sea-pier', name: 'Sea pier', blurb: 'The gulls have opinions about your sandwich. Loud ones.', status: 'soon', pin: { x: 120, y: 26 } },
];
