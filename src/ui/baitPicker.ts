import { FS, LINE } from '../font';
import { wormSprite } from '../art/iconArt';
import { shopIconSprite } from '../art/shopIconArt';
import { WORM_ID, baitById } from '../core/data/baits';
import { activeRig, chooseBait, chooseFloatRig, chooseLure, chosenBait, chosenLure, hasSpinRod, ownedBaits, ownedLures } from '../core/inventory';
import { sound } from '../audio/sound';
import { shopTab, type PlayerStore } from './bagShop';
import { installFrameStyles } from './frames';
import { COLORS, el, openPanel, type PanelHandle } from './panel';
import type { Sprite } from '../art/pixelGrid';
import { spriteCanvas } from './spriteCanvas';

const WORM_EFFECT = 'Catches everything';

/**
 * The rig picker (slice 15c, rig tabs in slice 32): Float lists the worms and every bait she has; Spin lists the lures she owns, with counts (the
 * tab only exists once she owns the spinning rod). A tap chooses the bait or lure, switches to that rig and closes the card.
 */
export function openRigPicker(store: PlayerStore, onClose: () => void): PanelHandle {
  installFrameStyles();
  let tab: 'float' | 'spin' = activeRig(store.get()) === 'spin' ? 'spin' : 'float';
  const panel: PanelHandle = openPanel(
    'Choose rig',
    (body, pinned) => {
      const p = store.get();
      if (!hasSpinRod(p)) tab = 'float';
      if (hasSpinRod(p)) {
        const tabs = el('div', 'display:flex;gap:4px;margin:0 0 6px');
        tabs.append(
          shopTab('Float', tab === 'float', () => {
            tab = 'float';
            panel.refresh(true);
          }),
          shopTab('Spin', tab === 'spin', () => {
            tab = 'spin';
            panel.refresh(true);
          }),
        );
        pinned.append(tabs);
      }
      if (tab === 'spin') {
        spinRows(body, store, () => panel.close()); // `panel` is not assigned yet on the first build
        return;
      }
      const current = activeRig(p) === 'float' ? chosenBait(p) : undefined;
      for (const { id, count } of ownedBaits(p)) {
        const bait = baitById(id);
        const name = bait?.name ?? 'Worms';
        const effect = bait?.short ?? bait?.effect ?? WORM_EFFECT;
        const usable = count > 0;
        const row = pickRow(id, id === WORM_ID ? wormSprite() : shopIconSprite(id), name, usable ? effect : 'None left', count, id === current, usable);
        if (usable) {
          row.addEventListener('click', () => {
            const r = chooseBait(store.get(), id);
            if (!r.ok) return;
            sound.play('tap');
            store.set(chooseFloatRig(r.state));
            panel.close();
          });
        }
        body.append(row);
      }
      body.append(el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.dim};margin-top:4px`, 'Bait is used up one per catch. When it runs out, worms are used.'));
    },
    onClose,
  );
  return panel;
}

/** One picker row: icon, name, a small line under it, and the count. */
function pickRow(id: string, icon: Sprite | undefined, name: string, effect: string, count: number, on: boolean, usable: boolean): HTMLElement {
  const row = el(
    'div',
    [
      'display:flex;align-items:center;gap:8px;padding:6px 4px;box-sizing:border-box',
      `border-bottom:1px solid ${COLORS.woodLight}`,
      `background:${on ? COLORS.woodLight : 'transparent'}`,
      `box-shadow:${on ? `inset 3px 0 ${COLORS.gold}` : 'none'}`,
      `cursor:${usable ? 'pointer' : 'default'}`,
      usable ? '' : 'opacity:0.5',
    ].join(';'),
  );
  row.setAttribute('role', 'button');
  row.dataset.baitId = id;
  const slot = el('div', 'flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center');
  if (icon) slot.append(spriteCanvas(icon, 32));
  const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px;line-height:${LINE}`);
  info.append(el('div', `color:${on ? COLORS.gold : COLORS.text}`, name), el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.cream}`, effect));
  row.append(slot, info, el('div', `flex:none;font-size:${FS.heading}px;color:${COLORS.cream}`, String(count)));
  return row;
}

/** The Spin tab: the lures she owns (shop order), the chosen one marked when the spinning rig is on. */
function spinRows(body: HTMLElement, store: PlayerStore, close: () => void): void {
  const p = store.get();
  const owned = ownedLures(p);
  if (owned.length === 0) {
    body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};padding:6px 0`, 'No lures yet. The River bend shop sells them.'));
    return;
  }
  const current = activeRig(p) === 'spin' ? chosenLure(p) : undefined;
  for (const { lure, count } of owned) {
    const row = pickRow(lure.id, shopIconSprite(lure.id), lure.name, lure.effect, count, lure.id === current, true);
    row.addEventListener('click', () => {
      const r = chooseLure(store.get(), lure.id);
      if (!r.ok) return;
      sound.play('tap');
      store.set(r.state);
      close();
    });
    body.append(row);
  }
  body.append(el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.dim};margin-top:4px`, 'Hold to reel, let go to pause. A lure is kept until it is lost.'));
}
