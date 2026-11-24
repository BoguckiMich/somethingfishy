/**
 * Shared look for the DOM panels (bag, shop, choice card): pixel-art wood, cream text, brown and
 * gold borders and a pixel frame drawn in code (see frames.ts), in the same style as the name card.
 */
import { sound, type SfxName } from '../audio/sound';
import { FONT, FS, LINE } from '../font';
import { installFrameStyles } from './frames';

export const COLORS = {
  backdrop: 'rgba(36,26,46,0.78)',
  wood: '#3a2318',
  woodLight: '#5c3a22',
  border: '#cb9c5a',
  outline: '#241a2e',
  cream: '#f3e3bf',
  text: '#fff8e8',
  gold: '#ffd35a',
  goldShade: '#b78837',
  amber: '#ffb347',
  dim: '#8a7660',
};

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (css) node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface ButtonOptions {
  /** Why the button is disabled (shown after the label; '' = the label itself says it); omit for an enabled button. */
  disabledReason?: string;
  small?: boolean;
  /**
   * 'gold' (default) is THE button of a card or row; 'wood' is every other action. The rule (slice 22b): at most one
   * rb-gold per card or row, for the main action; secondary buttons (Close, Reroll, Release, a second nap time)
   * are wood. Disabled buttons use rb-off and say why.
   */
  variant?: 'gold' | 'wood';
  /** Sound on press: a soft tap by default, null for none (a button that plays its own sound). */
  sfx?: SfxName | null;
}

/** A chunky wooden/gold button. Disabled ones are dimmed and say why. */
export function woodButton(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const disabled = opts.disabledReason !== undefined;
  const b = el('button', '', disabled && opts.disabledReason ? `${label} (${opts.disabledReason})` : label);
  b.type = 'button';
  b.disabled = disabled;
  installFrameStyles();
  b.className = `rb-btn ${disabled ? 'rb-off' : opts.variant === 'wood' ? 'rb-wood' : 'rb-gold'}`;
  b.style.cssText = [
    `font:${FS.body}px/${LINE} ${FONT}`,
    `padding:${opts.small ? '6px 6px' : '8px 8px'}`,
    `color:${disabled ? COLORS.dim : opts.variant === 'wood' ? COLORS.cream : COLORS.wood}`,
  ].join(';');
  const sfx = opts.sfx === undefined ? 'tap' : opts.sfx;
  if (!disabled) {
    b.addEventListener('click', () => {
      if (sfx) sound.play(sfx);
      onClick();
    });
  }
  return b;
}

export interface PanelHandle {
  close(): void;
  /** Rebuilds the body (call after the data changed). */
  refresh(resetScroll?: boolean): void;
}

/** A 20 px fade from clear to panel wood, pinned to the top or bottom edge of the body; shown only while there is more to scroll to. */
function scrollFade(edge: 'top' | 'bottom'): HTMLElement {
  const dir = edge === 'top' ? 'to bottom' : 'to top';
  return el(
    'div',
    `position:absolute;left:0;right:0;${edge}:0;height:20px;pointer-events:none;opacity:0;transition:opacity .15s;background:linear-gradient(${dir},${COLORS.wood},rgba(58,35,24,0))`,
  );
}

/**
 * Opens a full-screen overlay with a wooden card. `build` fills the body and is called again on
 * `refresh()`; its second argument is a `pinned` strip between the header and the scrolling body (tabs, a
 * purse, one main button) and its third a `footer` strip under it (both cleared on every refresh). A tap outside the card, or the close button,
 * closes it. Pass `dismissable: false` for a card that insists on a choice.
 *
 * The header is one line: the title is cut with an ellipsis if it is too long (keep titles short and put the
 * rest in the optional `subtitle`, FS.small cream; a function is re-read on every refresh). The body scrolls
 * with a thin wood scrollbar; a fade at the bottom (and at the top once scrolled) shows only when there is more.
 */
export function openPanel(
  title: string,
  build: (body: HTMLElement, pinned: HTMLElement, footer: HTMLElement) => void,
  onClose: () => void,
  dismissable = true,
  subtitle?: string | (() => string),
): PanelHandle {
  installFrameStyles();
  const root = el(
    'div',
    [
      'position:fixed',
      'inset:0',
      'z-index:10',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:12px',
      `background:${COLORS.backdrop}`,
      `font-family:${FONT}`,
      `color:${COLORS.text}`,
      'touch-action:manipulation',
    ].join(';'),
  );
  const card = el(
    'div',
    [
      'width:100%',
      'max-width:340px',
      'max-height:92vh',
      'display:flex',
      'flex-direction:column',
      'padding:6px 8px 8px',
    ].join(';'),
  );
  card.className = 'rb-panel';
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;min-width:0');
  const titles = el('div', 'flex:1;min-width:0');
  titles.append(el('div', `font:${FS.heading}px/${LINE} ${FONT};color:${COLORS.gold};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`, title));
  const sub = el('div', `font:${FS.small}px/${LINE} ${FONT};color:${COLORS.cream};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`);
  const subWrap = el('div', 'margin:-6px 0 8px');
  subWrap.append(sub);
  const setSub = () => {
    const t = typeof subtitle === 'function' ? subtitle() : (subtitle ?? '');
    sub.textContent = t;
    subWrap.style.display = t ? '' : 'none';
  };
  setSub();
  head.append(titles);
  const pinned = el('div', 'flex:none');
  const footer = el('div', 'flex:none');
  const body = el('div', 'overflow-y:auto;min-height:0;flex:1 1 auto;padding-right:8px');
  body.className = 'rb-scroll';
  const bodyWrap = el('div', 'position:relative;min-height:0;flex:1 1 auto;display:flex;flex-direction:column');
  const fadeTop = scrollFade('top');
  const fadeBottom = scrollFade('bottom');
  bodyWrap.append(body, fadeTop, fadeBottom);

  const updateFades = () => {
    const more = body.scrollTop + body.clientHeight < body.scrollHeight - 4;
    fadeBottom.style.opacity = more ? '1' : '0';
    fadeTop.style.opacity = body.scrollTop > 4 ? '1' : '0';
  };
  body.addEventListener('scroll', updateFades, { passive: true });

  let closed = false;
  let observer: ResizeObserver | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    observer?.disconnect();
    root.remove();
    onClose();
  };
  if (dismissable) {
    // The X looks 34 x 34 but its hit box is 44 x 44 (transparent padding around it).
    const hit = el('button', 'flex:none;width:44px;height:44px;margin:-5px -5px -5px 0;padding:0;border:0;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center');
    hit.type = 'button';
    hit.setAttribute('aria-label', 'Close');
    const x = el('div', `font:${FS.heading}px/${LINE} ${FONT};width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:${COLORS.cream}`, 'X');
    x.className = 'rb-btn rb-wood';
    hit.append(x);
    hit.addEventListener('click', () => {
      sound.play('tap');
      close();
    });
    head.append(hit);
    root.addEventListener('click', (e) => {
      if (e.target !== root) return;
      sound.play('tap');
      close();
    });
  }
  card.append(head, subWrap, pinned, bodyWrap, footer);
  root.append(card);
  document.body.append(root);
  sound.play('tap');
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(updateFades);
    observer.observe(body);
  }

  const refresh = (resetScroll = false) => {
    const keep = resetScroll ? 0 : body.scrollTop;
    body.replaceChildren();
    pinned.replaceChildren();
    footer.replaceChildren();
    setSub();
    build(body, pinned, footer);
    body.scrollTop = keep;
    updateFades();
    requestAnimationFrame(updateFades);
  };
  refresh();
  return { close, refresh };
}
