import Phaser from 'phaser';
import { distanceToY, BOBBER_X } from '../art/layout';
import { PAL } from '../art/palette';
import { FONT, FS, textPad } from '../font';
import { LINE_FIGHT_TUNING as T } from '../core/data/lineFight';
import type { BarGear } from '../core/gear';
import { lineGearOf, surgeLevel, warnLevel, type LineFightState } from '../core/lineFight';
import { STAR_ROWS, multiplyColor } from './CatchBarView';

/**
 * The "feel the line" fight on the lake (slice 28): the pure `LineFightState` in, pixels out. The fish is a splash and swirl at the end of
 * the taut line, on the water; the line itself and the rod bend are drawn by LakeScene (they are the scene's rod and line), which asks
 * `fishScreenPos` where the fish is. This view draws the splash, the telegraph, and the small curved tension gauge by Alex's reel.
 * The gauge never relies on colour alone: the zones differ in thickness, in dots (slack) and in teeth (red), and the needle's position says the rest.
 */

const DEPTH = 15.6;
/** The tension gauge: a half circle (slack at the left, red at the right), by the reel, clear of the line and of Alex's head. */
export const LINE_DIAL = { cx: 124, cy: 318, r: 26 };
const GOLD_DARK = 0xb98a2c;
const STEEL = 0x6f86a0;

/** Where the fish is on screen: sideways by the lateral offset (wider farther out), up the water with the distance. */
export function fishScreenPos(line: LineFightState, elapsedMs: number): { x: number; y: number; scale: number } {
  const far = Math.min(1, line.distanceM / 24);
  const spread = 26 + 48 * far;
  const surge = surgeLevel(line);
  const tremble = surge > 0 ? Math.sin(elapsedMs / 38) * 1.5 * surge : 0;
  return {
    x: BOBBER_X + line.lateral * spread + tremble,
    y: distanceToY(line.distanceM) + (surge > 0 ? Math.cos(elapsedMs / 45) * 0.8 : 0),
    scale: 1 + 0.9 * (1 - far),
  };
}

export class LineFightView {
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  /** Which way the fish last swam (for the shadow): -1 left, 1 right. */
  private facing = 1;
  private lastLateral = 0;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH);
    this.label = scene
      .add.text(LINE_DIAL.cx, LINE_DIAL.cy + 5, '', { fontFamily: FONT, fontSize: `${FS.small}px`, color: '#fff6e0', stroke: '#241a2e', strokeThickness: 3, padding: textPad(2, 1) })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH + 0.1);
    this.hide();
  }

  hide(): void {
    this.g.clear();
    this.label.setVisible(false);
  }

  /** `tint` dims everything a little at night. `foam` is the splash colour already tinted by the scene. */
  update(line: LineFightState, gear: BarGear, tint: number, elapsedMs: number, slipAfterMs?: number): void {
    const g = this.g;
    g.clear();
    const t = (c: number) => multiplyColor(c, tint);
    const pos = fishScreenPos(line, elapsedMs);
    if (Math.abs(line.lateral - this.lastLateral) > 0.002) this.facing = line.lateral > this.lastLateral ? 1 : -1;
    this.lastLateral = line.lateral;
    this.drawFish(g, line, pos, t, elapsedMs);
    this.drawDial(g, line, gear, t, elapsedMs, slipAfterMs !== undefined);
    this.label.setVisible(true).setText(`${Math.max(0, Math.ceil(line.distanceM))} m`);
  }

  /** The splash and swirl at the end of the line, the telegraph before a surge, and the spray and wake of the run. */
  private drawFish(g: Phaser.GameObjects.Graphics, line: LineFightState, p: { x: number; y: number; scale: number }, t: (c: number) => number, ms: number): void {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const k = p.scale;
    const surge = surgeLevel(line);
    const warn = warnLevel(line);
    const hush = line.phase === 'hush';
    const sec = ms / 1000;
    const ring = (rx: number, ry: number, a: number, dx = 0, dy = 0) => this.ellipse(g, x + dx, y + dy, rx, ry, t(PAL.foam), a);

    // The fish itself, a dark shape just under the surface, pointing where it swims (bigger when it is nearer).
    const f = this.facing;
    const len = Math.max(5, Math.round(8 * k));
    const hgt = Math.max(2, Math.round(2.8 * k));
    const bodyAlpha = hush ? 0.45 : 0.82;
    for (let i = -len; i <= len; i++) {
      const hh = Math.max(1, Math.round(hgt * Math.sqrt(1 - (i / (len + 1)) ** 2)));
      g.fillStyle(0x10233a, bodyAlpha).fillRect(x + i * f - (f < 0 ? 0 : 0), y - hh + 1, 1, hh * 2 - 1);
      g.fillStyle(t(PAL.shallow3), bodyAlpha * 0.55).fillRect(x + i * f, y - hh + 1, 1, 1); // a light back
    }
    for (let j = 1; j <= Math.max(3, Math.round(3.5 * k)); j++) {
      const th = Math.max(1, Math.round(j * 0.7));
      g.fillStyle(0x10233a, bodyAlpha).fillRect(x - (len + j) * f, y - th, 1, th * 2 + 1); // the tail fin, flared
    }
    g.fillStyle(PAL.white, hush ? 0.3 : 0.9).fillRect(x + Math.round(len * 0.55) * f, y - 1, 1, 1); // the eye

    // The swirl: foam flecks circling it, faster when it surges, still when it plays dead.
    const speed = hush ? 0.6 : 2.2 + 5 * surge + 3 * warn;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = sec * speed + (i / n) * Math.PI * 2;
      const rx = (7 + 2 * Math.sin(sec * 3 + i)) * k;
      g.fillStyle(t(PAL.foam), hush ? 0.4 : 0.9).fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * rx * 0.34), 1, 1);
    }
    ring(7 * k, 2.4 * k, 0.55);
    // A steady ripple, always.
    const ph = (sec * 0.9) % 1;
    ring((5 + ph * 12) * k, (1.6 + ph * 3.6) * k, (1 - ph) * 0.6);

    // The telegraph: the splash swells, a second and third ring spread, and spray lifts. It is the thing to read before the pull.
    if (warn > 0) {
      ring((8 + warn * 16) * k, (2.8 + warn * 6) * k, 0.95);
      ring((8 + warn * 16) * k + 1, (2.8 + warn * 6) * k + 1, 0.6);
      ring((5 + warn * 10) * k, (1.8 + warn * 4) * k, 0.9);
      const sprays = 6 + Math.round(warn * 8);
      for (let i = 0; i < sprays; i++) {
        const a = (i / sprays) * Math.PI * 2 + sec * 4;
        const lift = (3 + warn * 11) * k * (0.5 + 0.5 * Math.abs(Math.sin(a * 2.3 + sec * 9)));
        g.fillStyle(t(PAL.white), 0.95).fillRect(Math.round(x + Math.cos(a) * (6 + warn * 9) * k), Math.round(y - lift), 2, 2);
      }
      // A bold mark over it: it reads without colour.
      const bob = Math.round(Math.sin(sec * 30));
      const my = y - Math.round(20 * k) + bob;
      g.fillStyle(PAL.outline, 1).fillRect(x - 3, my - 2, 8, 13).fillRect(x - 2, my + 12, 6, 5);
      g.fillStyle(t(PAL.redLight), 1).fillRect(x - 1, my - 1, 4, 10).fillRect(x - 1, my + 13, 4, 3);
      g.fillStyle(t(PAL.white), 0.7).fillRect(x - 1, my - 1, 1, 10);
    }
    // A sideways cut is telegraphed: a small splash on the side it will dart to, and an arrow pointing there.
    if (line.cutWarn > 0) {
      const dir = line.cutTarget >= line.lateral ? 1 : -1;
      const w = 1 - line.cutWarn / T.cutWarnS;
      const sx = x + dir * Math.round(12 * k);
      ring((3 + w * 5) * k, (1.2 + w * 2) * k, 0.9, dir * Math.round(12 * k), 0);
      for (let i = 0; i < 4; i++) g.fillStyle(t(PAL.white), 0.9).fillRect(sx + (i - 2) * 2, y - 2 - Math.round(w * 4 + (i % 2) * 2), 1, 2);
      const ax = Math.min(350, Math.max(10, x + dir * Math.round(24 * k)));
      const on = Math.floor(ms / 90) % 2 === 0 ? 1 : 0.6;
      for (let s = 0; s <= 4; s++) {
        const px2 = ax - dir * (4 - s);
        g.fillStyle(PAL.outline, on).fillRect(px2 - 1, y - 5 + s - 1, 4, 4).fillRect(px2 - 1, y + 5 - s - 1, 4, 4);
      }
      for (let s = 0; s <= 4; s++) {
        const px2 = ax - dir * (4 - s);
        g.fillStyle(t(PAL.white), on).fillRect(px2, y - 5 + s, 2, 2).fillRect(px2, y + 5 - s, 2, 2);
      }
    }
    // The run: a big churn, a wake streaming behind the fish, and flying drops.
    if (surge > 0) {
      const big = 0.5 + 0.5 * surge;
      ring((10 + 9 * surge) * k, (3.4 + 3 * surge) * k, 0.95);
      ring((10 + 9 * surge) * k + 1, (3.4 + 3 * surge) * k + 1, 0.55);
      ring((6 + 4 * surge) * k, (2 + 1.5 * surge) * k, 0.9);
      for (let i = 1; i <= 9; i++) {
        const lag = i * 4.5 * k;
        const wx = x - Math.round(lag) * f;
        g.fillStyle(t(PAL.white), (0.95 - i * 0.07) * big).fillRect(wx, y - 1 + (i % 2), 3, 2);
        g.fillStyle(t(PAL.foam), (0.7 - i * 0.06) * big).fillRect(wx - f * 3, y + 3 + i, 3, 1).fillRect(wx - f * 3, y - 4 - i, 3, 1);
      }
      // Chevrons point where it runs: the pull reads by shape and motion, not by colour.
      const dir = line.runDir;
      const pulse = Math.floor(sec * 8) % 3;
      for (let i = 0; i < 3; i++) {
        const cxv = Math.min(350, Math.max(10, x + dir * Math.round((16 + i * 7) * k)));
        const on = i === pulse ? 1 : 0.65;
        // The arms start behind and meet at the tip, which points the way it runs.
        for (let s = 0; s <= 6; s++) {
          const ax = cxv - dir * (6 - s);
          g.fillStyle(PAL.outline, on).fillRect(ax - 1, y - 7 + s - 1, 4, 4).fillRect(ax - 1, y + 7 - s - 1, 4, 4);
        }
        for (let s = 0; s <= 6; s++) {
          const ax = cxv - dir * (6 - s);
          g.fillStyle(t(PAL.white), on).fillRect(ax, y - 7 + s, 2, 2).fillRect(ax, y + 7 - s, 2, 2);
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = Math.sin(sec * 17 + i * 2.1);
        const b = (sec * 5 + i * 0.31) % 1;
        g.fillStyle(t(PAL.white), 0.95 * (1 - b)).fillRect(Math.round(x + a * 15 * k), Math.round(y - 2 - Math.sin(b * Math.PI) * 15 * k), 2, 2);
      }
    }
  }

  /** The tension gauge: slack · steady (gold) · red. */
  private drawDial(g: Phaser.GameObjects.Graphics, line: LineFightState, barGear: BarGear, t: (c: number) => number, ms: number, trophy: boolean): void {
    const gear = lineGearOf(barGear);
    const { cx, cy, r } = LINE_DIAL;
    const near = line.tension >= gear.snapLimit - 0.1;
    const shake = near ? Math.round(Math.sin(ms / 28)) : 0;
    const px = cx + shake;
    // Backing: a dark half disc so the gauge reads over any water.
    const outer = r + 10;
    g.fillStyle(PAL.outline, 0.5);
    for (let dy = 0; dy <= outer; dy++) {
      const w = Math.floor(Math.sqrt(outer * outer - dy * dy));
      g.fillRect(px - w, cy - dy, w * 2, 1);
    }
    const danger = line.redS > 0.04 || line.slackS > 0.08;
    g.fillRect(px - 20, cy + 1, 40, danger ? 42 : 24);

    const theta = (tt: number) => Math.PI * (1 + tt);
    const arc = (t0: number, t1: number, r0: number, r1: number, colour: number, every = 1, alpha = 1) => {
      const steps = Math.ceil((t1 - t0) * Math.PI * r * 1.6);
      let n = 0;
      let lx = NaN;
      let ly = NaN;
      for (let i = 0; i <= steps; i++) {
        const a = theta(t0 + ((t1 - t0) * i) / steps);
        for (let rr = r0; rr <= r1; rr++) {
          const x = Math.round(px + Math.cos(a) * rr);
          const y = Math.round(cy + Math.sin(a) * rr);
          if (x === lx && y === ly) continue;
          lx = x;
          ly = y;
          n++;
          if (n % every === 0) g.fillStyle(colour, alpha).fillRect(x, y, 1, 1);
        }
      }
    };
    const lim = gear.snapLimit;
    const gl = T.goldBand[0];
    // Dim steel between the zones.
    arc(T.slackFloor, gl, r - 2, r + 1, t(STEEL));
    // In the red the whole red zone flashes white, so it cannot be missed.
    if (line.tension >= lim && Math.floor(ms / 70) % 2 === 0) arc(lim, 1, r - 5, r + 4, t(PAL.white), 1, 0.85);
    // Slack: grey and dotted.
    arc(0, T.slackFloor, r - 2, r + 1, t(PAL.stoneLight), 2);
    // Steady: the thick gold band, with dark ends.
    // Steady: the thick gold band runs up to exactly where the red starts (the snap limit).
    arc(gl, lim, r - 5, r + 4, t(GOLD_DARK));
    arc(gl + 0.01, lim - 0.01, r - 4, r + 3, t(PAL.gold));
    // Red: with teeth pointing out.
    arc(lim, 1, r - 3, r + 2, t(PAL.redDark));
    arc(lim, 1, r - 2, r + 1, t(PAL.red));
    for (let i = 0; i <= 5; i++) {
      const tt = lim + ((1 - lim) * i) / 5;
      const a = theta(Math.min(1, tt));
      for (let rr = r + 3; rr <= r + 6 - (i % 2) * 2; rr++) g.fillStyle(t(PAL.redLight), 1).fillRect(Math.round(px + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
    }
    // Ticks on the zone borders.
    for (const tt of [T.slackFloor, gl, lim]) {
      const a = theta(tt);
      for (let rr = r - 7; rr <= r - 5; rr++) g.fillStyle(t(PAL.white), 0.85).fillRect(Math.round(px + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
    }
    // The needle, with a dark rim, ending in a round tip.
    const a = theta(Math.min(1, Math.max(0, line.tension)));
    const len = r + 6;
    for (let s = 0; s <= len; s++) {
      const nx = Math.round(px + Math.cos(a) * s);
      const ny = Math.round(cy + Math.sin(a) * s);
      g.fillStyle(PAL.outline, 1).fillRect(nx - 1, ny - 1, 3, 3);
    }
    for (let s = 0; s <= len; s++) g.fillStyle(t(PAL.white), 1).fillRect(Math.round(px + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), 1, 1);
    const tx = Math.round(px + Math.cos(a) * len);
    const ty = Math.round(cy + Math.sin(a) * len);
    g.fillStyle(PAL.outline, 1).fillRect(tx - 2, ty - 2, 5, 5);
    g.fillStyle(t(line.tension >= lim ? PAL.redLight : PAL.white), 1).fillRect(tx - 1, ty - 1, 3, 3);
    // The reel hub.
    g.fillStyle(PAL.outline, 1).fillRect(px - 5, cy - 4, 10, 8);
    g.fillStyle(t(PAL.stone), 1).fillRect(px - 4, cy - 3, 8, 6);
    g.fillStyle(t(PAL.stoneLight), 1).fillRect(px - 4, cy - 3, 4, 3);
    g.fillStyle(t(PAL.gold), 1).fillRect(px + 2, cy + 1, 2, 2);

    // How close the line is to going: a red bar (snap) and a grey bar (slip), under the distance, only when they matter.
    const snapShare = Math.min(1, line.redS / (gear.flexS * (trophy ? T.trophyFlex : 1)));
    const slackShare = Math.min(1, line.slackS / (trophy ? T.trophySlackS : T.slackS));
    const bar = (y: number, share: number, colour: number, label: 'snap' | 'slip') => {
      if (share < 0.04) return;
      const w = 40;
      const x0 = px - w / 2;
      g.fillStyle(PAL.outline, 1).fillRect(x0 - 1, y - 1, w + 2, 5);
      g.fillStyle(t(PAL.outlineSoft), 1).fillRect(x0, y, w, 3);
      g.fillStyle(t(colour), 1).fillRect(x0, y, Math.round(w * share), 3);
      // The kind of danger is in the shape too: the snap bar has a spike at its end, the slip bar a hole.
      if (label === 'snap') g.fillStyle(t(PAL.white), 1).fillRect(x0 + w, y - 2, 1, 7);
      else g.fillStyle(PAL.outline, 1).fillRect(x0 + w - 2, y + 1, 2, 1);
    };
    bar(cy + 31, snapShare, PAL.red, 'snap');
    bar(cy + 37, slackShare, PAL.stoneLight, 'slip');

    // The perfect-run star above the gauge: gold while the run is still clean, grey and cracked once it is not.
    const clean = line.redTotalMs <= T.perfectRedGraceMs && line.slackTotalMs <= T.perfectSlackGraceMs && line.tension < lim;
    this.drawStar(g, px - 9, cy - r - 30, clean, t);
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x0: number, y0: number, perfect: boolean, t: (c: number) => number): void {
    const k = 2;
    const col = (c: string): number => {
      if (c === 'o') return perfect ? PAL.outline : PAL.stoneDark;
      if (c === 'h') return perfect ? 0xfff3a6 : PAL.stoneLight;
      return perfect ? 0xffc72c : PAL.stone;
    };
    STAR_ROWS.forEach((row, ry) =>
      [...row].forEach((c, rx) => {
        if (c === '.') return;
        const crack = !perfect && rx === 4 + (ry % 2) - (ry > 4 ? 1 : 0) && ry >= 1 && ry <= 7;
        g.fillStyle(crack ? PAL.outline : t(col(c)), 1).fillRect(x0 + rx * k, y0 + ry * k, k, k);
      }),
    );
  }

  private ellipse(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    const n = Math.max(12, Math.ceil((rx + ry) * 2.2));
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      if (x !== lx || y !== ly) g.fillRect(x, y, 1, 1);
      lx = x;
      ly = y;
    }
  }
}
