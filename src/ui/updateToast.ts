/**
 * "New version - tap to reload": registers the service worker (production only) and shows a small
 * pixel-framed toast when an update is waiting. It never reloads by itself, so no fight gets cut off.
 */
import { registerSW } from 'virtual:pwa-register';
import { FONT, FS } from '../font';
import { H } from '../art/layout';
import { BAR_TOP } from '../scenes/BottomBar';
import { installFrameStyles } from './frames';

export const UPDATE_TOAST_TEXT = 'New version — tap to reload';

/**
 * Sits the toast centred just above the bottom bar and its hint line, measured from the canvas's own
 * on-screen rect, so it covers neither the top HUD nor the bar. Safe-area insets keep it clear of notches.
 */
function placeAboveBar(btn: HTMLButtonElement): void {
  const canvas = document.querySelector('#game canvas');
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const scale = r.height / H;
  const fromBottom = window.innerHeight - r.top - (BAR_TOP - 42) * scale; // 42 game px: hint line + gap
  btn.style.bottom = `max(${Math.round(fromBottom)}px, calc(8px + env(safe-area-inset-bottom, 0px)))`;
}

/** Builds the (hidden) toast button; `onTap` runs when it is pressed. */
function buildToast(onTap: () => void): HTMLButtonElement {
  installFrameStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rb-btn rb-gold';
  btn.textContent = UPDATE_TOAST_TEXT;
  btn.style.cssText = [
    'position:fixed',
    'bottom:calc(120px + env(safe-area-inset-bottom, 0px))', // placed by placeAboveBar() once the canvas exists
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:20', // above the canvas and the panels (z-index 10)
    'display:none', // hidden: takes no taps from the game
    'padding:6px 10px',
    'max-width:calc(100vw - 16px)',
    `font:${FS.body}px ${FONT}`,
    'color:#241a2e',
    'touch-action:manipulation',
    '-webkit-user-select:none',
    'user-select:none',
  ].join(';');
  btn.addEventListener('click', onTap);
  document.body.append(btn);
  return btn;
}

/** Registers the service worker and wires the update toast. Does nothing outside a production build. */
export function setupUpdateToast(): void {
  if (!import.meta.env.PROD || typeof document === 'undefined' || !('serviceWorker' in navigator)) return;
  let toast: HTMLButtonElement | undefined;
  const updateSW = registerSW({
    onNeedRefresh() {
      toast ??= buildToast(() => void updateSW(true));
      toast.style.display = 'block';
      placeAboveBar(toast);
      window.addEventListener('resize', () => toast && placeAboveBar(toast));
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Check at launch (the browser does) and whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      });
    },
  });
}
