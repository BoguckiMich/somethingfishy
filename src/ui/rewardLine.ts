import { FS, LINE } from '../font';
import { coinSprite, wormSprite } from '../art/iconArt';
import { shopIconSprite } from '../art/shopIconArt';
import type { Sprite } from '../art/pixelGrid';
import type { QuestReward } from '../core/quests/quests';
import { COLORS, el } from './panel';
import { spriteCanvas } from './spriteCanvas';

/** The pieces of a reward, each with its icon: coins, worms, a special bait. */
export function rewardParts(r: QuestReward): { icon: Sprite; n: number }[] {
  const parts: { icon: Sprite; n: number }[] = [];
  if (r.coins > 0) parts.push({ icon: coinSprite(), n: r.coins });
  if (r.worms > 0) parts.push({ icon: wormSprite(), n: r.worms });
  const bait = r.bait ? shopIconSprite(r.bait.id) : undefined;
  if (r.bait && bait) parts.push({ icon: bait, n: r.bait.n });
  return parts;
}

/** "<coin> +60  <worm> +3  <corn> +10": icons instead of the words coins / worms (slice 22b). */
export function rewardLine(r: QuestReward, color: string = COLORS.gold, size: number = FS.small): HTMLElement {
  const row = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;font-size:${size}px;line-height:${LINE};color:${color}`);
  for (const { icon, n } of rewardParts(r)) {
    const part = el('span', 'display:inline-flex;align-items:center;gap:3px;white-space:nowrap');
    part.append(spriteCanvas(icon, 16), el('span', '', `+${n}`));
    row.append(part);
  }
  return row;
}

/** Just the reward icons, in a row (the closed checklist rows). */
export function rewardIcons(r: QuestReward): HTMLElement {
  const row = el('div', 'display:flex;align-items:center;gap:3px;flex:none');
  for (const { icon } of rewardParts(r)) row.append(spriteCanvas(icon, 16));
  return row;
}
