/**
 * "New version - tap to reload": registers the service worker (production only) and shows a small
 * pixel-framed toast when an update is waiting. It never reloads by itself, so no fight gets cut off.
 */
import { registerSW } from 'virtual:pwa-register';
import { FONT, FS } from '../font';
import { installFrameStyles } from './frames';

export const UPDATE_TOAST_TEXT = 'New version — tap to reload';

/** Builds the (hidden) toast button; `onTap` runs when it is pressed. */
function buildToast(onTap: () => void): HTMLButtonElement {
  installFrameStyles();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rb-btn rb-gold';
  btn.textContent = UPDATE_TOAST_TEXT;
  btn.style.cssText = [
    'position:fixed',
    'top:calc(8px + env(safe-area-inset-top, 0px))',
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
