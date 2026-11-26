import { POOL_SPECIES, type Species } from '../data/fish';
import type { PlayerState } from '../inventory';
import { locationById } from '../data/locations';
import { canBiteWithin, livesAt } from '../location';
import { hashString, rodReach } from '../quests/quests';
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
  // The pick is made among the species of the place she is at (slice 25a/25d), in data order: Quiet Lake keeps its old list and so its old days.
  const here = locationById(player.place);
  const live = POOL_SPECIES.filter((s) => livesAt(here, s.id));
  const reach = rodReach(player);
  const first = live[h % live.length];
  if (canBiteWithin(here, first, reach)) return first;
  const reachable = live.filter((s) => canBiteWithin(here, s, reach));
  return reachable.length > 0 ? reachable[h % reachable.length] : undefined;
}
