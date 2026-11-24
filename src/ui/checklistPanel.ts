import { FONT, FS, LINE } from '../font';
import { fishIconSprite } from '../art/fishArt';
import { coinSprite } from '../art/iconArt';
import { CHECKLIST_TITLE, type ChecklistBundle, type ChecklistSlot } from '../core/data/checklist';
import { speciesById } from '../core/data/fish';
import { starFor } from '../core/data/stars';
import {
  allDone, bundleDone, bundleTotal, canFill, checklistOrder, checklistOf, checklistRewardText, doneCount, firstOpenBundle, giveFish, giveWarning,
  payCoins, slotBlockReason, slotFilled, type HandIn,
} from '../core/checklist/checklist';
import type { PlayerStore } from './bagShop';
import { fishCanvas } from './logPanel';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';
import { rewardIcons, rewardLine } from './rewardLine';
import { spriteCanvas } from './spriteCanvas';
import { starRow } from './starRow';

/** What the panel needs: the player, today's fish (for the Give warning), and a call when a hand-in finished a bundle (reward toast, all-done card). */
export interface ChecklistStore extends PlayerStore {
  onHandIn(result: HandIn, bundle: ChecklistBundle, allFixed: boolean): void;
  /** Today's fish of the day, if any. */
  fotdId?(): string | undefined;
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
  const label = el('div', `flex:1;min-width:0;font-size:${FS.body}px;line-height:${LINE};color:${filled ? COLORS.cream : COLORS.text}`);
  label.append(el('div', '', look.text));
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
    // A disabled button says why; Give says which fish it would take when that is a gold one or the fish of the day.
    const why = slotBlockReason(p, bundle.id, i);
    if (why) label.append(el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.dim}`, why[0].toUpperCase() + why.slice(1)));
    const warn = giveWarning(p, bundle.id, i, store.fotdId?.());
    if (warn) {
      const line = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:2px 5px;font-size:${FS.small}px;line-height:1.1;color:${COLORS.amber}`, warn.text);
      const sp = speciesById(warn.fish.speciesId);
      const stars = warn.gold && sp ? starRow(starFor(sp, warn.fish.lengthCm), 1) : undefined;
      if (stars) line.append(stars);
      label.append(line);
    }
  }
  return row;
}

/** Slot dots for a bundle: filled gold squares and open dim ones. */
function slotDots(filled: boolean[]): HTMLElement {
  const dots = el('div', 'display:flex;align-items:center;gap:3px;flex:none');
  for (const f of filled) {
    dots.append(el('div', `width:10px;height:10px;box-sizing:border-box;border:2px solid ${f ? COLORS.goldShade : COLORS.dim};background:${f ? COLORS.gold : 'transparent'}`));
  }
  return dots;
}

/** A bundle as an accordion row: a 48 px header (name, slot dots, reward icons), and when open its flavour, reward and slots. */
function bundleSection(
  store: ChecklistStore,
  bundle: ChecklistBundle,
  open: boolean,
  toggle: () => void,
  act: (r: HandIn, b: ChecklistBundle) => void,
): HTMLElement {
  const p = store.get();
  const done = bundleDone(p, bundle.id);
  const box = el('div', `border-bottom:2px solid ${COLORS.woodLight}`);
  const head = el(
    'button',
    `display:flex;align-items:center;gap:8px;width:100%;min-height:48px;box-sizing:border-box;padding:0;border:0;background:none;cursor:pointer;text-align:left;font:${FS.body}px/${LINE} ${FONT};color:${done ? COLORS.gold : COLORS.text}`,
  );
  head.type = 'button';
  head.setAttribute('aria-expanded', String(open));
  const left = el('div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:4px 0');
  left.append(el('div', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', bundle.name));
  head.append(left);
  if (done) {
    head.append(el('div', `flex:none;font-size:${FS.body}px;color:${COLORS.gold}`, TICK));
  } else {
    left.append(slotDots(checklistOf(p)[bundle.id]));
    head.append(rewardIcons(bundle.reward));
  }
  head.addEventListener('click', toggle);
  box.append(head);
  if (open) {
    const inner = el('div', 'padding:0 0 6px');
    inner.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:#b9a589;font-style:italic`, bundle.flavour));
    const reward = el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.gold};margin-bottom:2px;display:flex;align-items:center;gap:6px`);
    if (checklistRewardText(bundle.reward)) reward.append('Reward:', rewardLine(bundle.reward));
    else reward.append('No reward, just the road');
    inner.append(reward);
    bundle.slots.forEach((_, i) => inner.append(slotRow(store, bundle, i, (r) => act(r, bundle))));
    box.append(inner);
  }
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

/**
 * "The Doorstep": the Quiet Lake checklist. One 48 px row per bundle (accordion: one open at a time, the first one she
 * can give to opens first, finished ones sink with a tick). Hand in fish (or coins) per slot; the scene hears about
 * finished bundles.
 */
export function showChecklistPanel(store: ChecklistStore, onClose: () => void): PanelHandle {
  let open: string | undefined = firstOpenBundle(store.get());
  const panel: PanelHandle = openPanel(
    CHECKLIST_TITLE,
    (body) => {
      const p = store.get();
      const act = (r: HandIn, b: ChecklistBundle) => {
        if (!r.ok) return;
        store.set(r.player);
        store.onHandIn(r, b, allDone(r.player));
        if (r.finished) open = firstOpenBundle(r.player);
        panel.refresh();
      };
      for (const b of checklistOrder(p)) {
        body.append(
          bundleSection(store, b, open === b.id, () => {
            open = open === b.id ? undefined : b.id;
            panel.refresh();
          }, act),
        );
      }
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:10px');
      col.append(woodButton('Close', () => panel.close(), { variant: 'wood' }));
      body.append(col);
    },
    onClose,
    true,
    () => `Quiet Lake checklist · ${doneCount(store.get())}/${bundleTotal}`,
  );
  return panel;
}
