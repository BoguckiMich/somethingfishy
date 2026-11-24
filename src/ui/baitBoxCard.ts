import { FS, LINE } from '../font';
import { DAILY_BOX } from '../core/data/daily';
import { tierHint, type BoxContents } from '../core/daily/daily';
import { sound } from '../audio/sound';
import { baitById } from '../core/data/baits';
import { shopIconSprite } from '../art/shopIconArt';
import { spriteCanvas } from './spriteCanvas';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** Five pips, the first `filled` of them gold: the "Day-in-a-row" streak tier. */
function streakRow(tier: number): HTMLElement {
  const row = el('div', 'display:flex;align-items:center;gap:8px;margin-top:10px');
  row.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream}`, `Days in a row: ${tier}`));
  const pips = el('div', 'display:flex;gap:4px;margin-left:auto');
  for (let i = 1; i <= DAILY_BOX.maxTier; i++) {
    const on = i <= tier;
    pips.append(el('div', `width:14px;height:14px;box-sizing:border-box;border:2px solid ${on ? COLORS.goldShade : COLORS.outline};background:${on ? COLORS.gold : COLORS.wood}`));
  }
  row.append(pips);
  const wrap = el('div', '');
  wrap.append(row, el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream};margin-top:2px`, tierHint(tier)));
  return wrap;
}

/**
 * The card for the crate on the dock. It first offers the package; "Take it" calls `take()` (the
 * scene grants and saves) and the same card then shows what was inside and the streak.
 * `tier` is the streak tier the box will have once opened.
 */
export function showBaitBoxCard(tier: number, take: () => BoxContents | null, onClose: () => void): PanelHandle {
  let opened: BoxContents | null = null;
  const panel: PanelHandle = openPanel(
    'Bait box',
    (body) => {
      if (!opened) {
        body.append(
          el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream}`, 'The bait shop left a package on the dock'),
          streakRow(tier),
        );
        const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
        col.append(
          woodButton('Take it', () => {
            opened = take();
            if (opened) sound.play('coin');
            panel.refresh();
          }),
        );
        body.append(col);
        return;
      }
      if (opened.lucky) {
        body.append(el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.gold};text-shadow:0 0 6px ${COLORS.amber};margin-bottom:4px`, '* Lucky box! *'));
      }
      body.append(el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.text}`, `+${opened.worms} worms`));
      if (opened.coins > 0) body.append(el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.gold}`, `+${opened.coins} coins`));
      // Special baits (slice 15c): a line each with the bait's icon.
      for (const [id, n] of Object.entries(opened.baits)) {
        const bait = baitById(id);
        const icon = shopIconSprite(id);
        if (!bait || n <= 0) continue;
        const line = el('div', 'display:flex;align-items:center;gap:6px');
        if (icon) line.append(spriteCanvas(icon, 32));
        line.append(el('div', `font-size:${FS.heading}px;line-height:${LINE};color:${COLORS.text}`, `+${n} ${bait.name.toLowerCase()}`));
        body.append(line);
      }
      body.append(streakRow(opened.tier));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
      col.append(woodButton('Close', () => panel.close(), { variant: 'wood' }));
      body.append(col);
    },
    onClose,
  );
  return panel;
}
