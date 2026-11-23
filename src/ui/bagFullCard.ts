import { FS, LINE } from '../font';
import type { BagFish } from '../core/inventory';
import { fishName } from './bagShop';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The bag is full: a small card asks what to do with the new fish. It cannot be dismissed with
 * a tap outside; the player picks Release or Swap.
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
      body.append(
        el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};margin-bottom:10px`, `You caught a ${fishName(fish)}, ${fish.lengthCm} cm (${fish.price} coins). There is no room for it.`),
      );
      const col = el('div', 'display:flex;flex-direction:column;gap:8px');
      col.append(
        woodButton('Release', () => {
          panel.close();
          onRelease();
        }),
        woodButton(`Swap for ${fishName(cheapest)} ${cheapest.lengthCm} cm`, () => {
          panel.close();
          onSwap();
        }),
      );
      body.append(col, el('div', `font-size:${FS.small}px;color:${COLORS.cream};margin-top:8px`, `Swapping lets the ${fishName(cheapest)} (${cheapest.price} coins) go.`));
    },
    () => {},
    false,
  );
  return panel;
}
