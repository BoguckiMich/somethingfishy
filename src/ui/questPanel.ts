import { FS, LINE } from '../font';
import { claimQuest, questText, questsOf, rerollQuest, rewardText, canReroll, type Quest } from '../core/quests/quests';
import type { PlayerState } from '../core/inventory';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';
import type { PlayerStore } from './bagShop';

/** What the quest panel needs: the player (read and written back) and today's date. */
export interface QuestStore extends PlayerStore {
  today(): string;
}

function bar(q: Quest): HTMLElement {
  const row = el('div', 'display:flex;align-items:center;gap:8px;margin-top:4px');
  const track = el('div', `flex:1;height:12px;box-sizing:border-box;border:2px solid ${COLORS.outline};background:${COLORS.outline}`);
  const share = Math.min(1, q.progress / q.params.target);
  track.append(el('div', `height:100%;width:${Math.round(share * 100)}%;background:${q.done ? COLORS.gold : COLORS.amber}`));
  row.append(track, el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};min-width:42px;text-align:right`, `${q.progress}/${q.params.target}`));
  return row;
}

function questRow(p: PlayerState, i: number, today: string, act: (next: PlayerState) => void): HTMLElement {
  const quests = questsOf(p);
  const q = quests.list[i];
  const row = el('div', `padding:8px 0;border-bottom:1px solid ${COLORS.woodLight};${q.claimed ? 'opacity:0.55' : ''}`);
  row.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, questText(q)), bar(q));
  const foot = el('div', 'display:flex;align-items:center;gap:8px;margin-top:6px');
  foot.append(el('div', `flex:1;min-width:0;font-size:${FS.small}px;line-height:${LINE};color:${COLORS.gold}`, rewardText(q.reward)));
  if (q.claimed) {
    foot.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.dim}`, 'Done'));
  } else if (q.done) {
    foot.append(woodButton('Claim', () => act(claimQuest(p, i).player), { small: true, sfx: 'coin' }));
  } else if (canReroll(quests, i, today)) {
    foot.append(woodButton('Reroll', () => act(rerollQuest(p, i, today).player), { small: true }));
  }
  row.append(foot);
  return row;
}

/** The notice board: today's quests with progress, Claim and the one free Reroll. */
export function showQuestPanel(store: QuestStore, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    'Daily quests',
    (body) => {
      const p = store.get();
      const quests = questsOf(p);
      const today = store.today();
      const act = (next: PlayerState) => {
        store.set(next);
        panel.refresh();
      };
      if (quests.list.length === 0) {
        body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};padding:6px 0`, 'No quests today.'));
      }
      quests.list.forEach((_, i) => body.append(questRow(p, i, today, act)));
      const rerollNote = quests.list.some((_, i) => canReroll(quests, i, today)) ? '1 free reroll today' : quests.rerollUsed ? 'Reroll used today' : '';
      if (rerollNote) body.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream};margin-top:8px`, rerollNote));
      body.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.dim};margin-top:${rerollNote ? 2 : 8}px`, 'New quests at midnight'));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:10px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}
