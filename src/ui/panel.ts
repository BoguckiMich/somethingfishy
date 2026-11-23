/**
 * Shared look for the DOM panels (bag, shop, choice card): pixel-art wood, cream text, brown and
 * gold borders, monospace, in the same style as the name card.
 */
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
}

/** A chunky wooden/gold button. Disabled ones are dimmed and say why. */
export function woodButton(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const disabled = opts.disabledReason !== undefined;
  const b = el('button', '', disabled ? `${label} (${opts.disabledReason})` : label);
  b.type = 'button';
  b.disabled = disabled;
  b.style.cssText = [
    'font:bold ' + (opts.small ? '12px' : '14px') + ' monospace',
    `padding:${opts.small ? '6px 8px' : '10px 10px'}`,
    'border:0',
    'border-radius:2px',
    'border-bottom:3px solid ' + (disabled ? '#2a1c14' : COLORS.goldShade),
    `color:${disabled ? COLORS.dim : COLORS.wood}`,
    `background:${disabled ? '#4a3426' : COLORS.gold}`,
    `cursor:${disabled ? 'default' : 'pointer'}`,
    disabled ? 'opacity:0.75' : '',
    'text-align:center',
  ].join(';');
  if (!disabled) b.addEventListener('click', onClick);
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
      'font-family:monospace',
      `color:${COLORS.text}`,
      'touch-action:manipulation',
    ].join(';'),
  );
  const card = el(
    'div',
    [
      'box-sizing:border-box',
      'width:100%',
      'max-width:340px',
      'max-height:92vh',
      'display:flex',
      'flex-direction:column',
      'padding:12px 12px 12px',
      `background:${COLORS.wood}`,
      `border:3px solid ${COLORS.border}`,
      `box-shadow:0 0 0 3px ${COLORS.outline}, 0 8px 0 3px ${COLORS.outline}`,
      'border-radius:2px',
    ].join(';'),
  );
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px');
  head.append(el('div', `font:bold 18px monospace;color:${COLORS.gold}`, title));
  const body = el('div', 'overflow-y:auto;min-height:0');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.remove();
    onClose();
  };
  if (dismissable) {
    const x = el('button', `font:bold 16px monospace;width:30px;height:30px;color:${COLORS.cream};background:${COLORS.woodLight};border:2px solid ${COLORS.border};border-radius:2px;cursor:pointer`, 'X');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    head.append(x);
    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });
  }
  card.append(head, body);
  root.append(card);
  document.body.append(root);

  const refresh = () => {
    body.replaceChildren();
    build(body);
  };
  refresh();
  return { close, refresh };
}
