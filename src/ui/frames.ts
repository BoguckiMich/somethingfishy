/**
 * DOM side of the pixel frames: renders the pure frame sprites (src/art/frameArt.ts) to data URLs
 * and installs the CSS classes that use them as 9-slice `border-image`s:
 *   .rb-panel  big wooden card with a wood-grain inside (frame x2)
 *   .rb-box    small inset box (log tiles, inputs)
 *   .rb-btn    bevelled button; add .rb-gold / .rb-wood / .rb-off for the colour; pressed = inverted
 */
import { FRAME_STYLES, frameBorder, frameSprite, woodGrainSprite, type FrameStyle } from '../art/frameArt';
import { spriteToRgba, type Sprite } from '../art/pixelGrid';

export const PANEL_SCALE = 2;

function dataUrl(s: Sprite): string {
  const canvas = document.createElement('canvas');
  canvas.width = s.width;
  canvas.height = s.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(new ImageData(spriteToRgba(s) as Uint8ClampedArray<ArrayBuffer>, s.width, s.height), 0, 0);
  return canvas.toDataURL('image/png');
}

/** A frame as a border-image rule body for an element with a `border` of the slice size times `scale`. */
function borderImage(style: FrameStyle, pressed: boolean, scale: number, fill: boolean): string {
  const b = frameBorder(style);
  const size = b * 2 + 4; // a small centre so the slices never touch
  const url = dataUrl(frameSprite(size, size, style, pressed));
  return `border:${b * scale}px solid transparent;border-image:url(${url}) ${b}${fill ? ' fill' : ''} / ${b * scale}px stretch;`;
}

let installed = false;

/** Adds the frame classes to the page once. */
export function installFrameStyles(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const grain = dataUrl(woodGrainSprite(16, 16));
  const btn = (name: string, style: FrameStyle) =>
    `.rb-btn.${name}{${borderImage(style, false, 1, true)}}.rb-btn.${name}:active:not(:disabled){${borderImage(style, true, 1, true)}}`;
  const css = [
    `.rb-panel{box-sizing:border-box;${borderImage(FRAME_STYLES.panel, false, PANEL_SCALE, false)}background-color:#3a2318;background-image:url(${grain});background-size:${16 * PANEL_SCALE}px ${16 * PANEL_SCALE}px;background-clip:padding-box;image-rendering:pixelated;filter:drop-shadow(0 4px 0 rgba(36,26,46,.85))}`,
    `.rb-box{box-sizing:border-box;${borderImage(FRAME_STYLES.hud, false, 1, false)}background-clip:padding-box;image-rendering:pixelated}`,
    `.rb-btn{box-sizing:border-box;margin:0;image-rendering:pixelated;background:none;cursor:pointer;text-align:center}`,
    btn('rb-gold', FRAME_STYLES.buttonGold),
    btn('rb-wood', FRAME_STYLES.buttonWood),
    btn('rb-off', FRAME_STYLES.buttonOff),
    `.rb-btn:disabled{cursor:default}`,
  ].join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}
