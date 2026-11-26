import Phaser from 'phaser';
import { W } from '../art/layout';
import { PAL } from '../art/palette';
import { TEX, baitIconKey } from '../art/textures';
import { FONT, FS, textPad } from '../font';
import { drawFrame } from './frameDraw';

export type BarButton = 'bag' | 'shop' | 'log' | 'bait' | 'settings';

/** The buttons draw 34 px tall (y 600-634) but hit 44 px tall (y 596-640, the canvas edge); each gap belongs to the nearer button. */
const BTN = { y: 600, h: 34, gap: 4, hitY: 596, hitH: 44 };
const ORDER: BarButton[] = ['bag', 'shop', 'log', 'bait', 'settings'];
/**
 * Widths in ORDER; the gear is square. VT323 at the body size is ~10 px per letter, so "Bag 10/10" and
 * "Log 10/13" (9 letters) need ~98 px with the frame; "Shop" fits in 52, the bait chip holds a 16 px icon and
 * up to three digits. Together with the 4 px gaps they span 352 of the 360 px.
 */
const WIDTHS = [98, 52, 98, 54, 34];
const X0 = Math.round((W - (WIDTHS.reduce((a, b) => a + b, 0) + BTN.gap * (WIDTHS.length - 1))) / 2);

const rectOf = (i: number) => {
  const x = X0 + WIDTHS.slice(0, i).reduce((a, b) => a + b + BTN.gap, 0);
  return new Phaser.Geom.Rectangle(x, BTN.y, WIDTHS[i], BTN.h);
};

/** What a finger may hit: the button widened by half a gap on each side and 44 px tall. */
const hitRectOf = (i: number) => {
  const r = rectOf(i);
  const pad = BTN.gap / 2;
  return new Phaser.Geom.Rectangle(r.x - pad, BTN.hitY, r.width + pad * 2, BTN.hitH);
};

/** The bait chip's rectangle, for the "-1" cue that floats up from it. */
export const baitChipRect = (): Phaser.Geom.Rectangle => rectOf(ORDER.indexOf('bait'));

/** Top edge of the bar, so the hint can sit just above it. */
export const BAR_TOP = BTN.y;

export interface BarView {
  /** Buttons work only while idle with no panel open. */
  enabled: boolean;
  bagCount: number;
  bagSlots: number;
  /** The bait on the hook (slice 15c) and how many are left; shown on the chip. */
  baitId: string;
  baitCount: number;
  /** The fish log: species found and how many there are (the label reads "Log 6/13"). */
  logFound: number;
  logTotal: number;
  /** A small dot on the Shop button: new gear is waiting there (A3). */
  shopDot?: boolean;
}

/** The bottom bar: Bag (n/10), Shop, Log, the bait chip and the gear (settings). Drawn with Phaser; taps come from the scene. */
export class BottomBar {
  private labels: Phaser.GameObjects.Text[];
  private gear: Phaser.GameObjects.Image;
  private baitIcon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, depth: number) {
    const gearRect = rectOf(ORDER.indexOf('settings'));
    this.gear = scene.add.image(gearRect.centerX, gearRect.centerY, TEX.gear).setDepth(depth);
    const chip = rectOf(ORDER.indexOf('bait'));
    this.baitIcon = scene.add.image(chip.x + 6, chip.centerY - 8, TEX.worm).setOrigin(0, 0).setDepth(depth);
    this.labels = ORDER.map((_, i) => {
      const r = rectOf(i);
      // The chip's number sits right of its icon.
      const cx = ORDER[i] === 'bait' ? r.x + 26 + (r.width - 26 - 4) / 2 : r.centerX;
      return scene.add
        .text(cx, r.centerY, '', { fontFamily: FONT, fontSize: `${FS.body}px`, color: '#fff6e4', padding: textPad(0, 2) })
        .setOrigin(0.5)
        .setDepth(depth);
    });
  }

  /** Which button is under (x, y), or null. Every button counts as a hit so the tap never casts. */
  hit(x: number, y: number): BarButton | null {
    const i = ORDER.findIndex((_, k) => hitRectOf(k).contains(x, y));
    return i < 0 ? null : ORDER[i];
  }

  /** True when the pointer is over the bar strip at all (so a near-miss never casts). */
  covers(_x: number, y: number): boolean {
    return y >= BTN.hitY;
  }

  draw(g: Phaser.GameObjects.Graphics, v: BarView): void {
    ORDER.forEach((id, i) => {
      const r = rectOf(i);
      // Disabled: the frame is shaded and the label stays readable at 85 % (over dark night grass too).
      const a = v.enabled ? 1 : 0.85;
      // Always opaque (a see-through frame lets the grass show through as stains); disabled = shaded.
      drawFrame(g, r.x, r.y, r.width, r.height, 'buttonWood');
      if (!v.enabled) g.fillStyle(PAL.outline, 0.4).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      const label = this.labels[i];
      // Amber from 8 of 10 on, so the warning comes before the bag-full card.
      const full = id === 'bag' && v.bagCount >= v.bagSlots - 2;
      label.setText(id === 'bag' ? `Bag ${v.bagCount}/${v.bagSlots}` : id === 'shop' ? 'Shop' : id === 'log' ? `Log ${v.logFound}/${v.logTotal}` : id === 'bait' ? String(v.baitCount) : '');
      if (id === 'settings') this.gear.setAlpha(a);
      if (id === 'bait') this.baitIcon.setTexture(baitIconKey(v.baitId)).setAlpha(a);
      label.setColor(full ? '#ffb347' : '#fff6e4');
      label.setAlpha(a);
      if (id === 'shop' && v.shopDot) {
        // A gold dot on the button's top right corner, breathing a little.
        const bx = r.right - 9;
        const by = r.y - 3;
        g.fillStyle(PAL.outline).fillRect(bx, by, 12, 12).fillStyle(PAL.gold).fillRect(bx + 1, by + 1, 10, 10).fillStyle(PAL.white, 0.8).fillRect(bx + 2, by + 2, 3, 3);
      }
    });
  }
}
