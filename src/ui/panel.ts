/**
 * Shared look for the DOM panels (bag, shop, choice card): pixel-art wood, cream text, brown and
 * gold borders and a pixel frame drawn in code (see frames.ts), in the same style as the name card.
 */
import { sound, type SfxName } from '../audio/sound';
import { FONT, FS } from '../font';
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
  /** Why the button is disabled (shown in place of the label); omit for an enabled button. */
  disabledReason?: string;
  small?: boolean;
  /** Sound on press: a soft tap by default, null for none (a button that plays its own sound). */
  sfx?: SfxName | null;
}

/** A chunky wooden/gold button. Disabled ones are dimmed and say why. */
export function woodButton(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const disabled = opts.disabledReason !== undefined;
  const b = el('button', '', disabled ? `${label} (${opts.disabledReason})` : label);
  b.type = 'button';
  b.disabled = disabled;
  installFrameStyles();
  b.className = `rb-btn ${disabled ? 'rb-off' : 'rb-gold'}`;
  b.style.cssText = [
    `font:${FS.body}px ${FONT}`,
    `padding:${opts.small ? '4px 6px' : '8px 8px'}`,
    `color:${disabled ? COLORS.dim : COLORS.wood}`,
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
  refresh(): void;
}

/**
 * Opens a full-screen overlay with a wooden card. `build` fills the body and is called again on
 * `refresh()`. A tap outside the card, or the close button, closes it. Pass `dismissable: false`
 * for a card that insists on a choice.
 */
export function openPanel(
  title: string,
  build: (body: HTMLElement) => void,
  onClose: () => void,
  dismissable = true,
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
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px');
  head.append(el('div', `font:${FS.heading}px ${FONT};color:${COLORS.gold}`, title));
  const body = el('div', 'overflow-y:auto;min-height:0');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.remove();
    onClose();
  };
  if (dismissable) {
    const x = el('button', `font:${FS.heading}px ${FONT};line-height:1;width:34px;height:34px;padding:0;color:${COLORS.cream}`, 'X');
    x.className = 'rb-btn rb-wood';
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => {
      sound.play('tap');
      close();
    });
    head.append(x);
    root.addEventListener('click', (e) => {
      if (e.target !== root) return;
      sound.play('tap');
      close();
    });
  }
  card.append(head, body);
  root.append(card);
  document.body.append(root);
  sound.play('tap');

  const refresh = () => {
    body.replaceChildren();
    build(body);
  };
  refresh();
  return { close, refresh };
}
