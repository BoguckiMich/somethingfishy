import Phaser from 'phaser';
import { W } from '../art/layout';
import { PAL } from '../art/palette';

export type BarButton = 'bag' | 'shop' | 'log';

const BTN = { y: 602, w: 108, h: 30, gap: 8 };
const X0 = Math.round((W - (BTN.w * 3 + BTN.gap * 2)) / 2);
const ORDER: BarButton[] = ['bag', 'shop', 'log'];

const rectOf = (i: number) => new Phaser.Geom.Rectangle(X0 + i * (BTN.w + BTN.gap), BTN.y, BTN.w, BTN.h);

/** Top edge of the bar, so the hint can sit just above it. */
export const BAR_TOP = BTN.y;

export interface BarView {
  /** Buttons work only while idle with no panel open. */
  enabled: boolean;
  bagCount: number;
  bagSlots: number;
}

/** The bottom bar: Bag (n/10), Shop and Log (not yet). Drawn with Phaser; taps come from the scene. */
export class BottomBar {
  private labels: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene, depth: number) {
    this.labels = ORDER.map((_, i) => {
      const r = rectOf(i);
      return scene.add
        .text(r.centerX, r.centerY, '', { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#fff6e4' })
        .setOrigin(0.5)
        .setDepth(depth);
    });
  }

  /** Which button is under (x, y), or null. Log counts as a hit so the tap never casts. */
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
      const live = v.enabled && id !== 'log';
      const a = live ? 1 : id === 'log' ? 0.5 : 0.6;
      g.fillStyle(PAL.outline, a).fillRect(r.x - 1, r.y, r.width + 2, r.height).fillRect(r.x, r.y - 1, r.width, r.height + 2);
      g.fillStyle(PAL.woodLight, a).fillRect(r.x, r.y, r.width, r.height);
      g.fillStyle(PAL.woodDeep, 0.92 * a).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      g.fillStyle(PAL.woodDark, 0.9 * a).fillRect(r.x + 1, r.y + 1, r.width - 2, 1);
      const label = this.labels[i];
      const full = id === 'bag' && v.bagCount >= v.bagSlots;
      label.setText(id === 'bag' ? `Bag ${v.bagCount}/${v.bagSlots}` : id === 'shop' ? 'Shop' : 'Log');
      label.setColor(full ? '#ffb347' : '#fff6e4');
      label.setAlpha(a);
      if (id === 'log') label.setText('Log (soon)').setFontSize(12);
    });
  }
}
