import { FS, LINE } from '../font';
import { journalIconSprite } from '../art/journalIconArt';
import { journalChapterCount, journalEntries, journalHasNew, markJournalLooked, storyOf, type JournalEntry } from '../core/story/story';
import { JOURNAL_TOTAL } from '../core/data/story';
import { spriteCanvas } from './spriteCanvas';
import { claimQuest, questText, questsOf, rerollQuest, canReroll, type Quest } from '../core/quests/quests';
import type { PlayerState } from '../core/inventory';
import { fishIconSprite } from '../art/fishArt';
import { speciesById } from '../core/data/fish';
import { fishCanvas } from './logPanel';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';
import { shopTab, type PlayerStore } from './bagShop';
import { rewardLine } from './rewardLine';
import { unknownHints } from '../core/rare';

/** What the quest panel needs: the player (read and written back) and today's date. */
export interface QuestStore extends PlayerStore {
  today(): string;
  /** Today's fish (slice 19), if any. */
  fotdId(): string | undefined;
  /** Opens the Quiet Lake checklist (the quest panel closes first); `done` of `total` bundles shows on the button. */
  openChecklist(): void;
  checklist(): { done: number; total: number };
  /** The road to the river is fixed (the checklist is done): the last journal page. */
  roadFixed(): boolean;
  /** The names the thoughts are signed with. */
  names(): { alex: string; paj: string };
}

/** The player's own fold choice for the daily quests this session (undefined = the default rule). */
let foldChoice: boolean | undefined;

/** Folded once every quest of the day is claimed (and there is at least one), else open. */
export function defaultFolded(list: readonly { claimed: boolean }[]): boolean {
  return list.length > 0 && list.every((q) => q.claimed);
}

export type NoticeTab = 'quests' | 'story';

/** The top block: today's fish. Its sprite sits beside the name only, not beside the whole block. */
function fotdRow(id: string): HTMLElement | undefined {
  const sp = speciesById(id);
  if (!sp) return undefined;
  const row = el('div', `padding:6px 0 8px;border-bottom:2px solid ${COLORS.woodLight};font-size:${FS.body}px;line-height:${LINE}`);
  const nameRow = el('div', 'display:flex;align-items:center;gap:8px');
  const pic = el('div', 'flex:none;width:40px;display:flex;align-items:center;justify-content:center');
  pic.append(fishCanvas(fishIconSprite(id), 40, 2));
  nameRow.append(pic, el('div', `color:${COLORS.text}`, sp.name));
  row.append(
    el('div', `color:${COLORS.gold}`, 'Fish of the day'),
    nameRow,
    el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, 'bites more, sells x2'),
  );
  return row;
}

/** The progress bar: gold fill, with the count inside on the right. */
function bar(q: Quest): HTMLElement {
  const track = el('div', `position:relative;height:22px;margin-top:4px;box-sizing:border-box;border:2px solid ${COLORS.outline};background:${COLORS.outline}`);
  const share = Math.min(1, q.progress / q.params.target);
  track.append(el('div', `height:100%;width:${Math.round(share * 100)}%;background:${COLORS.gold}`));
  const shadow = ['1px 0', '-1px 0', '0 1px', '0 -1px'].map((o) => `${o} ${COLORS.outline}`).join(',');
  track.append(
    el(
      'div',
      `position:absolute;right:4px;top:0;bottom:0;display:flex;align-items:center;font-size:${FS.small}px;line-height:1;color:${COLORS.cream};text-shadow:${shadow}`,
      `${q.progress}/${q.params.target}`,
    ),
  );
  return track;
}

function questRow(p: PlayerState, i: number, today: string, act: (next: PlayerState) => void): HTMLElement {
  const quests = questsOf(p);
  const q = quests.list[i];
  const row = el('div', `padding:8px 0;border-bottom:1px solid ${COLORS.woodLight};${q.claimed ? 'opacity:0.55' : ''}`);
  row.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, questText(q)), bar(q));
  const foot = el('div', 'display:flex;align-items:center;gap:8px;margin-top:6px');
  const reward = rewardLine(q.reward);
  reward.style.cssText += ';flex:1;min-width:0';
  foot.append(reward);
  if (q.claimed) {
    foot.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.dim}`, 'Done'));
  } else if (q.done) {
    foot.append(woodButton('Claim', () => act(claimQuest(p, i).player), { small: true, sfx: 'coin' }));
  } else if (canReroll(quests, i, today)) {
    foot.append(woodButton('Reroll', () => act(rerollQuest(p, i, today).player), { small: true, variant: 'wood' }));
  }
  row.append(foot);
  return row;
}

/** A journal page: the picture, the note or description, and the thought in italics under the thinker's name. */
function journalRow(e: JournalEntry, names: { alex: string; paj: string }): HTMLElement {
  const row = el('div', `display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid ${COLORS.woodLight}`);
  const icon = journalIconSprite(e.icon);
  const scale = Math.max(1, Math.min(3, Math.floor(44 / icon.width), Math.floor(36 / icon.height)));
  const pic = el('div', 'flex:none;width:44px;height:36px;display:flex;align-items:center;justify-content:center');
  pic.append(spriteCanvas(icon, icon.width * scale));
  const col = el('div', 'flex:1;min-width:0');
  col.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.text}`, e.text));
  const thought = el('div', `margin-top:4px;font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream}`);
  thought.append(el('span', `color:${COLORS.gold}`, `${e.by === 'alex' ? names.alex : names.paj}: `), el('span', 'font-style:italic;font-synthesis:style', e.thought));
  col.append(thought);
  row.append(pic, col);
  return row;
}

/** The notice board: Quests (today's quests with progress, Claim (gold) and the one free Reroll (wood)) and Story (the journal, slice 22d). */
export function showQuestPanel(store: QuestStore, onClose: () => void, startTab: NoticeTab = 'quests'): PanelHandle {
  let tab: NoticeTab = startTab;
  // Decided once when the board opens, so claiming the last quest does not fold it under her finger.
  let folded = foldChoice ?? defaultFolded(questsOf(store.get()).list);
  const panel: PanelHandle = openPanel(
    'Notice board',
    (body, pinned) => {
      // The tabs; a dot on Story while a page is new (opening the tab reads it).
      const road = store.roadFixed();
      if (tab === 'story' && journalHasNew(storyOf(store.get()), road)) store.set({ ...store.get(), story: markJournalLooked(storyOf(store.get()), road) });
      const fresh = tab !== 'story' && journalHasNew(storyOf(store.get()), road);
      const tabs = el('div', 'display:flex;gap:4px;margin:2px 0 6px');
      const storyTab = shopTab('Story', tab === 'story', () => {
        tab = 'story';
        panel.refresh(true);
      });
      if (fresh) {
        storyTab.style.position = 'relative';
        storyTab.append(el('span', `position:absolute;top:6px;right:8px;width:8px;height:8px;background:${COLORS.gold};border:2px solid ${COLORS.outline}`));
        storyTab.setAttribute('aria-label', 'Story, new page');
      }
      tabs.append(
        shopTab('Quests', tab === 'quests', () => {
          tab = 'quests';
          panel.refresh(true);
        }),
        storyTab,
      );
      pinned.append(tabs);
      if (tab === 'story') {
        const entries = journalEntries(storyOf(store.get()), road);
        if (entries.length === 0) {
          body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};padding:6px 0`, 'No pages yet. Watch the lake for bottles and odd things.'));
          return;
        }
        const names = store.names();
        entries.forEach((e) => body.append(journalRow(e, names)));
        const close = el('div', 'margin-top:10px');
        close.append(woodButton('Close', () => panel.close(), { variant: 'wood' }));
        body.append(close);
        return;
      }
      const p = store.get();
      const quests = questsOf(p);
      const today = store.today();
      const act = (next: PlayerState) => {
        store.set(next);
        panel.refresh();
      };
      // The checklist entry sits right under the tabs so it never hides below the quests (fix/board-and-car).
      const cl = store.checklist();
      const clRow = el('div', 'margin:2px 0 8px');
      const clBtn = woodButton(`Quiet Lake checklist ${cl.done}/${cl.total}`, () => {
        panel.close();
        store.openChecklist();
      }, { variant: 'wood' });
      clBtn.style.width = '100%';
      clRow.append(clBtn);
      body.append(clRow);
      const fid = store.fotdId();
      const frow = fid ? fotdRow(fid) : undefined;
      if (frow) body.append(frow);
      // Daily quests: a foldable section. Folded by default once all of today's are claimed; her own toggle wins for the session.
      const claimed = quests.list.filter((q) => q.claimed).length;
      const ready = quests.list.some((q) => q.done && !q.claimed);
      const head = el(
        'button',
        `display:flex;align-items:center;gap:8px;width:100%;min-height:44px;margin-top:6px;padding:0 10px;box-sizing:border-box;border:2px solid ${COLORS.outline};background:${COLORS.woodLight};cursor:pointer;text-align:left;font-family:inherit;font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`,
      );
      head.type = 'button';
      head.setAttribute('aria-expanded', String(!folded));
      head.append(el('span', `color:${COLORS.gold}`, folded ? '>' : 'v'), el('span', 'flex:1', `Daily quests (${claimed}/${quests.list.length})`));
      if (ready) head.append(el('span', `color:${COLORS.gold}`, 'Claim!'));
      head.addEventListener('click', () => {
        folded = !folded;
        foldChoice = folded;
        panel.refresh();
      });
      body.append(head);
      if (!folded) {
        if (quests.list.length === 0) {
          body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};padding:6px 0`, 'No quests today.'));
        }
        quests.list.forEach((_, i) => body.append(questRow(p, i, today, act)));
        const rerollNote = quests.list.some((_, i) => canReroll(quests, i, today)) ? '1 free reroll today' : quests.rerollUsed ? 'Reroll used today' : '';
        if (rerollNote) body.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream};margin-top:8px`, rerollNote));
        body.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.dim};margin-top:${rerollNote ? 2 : 8}px`, 'New quests at midnight'));
      }
      // Rumours (slice 23d): the half-hints of the rare fish she has not caught yet, pinned as one more note.
      const rumours = unknownHints(p.log);
      if (rumours.length > 0) {
        const note = el('div', `margin-top:12px;padding:8px;border:2px solid ${COLORS.woodLight};background:${COLORS.outline}`);
        note.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.gold};margin-bottom:4px`, 'Rumours'));
        for (const h of rumours) note.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream};padding:2px 0`, `- ${h.text}`));
        body.append(note);
      }
      const close = el('div', 'margin-top:10px');
      close.append(woodButton('Close', () => panel.close(), { variant: 'wood' }));
      body.append(close);
    },
    onClose,
    true,
    () => (tab === 'story' ? `Chapter ${journalChapterCount(storyOf(store.get()), store.roadFixed())} of ${JOURNAL_TOTAL}` : ''),
  );
  return panel;
}
