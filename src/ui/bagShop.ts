import { FONT, FS, LINE } from '../font';
import { fishSizeClass, fishSprite } from '../art/fishArt';
import { coinSprite, lockSprite, wormSprite } from '../art/iconArt';
import { shopIconSprite } from '../art/shopIconArt';
import type { Sprite } from '../art/pixelGrid';
import { SHOP_BAITS } from '../core/data/baits';
import { speciesById } from '../core/data/fish';
import { SHOP } from '../core/data/shop';
import { sold } from '../core/data/shopStock';
import { QUIET_LAKE } from '../core/data/locations';
import type { Location } from '../core/location';
import { bagTier } from '../core/data/stars';
import { RODS } from '../core/data/rods';
import { NIGHT_KIT } from '../core/data/nightKit';
import { CAMP_ITEMS } from '../core/data/camp';
import { tr } from '../i18n/en';
import { buyCampItem, hasCamp } from '../core/camp';
import type { Line, Reel, Rod } from '../core/gear';
import { gateText, gearUnlocked } from '../core/gearGates';
import {
  bagValue,
  baitCount,
  buyBait,
  buyLine,
  buyNightKit,
  hasNightKit,
  nightKitForSale,
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
  shopStartTab,
  type BagFish,
  type Outcome,
  type PlayerState,
} from '../core/inventory';
import { sound } from '../audio/sound';
import { fishBoxCanvas } from './logPanel';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';
import { installFrameStyles } from './frames';
import { spriteCanvas } from './spriteCanvas';
import { starRow } from './starRow';

/** The player state lives in the scene; panels read it and write it back through this. */
export interface PlayerStore {
  get(): PlayerState;
  set(p: PlayerState): void;
}

export const fishName = (f: BagFish): string => speciesById(f.speciesId)?.name ?? f.speciesId;
const sizeText = (f: BagFish): string => `${f.lengthCm} cm`;

const sectionTitle = (text: string) =>
  el('div', `font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold};margin:12px 0 6px;border-bottom:2px solid ${COLORS.woodLight};padding-bottom:3px`, text);

/** A number with the small coin icon in front (prices, purse, totals). */
export function coinAmount(n: number | string, color: string = COLORS.gold): HTMLElement {
  const box = el('span', `display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-size:${FS.body}px;color:${color}`);
  box.append(spriteCanvas(coinSprite(), 16), el('span', '', String(n)));
  return box;
}

/** Puts "prefix <coin> amount" on a button (woodButton only takes plain text). */
function coinButtonLabel(button: HTMLButtonElement, prefix: string, n: number): void {
  button.style.cssText += ';display:inline-flex;align-items:center;justify-content:center;gap:4px';
  button.replaceChildren(prefix, spriteCanvas(coinSprite(), 16), String(n));
}

function fishRow(f: BagFish, action?: HTMLElement): HTMLElement {
  const row = el('div', `display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid ${COLORS.woodLight}`);
  const pic = fishBoxCanvas(fishSprite(f.speciesId, fishSizeClass(f.speciesId, f.lengthCm)), 32);
  const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px`);
  const sp = speciesById(f.speciesId);
  const stars = sp ? starRow(bagTier(f), 2) : undefined;
  const size = el('div', `display:flex;flex-wrap:wrap;align-items:center;column-gap:5px;font-size:${FS.small}px;color:${COLORS.cream}`, `${sizeText(f)} · ${f.weightG}g`);
  if (stars) size.append(stars);
  info.append(el('div', `color:${COLORS.text}`, fishName(f)), size);
  row.append(pic, info, coinAmount(f.price));
  if (action) row.append(action);
  return row;
}

// ---- Icons, cards, the tackle strip ---------------------------------------------------------

/** The item that just got bought: its icon pops the next time it is drawn (consumed on use). */
let popId: string | undefined;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A small pop (scale up and back, ~250 ms) with a few sparkle pixels flying out. Skipped for reduced motion. */
function popIcon(slot: HTMLElement): void {
  if (reducedMotion() || typeof slot.animate !== 'function') return;
  slot.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'ease-out' });
  const dirs: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4], [1.4, 0]];
  dirs.forEach(([dx, dy], i) => {
    const spark = el('div', `position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;pointer-events:none;background:${i % 2 ? COLORS.gold : COLORS.text}`);
    slot.append(spark);
    const a = spark.animate(
      [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx * 30}px,${dy * 30}px)`, opacity: 0 }],
      { duration: 400, easing: 'ease-out' },
    );
    a.onfinish = () => spark.remove();
  });
}

/** A framed wood slot holding a shop icon (`px` is the icon size, a multiple of 16). `dim` greys it a little. */
function iconSlot(id: string, px: number, dim = false): HTMLElement {
  installFrameStyles();
  const slot = el('div', `position:relative;flex:none;box-sizing:border-box;width:${px + 8}px;height:${px + 8}px;display:flex;align-items:center;justify-content:center;background:${COLORS.woodLight}`);
  slot.className = 'rb-box';
  slot.dataset.itemId = id;
  const sprite: Sprite | undefined = shopIconSprite(id);
  if (sprite) {
    const c = spriteCanvas(sprite, px);
    if (dim) c.style.cssText += ';opacity:0.65';
    slot.append(c);
  }
  if (popId === id) {
    popId = undefined;
    requestAnimationFrame(() => popIcon(slot));
  }
  return slot;
}

interface CardOptions {
  id: string;
  name: string;
  /** Price in coins; omit for an item that is already owned. */
  price?: number;
  effect: string;
  /** What is shown in place of the Buy button (e.g. "Best owned"). */
  note?: string;
  coins: number;
  buy?: () => void;
  /** A locked card: dimmed icon and a disabled button saying what is missing (e.g. "Needs the Fiberglass Rod"). */
  locked?: string;
  /** A checklist gate (slice 23a): greyed card, a lock and what is missing, no button and no price button. */
  gate?: string;
}

/** A shop card: icon slot on the left, name + price + effect beside it, the Buy button underneath. */
function itemCard(o: CardOptions): HTMLElement {
  const missing = o.price === undefined ? 0 : Math.max(0, o.price - o.coins);
  if (o.gate) return gateCard(o, o.gate);
  const card = el('div', `display:flex;flex-direction:column;gap:6px;padding:6px 0;border-bottom:1px solid ${COLORS.woodLight}`);
  const top = el('div', 'display:flex;gap:8px;align-items:flex-start');
  const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px`);
  info.append(el('div', `color:${COLORS.text}`, tr(o.name)));
  if (o.price !== undefined) info.append(coinAmount(o.price));
  if (o.note) info.append(el('div', `color:${COLORS.gold}`, o.note));
  info.append(el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.cream};margin-top:2px`, tr(o.effect)));
  top.append(iconSlot(o.id, 48, missing > 0 || o.locked !== undefined), info);
  card.append(top);
  if (o.locked !== undefined) {
    const b = woodButton(o.locked, () => undefined, { disabledReason: '' });
    b.style.cssText += ';width:100%';
    card.append(b);
  } else if (o.buy) {
    const buy = o.buy;
    const b = woodButton('Buy', buy, { disabledReason: missing ? `need ${missing} more` : undefined, sfx: 'coin' });
    b.style.cssText += ';width:100%';
    card.append(b);
  }
  return card;
}

/** A card for an item behind the checklist: dim icon, price in dim, a lock line, no Buy button. */
function gateCard(o: CardOptions, gate: string): HTMLElement {
  const card = el('div', `display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid ${COLORS.woodLight};opacity:0.8`);
  card.dataset.locked = o.id;
  const info = el('div', `flex:1;min-width:0;font-size:${FS.body}px`);
  info.append(el('div', `color:${COLORS.dim}`, tr(o.name)));
  if (o.price !== undefined) info.append(coinAmount(o.price, COLORS.dim));
  info.append(el('div', `font-size:${FS.small}px;line-height:1.1;color:${COLORS.dim};margin-top:2px`, tr(o.effect)));
  const lock = el('div', `display:flex;align-items:flex-start;gap:4px;margin-top:4px;font-size:${FS.small}px;line-height:1.1;color:${COLORS.cream}`);
  lock.append(
    spriteCanvas(lockSprite(), 16),
    el('span', '', gate),
  );
  info.append(lock);
  card.append(iconSlot(o.id, 48, true), info);
  return card;
}

/** One entry of "Your tackle": a small icon and the item's name, or a dim empty slot. */
function tackleEntry(owned: { id: string; name: string } | undefined, emptyText: string): HTMLElement {
  const row = el('div', 'display:flex;align-items:center;gap:8px;padding:2px 0');
  if (owned) {
    row.append(iconSlot(owned.id, 32), el('div', `font-size:${FS.body}px;color:${COLORS.text}`, owned.name));
  } else {
    const empty = el('div', 'flex:none;box-sizing:border-box;width:40px;height:40px;background:#2a1a12');
    empty.className = 'rb-box';
    row.append(empty, el('div', `font-size:${FS.body}px;color:${COLORS.dim}`, emptyText));
  }
  return row;
}

/** A rod's red core as a share of its catch zone: "20%" (slice 23f). */
const coreText = (rod: Rod): string => `${Math.round((rod.barGear.coreShare ?? 0) * 100)}%`;

const rodEffect = (current: Rod, next: Rod): string =>
  `Reach ${current.maxCastM} to ${next.maxCastM} m${next.maxCastM > 15 && current.maxCastM <= 15 ? ' (deep water)' : ''}, catch zone ${Math.round(current.barGear.zoneSize * 100)}% to ${Math.round(next.barGear.zoneSize * 100)}%, red core ${coreText(current)} to ${coreText(next)}`;

/** A card for a line or reel: the next one up with price and effect, or the best one owned. */
function tackleCard(
  owned: Line | Reel | undefined,
  next: Line | Reel | undefined,
  coins: number,
  buy: () => void,
  gate?: string,
): HTMLElement | undefined {
  if (next) return itemCard({ id: next.id, name: next.name, price: next.price, effect: next.effect, coins, buy, gate });
  if (owned) return itemCard({ id: owned.id, name: owned.name, note: 'Best owned', effect: owned.effect, coins });
  return undefined;
}

const emptyNote = (text: string) => el('div', `font-size:${FS.body}px;color:${COLORS.cream};padding:6px 0`, text);

/** The bag: what she caught, its size and price, and the total value. Once there is fish, a footer sends her to the Shop (`goShop`). */
export function openBagPanel(store: PlayerStore, onClose: () => void, goShop?: () => void): PanelHandle {
  return openPanel(
    `Bag (${store.get().bag.length}/${SHOP.bagSlots})`,
    (body, _pinned, footer) => {
      const { bag } = store.get();
      if (bag.length === 0) body.append(emptyNote('The bag is empty. Go catch something!'));
      for (const f of bag) body.append(fishRow(f));
      const total = el('div', `margin-top:10px;font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold};display:flex;justify-content:flex-end;align-items:center;gap:6px`, 'Total value:');
      total.append(coinAmount(bagValue(bag)));
      body.append(total);
      if (bag.length > 0 && goShop) {
        const go = el('div', `display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:2px solid ${COLORS.woodLight}`);
        go.append(el('div', `flex:1;min-width:0;font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream}`, 'Sell fish at the Shop'));
        const b = woodButton('Go to Shop', goShop, { small: true, variant: 'wood' });
        b.style.flex = 'none';
        go.append(b);
        footer.append(go);
      }
    },
    onClose,
  );
}

/** One of the two shop tabs: 44 px tall, the active one lighter wood with a gold underline. */
export function shopTab(label: string, active: boolean, onPick: () => void): HTMLButtonElement {
  const b = el(
    'button',
    [
      'flex:1',
      'height:44px',
      'box-sizing:border-box',
      'padding:0 6px',
      'cursor:pointer',
      `font:${FS.body}px/${LINE} ${FONT}`,
      `color:${active ? COLORS.text : COLORS.cream}`,
      `background:${active ? COLORS.woodLight : '#2a1a12'}`,
      `border:2px solid ${COLORS.outline}`,
      `border-bottom:3px solid ${active ? COLORS.gold : COLORS.outline}`,
    ].join(';'),
    label,
  );
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-selected', String(active));
  b.addEventListener('click', () => {
    if (!active) {
      sound.play('tap');
      onPick();
    }
  });
  return b;
}

/** The shop: Sell and Buy tabs (opens on Sell when the bag has fish, else Buy; `startTab` forces one). */
export function openShopPanel(store: PlayerStore, onClose: () => void, startTab?: 'sell' | 'buy', place: Location = QUIET_LAKE): PanelHandle {
  const stock = place.shop;
  let ownerNote = '';
  let tab: 'sell' | 'buy' = startTab ?? shopStartTab(store.get());
  const apply = (r: Outcome, boughtId?: string) => {
    store.set(r.state);
    if (r.ok && boughtId) popId = boughtId;
  };
  const panel: PanelHandle = openPanel(
    `Shop · ${place.name}`,
    (body, pinned) => {
      // Soft-lock guard: runs every time the shop is (re)drawn.
      const guard = freeWormsIfStuck(store.get());
      if (guard.granted) {
        store.set(guard.state);
        ownerNote = 'The bait shop owner slips you a few worms';
      }
      const p = store.get();
      const purse = el('div', `display:flex;align-items:center;gap:14px;font-size:${FS.body}px;color:${COLORS.cream}`);
      const worms = el('span', 'display:inline-flex;align-items:center;gap:4px');
      worms.append(spriteCanvas(wormSprite(), 16), el('span', '', String(p.worms)));
      purse.append(coinAmount(p.coins, COLORS.cream), worms);
      pinned.append(purse);
      if (ownerNote) pinned.append(el('div', `font-size:${FS.body}px;color:${COLORS.gold};margin-top:6px`, ownerNote));

      const tabs = el('div', 'display:flex;gap:4px;margin:8px 0 6px');
      tabs.append(
        shopTab(`Sell (${p.bag.length})`, tab === 'sell', () => {
          tab = 'sell';
          panel.refresh(true);
        }),
        shopTab('Buy', tab === 'buy', () => {
          tab = 'buy';
          panel.refresh(true);
        }),
      );
      pinned.append(tabs);

      if (tab === 'sell') {
        if (p.bag.length === 0) {
          body.append(emptyNote('Nothing to sell.'));
          return;
        }
        // "Sell all" is pinned above the list; each row's own Sell is wood so it is the only gold button.
        const all = woodButton('Sell all', () => {
          apply(sellAll(store.get()));
          panel.refresh();
        }, { sfx: 'coin' });
        coinButtonLabel(all, 'Sell all +', bagValue(p.bag));
        all.style.cssText += ';width:100%;margin-bottom:4px';
        pinned.append(all);
        p.bag.forEach((f, i) => {
          body.append(
            fishRow(
              f,
              woodButton('Sell', () => {
                apply(sellOne(store.get(), i));
                panel.refresh();
              }, { small: true, sfx: 'coin', variant: 'wood' }),
            ),
          );
        });
        return;
      }

      body.append(el('div', `font:${FS.body}px/${LINE} ${FONT};color:${COLORS.gold};margin:0 0 6px;border-bottom:2px solid ${COLORS.woodLight};padding-bottom:3px`, 'Bait'));
      body.append(
        itemCard({
          id: 'worms',
          name: 'Worm pack',
          price: SHOP.wormPackPrice,
          effect: `${SHOP.wormPackSize} worms for bait`,
          coins: p.coins,
          buy: () => {
            apply(buyWorms(store.get(), stock), 'worms');
            panel.refresh();
          },
        }),
      );

      // The special baits (slice 15c), packs of 10; glow bait is not sold.
      for (const bait of SHOP_BAITS.filter((b) => sold(stock, b.id))) {
        const pack = bait.pack!;
        body.append(
          itemCard({
            id: bait.id,
            name: baitCount(p, bait.id) > 0 ? `${bait.name} (have ${baitCount(p, bait.id)})` : bait.name,
            price: pack.price,
            effect: `${pack.size} per pack. ${bait.effect}`,
            coins: p.coins,
            buy: () => {
              apply(buyBait(store.get(), bait.id, stock), bait.id);
              panel.refresh();
            },
          }),
        );
      }

      // Your tackle: the rod, line and reel she owns (slice 15b), then the next upgrades as cards.
      body.append(sectionTitle('Your tackle'));
      const rodNow = RODS.find((r) => r.id === p.rodId) ?? RODS[0];
      body.append(
        tackleEntry(rodNow, ''),
        tackleEntry(equippedLine(p), 'No line yet'),
        tackleEntry(equippedReel(p), 'No reel yet'),
        ...(hasNightKit(p) ? [tackleEntry(NIGHT_KIT, '')] : []),
      );

      body.append(sectionTitle(stock.gear.length > 0 ? 'Upgrades' : 'River gear'));
      if (stock.gear.length === 0) body.append(emptyNote(stock.gearEmpty ?? 'Nothing for sale here yet.'));
      const rod = nextRod(p);
      const gateOf = (id: string) => (gearUnlocked(id, p) ? undefined : gateText(id, p));
      if (stock.gear.length > 0) body.append(
        rod
          ? itemCard({
              gate: gateOf(rod.id),
              id: rod.id,
              name: rod.name,
              price: rod.price,
              effect: rodEffect(rodNow, rod),
              coins: p.coins,
              buy: () => {
                apply(buyRod(store.get(), stock), rod.id);
                panel.refresh();
              },
            })
          : itemCard({
              id: rodNow.id,
              name: rodNow.name,
              note: 'Best owned',
              effect: `Reach ${rodNow.maxCastM} m, catch zone ${Math.round(rodNow.barGear.zoneSize * 100)}%, red core ${coreText(rodNow)}`,
              coins: p.coins,
            }),
      );
      const line = nextLine(p);
      const reel = nextReel(p);
      const lineCard = !line || sold(stock, line.id) ? tackleCard(equippedLine(p), line, p.coins, () => {
        apply(buyLine(store.get(), stock), line?.id);
        panel.refresh();
      }, line ? gateOf(line.id) : undefined) : undefined;
      const reelCard = !reel || sold(stock, reel.id) ? tackleCard(equippedReel(p), reel, p.coins, () => {
        apply(buyReel(store.get(), stock), reel?.id);
        panel.refresh();
      }, reel ? gateOf(reel.id) : undefined) : undefined;
      if (lineCard) body.append(lineCard);
      if (reelCard) body.append(reelCard);

      // The night kit (slice 16): always shown; locked until the fiberglass rod (or better) is owned.
      if (sold(stock, NIGHT_KIT.id)) body.append(
        hasNightKit(p)
          ? itemCard({ id: NIGHT_KIT.id, name: NIGHT_KIT.name, note: 'Owned', effect: NIGHT_KIT.effect, coins: p.coins })
          : itemCard({
              id: NIGHT_KIT.id,
              name: NIGHT_KIT.name,
              price: NIGHT_KIT.price,
              effect: NIGHT_KIT.effect,
              coins: p.coins,
              locked: nightKitForSale(p) ? undefined : `Needs the ${RODS.find((r) => r.id === NIGHT_KIT.needsRodId)?.name ?? 'Fiberglass Rod'}`,
              buy: () => {
                apply(buyNightKit(store.get(), stock), NIGHT_KIT.id);
                panel.refresh();
              },
            }),
      );

      // The camp (slice 23e): small things for the grass by the car, mostly cosmetic; each is bought once.
      if (stock.camp.length > 0) body.append(sectionTitle('Camp'));
      for (const item of CAMP_ITEMS.filter((c) => sold(stock, c.id))) {
        body.append(
          hasCamp(p, item.id)
            ? itemCard({ id: item.id, name: item.name, note: 'Owned', effect: item.effect, coins: p.coins })
            : itemCard({
                id: item.id,
                name: item.name,
                price: item.price,
                effect: item.effect,
                coins: p.coins,
                buy: () => {
                  apply(buyCampItem(store.get(), item.id, stock), item.id);
                  panel.refresh();
                },
              }),
        );
      }
    },
    onClose,
  );
  return panel;
}
