import { FS, LINE } from '../font';
import type { BottleContents } from '../core/moments/moments';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The wood card for a message in a bottle: the note, and, when there were any, the worms tucked
 * inside. Like the bait-box card it is only a view; the scene already granted the worms.
 */
export function showBottleCard(contents: BottleContents, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    'Bottle note',
    (body) => {
      body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text};padding:4px 0 6px`, contents.text));
      if (contents.worms > 0) {
        body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.gold};margin-top:6px`, `A few worms were tucked inside (+${contents.worms})`));
      }
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}
