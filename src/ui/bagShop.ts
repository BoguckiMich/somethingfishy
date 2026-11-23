import { FONT, FS, LINE } from '../font';
import { speciesById } from '../core/data/fish';
import { SHOP } from '../core/data/shop';
import { RODS } from '../core/data/rods';
import type { Line, Reel } from '../core/gear';
import {
  bagValue,
  buyLine,
  buyReel,
  buyRod,
  buyWorms,
  equippedLine,
  equippedReel,
  freeWormsIfStuck,
  nextLine,
  nextReel,
  nextRod,
  sellAll,
  sellOne,
  type BagFish,
  type Outcome,
  type PlayerState,
} from '../core/inventory';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** The player state lives in the scene; panels read it and write it back through this. */
export interface PlayerStore {
  get(): PlayerState;
  set(p: PlayerState): void;
}

export const fishName = (f: BagFish): string => speciesById(f.speciesId)?.name ?? f.speciesId;
const sizeText = (f: BagFish): string => `${f.lengthCm} cm`;

const sectionTitle = (text: string) =>
  el('div', `font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold};margin:12px 0 6px;border-bottom:2px solid ${COLORS.woodLight};padding-bottom:3px`, text);

function fishRow(f: BagFish, action?: HTMLElement): HTMLElement {
  const row = el('div', `display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid ${COLORS.woodLight}`);
  const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px`);
  info.append(el('div', `color:${COLORS.text}`, fishName(f)), el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, `${sizeText(f)} · ${f.weightG} g`));
  row.append(info, el('div', `font-size:${FS.body}px;color:${COLORS.gold};white-space:nowrap`, `${f.price} coins`));
  if (action) row.append(action);
  return row;
}

/** A shop row for a line or reel: what she has, the next one with its price and effect, and a Buy button. */
function tackleRow(
  kind: 'Line' | 'Reel',
  owned: Line | Reel | undefined,
  next: Line | Reel | undefined,
  coins: number,
  buy: () => void,
  refresh: () => void,
): HTMLElement {
  const row = el('div', `display:flex;flex-direction:column;gap:6px;padding:6px 0;border-bottom:1px solid ${COLORS.woodLight}`);
  const have = owned ? owned.name : `No ${kind.toLowerCase()} yet`;
  if (!next) {
    row.append(el('div', `font-size:${FS.body}px;color:${COLORS.gold}`, `${have} (best owned)`));
    return row;
  }
  const info = el('div', `font-size:${FS.body}px`);
  info.append(
    el('div', '', `${next.name}, ${next.price} coins`),
    el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, `${next.effect}. You have: ${have}`),
  );
  const missing = Math.max(0, next.price - coins);
  row.append(
    info,
    woodButton('Buy', () => {
      buy();
      refresh();
    }, { disabledReason: missing ? `need ${missing} more` : undefined, sfx: 'coin' }),
  );
  return row;
}

const emptyNote =(text: string) => el('div', `font-size:${FS.body}px;color:${COLORS.cream};padding:6px 0`, text);

/** The bag: what she caught, its size and price, and the total value. */
export function openBagPanel(store: PlayerStore, onClose: () => void): PanelHandle {
  return openPanel(
    `Bag (${store.get().bag.length}/${SHOP.bagSlots})`,
    (body) => {
      const { bag } = store.get();
      if (bag.length === 0) body.append(emptyNote('The bag is empty. Go catch something!'));
      for (const f of bag) body.append(fishRow(f));
      body.append(el('div', `margin-top:10px;font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold};text-align:right`, `Total value: ${bagValue(bag)} coins`));
    },
    onClose,
  );
}

/** The shop: sell fish, buy worms, buy the next rod. */
export function openShopPanel(store: PlayerStore, onClose: () => void): PanelHandle {
  let ownerNote = '';
  const apply = (r: Outcome) => store.set(r.state);
  const panel: PanelHandle = openPanel(
    'Shop',
    (body) => {
      // Soft-lock guard: runs every time the shop is (re)drawn.
      const guard = freeWormsIfStuck(store.get());
      if (guard.granted) {
        store.set(guard.state);
        ownerNote = 'The bait shop owner slips you a few worms';
      }
      const p = store.get();
      body.append(el('div', `font-size:${FS.body}px;color:${COLORS.cream}`, `Coins: ${p.coins}   Worms: ${p.worms}`));
      if (ownerNote) body.append(el('div', `font-size:${FS.body}px;color:${COLORS.gold};margin-top:6px`, ownerNote));

      body.append(sectionTitle('Sell'));
      if (p.bag.length === 0) body.append(emptyNote('Nothing to sell.'));
      p.bag.forEach((f, i) => {
        body.append(
          fishRow(
            f,
            woodButton('Sell', () => {
              apply(sellOne(store.get(), i));
              panel.refresh();
            }, { small: true, sfx: 'coin' }),
          ),
        );
      });
      if (p.bag.length > 0) {
        const all = woodButton(`Sell all (+${bagValue(p.bag)} coins)`, () => {
          apply(sellAll(store.get()));
          panel.refresh();
        }, { sfx: 'coin' });
        all.style.cssText += ';width:100%;margin-top:8px';
        body.append(all);
      }

      body.append(sectionTitle('Worms'));
      const wormLine = el('div', 'display:flex;align-items:center;gap:8px');
      wormLine.append(el('div', `flex:1;font-size:${FS.body}px`, `${SHOP.wormPackSize} worms, ${SHOP.wormPackPrice} coins`));
      const missing = p.coins < SHOP.wormPackPrice ? SHOP.wormPackPrice - p.coins : 0;
      wormLine.append(
        woodButton('Buy', () => {
          apply(buyWorms(store.get()));
          panel.refresh();
        }, { disabledReason: missing ? `need ${missing} more` : undefined, sfx: 'coin' }),
      );
      body.append(wormLine);

      body.append(sectionTitle('Rods'));
      const rod = nextRod(p);
      const current = RODS.find((r) => r.id === p.rodId) ?? RODS[0];
      body.append(el('div', `font-size:${FS.small}px;color:${COLORS.cream};margin-bottom:4px`, `You have: ${current.name} (${current.maxCastM} m, zone ${Math.round(current.barGear.zoneSize * 100)}%)`));
      if (!rod) {
        body.append(el('div', `font-size:${FS.body}px;color:${COLORS.gold}`, 'Best rod owned'));
      } else {
        const line = el('div', 'display:flex;flex-direction:column;gap:8px');
        const info = el('div', `font-size:${FS.body}px`);
        info.append(
          el('div', '', `${rod.name}, ${rod.price} coins`),
          el('div', `font-size:${FS.small}px;color:${COLORS.cream}`, `Reach ${current.maxCastM} to ${rod.maxCastM} m${rod.maxCastM > 15 && current.maxCastM <= 15 ? ' (deep water)' : ''}, catch zone ${Math.round(current.barGear.zoneSize * 100)}% to ${Math.round(rod.barGear.zoneSize * 100)}%`),
        );
        const rodMissing = Math.max(0, rod.price - p.coins);
        line.append(
          info,
          woodButton('Buy', () => {
            apply(buyRod(store.get()));
            panel.refresh();
          }, { disabledReason: rodMissing ? `need ${rodMissing} more` : undefined, sfx: 'coin' }),
        );
        body.append(line);
      }

      // Lines and reels (slice 15a): one row each, the next item up, bought in order.
      body.append(sectionTitle('Line and reel'));
      body.append(
        tackleRow('Line', equippedLine(p), nextLine(p), p.coins, () => apply(buyLine(store.get())), () => panel.refresh()),
        tackleRow('Reel', equippedReel(p), nextReel(p), p.coins, () => apply(buyReel(store.get())), () => panel.refresh()),
      );
    },
    onClose,
  );
  return panel;
}
