import { FS, LINE } from '../font';
import type { BagFish } from '../core/inventory';
import { coinAmount, fishName } from './bagShop';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The bag is full: a small card asks what to do with the new fish. It cannot be dismissed with
 * a tap outside; the player picks Release or Swap. Swap (keeps the better fish) is the gold button,
 * Release is wood (slice 22b).
 */
export function showBagFullCard(
  fish: BagFish,
  cheapest: BagFish,
  onRelease: () => void,
  onSwap: () => void,
): PanelHandle {
  const panel: PanelHandle = openPanel(
    'Bag is full',
    (body) => {
      const line = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:0 6px;font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text}`, `${fishName(fish)}, ${fish.lengthCm} cm ·`);
      line.append(coinAmount(fish.price));
      body.append(line, el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};margin-bottom:10px`, 'No room in the bag.'));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px');
      col.append(
        woodButton(`Swap for ${fishName(cheapest)} ${cheapest.lengthCm} cm`, () => {
          panel.close();
          onSwap();
        }),
        woodButton('Release', () => {
          panel.close();
          onRelease();
        }, { variant: 'wood' }),
      );
      const note = el('div', `display:flex;flex-wrap:wrap;align-items:center;gap:0 6px;font-size:${FS.small}px;color:${COLORS.cream};margin-top:8px`, `Swapping lets the ${fishName(cheapest)} go (`);
      note.append(coinAmount(cheapest.price, COLORS.cream), ')');
      body.append(col, note);
    },
    () => {},
    false,
  );
  return panel;
}
