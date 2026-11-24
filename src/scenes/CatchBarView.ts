import Phaser from 'phaser';
import { BAR_BORDER, BAR_INNER, STRIP_INNER } from '../art/catchBarArt';
import { lerpColor } from '../art/dayCycle';
import { W } from '../art/layout';
import { PAL } from '../art/palette';
import { fishIconKey } from '../art/fishArt';
import { TEX } from '../art/textures';
import { coreHalf, type CatchBarState } from '../core/catchBar';
import type { BarGear } from '../core/gear';

/** Screen layout of the catch bar: right edge, clear of the bobber column. The top right is free (slice 22c), so it starts higher. */
const BAR_FRAME = { x: W - 8 - (BAR_INNER.w + BAR_BORDER * 2), y: 50 };
const STRIP_BORDER = 3;
const STRIP_FRAME = { x: BAR_FRAME.x - 3 - (STRIP_INNER.w + STRIP_BORDER * 2), y: BAR_FRAME.y + (BAR_BORDER - STRIP_BORDER) };
/** Inner windows (where things move), in screen pixels. */
export const BAR_WINDOW = { x: BAR_FRAME.x + BAR_BORDER, y: BAR_FRAME.y + BAR_BORDER, w: BAR_INNER.w, h: BAR_INNER.h };
const STRIP_WINDOW = { x: STRIP_FRAME.x + STRIP_BORDER, y: STRIP_FRAME.y + STRIP_BORDER, w: STRIP_INNER.w, h: STRIP_INNER.h };

const DEPTH = 30;
/** A 9 x 9 fish above the progress strip (what you are after) and a net below it (what fills up), centred on the strip. */
const ICON_GAP = 2;

/** Multiplies two 0xRRGGBB colours (what setTint does on the GPU). */
export function multiplyColor(a: number, b: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Progress colour: red when nearly empty, yellow in the middle, green when nearly full. */
export function progressColor(progress: number): number {
  return progress < 0.5 ? lerpColor(PAL.red, PAL.gold, progress / 0.5) : lerpColor(PAL.gold, PAL.leafLight, (progress - 0.5) / 0.5);
}

/** Phaser layer for the catch bar: the pure `CatchBarState` in, pixels out. */
export class CatchBarView {
  private bg: Phaser.GameObjects.Graphics;
  private dyn: Phaser.GameObjects.Graphics;
  private frame: Phaser.GameObjects.Image;
  private strip: Phaser.GameObjects.Image;
  private fishIcon: Phaser.GameObjects.Image;
  private stripTop: Phaser.GameObjects.Image;
  private stripBottom: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setDepth(DEPTH - 1);
    this.dyn = scene.add.graphics().setDepth(DEPTH);
    this.frame = scene.add.image(BAR_FRAME.x, BAR_FRAME.y, TEX.barFrame).setOrigin(0, 0).setDepth(DEPTH + 0.2);
    this.strip = scene.add.image(STRIP_FRAME.x, STRIP_FRAME.y, TEX.stripFrame).setOrigin(0, 0).setDepth(DEPTH + 0.2);
    this.fishIcon = scene.add.image(0, 0, fishIconKey('perch')).setDepth(DEPTH + 0.1);
    const cx = STRIP_FRAME.x + Math.floor((STRIP_INNER.w + STRIP_BORDER * 2) / 2);
    const stripH = STRIP_INNER.h + STRIP_BORDER * 2;
    this.stripTop = scene.add.image(cx, STRIP_FRAME.y - ICON_GAP, TEX.stripFish).setOrigin(0.5, 1).setDepth(DEPTH + 0.2);
    this.stripBottom = scene.add.image(cx, STRIP_FRAME.y + stripH + ICON_GAP, TEX.stripNet).setOrigin(0.5, 0).setDepth(DEPTH + 0.2);
    this.hide();
  }

  hide(): void {
    this.bg.clear();
    this.dyn.clear();
    this.frame.setVisible(false);
    this.strip.setVisible(false);
    this.fishIcon.setVisible(false);
    this.stripTop.setVisible(false);
    this.stripBottom.setVisible(false);
  }

  /** `tint` dims everything a little at night (a gentler version of the world tint). */
  update(bar: CatchBarState, gear: BarGear, tint: number, speciesId: string, slipAfterMs?: number): void {
    const t = (c: number) => multiplyColor(c, tint);
    const { bg, dyn } = this;
    bg.clear();
    dyn.clear();
    this.frame.setVisible(true).setTint(tint);
    this.strip.setVisible(true).setTint(tint);
    this.stripTop.setVisible(true).setTint(tint);
    this.stripBottom.setVisible(true).setTint(tint);

    const win = BAR_WINDOW;
    const toY = (pos: number) => win.y + (1 - pos) * win.h;

    // Backdrop: dark water with faint ruler ticks, so the bar reads over any part of the lake.
    bg.fillStyle(t(PAL.barWater), 0.66).fillRect(win.x, win.y, win.w, win.h);
    bg.fillStyle(t(PAL.shallow3), 0.16);
    for (let i = 1; i < 10; i++) bg.fillRect(win.x + (i % 5 === 0 ? 0 : win.w - 5), Math.round(toY(i / 10)), i % 5 === 0 ? win.w : 5, 1);
    bg.fillStyle(t(PAL.barWater), 0.66).fillRect(STRIP_WINDOW.x, STRIP_WINDOW.y, STRIP_WINDOW.w, STRIP_WINDOW.h);

    // The catch zone: a translucent green band, brighter while the thumb is down.
    const half = gear.zoneSize / 2;
    const top = Math.round(toY(bar.zone + half));
    const bottom = Math.round(toY(bar.zone - half));
    dyn.fillStyle(t(PAL.leafLight), bar.holding ? 0.62 : 0.5).fillRect(win.x, top, win.w, bottom - top);
    dyn.fillStyle(t(PAL.leafHi), 0.95).fillRect(win.x, top, win.w, 2).fillRect(win.x, bottom - 2, win.w, 2);
    dyn.fillStyle(t(PAL.leafHi), 0.35).fillRect(win.x, top + 2, 2, bottom - top - 4).fillRect(win.x + win.w - 2, top + 2, 2, bottom - top - 4);

    // The sweet spot (slice 23f): a red core inside the green band, riding with it. The fish in it fills progress faster.
    const core = coreHalf(gear);
    if (core > 0) {
      const cTop = Math.round(toY(bar.zone + core));
      const cBottom = Math.max(cTop + 3, Math.round(toY(bar.zone - core)));
      dyn.fillStyle(t(PAL.redDark), 1).fillRect(win.x + 3, cTop, win.w - 6, cBottom - cTop);
      dyn.fillStyle(t(PAL.red), 1).fillRect(win.x + 4, cTop + 1, win.w - 8, cBottom - cTop - 2);
      dyn.fillStyle(PAL.white, 0.35).fillRect(win.x + 4, cTop + 1, win.w - 8, 1);
    }

    // The fish, a little shaken when it is moving fast.
    const shake = Math.abs(bar.fishVel) > 0.5 ? Math.round(Math.sin(bar.elapsedMs / 35)) : 0;
    this.fishIcon
      .setTexture(fishIconKey(speciesId))
      .setVisible(true)
      .setTint(tint)
      .setPosition(Math.round(win.x + win.w / 2) + shake, Math.round(toY(bar.fish)));

    // A trophy slips away when it stays out of the green too long (slice 23d): a red meter along the top inside edge of the bar fills while it is outside.
    if (slipAfterMs !== undefined && bar.outsideMs > 0) {
      const share = Math.min(1, bar.outsideMs / slipAfterMs);
      dyn.fillStyle(PAL.outline, 0.85).fillRect(win.x, win.y, win.w, 6);
      dyn.fillStyle(t(PAL.red), 1).fillRect(win.x + 1, win.y + 1, Math.round((win.w - 2) * share), 4);
    }

    // Progress strip: fills from the bottom, red -> yellow -> green.
    const fillH = Math.round(bar.progress * STRIP_WINDOW.h);
    const color = t(progressColor(bar.progress));
    dyn.fillStyle(color).fillRect(STRIP_WINDOW.x, STRIP_WINDOW.y + STRIP_WINDOW.h - fillH, STRIP_WINDOW.w, fillH);
    dyn.fillStyle(PAL.white, 0.4).fillRect(STRIP_WINDOW.x, STRIP_WINDOW.y + STRIP_WINDOW.h - fillH, 2, fillH);
  }
}
