import Phaser from 'phaser';
import { W } from '../art/layout';
import { PAL } from '../art/palette';
import { TEX } from '../art/textures';
import { FONT, FS } from '../font';
import { drawFrame } from './frameDraw';

export type BarButton = 'bag' | 'shop' | 'log' | 'settings';

const BTN = { y: 602, h: 30, gap: 8 };
const ORDER: BarButton[] = ['bag', 'shop', 'log', 'settings'];
/** Widths in ORDER; the gear is square. Together with the gaps they span 340 of the 360 px. */
const WIDTHS = [95, 95, 96, 30];
const X0 = Math.round((W - (WIDTHS.reduce((a, b) => a + b, 0) + BTN.gap * (WIDTHS.length - 1))) / 2);

const rectOf = (i: number) => {
  const x = X0 + WIDTHS.slice(0, i).reduce((a, b) => a + b + BTN.gap, 0);
  return new Phaser.Geom.Rectangle(x, BTN.y, WIDTHS[i], BTN.h);
};

/** Top edge of the bar, so the hint can sit just above it. */
export const BAR_TOP = BTN.y;

export interface BarView {
  /** Buttons work only while idle with no panel open. */
  enabled: boolean;
  bagCount: number;
  bagSlots: number;
}

/** The bottom bar: Bag (n/10), Shop, Log and the gear (settings). Drawn with Phaser; taps come from the scene. */
export class BottomBar {
  private labels: Phaser.GameObjects.Text[];
  private gear: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, depth: number) {
    const gearRect = rectOf(ORDER.indexOf('settings'));
    this.gear = scene.add.image(gearRect.centerX, gearRect.centerY, TEX.gear).setDepth(depth);
    this.labels = ORDER.map((_, i) => {
      const r = rectOf(i);
      return scene.add
        .text(r.centerX, r.centerY, '', { fontFamily: FONT, fontSize: `${FS.body}px`, fontStyle: 'bold', color: '#fff6e4' })
        .setOrigin(0.5)
        .setDepth(depth);
    });
  }

  /** Which button is under (x, y), or null. Every button counts as a hit so the tap never casts. */
  hit(x: number, y: number): BarButton | null {
    const i = ORDER.findIndex((_, k) => rectOf(k).contains(x, y));
    return i < 0 ? null : ORDER[i];
  }

  /** True when the pointer is over the bar strip at all (so a near-miss never casts). */
  covers(_x: number, y: number): boolean {
    return y >= BTN.y - 4;
  }

  draw(g: Phaser.GameObjects.Graphics, v: BarView): void {
    ORDER.forEach((id, i) => {
      const r = rectOf(i);
      const a = v.enabled ? 1 : 0.6;
      // Always opaque (a see-through frame lets the grass show through as stains); disabled = shaded.
      drawFrame(g, r.x, r.y, r.width, r.height, 'buttonWood');
      if (!v.enabled) g.fillStyle(PAL.outline, 0.45).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      const label = this.labels[i];
      const full = id === 'bag' && v.bagCount >= v.bagSlots;
      label.setText(id === 'bag' ? `Bag ${v.bagCount}/${v.bagSlots}` : id === 'shop' ? 'Shop' : id === 'log' ? 'Log' : '');
      if (id === 'settings') this.gear.setAlpha(a);
      label.setColor(full ? '#ffb347' : '#fff6e4');
      label.setAlpha(a);
    });
  }
}
