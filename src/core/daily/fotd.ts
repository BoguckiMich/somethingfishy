import { POOL_SPECIES, type Species } from '../data/fish';
import type { PlayerState } from '../inventory';
import { locationById } from '../data/locations';
import { livesAt } from '../location';
import { hashString, reachableZones } from '../quests/quests';
import { isValidDate } from './dates';

/**
 * Fish of the day (slice 19). Pure: seeded from the date only, so the same day always names the same
 * species (the pick is made among ALL non-legendary species, in data order). If her rod cannot reach it
 * yet, a deterministic fallback picks a reachable one instead, so the answer only changes when she buys
 * the carbon rod. Nothing is saved.
 */
export function fishOfTheDay(today: string, player: PlayerState): Species | undefined {
  if (!isValidDate(today)) return undefined;
  const h = hashString(`fotd:${today}`);
  const first = POOL_SPECIES[h % POOL_SPECIES.length];
  const zones = reachableZones(player);
  // Only a species that lives at the place she is at (slice 25a); every species lives at Quiet Lake.
  const here = locationById(player.place);
  if (zones.includes(first.zone) && livesAt(here, first.id)) return first;
  const reachable = POOL_SPECIES.filter((s) => zones.includes(s.zone) && livesAt(here, s.id));
  return reachable.length > 0 ? reachable[h % reachable.length] : undefined;
}
