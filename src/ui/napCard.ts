import { FS, LINE } from '../font';
import { napOptions, napPrimaryId, type NapOption } from '../core/bedtime';
import { formatClock } from '../core/clock';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The nap card (slice 16), opened by tapping the car in the daytime: "Nap until..." with one
 * button per time (Dawn, Day, Dusk, Night, and Deep night with the night kit). Free. `pick` gets the
 * chosen option; the card closes first so the scene sees no open panel. The subtitle gives the time now
 * (`minute`); the next sensible time is the one gold button, the rest are wood (slice 22b).
 */
export function showNapCard(kit: boolean, pick: (o: NapOption) => void, onClose: () => void, minute = 12 * 60): PanelHandle {
  const primary = napPrimaryId(minute);
  const panel: PanelHandle = openPanel(
    'Nap until...',
    (body) => {
      body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};margin-bottom:8px`, 'Pajkel and Bestia rest in the car.'));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px');
      for (const o of napOptions(kit)) {
        col.append(
          woodButton(
            o.label,
            () => {
              panel.close();
              pick(o);
            },
            { variant: o.id === primary ? 'gold' : 'wood' },
          ),
        );
      }
      body.append(col);
    },
    onClose,
    true,
    `It's ${formatClock(minute)} now`,
  );
  return panel;
}
