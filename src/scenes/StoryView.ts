import Phaser from 'phaser';
import type { SfxName } from '../audio/sound';
import { W } from '../art/layout';
import { ringPoints } from '../art/momentArt';
import { PAL } from '../art/palette';
import { momentKey } from '../art/textures';
import { MOMENT_TUNING } from '../core/data/moments';
import { STORY_TUNING, type ChapterKind } from '../core/data/story';
import { FONT, FS } from '../font';

/**
 * The pictures of the story chapters that are not plain cards (GAME_DESIGN section 3, slice 21): the
 * sealed bottle, the duck taking the sandwich, the star that blinks, the wet footprints. Rules (which
 * chapter, when, what is queued) live in core/story and LakeScene; this class only moves sprites and
 * reports back. One picture at a time.
 */

export interface StoryHooks {
  sfx(name: SfxName): void;
  /** The sealed bottle was tapped: open its note card (the scene then calls `clear`). */
  tapBottle(): void;
  /** A self-playing picture ended: `seen` is false when it was cut short (a fight, a reset). */
  finished(seen: boolean): void;
}

/** Layers (the scene's Z: waterFx 8, waterDecor 9, nearShore 10, dock 11, postFx 12; the angler and companions 14). */
const DEPTH = { water: 9.4, planks: 11.1, sandwich: 11.2, duck: 11.3, text: 31.5 } as const;

/** The sealed bottle floats here, near the dock end (never drifts). */
export const SEALED_BOTTLE = { x: 86, y: 372 };
/** The river's sealed bottle (R3) starts here and drifts upstream (right) to `maxX`, where the eddy holds it. */
export const RIVER_BOTTLE = { x: 120, y: 326, maxX: 214 };
/** R1: the stick floats from the water right of the landing, up and to the right, out of the picture. */
const STICK_PATH = { from: { x: 262, y: 352 }, to: { x: 372, y: 296 }, ms: 17_000 };
/** R4: the duck's lane on the river (it drifts a few px lower as it comes down the bend). */
const DUCK_WORM_Y = 286;
/** The sandwich lies on the planks at the dock's left edge, next to Pajkel's seat; the duck stops at the edge. */
export const SANDWICH_AT = { x: 124, y: 414 };
const DUCK_STOP = { x: 103, y: 410 };
/** The star that blinks. */
export const BLINK_AT = { x: 150, y: 292 };
/** The footprints walk down the dock to the car and back (screen px). */
const PRINT_PATH = [
  { x: 126, y: 366 },
  { x: 126, y: 462 },
  { x: 106, y: 494 },
  { x: 88, y: 514 },
];
const PRINT_SPACING = 11;
const PRINT_OUT_MS = 480;
const PRINT_BACK_MS = 360;
const PRINT_GAP_MS = 1300;
const PRINT_HOLD_MS = 1800;
const PRINT_DRY_MS = 3200;
const FLOAT_MS = 1700;

const multiply = (a: number, b: number): number => {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Points every `spacing` px along a polyline, each with the walking direction (unit vector). */
export function samplePath(path: readonly { x: number; y: number }[], spacing: number): { x: number; y: number; dx: number; dy: number }[] {
  const out: { x: number; y: number; dx: number; dy: number }[] = [];
  let walked = 0; // distance covered before the current segment
  let next = 0; // distance of the next point to place
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    while (next <= walked + len) {
      const d = next - walked;
      out.push({ x: a.x + dx * d, y: a.y + dy * d, dx, dy });
      next += spacing;
    }
    walked += len;
  }
  return out;
}

interface Active {
  kind: ChapterKind;
  age: number;
  /** Set once tapped (blink): ms since, -1 while untouched. */
  tappedAge: number;
  /** Small progress counter per kind (duck: 0 swim in, 1 lunge, 2 leaving). */
  stage: number;
  x: number;
  y: number;
  /** Duck: the age a stage began at, and the quacks said so far. */
  stageAt: number;
  quacks: number;
  /** Blink: when it sinks (age). */
  sinkAt: number;
  fadeLeft: number;
  /** The sealed bottle drifts slowly upstream (the river's R3). */
  drift: boolean;
}

interface Ring {
  x: number;
  y: number;
  age: number;
  ms: number;
  rx: number;
  ry: number;
}

export class StoryView {
  private fx: Phaser.GameObjects.Graphics;
  private main: Phaser.GameObjects.Image;
  private extra: Phaser.GameObjects.Image;
  private prints: Phaser.GameObjects.Image[] = [];
  private floatText: Phaser.GameObjects.Text;
  private floatAge = Infinity;
  private floatAt = { x: 0, y: 0 };
  private active: Active | null = null;
  private rings: Ring[] = [];
  private outPrints: { x: number; y: number; dx: number; dy: number; side: number }[] = [];
  private backPrints: { x: number; y: number; dx: number; dy: number; side: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    private hooks: StoryHooks,
  ) {
    this.fx = scene.add.graphics().setDepth(DEPTH.water + 0.05);
    this.main = scene.add.image(0, 0, momentKey('duck')).setOrigin(0.5, 0.5).setVisible(false);
    this.extra = scene.add.image(0, 0, momentKey('sandwich')).setOrigin(0.5, 0.5).setVisible(false);
    this.floatText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: '#ffd35a', stroke: '#241a2e', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setDepth(DEPTH.text)
      .setVisible(false);
    const along = samplePath(PRINT_PATH, PRINT_SPACING);
    this.outPrints = along.map((p, i) => ({ ...p, side: i % 2 ? 1 : -1 }));
    // The way back is the same walk the other way, a little to the side.
    this.backPrints = [...along].reverse().map((p, i) => ({ x: p.x + 11, y: p.y, dx: -p.dx, dy: -p.dy, side: i % 2 ? 1 : -1 }));
    for (let i = 0; i < this.outPrints.length + this.backPrints.length; i++) {
      this.prints.push(scene.add.image(0, 0, momentKey('footprint')).setOrigin(0.5, 0.5).setDepth(DEPTH.planks).setVisible(false));
    }
  }

  /** The picture on screen, or null. */
  get kind(): ChapterKind | null {
    return this.active?.kind ?? null;
  }

  /** How still the lake should be (0..1): the blink asks for calm water while it is on screen. */
  get calm(): number {
    const a = this.active;
    if (!a || a.kind !== 'blink') return 0;
    return a.tappedAge >= 0 || a.age >= a.sinkAt ? 0 : clamp01(a.age / 1500);
  }

  /** A shiver is on screen: the crickets dip like for the uncanny moments. */
  get uncanny(): boolean {
    return this.active?.kind === 'blink';
  }

  // ---- Start and stop -----------------------------------------------------------------------

  start(kind: ChapterKind, drift = false): void {
    this.clear();
    const a: Active = { kind, age: 0, tappedAge: -1, stage: 0, x: 0, y: 0, stageAt: 0, quacks: 0, sinkAt: STORY_TUNING.blinkMs, fadeLeft: -1, drift };
    switch (kind) {
      case 'bottle':
        a.x = drift ? RIVER_BOTTLE.x : SEALED_BOTTLE.x;
        a.y = drift ? RIVER_BOTTLE.y : SEALED_BOTTLE.y;
        break;
      case 'stick':
        a.x = STICK_PATH.from.x;
        a.y = STICK_PATH.from.y;
        this.hooks.sfx('boof'); // Bestia drops her stick in the river
        this.hooks.sfx('plop');
        this.rings.push({ x: a.x, y: a.y + 2, age: 0, ms: 1400, rx: 12, ry: 3.5 });
        break;
      case 'duckWorm':
        a.x = W + 14;
        a.y = DUCK_WORM_Y;
        this.hooks.sfx('boof');
        break;
      case 'duck':
        a.x = -14;
        a.y = DUCK_STOP.y;
        this.hooks.sfx('boof'); // Bestia sees the duck
        break;
      case 'blink':
        a.x = BLINK_AT.x;
        a.y = BLINK_AT.y;
        break;
      case 'prints':
      case 'card':
        break;
    }
    this.active = a;
  }

  /** Ends whatever is on screen at once (without a report). */
  clear(): void {
    this.active = null;
    this.rings = [];
    this.main.setVisible(false);
    this.extra.setVisible(false);
    for (const p of this.prints) p.setVisible(false);
    this.fx.clear();
  }

  /** A fight (or anything that needs the lake to itself) started. The sealed bottle just waits; the rest fade and count as unseen. */
  fadeOut(): void {
    const a = this.active;
    if (a && a.kind !== 'bottle' && a.fadeLeft < 0) a.fadeLeft = MOMENT_TUNING.fadeOutMs;
  }

  // ---- Taps ---------------------------------------------------------------------------------

  private hitRect(canOpenCard: boolean): Phaser.Geom.Rectangle | null {
    const a = this.active;
    if (!a || a.tappedAge >= 0 || a.fadeLeft >= 0) return null;
    const m = MOMENT_TUNING.minTapPx;
    const box = (cx: number, cy: number, w: number, h: number) => {
      const bw = Math.max(m, w);
      const bh = Math.max(m, h);
      return new Phaser.Geom.Rectangle(cx - bw / 2, cy - bh / 2, bw, bh);
    };
    if (a.kind === 'bottle') return canOpenCard && a.age > 500 ? box(a.x, a.y, 28, 28) : null;
    if (a.kind === 'blink') return a.age > 1200 && a.age < a.sinkAt ? box(a.x, a.y, 30, 30) : null;
    return null;
  }

  hit(x: number, y: number, canOpenCard: boolean): boolean {
    return this.hitRect(canOpenCard)?.contains(x, y) ?? false;
  }

  /** Handles a tap; true when it landed on the picture (so it never becomes a cast). */
  tap(x: number, y: number, canOpenCard: boolean): boolean {
    if (!this.hit(x, y, canOpenCard)) return false;
    const a = this.active!;
    if (a.kind === 'bottle') {
      this.hooks.sfx('clink');
      this.hooks.tapBottle();
      return true;
    }
    a.tappedAge = 0;
    this.sink(a);
    return true;
  }

  private sink(a: Active): void {
    this.hooks.sfx('plop');
    this.rings.push({ x: a.x, y: a.y + 2, age: 0, ms: 1500, rx: 14, ry: 4 });
    this.showFloat('...it blinked.', a.x, a.y + 30);
  }

  private showFloat(text: string, x: number, y: number): void {
    this.floatText.setText(text);
    this.floatAt = { x: Math.round(Phaser.Math.Clamp(x, 80, W - 80)), y: Math.round(y) };
    this.floatAge = 0;
  }

  // ---- Per frame ----------------------------------------------------------------------------

  /** `tint` is the day look's world tint (a 0xRRGGBB multiplier). */
  update(dtMs: number, tint: number): void {
    this.floatAge += dtMs;
    this.drawFloat();
    this.fx.clear();
    for (const r of this.rings) r.age += dtMs;
    this.rings = this.rings.filter((r) => r.age < r.ms);
    const a = this.active;
    if (!a) {
      this.drawRings(tint);
      return;
    }
    a.age += dtMs;
    if (a.tappedAge >= 0) a.tappedAge += dtMs;
    if (a.fadeLeft >= 0) a.fadeLeft = Math.max(0, a.fadeLeft - dtMs);
    const fade = a.fadeLeft >= 0 ? a.fadeLeft / MOMENT_TUNING.fadeOutMs : 1;
    this.main.setVisible(false);
    this.extra.setVisible(false);
    let seen = false;
    switch (a.kind) {
      case 'bottle':
        this.updateBottle(a, tint);
        break;
      case 'duck':
        seen = this.updateDuck(a, dtMs, fade, tint);
        break;
      case 'blink':
        seen = this.updateBlink(a, fade, tint);
        break;
      case 'prints':
        seen = this.updatePrints(a, fade, tint);
        break;
      case 'stick':
        seen = this.updateStick(a, fade, tint);
        break;
      case 'duckWorm':
        seen = this.updateDuckWorm(a, dtMs, fade, tint);
        break;
      case 'card':
        break;
    }
    this.drawRings(tint);
    if (a.fadeLeft === 0) this.finish(false);
    else if (seen) this.finish(true);
  }

  private finish(seen: boolean): void {
    this.clear();
    this.hooks.finished(seen);
  }

  private place(img: Phaser.GameObjects.Image, key: string, x: number, y: number, alpha: number, tint: number, depth: number): void {
    img.setTexture(momentKey(key)).setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setTint(tint).setDepth(depth).setVisible(true).setAngle(0).setFlipX(false);
  }

  private ring(cx: number, cy: number, rx: number, ry: number, alpha: number, tint: number): void {
    this.fx.fillStyle(multiply(PAL.foam, tint), alpha);
    for (const p of ringPoints(rx, ry)) this.fx.fillRect(Math.round(cx) + p.x, Math.round(cy) + p.y, 1, 1);
  }

  private drawRings(tint: number): void {
    for (const r of this.rings) {
      const t = r.age / r.ms;
      if (t < 0) continue;
      this.ring(r.x, r.y, r.rx * (0.35 + 0.65 * t), r.ry * (0.35 + 0.65 * t), (1 - t) * 0.85, tint);
    }
  }

  private drawFloat(): void {
    const on = this.floatAge < FLOAT_MS;
    this.floatText.setVisible(on);
    if (!on) return;
    const k = this.floatAge / FLOAT_MS;
    this.floatText.setPosition(this.floatAt.x, this.floatAt.y - k * 16).setAlpha(Math.min(1, (FLOAT_MS - this.floatAge) / 400));
  }

  // ---- The pictures -------------------------------------------------------------------------

  /** R1: Bestia's stick floats upstream (up and to the right, against the current), slowly, then out of sight. */
  private updateStick(a: Active, fade: number, tint: number): boolean {
    const t = clamp01(a.age / STICK_PATH.ms);
    a.x = STICK_PATH.from.x + (STICK_PATH.to.x - STICK_PATH.from.x) * t;
    a.y = STICK_PATH.from.y + (STICK_PATH.to.y - STICK_PATH.from.y) * t + Math.sin(a.age / 600);
    const alpha = clamp01(a.age / 500) * (t > 0.85 ? (1 - t) / 0.15 : 1) * fade;
    this.place(this.main, 'stick', a.x, a.y, alpha, tint, DEPTH.water);
    this.main.setAngle(-14 + Math.round(Math.sin(a.age / 900) * 6));
    // A little wake behind it, pointing back down the river.
    for (let i = 1; i <= 4; i++) this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.8 - i * 0.16)).fillRect(Math.round(a.x - 9 - i * 3), Math.round(a.y + 3 + i), 1, 1);
    return t >= 1;
  }

  /** R4: the duck comes round the bend from upstream with a worm hanging from its beak, stops by the landing for a moment (a quack), and paddles on downstream. */
  private updateDuckWorm(a: Active, dtMs: number, fade: number, tint: number): boolean {
    const alpha = clamp01(a.age / 350) * fade;
    const STOP_X = 196;
    const STOP_MS = 3200;
    if (a.stage === 0) {
      a.x -= 26 * (dtMs / 1000);
      a.y = DUCK_WORM_Y + Math.round((W + 14 - a.x) / 40);
      if (a.x <= STOP_X) {
        a.stage = 1;
        a.stageAt = a.age;
        this.hooks.sfx('quack');
      }
    } else if (a.stage === 1) {
      if (a.age - a.stageAt > STOP_MS) {
        a.stage = 2;
        a.stageAt = a.age;
        this.hooks.sfx('quack');
      }
    } else {
      a.x -= 30 * (dtMs / 1000);
      if (a.x < -26) return true;
    }
    const bob = Math.round(Math.sin(a.age / 520));
    this.place(this.main, 'duck', a.x, a.y + bob, alpha, tint, DEPTH.duck);
    this.main.setFlipX(true);
    // The wake behind (to the right, upstream).
    for (let i = 1; i <= 5; i++) {
      const bx = a.x + 10 + i * 4;
      const spread = Math.round(i * 0.6);
      this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.85 - i * 0.14));
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 - spread, 1, 1);
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 + spread, 1, 1);
    }
    // The worm: pink, hanging from the beak tip and wriggling.
    const wx = Math.round(a.x) - 12;
    const wy = Math.round(a.y) + bob - 2;
    const wig = Math.round(Math.sin(a.age / 140));
    this.fx.fillStyle(PAL.outline, alpha);
    this.fx.fillRect(wx - 1, wy - 1, 3, 1).fillRect(wx - 1 + wig, wy, 4, 10);
    this.fx.fillStyle(multiply(PAL.pink, tint), alpha);
    this.fx.fillRect(wx, wy, 1, 1).fillRect(wx + wig, wy + 1, 2, 8);
    return false;
  }

  private updateBottle(a: Active, tint: number): void {
    // The river's bottle drifts slowly upstream (to the right) and settles in the eddy; the lake's never moves.
    if (a.drift) {
      a.x = Math.min(RIVER_BOTTLE.maxX, RIVER_BOTTLE.x + a.age * 0.0035);
      a.y = RIVER_BOTTLE.y - Math.round((a.x - RIVER_BOTTLE.x) / 22);
    }
    const alpha = clamp01(a.age / 1500);
    const bob = Math.round(Math.sin(a.age / 800));
    this.place(this.main, 'storyBottle', a.x, a.y + bob, alpha, tint, DEPTH.water);
    this.main.setAngle(Math.sin(a.age / 1100) > 0.4 ? 4 : Math.sin(a.age / 1100) < -0.4 ? -4 : 0);
    // Small rings now and then, and a tiny gold glint on the seal so it reads as something special.
    const k = (a.age % 3000) / 3000;
    if (k < 0.5) this.ring(a.x, a.y + 5, 6 + k * 14, 1.5 + k * 4.5, (1 - k * 2) * 0.55 * alpha, tint);
    if (a.age % 2400 > 2100) this.fx.fillStyle(PAL.white, 0.9 * alpha).fillRect(Math.round(a.x) + 5, Math.round(a.y) + bob - 3, 1, 1);
  }

  private updateDuck(a: Active, dtMs: number, fade: number, tint: number): boolean {
    const ENTER_MS = 4500;
    const LUNGE_MS = 380;
    const alpha = clamp01(a.age / 350) * fade;
    const sandwichOn = a.stage === 0 || (a.stage === 1 && a.age - a.stageAt < LUNGE_MS * 0.5);
    if (sandwichOn) this.place(this.extra, 'sandwich', SANDWICH_AT.x, SANDWICH_AT.y, clamp01(a.age / 400) * fade, tint, DEPTH.sandwich);
    let dir = 1;
    if (a.stage === 0) {
      const t = clamp01(a.age / ENTER_MS);
      a.x = -14 + (DUCK_STOP.x + 14) * ease(t);
      if (t >= 1) {
        a.stage = 1;
        a.stageAt = a.age;
        this.hooks.sfx('quack');
      }
    } else if (a.stage === 1) {
      const t = clamp01((a.age - a.stageAt) / LUNGE_MS);
      a.x = DUCK_STOP.x + 7 * Math.sin(t * Math.PI);
      if (t >= 1) {
        a.stage = 2;
        a.stageAt = a.age;
        this.rings.push({ x: DUCK_STOP.x, y: DUCK_STOP.y + 5, age: 0, ms: 900, rx: 10, ry: 3 });
      }
    } else {
      // Off to the left in a hurry, quacking, with the sandwich in its beak.
      dir = -1;
      a.x -= 38 * (dtMs / 1000);
      const since = a.age - a.stageAt;
      if (a.quacks < 3 && since > 300 + a.quacks * 900) {
        a.quacks++;
        this.hooks.sfx('quack');
      }
      if (a.x < -26) return true;
    }
    const hurry = a.stage === 2;
    const bob = Math.round(Math.sin(a.age / (hurry ? 90 : 520)));
    this.place(this.main, 'duck', a.x, a.y + bob, alpha, tint, DEPTH.duck);
    this.main.setFlipX(dir < 0);
    // The wake behind the body; the stolen sandwich between the beak tips.
    for (let i = 1; i <= 5; i++) {
      const bx = a.x - dir * (10 + i * 4);
      const spread = Math.round(i * (hurry ? 0.9 : 0.6));
      this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.85 - i * 0.14));
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 - spread, 1, 1);
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 + spread, 1, 1);
    }
    if (a.stage === 2) {
      const bx = Math.round(a.x) + dir * 12;
      const by = Math.round(a.y) + bob - 3;
      this.fx.fillStyle(PAL.outline, alpha).fillRect(bx - 3, by - 1, 7, 5);
      this.fx.fillStyle(multiply(PAL.strawLight, tint), alpha).fillRect(bx - 2, by, 5, 1).fillRect(bx - 2, by + 2, 5, 1);
      this.fx.fillStyle(multiply(PAL.pink, tint), alpha).fillRect(bx - 2, by + 1, 5, 1);
    }
    return false;
  }

  private updateBlink(a: Active, fade: number, tint: number): boolean {
    // The still water, a glint that is not a star: it fades in, waits, blinks once (slowly), waits, and sinks.
    const sinking = a.tappedAge >= 0 || a.age >= a.sinkAt;
    if (a.tappedAge < 0 && a.age >= a.sinkAt) {
      a.tappedAge = 0;
      this.sink(a);
    }
    const FADE_IN = 2000;
    const BLINK_AT_MS = 4200;
    // Frames of the blink: open, half, shut, hold, half, open (ms from BLINK_AT_MS).
    const b = a.age - BLINK_AT_MS;
    let key = 'blinkOpen';
    if (b >= 0 && b < 2300) key = b < 500 ? 'blinkHalf' : b < 1100 ? 'blinkShut' : b < 1500 ? 'blinkShut' : b < 1900 ? 'blinkHalf' : 'blinkOpen';
    let alpha = clamp01(a.age / FADE_IN) * fade;
    let y = a.y;
    if (sinking) {
      const t = clamp01(a.tappedAge / 1300);
      y = a.y + t * 9;
      alpha *= 1 - t;
      if (t >= 1) return true;
    }
    // A slow glimmer ring around it (never a star in the sky above it: that is the point).
    const pulse = 0.35 + 0.15 * Math.sin(a.age / 700);
    this.ring(a.x, y, 7 + Math.sin(a.age / 900) * 1.5, 2.2, pulse * alpha, tint);
    this.place(this.main, key, a.x, y, alpha, 0xffffff, DEPTH.water);
    return false;
  }

  private updatePrints(a: Active, fade: number, tint: number): boolean {
    const START = 700;
    const outEnd = START + this.outPrints.length * PRINT_OUT_MS;
    const backStart = outEnd + PRINT_GAP_MS;
    const backEnd = backStart + this.backPrints.length * PRINT_BACK_MS;
    const dryStart = backEnd + PRINT_HOLD_MS;
    const end = dryStart + PRINT_DRY_MS;
    const dry = 1 - clamp01((a.age - dryStart) / PRINT_DRY_MS);
    const all = [
      ...this.outPrints.map((p, i) => ({ ...p, at: START + i * PRINT_OUT_MS, out: true })),
      ...this.backPrints.map((p, i) => ({ ...p, at: backStart + i * PRINT_BACK_MS, out: false })),
    ];
    all.forEach((p, i) => {
      const img = this.prints[i];
      const t = (a.age - p.at) / 350;
      if (t < 0) {
        img.setVisible(false);
        return;
      }
      // Prints are 5 x 7: the left and right foot sit a little to each side of the walking line.
      const px = p.x - p.dy * 3 * p.side;
      const py = p.y + p.dx * 3 * p.side;
      this.place(img, 'footprint', px, py, 0.9 * clamp01(t) * dry * fade, tint, DEPTH.planks);
      // Toes point the way she walked: down the dock going out, back up coming home.
      img.setFlipY(p.dy > 0).setFlipX(p.side > 0);
    });
    if (a.stage === 0 && a.age > START) {
      a.stage = 1;
      this.hooks.sfx('plop'); // the first step out of the water
    }
    return a.age >= end;
  }
}
