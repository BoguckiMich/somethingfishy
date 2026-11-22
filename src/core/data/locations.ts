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
