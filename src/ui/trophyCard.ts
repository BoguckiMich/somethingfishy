import { FS, LINE } from '../font';
import { fishSprite } from '../art/fishArt';
import { speciesById } from '../core/data/fish';
import { TROPHY_TEXT } from '../core/data/rare';
import { formatCatchSize } from '../core/fish';
import type { FishLog } from '../core/fishLog';
import { boardIds, type TrophyState } from '../core/rare';
import { fishCanvas } from './logPanel';
import { starRow } from './starRow';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** "24 Nov 2026" from a YYYY-MM-DD date; '' when there is none. */
export function trophyDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

/** The card a tap on the trophy board opens (slice 23d): each mounted fish with its size and the date; the Pale One has its record from the log. */
export function showTrophyCard(trophies: TrophyState | undefined, log: FishLog, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    TROPHY_TEXT.board.title,
    (body) => {
      const ids = boardIds(trophies, log);
      if (ids.length === 0) body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.cream};padding:6px 0`, TROPHY_TEXT.board.empty));
      for (const id of ids) {
        const sp = speciesById(id);
        if (!sp) continue;
        const size = id === 'pale' ? log.pale && formatCatchSize(log.pale.bestLengthCm, log.pale.bestWeightG) : trophies?.[id] && formatCatchSize(trophies[id].lengthCm, trophies[id].weightG);
        const date = id === 'pale' ? '' : trophyDate(trophies?.[id]?.date ?? '');
        const row = el('div', `display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid ${COLORS.woodLight}`);
        const pic = el('div', 'flex:none;width:64px;height:44px;display:flex;align-items:center;justify-content:center');
        pic.append(fishCanvas(fishSprite(id, id === 'pale' ? 2 : 1), 64, 3));
        const col = el('div', 'flex:1;min-width:0');
        const medal = id !== 'pale' && trophies?.[id]?.medal === true ? starRow('medal', 2) : undefined;
        const nameLine = el('div', `display:flex;align-items:center;gap:6px;font-size:${FS.body}px;line-height:${LINE};color:${COLORS.gold}`, sp.name);
        if (medal) nameLine.append(medal);
        col.append(
          nameLine,
          el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.text}`, size || ''),
        );
        if (date) col.append(el('div', `font-size:${FS.small}px;line-height:${LINE};color:${COLORS.cream}`, date));
        row.append(pic, col);
        body.append(row);
      }
      const close = el('div', 'margin-top:10px');
      close.append(woodButton('Close', () => panel.close(), { variant: 'wood' }));
      body.append(close);
    },
    onClose,
  );
  return panel;
}
