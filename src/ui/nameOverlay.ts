import { FONT, FS } from '../font';
import { installFrameStyles } from './frames';
import { DEFAULT_PROFILE, MAX_NAME_LENGTH, normalizeProfile, type Profile } from '../core/profile';

/**
 * Cozy name-entry card as a plain DOM overlay (so the phone keyboard just works).
 * Styled with the game's brown and cream palette. Returns a function that closes it.
 */
export function showNameOverlay(initial: Profile, firstLaunch: boolean, onDone: (p: Profile) => void): () => void {
  installFrameStyles();
  const root = document.createElement('div');
  root.setAttribute('data-name-overlay', '');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:10',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px',
    'overflow:auto',
    'background:rgba(36,26,46,0.84)',
    `font-family:${FONT}`,
    'color:#fff8e8',
  ].join(';');

  const fields: { key: keyof Profile; label: string }[] = [
    { key: 'player', label: 'You' },
    { key: 'companion', label: 'Your fishing buddy' },
    { key: 'dog', label: 'The dog' },
  ];

  const card = document.createElement('form');
  card.className = 'rb-panel';
  card.style.cssText = [
    'width:100%',
    'max-width:320px',
    'padding:10px 8px 8px',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = firstLaunch ? 'Welcome to the lake' : 'Names';
  title.style.cssText = `font-size:${FS.heading}px;color:#ffd35a;text-align:center;margin-bottom:4px`;
  const sub = document.createElement('div');
  sub.textContent = firstLaunch ? 'Who is fishing today? (stored on this device only)' : 'Change who is who';
  sub.style.cssText = `font-size:${FS.body}px;color:#f3e3bf;text-align:center;margin-bottom:14px;line-height:1.35`;
  card.append(title, sub);

  const inputs: Record<string, HTMLInputElement> = {};
  for (const f of fields) {
    const label = document.createElement('label');
    label.style.cssText = `display:block;margin-bottom:12px;font-size:${FS.body}px;color:#f3e3bf`;
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial[f.key];
    input.maxLength = MAX_NAME_LENGTH;
    input.placeholder = DEFAULT_PROFILE[f.key];
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'words');
    input.spellcheck = false;
    input.style.cssText = [
      'display:block',
      'box-sizing:border-box',
      'width:100%',
      'margin-top:4px',
      'padding:10px 10px',
      `font:${FS.heading}px ${FONT}`, // at least 16px stops iOS from zooming on focus
      'color:#fff8e8',
      'background:#241a2e',
      'border:2px solid #84582f',
      'border-radius:0',
      'outline:none',
    ].join(';');
    input.addEventListener('focus', () => (input.style.borderColor = '#ffd35a'));
    input.addEventListener('blur', () => (input.style.borderColor = '#84582f'));
    label.append(input);
    card.append(label);
    inputs[f.key] = input;
  }

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = "Let's fish!";
  button.className = 'rb-btn rb-gold';
  button.style.cssText = [
    'display:block',
    'width:100%',
    'margin-top:6px',
    'padding:10px',
    `font:${FS.heading}px ${FONT}`,
    'color:#3a2318',
  ].join(';');
  card.append(button);

  card.addEventListener('submit', (e) => {
    e.preventDefault();
    const profile = normalizeProfile({
      player: inputs.player.value,
      companion: inputs.companion.value,
      dog: inputs.dog.value,
    });
    close();
    onDone(profile);
  });

  const close = () => root.remove();
  root.append(card);
  document.body.append(root);
  return close;
}
