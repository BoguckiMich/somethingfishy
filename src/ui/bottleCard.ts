import { FS, LINE } from '../font';
import type { BottleContents } from '../core/moments/moments';
import type { ChapterCard } from '../core/data/story';
import { tr } from '../i18n/en';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/**
 * The wood card for a message in a bottle: the note, and, when there were any, the worms tucked
 * inside. Like the bait-box card it is only a view; the scene already granted the worms.
 */
export function showBottleCard(contents: BottleContents, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    'Bottle note',
    (body) => {
      body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text};padding:4px 0 6px`, keepSignature(contents.text)));
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

/** Keeps a bottle's signature (" - W.") on the line of the last words: the spaces around it do not break. */
export const keepSignature = (text: string): string => text.replace(/\s(—)\s(\S+)$/, ' $1 $2');

/** A chapter card (River bend R1, R2, R6): like the story card, but with `tagLast` the last line is a small wooden gate tag on a string. */
export function showChapterCard(card: ChapterCard, onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    tr(card.title),
    (body) => {
      card.lines.forEach((raw, i) => {
        const t = tr(raw);
        if (card.tagLast && i === card.lines.length - 1) {
          const tag = el(
            'div',
            `display:inline-block;margin:6px 0 2px 8px;padding:6px 12px;border:3px solid ${COLORS.outline};border-radius:3px;background:#f3e3bf;color:#241a2e;font-weight:bold;font-size:${FS.body}px;line-height:${LINE};letter-spacing:1px;transform:rotate(-2deg);box-shadow:0 2px 0 ${COLORS.outline}`,
            t,
          );
          const wrap = el('div', '');
          wrap.append(tag);
          body.append(wrap);
        } else body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text};padding:2px 0`, t));
      });
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}

/** A small story card: a title and a few short lines (the Pale One bonus beat). Like the others it is only a view. */
export function showStoryCard(title: string, lines: readonly string[], onClose: () => void): PanelHandle {
  const panel: PanelHandle = openPanel(
    title,
    (body) => {
      for (const t of lines) body.append(el('div', `font-size:${FS.body}px;line-height:${LINE};color:${COLORS.text};padding:2px 0`, t));
      const col = el('div', 'display:flex;flex-direction:column;gap:8px;margin-top:12px');
      col.append(woodButton('Close', () => panel.close()));
      body.append(col);
    },
    onClose,
  );
  return panel;
}
