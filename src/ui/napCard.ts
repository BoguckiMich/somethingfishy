import { FS, LINE } from '../font';
import { formatCooldown, napOptions, napPrimaryId, type NapOption } from '../core/bedtime';
import { formatClock } from '../core/clock';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The nap card (slice 16), opened by tapping the car in the daytime: "Nap until..." with one
 * button per time (Dawn, Day, Dusk, Night, and Deep night with the night kit). Free. `pick` gets the
 * chosen option; the card closes first so the scene sees no open panel. The subtitle gives the time now
 * (`minute`); the next sensible time is the one gold button, the rest are wood (slice 22b).
 */
export function showNapCard(kit: boolean, pick: (o: NapOption) => void, onClose: () => void, minute = 12 * 60, cooldownLeft: () => number = () => 0): PanelHandle {
  const primary = napPrimaryId(minute);
  // After a nap they rest a little (balance A2): the buttons wait and a kind line counts down; the card refreshes itself each second.
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  const panel: PanelHandle = openPanel(
    'Nap until...',
    (body) => {
      const left = cooldownLeft();
      body.append(
        el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};margin-bottom:8px`, left > 0 ? `They are still waking up. Another nap in ${formatCooldown(left)}.` : 'They rest in the car.'),
      );
      const col = el('div', 'display:flex;flex-direction:column;gap:8px');
      for (const o of napOptions(kit)) {
        col.append(
          woodButton(
            o.label,
            () => {
              stop();
              panel.close();
              pick(o);
            },
            left > 0 ? { variant: 'wood', disabledReason: formatCooldown(left) } : { variant: o.id === primary ? 'gold' : 'wood' },
          ),
        );
      }
      if (left > 0 && timer === undefined) timer = setInterval(() => panel.refresh(), 1000);
      if (left <= 0) stop();
      body.append(col);
    },
    () => {
      stop();
      onClose();
    },
    true,
    `It's ${formatClock(minute)} now`,
  );
  return panel;
}
