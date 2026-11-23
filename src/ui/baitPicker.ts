import { FS, LINE } from '../font';
import { wormSprite } from '../art/iconArt';
import { shopIconSprite } from '../art/shopIconArt';
import { WORM_ID, baitById } from '../core/data/baits';
import { chooseBait, chosenBait, ownedBaits } from '../core/inventory';
import { sound } from '../audio/sound';
import type { PlayerStore } from './bagShop';
import { installFrameStyles } from './frames';
import { COLORS, el, openPanel, type PanelHandle } from './panel';
import { spriteCanvas } from './spriteCanvas';

const WORM_EFFECT = 'Catches everything';

/** The bait picker (slice 15c): worms plus every bait she has, each with icon, name, count and effect. A tap chooses it and closes the card. */
export function openBaitPicker(store: PlayerStore, onClose: () => void): PanelHandle {
  installFrameStyles();
  const panel: PanelHandle = openPanel(
    'Choose bait',
    (body) => {
      const p = store.get();
      const current = chosenBait(p);
      for (const { id, count } of ownedBaits(p)) {
        const bait = baitById(id);
        const name = bait?.name ?? 'Worms';
        const effect = bait?.effect ?? WORM_EFFECT;
        const usable = count > 0;
        const on = id === current;
        const row = el(
          'div',
          [
            'display:flex;align-items:center;gap:8px;padding:6px;margin-bottom:6px;box-sizing:border-box',
            `background:${on ? COLORS.woodLight : COLORS.wood}`,
            `border:2px solid ${on ? COLORS.gold : COLORS.outline}`,
            `cursor:${usable ? 'pointer' : 'default'}`,
            usable ? '' : 'opacity:0.5',
          ].join(';'),
        );
        row.setAttribute('role', 'button');
        row.dataset.baitId = id;
        const icon = id === WORM_ID ? wormSprite() : shopIconSprite(id);
        const slot = el('div', 'flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center');
        if (icon) slot.append(spriteCanvas(icon, 32));
        const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px;line-height:${LINE}`);
        info.append(
          el('div', `color:${on ? COLORS.gold : COLORS.text}`, name),
          el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.cream}`, usable ? effect : 'None left'),
        );
        row.append(slot, info, el('div', `flex:none;font-size:${FS.heading}px;color:${COLORS.cream}`, String(count)));
        if (usable) {
          row.addEventListener('click', () => {
            const r = chooseBait(store.get(), id);
            if (!r.ok) return;
            sound.play('tap');
            store.set(r.state);
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
