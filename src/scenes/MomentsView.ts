import Phaser from 'phaser';
import type { SfxName } from '../audio/sound';
import { W } from '../art/layout';
import { ringPoints } from '../art/momentArt';
import { PAL } from '../art/palette';
import { momentKey } from '../art/textures';
import { MOMENTS, MOMENT_TUNING, type MomentKind } from '../core/data/moments';
import { isUncanny } from '../core/moments/moments';
import { randInt, randRange, type Rng } from '../core/random';
import { FONT, FS } from '../font';

/**
 * The picture and the taps of one lake moment at a time (GAME_DESIGN section 3, slice 14). Pure
 * rules (when, which, what a tap gives) live in core/moments; this class only moves sprites. The
 * scene tells it what to spawn and feeds it time; it reports sounds and rewards through hooks.
 */

export interface MomentHooks {
  sfx(name: SfxName): void;
  /** A shooting star was tapped: grant the coins and return how many. */
  claimStar(): number;
  /** The bottle was tapped: open its note card. */
  openBottle(): void;
}

/** Layers (the scene's Z: waterFx 8, waterDecor 9, nearShore 10). */
const DEPTH = { sky: 3.5, under: 8.2, water: 9.4, text: 31.5 } as const;
/** Where things float. Kept clear of the dock and of the bobber column (x = 256). */
const DUCK_Y = { min: 204, max: 232 };
const FROG_SPOTS = [
  { x: 96, y: 320 },
  { x: 176, y: 276 },
  { x: 318, y: 394 },
];
const BOTTLE_REST = { x: 94, y: 420 };
const JUMP_AREA = { x: [40, 320], y: [236, 330] } as const;
const BUBBLE_AREA = { x: [70, 230], y: [262, 332] } as const;
const SHAPE_AREA = { x: [70, 220], y: [250, 320] } as const;
const FLOAT_MS = 1500;

const multiply = (a: number, b: number): number => {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 2;

interface Bubble {
  x: number;
  y: number;
  age: number;
  rise: number;
  big: boolean;
  phase: number;
}
interface Ring {
  x: number;
  y: number;
  age: number;
  ms: number;
  rx: number;
  ry: number;
}

interface Active {
  kind: MomentKind;
  age: number;
  /** Real ms before it ends by itself. */
  life: number;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Set once tapped: ms since, or -1 while untouched. */
  tappedAge: number;
  /** Duck speed in px/s. */
  speed: number;
  /** Star: start/end of the path. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Frog: age at which it plops by itself, and the age at which it did (-1 = still sitting). */
  frogLeaves: number;
  leftAt: number;
  /** Small per-kind progress counter (jump: 0 take-off, 1 flying, 2 landed; frog: 0 hopping, 1 rippled). */
  stage: number;
  /** Bubbles: spawn clock and the next bubbling sound. */
  spawnIn: number;
  nextSound: number;
  /** Quick fade because a fight started (ms left, -1 = not fading). */
  fadeLeft: number;
}

export class MomentsView {
  private fx: Phaser.GameObjects.Graphics;
  private skyFx: Phaser.GameObjects.Graphics;
  private main: Phaser.GameObjects.Image;
  private second: Phaser.GameObjects.Image;
  private floatText: Phaser.GameObjects.Text;
  private floatIcon: Phaser.GameObjects.Image;
  private floatAge = Infinity;
  private floatAt = { x: 0, y: 0 };
  private active: Active | null = null;
  private bubbles: Bubble[] = [];
  private rings: Ring[] = [];
  /** A star sparkle after a tap (burst at x, y). */
  private burst: { x: number; y: number; age: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    private hooks: MomentHooks,
    private rng: Rng,
  ) {
    this.fx = scene.add.graphics().setDepth(DEPTH.water + 0.05);
    this.skyFx = scene.add.graphics().setDepth(DEPTH.sky);
    this.main = scene.add.image(0, 0, momentKey('duck')).setOrigin(0.5, 0.5).setVisible(false);
    this.second = scene.add.image(0, 0, momentKey('duck')).setOrigin(0.5, 0.5).setVisible(false);
    this.floatText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: '#ffd35a', stroke: '#241a2e', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setDepth(DEPTH.text)
      .setVisible(false);
    this.floatIcon = scene.add.image(0, 0, momentKey('starHead')).setDepth(DEPTH.text).setVisible(false);
  }

  /** The moment on screen, or null. */
  get kind(): MomentKind | null {
    return this.active?.kind ?? null;
  }

  /** An uncanny moment is on screen (the crickets dip). */
  get uncanny(): boolean {
    return this.active !== null && isUncanny(this.active.kind);
  }

  // ---- Spawning ---------------------------------------------------------------------------

  spawn(kind: MomentKind): void {
    this.clear();
    const r = this.rng;
    const life = MOMENTS[kind].durationMs;
    const a: Active = {
      kind,
      age: 0,
      life,
      x: 0,
      y: 0,
      dir: r() < 0.5 ? 1 : -1,
      tappedAge: -1,
      speed: 0,
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      frogLeaves: 0,
      leftAt: -1,
      stage: 0,
      spawnIn: 0,
      nextSound: 0,
      fadeLeft: -1,
    };
    switch (kind) {
      case 'duck':
        a.speed = randRange(r, 15, 20);
        a.x = a.dir > 0 ? -12 : W + 12;
        a.y = Math.round(randRange(r, DUCK_Y.min, DUCK_Y.max));
        break;
      case 'frog': {
        const s = FROG_SPOTS[Math.floor(r() * FROG_SPOTS.length)];
        a.x = s.x;
        a.y = s.y;
        a.frogLeaves = life - 2800;
        break;
      }
      case 'jump':
        a.x = Math.round(randRange(r, JUMP_AREA.x[0], JUMP_AREA.x[1]));
        a.y = Math.round(randRange(r, JUMP_AREA.y[0], JUMP_AREA.y[1]));
        break;
      case 'star': {
        // A falling star: from high on one side to lower on the other, well inside the sky.
        const y0 = randRange(r, 18, 56);
        a.from = { x: a.dir > 0 ? 40 : W - 40, y: y0 };
        a.to = { x: a.dir > 0 ? W - 40 : 40, y: y0 + 70 };
        a.x = a.from.x;
        a.y = a.from.y;
        break;
      }
      case 'bottle':
        a.x = -14;
        a.y = BOTTLE_REST.y;
        break;
      case 'bubbles':
        a.x = Math.round(randRange(r, BUBBLE_AREA.x[0], BUBBLE_AREA.x[1]));
        a.y = Math.round(randRange(r, BUBBLE_AREA.y[0], BUBBLE_AREA.y[1]));
        a.nextSound = 0;
        break;
      case 'shape':
        a.x = Math.round(randRange(r, SHAPE_AREA.x[0], SHAPE_AREA.x[1]));
        a.y = Math.round(randRange(r, SHAPE_AREA.y[0], SHAPE_AREA.y[1]));
        break;
    }
    this.active = a;
  }

  /** Ends whatever is on screen at once (the scene was reset, or a dev respawn). */
  clear(): void {
    this.active = null;
    this.bubbles = [];
    this.rings = [];
    this.burst = null;
    this.main.setVisible(false);
    this.second.setVisible(false);
    this.fx.clear();
    this.skyFx.clear();
  }

  /** A fight (or anything that needs the lake to itself) started: fade out quickly. */
  fadeOut(): void {
    if (this.active && this.active.fadeLeft < 0) this.active.fadeLeft = MOMENT_TUNING.fadeOutMs;
  }

  // ---- Taps -------------------------------------------------------------------------------

  /** The tappable box of the moment (at least minTapPx square), or null when nothing can be tapped. */
  private hitRect(canOpenCard: boolean): Phaser.Geom.Rectangle | null {
    const a = this.active;
    if (!a || a.tappedAge >= 0 || a.fadeLeft >= 0) return null;
    const m = MOMENT_TUNING.minTapPx;
    const box = (cx: number, cy: number, w: number, h: number) => {
      const bw = Math.max(m, w);
      const bh = Math.max(m, h);
      return new Phaser.Geom.Rectangle(cx - bw / 2, cy - bh / 2, bw, bh);
    };
    switch (a.kind) {
      case 'duck':
        return box(a.x, a.y, 24, 24);
      case 'frog':
        return a.age < a.frogLeaves && a.age > 300 ? box(a.x, a.y + 3, 24, 24) : null;
      case 'jump':
        return null;
      case 'star':
        return box(a.x, a.y, 56, 56); // a fast thing: a generous box
      case 'bottle':
        return canOpenCard && a.age > 600 ? box(a.x, a.y, 24, 24) : null;
      case 'bubbles':
        return box(a.x, a.y - 12, 40, 44);
      case 'shape':
        return box(a.x, a.y, 40, 40);
    }
  }

  /** Is this point on the moment (so the press must not become a cast)? */
  hit(x: number, y: number, canOpenCard: boolean): boolean {
    return this.hitRect(canOpenCard)?.contains(x, y) ?? false;
  }

  /** Handles a tap; true when it landed on the moment. The bottle opens a card, so it needs `canOpenCard` (idle). */
  tap(x: number, y: number, canOpenCard: boolean): boolean {
    if (!this.hit(x, y, canOpenCard)) return false;
    const a = this.active!;
    a.tappedAge = 0;
    switch (a.kind) {
      case 'duck':
        this.hooks.sfx('quack');
        a.speed *= 3.2; // paddles off in a hurry
        break;
      case 'frog':
        this.hooks.sfx('plop');
        a.leftAt = a.age;
        break;
      case 'star': {
        const coins = this.hooks.claimStar();
        this.hooks.sfx('sparkle');
        this.burst = { x: a.x, y: a.y, age: 0 };
        this.showFloat(`Make a wish!\n+${coins} coins`, a.x, a.y + 4, true);
        break;
      }
      case 'bottle':
        this.hooks.sfx('clink');
        this.hooks.openBottle();
        break;
      case 'bubbles':
        this.showFloat('…', a.x, a.y - 14, false);
        break;
      case 'shape':
        this.showFloat('…', a.x, a.y - 12, false);
        this.rings.push({ x: a.x, y: a.y, age: 0, ms: 1100, rx: 10, ry: 3 });
        break;
    }
    return true;
  }

  private showFloat(text: string, x: number, y: number, icon: boolean): void {
    this.floatText.setText(text);
    this.floatAt = { x: Math.round(Phaser.Math.Clamp(x, 70, W - 70)), y: Math.round(y) };
    this.floatAge = 0;
    this.floatIcon.setData('show', icon);
  }

  // ---- Per frame --------------------------------------------------------------------------

  /** `tint` is the day look's world tint (a 0xRRGGBB multiplier). */
  update(dtMs: number, tint: number): void {
    this.floatAge += dtMs;
    this.drawFloat();
    const g = this.fx;
    g.clear();
    this.skyFx.clear();
    for (const r of this.rings) r.age += dtMs;
    this.rings = this.rings.filter((r) => r.age < r.ms);
    if (this.burst) {
      this.burst.age += dtMs;
      if (this.burst.age > 900) this.burst = null;
    }
    const a = this.active;
    if (!a) {
      this.main.setVisible(false);
      this.second.setVisible(false);
      this.drawRings(tint);
      this.drawBurst();
      return;
    }
    a.age += dtMs;
    if (a.tappedAge >= 0) a.tappedAge += dtMs;
    if (a.fadeLeft >= 0) a.fadeLeft -= dtMs;
    const fade = a.fadeLeft >= 0 ? Math.max(0, a.fadeLeft / MOMENT_TUNING.fadeOutMs) : 1;
    const inAlpha = Math.min(1, a.age / 350);
    const alpha = inAlpha * fade;
    let done = a.fadeLeft === 0 || (a.fadeLeft < 0 && a.age >= a.life);
    this.main.setVisible(false);
    this.second.setVisible(false);

    switch (a.kind) {
      case 'duck':
        done = this.updateDuck(a, dtMs, alpha, tint) || done;
        break;
      case 'frog':
        done = this.updateFrog(a, alpha, tint) || done;
        break;
      case 'jump':
        this.updateJump(a, tint);
        break;
      case 'star':
        done = this.updateStar(a) || done;
        break;
      case 'bottle':
        done = this.updateBottle(a, alpha, tint) || done;
        break;
      case 'bubbles':
        done = this.updateBubbles(a, dtMs, alpha, tint) || done;
        break;
      case 'shape':
        done = this.updateShape(a, dtMs, tint) || done;
        break;
    }
    this.drawRings(tint);
    this.drawBurst();
    if (done) this.clearActive();
  }

  private clearActive(): void {
    this.active = null;
    this.bubbles = [];
    this.main.setVisible(false);
    this.second.setVisible(false);
  }

  private place(img: Phaser.GameObjects.Image, key: string, x: number, y: number, alpha: number, tint: number, depth: number): void {
    img.setTexture(momentKey(key)).setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setTint(tint).setDepth(depth).setVisible(true);
  }

  private drawRings(tint: number): void {
    for (const r of this.rings) {
      const t = r.age / r.ms;
      this.ring(r.x, r.y, r.rx * (0.35 + 0.65 * t), r.ry * (0.35 + 0.65 * t), (1 - t) * 0.85, tint);
    }
  }

  private ring(cx: number, cy: number, rx: number, ry: number, alpha: number, tint: number): void {
    this.fx.fillStyle(multiply(PAL.foam, tint), alpha);
    for (const p of ringPoints(rx, ry)) this.fx.fillRect(Math.round(cx) + p.x, Math.round(cy) + p.y, 1, 1);
  }

  private drawFloat(): void {
    const on = this.floatAge < FLOAT_MS;
    const showIcon = on && this.floatIcon.getData('show') === true;
    this.floatText.setVisible(on);
    this.floatIcon.setVisible(showIcon);
    if (!on) return;
    const k = this.floatAge / FLOAT_MS;
    const alpha = Math.min(1, (FLOAT_MS - this.floatAge) / 400);
    const y = this.floatAt.y - 16 - k * 22;
    this.floatText.setPosition(this.floatAt.x, y).setAlpha(alpha);
    this.floatIcon.setPosition(this.floatAt.x, y - 30 + Math.round(Math.sin(this.floatAge / 140))).setAlpha(alpha);
  }

  private drawBurst(): void {
    const b = this.burst;
    if (!b) return;
    const t = b.age / 900;
    const g = this.skyFx;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.3;
      const d = 6 + t * 26;
      g.fillStyle(i % 2 ? PAL.white : PAL.gold, 1 - t);
      g.fillRect(Math.round(b.x + Math.cos(ang) * d), Math.round(b.y + Math.sin(ang) * d), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  }

  // ---- The moments ------------------------------------------------------------------------

  private updateDuck(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    a.x += a.dir * a.speed * (dtMs / 1000);
    const hurry = a.tappedAge >= 0;
    const bob = Math.round(Math.sin(a.age / (hurry ? 90 : 520)));
    this.place(this.main, 'duck', a.x, a.y + bob, alpha, tint, DEPTH.water);
    this.main.setFlipX(a.dir < 0).setAngle(0);
    // The wake: foam dots trailing behind the body in a V; wider when it hurries.
    for (let i = 1; i <= 5; i++) {
      const bx = a.x - a.dir * (6 + i * 4);
      const spread = Math.round(i * (hurry ? 0.9 : 0.6));
      this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.85 - i * 0.14));
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 4 - spread, 1, 1);
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 4 + spread, 1, 1);
    }
    return a.x > W + 20 || a.x < -20;
  }

  private updateFrog(a: Active, alpha: number, tint: number): boolean {
    if (a.leftAt < 0 && a.age >= a.frogLeaves) {
      a.leftAt = a.age; // it hops in on its own
      a.tappedAge = 0;
      this.hooks.sfx('plop');
    }
    const padY = a.y + 5;
    if (a.leftAt < 0) {
      // Sitting: idle most of the time, throat puffed for a moment now and then.
      const puff = a.age % 3200 > 2500;
      this.place(this.main, puff ? 'frogPuff' : 'frogIdle', a.x, a.y, alpha, tint, DEPTH.water);
      this.place(this.second, 'frogPad', a.x, padY, alpha, tint, DEPTH.water - 0.01);
      return false;
    }
    // The hop: the frog arcs sideways into the water and plops; the pad stays a moment, then fades.
    const since = a.age - a.leftAt;
    const hopMs = 320;
    const t = since / hopMs;
    if (t < 1) {
      this.place(this.main, 'frogIdle', a.x + 8 * t * a.dir, a.y - Math.sin(t * Math.PI) * 10 + 4 * t * t, alpha, tint, DEPTH.water);
      this.place(this.second, 'frogPad', a.x, padY, alpha, tint, DEPTH.water - 0.01);
      return false;
    }
    if (a.stage === 0) {
      a.stage = 1;
      this.rings.push({ x: a.x + 8 * a.dir, y: padY + 1, age: 0, ms: 1200, rx: 9, ry: 3 });
    }
    const padAlpha = alpha * Math.max(0, 1 - (since - hopMs - 1200) / 700);
    if (padAlpha <= 0) return true;
    this.place(this.second, 'frogPad', a.x, padY, padAlpha, tint, DEPTH.water - 0.01);
    return false;
  }

  private updateJump(a: Active, tint: number): void {
    const flightMs = 700;
    const reach = 26 * a.dir;
    const height = 28;
    if (a.stage === 0) {
      a.stage = 1;
      this.hooks.sfx('plop');
      this.rings.push({ x: a.x, y: a.y, age: 0, ms: 700, rx: 7, ry: 2 });
    }
    const t = a.age / flightMs;
    if (t < 1) {
      const px = a.x + reach * t;
      const py = a.y - Math.sin(t * Math.PI) * height;
      // Tilted along the arc in 15 degree steps so it stays chunky; mirrored when it flies left.
      const tilt = Math.atan2(-Math.cos(t * Math.PI) * height * Math.PI, Math.abs(reach));
      const snapped = Math.round((tilt * 180) / Math.PI / 15) * 15;
      this.place(this.main, 'jumpFish', px, py, 1, tint, DEPTH.water);
      this.main.setFlipX(a.dir < 0).setAngle(a.dir > 0 ? snapped : -snapped);
    } else if (a.stage === 1) {
      a.stage = 2;
      this.hooks.sfx('plop');
      const lx = a.x + reach;
      this.rings.push({ x: lx, y: a.y, age: 0, ms: 1300, rx: 15, ry: 4.5 });
      this.rings.push({ x: lx, y: a.y, age: -260, ms: 1300, rx: 15, ry: 4.5 });
    }
  }

  private updateStar(a: Active): boolean {
    const dur = a.life - 100;
    const t = Math.min(1, a.age / dur);
    if (a.tappedAge < 0) {
      a.x = a.from.x + (a.to.x - a.from.x) * t;
      a.y = a.from.y + (a.to.y - a.from.y) * t;
      const len = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
      const ux = (a.to.x - a.from.x) / len;
      const uy = (a.to.y - a.from.y) / len;
      const g = this.skyFx;
      const lead = Math.min(1, a.age / 250);
      // The trail: points behind the head, shrinking and fading.
      for (let i = 1; i <= 18; i++) {
        const back = i * 3;
        const k = 1 - i / 19;
        g.fillStyle(i < 6 ? PAL.white : PAL.gold, k * 0.9 * lead);
        g.fillRect(Math.round(a.x - ux * back), Math.round(a.y - uy * back), 1, 1);
        if (i < 9) g.fillRect(Math.round(a.x - ux * back), Math.round(a.y - uy * back) + 1, 1, 1);
      }
      const end = t > 0.9 ? (1 - t) / 0.1 : 1;
      this.place(this.main, 'starHead', a.x, a.y, lead * end, 0xffffff, DEPTH.sky + 0.1);
      this.main.setAngle(0).setFlipX(false);
    }
    // After a tap the sparkle burst (drawn by drawBurst) plays out, then it is over.
    return a.tappedAge >= 900 || (a.tappedAge < 0 && a.age >= a.life);
  }

  private updateBottle(a: Active, alpha: number, tint: number): boolean {
    if (a.tappedAge >= 0) return true; // taken: the note card opens, the bottle is gone
    const approachMs = 7000;
    const leaveMs = 6000;
    const stayEnd = a.life - leaveMs;
    let x = BOTTLE_REST.x;
    let al = alpha;
    if (a.age < approachMs) {
      x = -14 + (BOTTLE_REST.x + 14) * ease(a.age / approachMs);
    } else if (a.age >= stayEnd) {
      const t = (a.age - stayEnd) / leaveMs; // drifts off to the left again
      x = BOTTLE_REST.x - 40 * t;
      al = alpha * (1 - t);
    }
    a.x = x;
    a.y = BOTTLE_REST.y + Math.round(Math.sin(a.age / 700));
    this.place(this.main, 'bottle', x, a.y, al, tint, DEPTH.water);
    this.main.setFlipX(false).setAngle(Math.sin(a.age / 900) > 0 ? 5 : 0);
    // Small rings now and then where it sits.
    const k = (a.age % 2600) / 2600;
    if (a.age > approachMs && k < 0.5) this.ring(x, a.y + 4, 4 + k * 12, 1.5 + k * 4, (1 - k * 2) * 0.55 * al, tint);
    return false;
  }

  private updateBubbles(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    const stopped = a.tappedAge >= 0;
    if (!stopped && a.age < a.life - 2500) {
      a.spawnIn -= dtMs;
      if (a.spawnIn <= 0) {
        a.spawnIn = randRange(this.rng, 160, 340);
        this.bubbles.push({ x: a.x + randInt(this.rng, -5, 5), y: a.y, age: 0, rise: randRange(this.rng, 22, 36), big: this.rng() < 0.4, phase: this.rng() * 6 });
      }
      a.nextSound -= dtMs;
      if (a.nextSound <= 0) {
        a.nextSound = 3400;
        this.hooks.sfx('bubbles');
      }
    }
    // A faint dark patch where they come from.
    this.fx.fillStyle(multiply(PAL.deep0, tint), 0.3 * alpha);
    for (const p of ringPoints(5, 1.6)) this.fx.fillRect(Math.round(a.x) + p.x, Math.round(a.y) + 2 + p.y, 1, 1);
    const RISE_MS = 1700;
    for (const b of this.bubbles) b.age += dtMs * (stopped ? 2.4 : 1);
    for (const b of this.bubbles) {
      const t = b.age / RISE_MS;
      if (t >= 1) continue;
      const x = Math.round(b.x + Math.sin(b.phase + t * 7) * 2);
      const y = Math.round(b.y - b.rise * ease(t));
      const al = (t > 0.8 ? (1 - t) / 0.2 : 1) * alpha;
      this.fx.fillStyle(multiply(PAL.foam, tint), al);
      if (b.big) {
        for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]]) this.fx.fillRect(x + dx, y + dy, 1, 1);
        this.fx.fillStyle(multiply(PAL.white, tint), al).fillRect(x + 1, y - 1, 1, 1);
      } else {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) this.fx.fillRect(x + dx, y + dy, 1, 1);
      }
      if (t > 0.9) this.ring(x, y, 3 + (t - 0.9) * 40, 1 + (t - 0.9) * 12, (1 - t) * 5 * 0.5, tint);
    }
    this.bubbles = this.bubbles.filter((b) => b.age < RISE_MS);
    if (stopped) return this.bubbles.length === 0 || a.tappedAge > 700;
    return a.age >= a.life && this.bubbles.length === 0;
  }

  private updateShape(a: Active, dtMs: number, tint: number): boolean {
    const under = multiply(tint, 0x7f8aa0);
    if (a.tappedAge >= 0) {
      // It sinks: down a few pixels and gone.
      const t = Math.min(1, a.tappedAge / 800);
      this.place(this.main, 'shape', a.x, a.y + t * 10, 0.5 * (1 - t), under, DEPTH.under);
      return t >= 1;
    }
    a.x += a.dir * 4 * (dtMs / 1000); // a slow drift
    const fade = a.fadeLeft >= 0 ? Math.max(0, a.fadeLeft / MOMENT_TUNING.fadeOutMs) : 1;
    const al = 0.55 * Math.min(1, a.age / 2200) * Math.min(1, (a.life - a.age) / 2400) * fade;
    this.place(this.main, 'shape', a.x, a.y + Math.round(Math.sin(a.age / 900)), al, under, DEPTH.under);
    this.main.setFlipX(a.dir < 0).setAngle(0);
    return false;
  }
}
