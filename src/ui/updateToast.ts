/**
 * "New version - tap to reload": registers the service worker (production only) and shows a small
 * pixel-framed toast when an update is waiting. It never reloads by itself, so no fight gets cut off.
 */
import { registerSW } from 'virtual:pwa-register';
import { FONT, FS, LINE } from '../font';
import { H } from '../art/layout';
import { installFrameStyles } from './frames';

export const UPDATE_TOAST_TEXT = 'New version — tap to reload';

/** If the service worker hand-over has not reloaded the page by then, reload it ourselves. */
const RELOAD_FALLBACK_MS = 1500;

/**
 * Sits the toast in the top right corner of the game (slice 22c: the pencil and board buttons are gone, so the
 * corner is free; the clock and coins are on the left), measured from the canvas's own on-screen rect so it
 * follows the letterbox on tall phones. Safe-area insets keep it clear of notches.
 */
function placeTopRight(btn: HTMLButtonElement): void {
  const canvas = document.querySelector('#game canvas');
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const scale = r.height / H;
  const fromTop = r.top + 8 * scale;
  const fromRight = window.innerWidth - r.right + 8 * scale;
  btn.style.top = `max(${Math.round(fromTop)}px, calc(8px + env(safe-area-inset-top, 0px)))`;
  btn.style.right = `max(${Math.round(fromRight)}px, calc(8px + env(safe-area-inset-right, 0px)))`;
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
    'top:calc(8px + env(safe-area-inset-top, 0px))', // placed by placeTopRight() once the canvas exists
    'right:8px',
    'z-index:20', // above the canvas and the panels (z-index 10)
    'display:none', // hidden: takes no taps from the game
    'padding:6px 10px',
    'max-width:calc(100vw - 16px)',
    `font:${FS.body}px/${LINE} ${FONT}`,
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
      toast ??= buildToast(() => {
        // updateSW(true) asks the waiting worker to take over and reloads on workbox's `controlling`
        // event, but that event never comes for a tab first opened uncontrolled (first visit, no
        // clientsClaim) and kept open: the tap then did nothing. So reload anyway shortly after;
        // the new worker is active by then, or the network serves the new build.
        void updateSW(true);
        window.setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
      });
      toast.style.display = 'block';
      placeTopRight(toast);
      window.addEventListener('resize', () => toast && placeTopRight(toast));
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
