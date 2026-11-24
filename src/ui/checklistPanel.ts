import { FONT, FS, LINE } from '../font';
import { fishIconSprite } from '../art/fishArt';
import { coinSprite } from '../art/iconArt';
import { CHECKLIST, CHECKLIST_TITLE, type ChecklistBundle, type ChecklistSlot } from '../core/data/checklist';
import { speciesById } from '../core/data/fish';
import {
  allDone, bundleDone, bundleTotal, canFill, checklistRewardText, doneCount, giveFish, payCoins, slotFilled, type HandIn,
} from '../core/checklist/checklist';
import type { PlayerStore } from './bagShop';
import { fishCanvas } from './logPanel';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';
import { spriteCanvas } from './spriteCanvas';
import { starRow } from './starRow';

/** What the panel needs: the player, and a call when a hand-in finished a bundle (reward toast, all-done card). */
export interface ChecklistStore extends PlayerStore {
  onHandIn(result: HandIn, bundle: ChecklistBundle, allFixed: boolean): void;
}

const TICK = '✓';

function tick(done: boolean): HTMLElement {
  return el('span', `flex:none;width:20px;text-align:center;font-size:${FS.body}px;color:${done ? COLORS.gold : COLORS.dim}`, done ? TICK : '○');
}

/** What an open slot asks for: its picture and its words. */
function slotLook(slot: ChecklistSlot): { pic: HTMLElement; text: string } {
  const pic = el('div', 'flex:none;width:38px;display:flex;align-items:center;justify-content:center');
  if (slot.kind === 'species') {
    pic.append(fishCanvas(fishIconSprite(slot.id), 38, 2));
    return { pic, text: speciesById(slot.id)?.name ?? slot.id };
  }
  if (slot.kind === 'star') {
    const row = starRow(slot.min, 2);
    if (row) pic.append(row);
    pic.style.width = '58px';
    return { pic, text: slot.min === 'gold' ? 'any gold fish' : 'any fish, silver or better' };
  }
  pic.append(spriteCanvas(coinSprite(), 32));
  return { pic, text: `${slot.amount} coins` };
}

function slotRow(store: ChecklistStore, bundle: ChecklistBundle, i: number, act: (r: HandIn) => void): HTMLElement {
  const p = store.get();
  const slot = bundle.slots[i];
  const filled = slotFilled(p, bundle.id, i);
  const row = el('div', `display:flex;align-items:center;gap:6px;padding:4px 0;${filled ? 'opacity:0.6' : ''}`);
  const look = slotLook(slot);
  const label = el('div', `flex:1;min-width:0;font-size:${FS.body}px;line-height:${LINE};color:${filled ? COLORS.cream : COLORS.text}`, look.text);
  row.append(tick(filled), look.pic, label);
  if (!filled) {
    const isCoins = slot.kind === 'coins';
    const ok = canFill(p, bundle.id, i);
    const btn = woodButton(
      isCoins ? 'Pay' : 'Give',
      () => act(isCoins ? payCoins(store.get(), bundle.id, i) : giveFish(store.get(), bundle.id, i)),
      { small: true, sfx: isCoins ? 'coin' : 'tap', ...(ok ? {} : { disabledReason: '' }) },
    );
    btn.style.minWidth = '56px';
    row.append(btn);
  }
  return row;
}

function bundleSection(store: ChecklistStore, bundle: ChecklistBundle, act: (r: HandIn, b: ChecklistBundle) => void): HTMLElement {
  const p = store.get();
  const done = bundleDone(p, bundle.id);
  const box = el('div', `padding:8px 0;border-bottom:2px solid ${COLORS.woodLight}`);
  const head = el('div', 'display:flex;align-items:center;gap:6px');
  head.append(
    el('div', `flex:1;min-width:0;font:${FS.body}px/${LINE} ${FONT};color:${done ? COLORS.gold : COLORS.text}`, bundle.name),
    ...(done ? [el('div', `flex:none;font-size:${FS.body}px;color:${COLORS.gold}`, `${TICK} Done`)] : []),
  );
  box.append(head, el('div', `font-size:${FS.small}px;line-height:${LINE};color:#b9a589;font-style:italic`, bundle.flavour));
  const reward = checklistRewardText(bundle.reward);
  box.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.gold};margin-bottom:2px`, reward ? `Reward: ${reward}` : 'No reward, just the road'));
  bundle.slots.forEach((_, i) => box.append(slotRow(store, bundle, i, (r) => act(r, bundle))));
  return box;
}

/** The card for the last bundle: the road to the river is fixed. */
export function showRoadFixedCard(onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    'Road fixed!',
    (body) => {
      const lines = ['The road to the river is fixed.', 'Pajkel packs the car.', 'Bestia packs a stick.'];
      for (const t of lines) body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text};padding:2px 0`, t));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}

/** "The Doorstep": the Quiet Lake checklist. Hand in fish (or coins) per slot; the scene hears about finished bundles. */
export function showChecklistPanel(store: ChecklistStore, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    CHECKLIST_TITLE,
    (body) => {
      const p = store.get();
      body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream}`, `${doneCount(p)}/${bundleTotal} bundles`));
      const act = (r: HandIn, b: ChecklistBundle) => {
        if (!r.ok) return;
        store.set(r.player);
        store.onHandIn(r, b, allDone(r.player));
        panel.refresh();
      };
      for (const b of CHECKLIST) body.append(bundleSection(store, b, act));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:10px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}
