import Phaser from 'phaser';
import type { SfxName } from '../audio/sound';
import { W } from '../art/layout';
import { BUBBLE_BIG, BUBBLE_BIG_HIGHLIGHT, BUBBLE_SMALL, ringPoints } from '../art/momentArt';
import { PAL } from '../art/palette';
import { momentKey } from '../art/textures';
import { MOMENTS, MOMENT_TUNING, type MomentKind } from '../core/data/moments';
import { easeMomentDim, isUncanny, tickMomentAge } from '../core/moments/moments';
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
  /** A paper boat was caught: grant its worms (about 1 in 4 holds some) and return how many (0 = an empty boat). */
  claimBoat(): number;
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
/** River bend (slice 25e): where its moments play. The river runs right to left; the rope and landing are on the left, the dock in the middle. */
const KINGFISHER_DIVE_X = [120, 300] as const;
const KINGFISHER_Y = { min: 244, max: 292 };
const OTTER_AREA = { x: [130, 270], y: [240, 282] } as const;
const LANTERN_Y = { min: 262, max: 300 };
const BOAT_Y = { min: 262, max: 322 };
/** The heron's feet: in the shallows by the right bank. */
const HERON_FEET = { x: 300, y: 350 };
/** The kingfisher's timeline (ms): fly in, hover, dive, under the water, emerge with a fish, fly away. */
const KF = { inEnd: 2000, hoverEnd: 2500, diveEnd: 2850, underEnd: 3400, emergeEnd: 4200, end: 7200 } as const;

const multiply = (a: number, b: number): number => {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
/** Half way to white: things that should still read at night (bubbles) use this instead of the full tint. */
const lift = (tint: number): number => {
  const ch = (s: number) => ((((tint >> s) & 255) + 255) >> 1) << s;
  return ch(16) | ch(8) | ch(0);
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
  private paused = false;
  /** 1 = full, MOMENT_TUNING.pausedAlpha = fully dimmed; eased so it does not pop. */
  private dim = 1;
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
        const y0 = randRange(r, 60, 72);
        a.from = { x: a.dir > 0 ? 130 : 330, y: y0 };
        a.to = { x: a.dir > 0 ? 330 : 130, y: y0 + 40 };
        a.x = a.from.x;
        a.y = a.from.y;
        break;
      }
      case 'bottle':
        a.x = -20;
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
      case 'kingfisher':
        // `to` is where it dives (the water), `from.x` where it came in from.
        a.to = { x: Math.round(randRange(r, KINGFISHER_DIVE_X[0], KINGFISHER_DIVE_X[1])), y: Math.round(randRange(r, KINGFISHER_Y.min, KINGFISHER_Y.max)) };
        a.from = { x: a.dir > 0 ? -16 : W + 16, y: 0 };
        a.x = a.from.x;
        a.y = a.to.y - 60;
        break;
      case 'otter':
        a.x = Math.round(randRange(r, OTTER_AREA.x[0], OTTER_AREA.x[1]));
        a.y = Math.round(randRange(r, OTTER_AREA.y[0], OTTER_AREA.y[1]));
        a.speed = 3; // drifts a little downstream (left) while it eats
        break;
      case 'lantern':
        a.dir = 1; // upstream, to the right
        a.x = 20;
        a.y = Math.round(randRange(r, LANTERN_Y.min, LANTERN_Y.max));
        a.speed = 9;
        break;
      case 'paperBoat':
        a.dir = -1; // downstream, to the left
        a.x = W + 12;
        a.y = Math.round(randRange(r, BOAT_Y.min, BOAT_Y.max));
        a.speed = randRange(r, 13, 17);
        break;
      case 'heron':
        a.x = HERON_FEET.x;
        a.y = HERON_FEET.y;
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

  /**
   * A hook, fight or show-off is on: the moment waits (its animation and lifetime freeze, it dims a
   * little) and picks up again with the lifetime it had left when this goes back to false.
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  // ---- Taps -------------------------------------------------------------------------------

  /** The tappable box of the moment (at least minTapPx square), or null when nothing can be tapped. */
  private hitRect(canOpenCard: boolean): Phaser.Geom.Rectangle | null {
    const a = this.active;
    if (!a || a.tappedAge >= 0 || this.paused) return null;
    const m = MOMENT_TUNING.minTapPx;
    const box = (cx: number, cy: number, w: number, h: number) => {
      const bw = Math.max(m, w);
      const bh = Math.max(m, h);
      return new Phaser.Geom.Rectangle(cx - bw / 2, cy - bh / 2, bw, bh);
    };
    switch (a.kind) {
      case 'duck':
        return box(a.x, a.y, 28, 28);
      case 'frog':
        return a.age < a.frogLeaves && a.age > 300 ? box(a.x, a.y + 4, 28, 28) : null;
      case 'jump':
        return null;
      case 'star':
        return box(a.x, a.y, 56, 56); // a fast thing: a generous box
      case 'bottle':
        return canOpenCard && a.age > 600 ? box(a.x, a.y, 28, 28) : null;
      case 'bubbles':
        return box(a.x, a.y - 12, 40, 44);
      case 'shape':
        return box(a.x, a.y, 40, 40);
      case 'kingfisher':
        return a.stage === 0 && a.age > 400 && a.age < KF.diveEnd ? box(a.x, a.y, 44, 44) : null;
      case 'otter':
        return a.stage === 0 && a.age > 500 ? box(a.x, a.y, 44, 28) : a.stage === 2 ? box(a.x, a.y - 4, 36, 36) : null;
      case 'lantern':
        return box(a.x, a.y, 40, 44);
      case 'paperBoat':
        return box(a.x, a.y, 44, 36);
      case 'heron':
        return a.stage === 0 && a.age > 600 ? box(a.x, a.y - 14, 40, 52) : null;
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
        this.showFloat(`Make a wish!\n+${coins} coins`, a.x, a.y + 44, true);
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
      case 'kingfisher':
        // It is off at once, chirping, without its fish.
        this.hooks.sfx('chirp');
        this.showFloat('Tsee!', a.x, a.y + 26, false);
        a.stage = 1;
        a.tappedAge = 0;
        a.leftAt = a.age;
        a.from = { x: a.dir > 0 ? -16 : W + 16, y: 0 };
        break;
      case 'otter':
        // It rolls over and dives (stage 1), is gone a moment, then pops up again a little way off (stage 2) and dives for good.
        this.hooks.sfx('plop');
        a.stage = 1;
        a.leftAt = a.age;
        this.rings.push({ x: a.x, y: a.y + 3, age: 0, ms: 1400, rx: 16, ry: 4.5 });
        break;
      case 'lantern':
        this.showFloat('...', a.x, a.y + 30, false);
        break;
      case 'paperBoat': {
        const worms = this.hooks.claimBoat();
        this.hooks.sfx(worms > 0 ? 'sparkle' : 'tap');
        this.showFloat(worms > 0 ? `+${worms} worms!` : 'Only a boat.', a.x, a.y + 26, false);
        break;
      }
      case 'heron':
        this.hooks.sfx('boof');
        this.showFloat('Hmph.', a.x, a.y - 52, false);
        a.stage = 1;
        a.leftAt = a.age;
        break;
    }
    return true;
  }

  private showFloat(text: string, x: number, y: number, icon: boolean): void {
    this.floatText.setText(text);
    this.floatAt = { x: Math.round(Phaser.Math.Clamp(x, 80, W - 80)), y: Math.round(y) };
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
    this.dim = easeMomentDim(this.dim, this.paused, dtMs);
    // Paused: the moment's own clock stands still (age, tap timer and movement), only the dim eases.
    const mdt = tickMomentAge(0, dtMs, !this.paused);
    a.age += mdt;
    if (a.tappedAge >= 0) a.tappedAge += mdt;
    dtMs = mdt;
    const alpha = Math.min(1, a.age / 350);
    let done = a.age >= a.life;
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
      case 'kingfisher':
        done = this.updateKingfisher(a, tint);
        break;
      case 'otter':
        done = this.updateOtter(a, dtMs, alpha, tint) || done;
        break;
      case 'lantern':
        done = this.updateLantern(a, dtMs, alpha, tint) || done;
        break;
      case 'paperBoat':
        done = this.updatePaperBoat(a, dtMs, alpha, tint) || done;
        break;
      case 'heron':
        done = this.updateHeron(a, dtMs, alpha, tint) || done;
        break;
    }
    this.main.setAlpha(this.main.alpha * this.dim);
    this.second.setAlpha(this.second.alpha * this.dim);
    this.fx.setAlpha(this.dim);
    this.skyFx.setAlpha(this.dim);
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
    img.setTexture(momentKey(key)).setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setTint(tint).setDepth(depth).setVisible(true).setOrigin(0.5, 0.5).setFlipX(false).setFlipY(false).setAngle(0);
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
    const y = this.floatAt.y - k * 16;
    this.floatText.setPosition(this.floatAt.x, y).setAlpha(alpha);
    this.floatIcon.setPosition(this.floatAt.x, y - 36 + Math.round(Math.sin(this.floatAge / 140))).setAlpha(alpha);
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
      const bx = a.x - a.dir * (10 + i * 4);
      const spread = Math.round(i * (hurry ? 0.9 : 0.6));
      this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.85 - i * 0.14));
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 - spread, 1, 1);
      this.fx.fillRect(Math.round(bx), Math.round(a.y) + 5 + spread, 1, 1);
    }
    return a.x > W + 20 || a.x < -20;
  }

  private updateFrog(a: Active, alpha: number, tint: number): boolean {
    if (a.leftAt < 0 && a.age >= a.frogLeaves) {
      a.leftAt = a.age; // it hops in on its own
      a.tappedAge = 0;
      this.hooks.sfx('plop');
    }
    const padY = a.y + 7;
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
      this.place(this.main, 'frogIdle', a.x + 10 * t * a.dir, a.y - Math.sin(t * Math.PI) * 12 + 6 * t * t, alpha * (t > 0.7 ? (1 - t) / 0.3 : 1), tint, DEPTH.water);
      this.place(this.second, 'frogPad', a.x, padY, alpha, tint, DEPTH.water - 0.01);
      return false;
    }
    if (a.stage === 0) {
      a.stage = 1;
      this.rings.push({ x: a.x + 10 * a.dir, y: padY + 1, age: 0, ms: 1200, rx: 11, ry: 3.5 });
    }
    const padAlpha = alpha * Math.max(0, 1 - (since - hopMs - 1200) / 700);
    if (padAlpha <= 0) return true;
    this.place(this.second, 'frogPad', a.x, padY, padAlpha, tint, DEPTH.water - 0.01);
    return false;
  }

  private updateJump(a: Active, tint: number): void {
    const flightMs = 700;
    const reach = 34 * a.dir;
    const height = 40;
    if (a.stage === 0) {
      a.stage = 1;
      this.hooks.sfx('plop');
      this.rings.push({ x: a.x, y: a.y, age: 0, ms: 700, rx: 9, ry: 2.5 });
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
      this.rings.push({ x: lx, y: a.y, age: 0, ms: 1300, rx: 18, ry: 5.5 });
      this.rings.push({ x: lx, y: a.y, age: -260, ms: 1300, rx: 18, ry: 5.5 });
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
      for (let i = 1; i <= 34; i++) {
        const back = i * 1.5;
        const k = 1 - i / 35;
        g.fillStyle(i < 10 ? PAL.white : PAL.gold, k * 0.85 * lead);
        g.fillRect(Math.round(a.x - ux * back), Math.round(a.y - uy * back), 1, 1);
        if (i < 16) g.fillRect(Math.round(a.x - ux * back), Math.round(a.y - uy * back) + 1, 1, 1);
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
      x = -20 + (BOTTLE_REST.x + 20) * ease(a.age / approachMs);
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
    if (a.age > approachMs && k < 0.5) this.ring(x, a.y + 5, 5 + k * 14, 1.5 + k * 4.5, (1 - k * 2) * 0.55 * al, tint);
    return false;
  }

  private updateBubbles(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    const stopped = a.tappedAge >= 0;
    if (!stopped && a.age < a.life - 2500) {
      a.spawnIn -= dtMs;
      if (a.spawnIn <= 0) {
        a.spawnIn = randRange(this.rng, 70, 170);
        this.bubbles.push({ x: a.x + randInt(this.rng, -5, 5), y: a.y, age: 0, rise: randRange(this.rng, 28, 44), big: this.rng() < 0.5, phase: this.rng() * 6 });
      }
      a.nextSound -= dtMs;
      if (a.nextSound <= 0) {
        a.nextSound = 3400;
        this.hooks.sfx('bubbles');
      }
    }
    // A faint dark patch where they come from.
    this.fx.fillStyle(multiply(PAL.deep0, tint), 0.45 * alpha * Math.min(1, Math.max(0, (a.life - a.age) / 1500)));
    for (const p of ringPoints(7, 2.2)) this.fx.fillRect(Math.round(a.x) + p.x, Math.round(a.y) + 2 + p.y, 1, 1);
    const RISE_MS = 1700;
    for (const b of this.bubbles) b.age += dtMs * (stopped ? 2.4 : 1);
    for (const b of this.bubbles) {
      const t = b.age / RISE_MS;
      if (t >= 1) continue;
      const x = Math.round(b.x + Math.sin(b.phase + t * 7) * 2);
      const y = Math.round(b.y - b.rise * ease(t));
      const al = (t > 0.8 ? (1 - t) / 0.2 : 1) * alpha;
      this.fx.fillStyle(multiply(PAL.white, lift(tint)), Math.min(1, al * 1.5));
      for (const [dx, dy] of b.big ? BUBBLE_BIG : BUBBLE_SMALL) this.fx.fillRect(x + dx, y + dy, 1, 1);
      if (b.big) this.fx.fillStyle(multiply(PAL.foam, lift(tint)), al).fillRect(x + BUBBLE_BIG_HIGHLIGHT[0], y + BUBBLE_BIG_HIGHLIGHT[1], 1, 1);
      if (t > 0.9) this.ring(x, y, 3 + (t - 0.9) * 40, 1 + (t - 0.9) * 12, (1 - t) * 5 * 0.5, tint);
    }
    this.bubbles = this.bubbles.filter((b) => b.age < RISE_MS);
    if (stopped) return this.bubbles.length === 0 || a.tappedAge > 700;
    return a.age >= a.life && this.bubbles.length === 0;
  }

  // ---- River bend moments (slice 25e) ---------------------------------------------------------

  /** A small silver fish held in a beak at (x, y), pointing `dir` (drawn with rects: 5 x 2). */
  private fishInBeak(x: number, y: number, dir: 1 | -1, alpha: number, tint: number): void {
    const x0 = dir > 0 ? x : x - 4;
    this.fx.fillStyle(PAL.outline, alpha).fillRect(x0 - 1, y - 1, 7, 4);
    this.fx.fillStyle(multiply(PAL.foam, tint), alpha).fillRect(x0, y, 5, 2);
    this.fx.fillStyle(multiply(PAL.shallow2, tint), alpha).fillRect(dir > 0 ? x0 + 4 : x0, y, 1, 2);
  }

  /** The kingfisher: a blue flash flies in, hovers, dives with a splash and comes up with a fish, then is gone. A tap sends it off chirping. */
  private updateKingfisher(a: Active, tint: number): boolean {
    const d = a.dir;
    const ex = a.from.x; // where it came in from: it leaves toward the same side
    const wing = Math.floor(a.age / 110) % 2 === 0 ? 'kingfisherUp' : 'kingfisherDown';
    const face = (img: Phaser.GameObjects.Image, dir: number) => img.setFlipX(dir < 0);
    if (a.stage === 1) {
      // Chased off by the tap: straight away, rising, back toward where it came from.
      const t = (a.age - a.leftAt) / 1800;
      if (t >= 1) return true;
      const out = ex < 0 ? -1 : 1;
      const x = a.x + out * t * 200;
      this.place(this.main, wing, x, a.y - t * 60, 1 - t * t, tint, DEPTH.water + 0.1);
      face(this.main, out);
      return false;
    }
    const dive = a.to;
    const startX = ex;
    const hoverY = dive.y - 58;
    if (a.age < KF.inEnd) {
      const t = ease(a.age / KF.inEnd);
      a.x = startX + (dive.x - startX) * t;
      a.y = hoverY - Math.sin(t * Math.PI) * 18;
      this.place(this.main, wing, a.x, a.y, Math.min(1, a.age / 250), tint, DEPTH.water + 0.1);
      face(this.main, d);
    } else if (a.age < KF.hoverEnd) {
      a.x = dive.x;
      a.y = hoverY + Math.round(Math.sin(a.age / 60) * 1);
      this.place(this.main, wing, a.x, a.y, 1, tint, DEPTH.water + 0.1);
      face(this.main, d);
    } else if (a.age < KF.diveEnd) {
      const t = (a.age - KF.hoverEnd) / (KF.diveEnd - KF.hoverEnd);
      a.y = hoverY + (dive.y - hoverY) * t * t;
      this.place(this.main, 'kingfisherDive', a.x, a.y, 1, tint, DEPTH.water + 0.1);
    } else if (a.age < KF.underEnd) {
      if (a.stage === 0 && a.leftAt < 0) {
        a.leftAt = -2; // the splash, once
        this.hooks.sfx('plop');
        this.rings.push({ x: dive.x, y: dive.y + 4, age: 0, ms: 1300, rx: 12, ry: 3.5 });
        this.rings.push({ x: dive.x, y: dive.y + 4, age: -250, ms: 1300, rx: 12, ry: 3.5 });
      }
    } else if (a.age < KF.emergeEnd) {
      const t = (a.age - KF.underEnd) / (KF.emergeEnd - KF.underEnd);
      a.y = dive.y - t * 42;
      this.place(this.main, wing, a.x, a.y, 1, tint, DEPTH.water + 0.1);
      face(this.main, d);
      this.fishInBeak(Math.round(a.x) + d * 9, Math.round(a.y) - 1, d, 1, tint);
    } else {
      const t = (a.age - KF.emergeEnd) / (KF.end - KF.emergeEnd);
      if (t >= 1) return true;
      a.x = dive.x + d * t * 220;
      a.y = dive.y - 42 - t * 40;
      this.place(this.main, wing, a.x, a.y, 1 - t * t, tint, DEPTH.water + 0.1);
      face(this.main, d);
      this.fishInBeak(Math.round(a.x) + d * 9, Math.round(a.y) - 1, d, 1 - t * t, tint);
    }
    return false;
  }

  /** The otter floats on its back eating, drifting a little; a tap makes it roll and dive, then pop up again nearby. */
  private updateOtter(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    const bob = Math.round(Math.sin(a.age / 700));
    if (a.stage === 0) {
      a.x -= a.speed * (dtMs / 1000);
      const left = a.life - a.age;
      if (left < 700) {
        // It gets bored and dives by itself.
        this.place(this.main, 'otterDive', a.x, a.y - 2, Math.max(0, left / 700), tint, DEPTH.water);
        if (left <= 0) this.rings.push({ x: a.x, y: a.y + 3, age: 0, ms: 1200, rx: 14, ry: 4 });
        return false;
      }
      this.place(this.main, 'otterBack', a.x, a.y + bob, alpha, tint, DEPTH.water);
      // Now and then a little paw rolls the fish: a tiny splash ring.
      const k = (a.age % 2600) / 2600;
      if (k < 0.45) this.ring(a.x - 4, a.y + 6, 4 + k * 12, 1.5 + k * 4, (1 - k / 0.45) * 0.6 * alpha, tint);
      return false;
    }
    const since = a.age - a.leftAt;
    if (a.stage === 1) {
      // It rolls over and swims off fast, arching out of the water and in again (porpoising), then pops its head up a little way off.
      const RUN_MS = 1500;
      const HUMP_MS = 375;
      const run = Math.min(since, RUN_MS);
      const dir: 1 | -1 = a.x < 110 ? 1 : a.x > 280 ? -1 : a.dir;
      const px = a.x + dir * 52 * (run / 1000);
      const phase = Math.floor(run / HUMP_MS);
      if (since < RUN_MS && phase % 2 === 0) {
        const f = (run % HUMP_MS) / HUMP_MS;
        this.place(this.main, 'otterDive', px, a.y - Math.round(Math.sin(f * Math.PI) * 4), 1, tint, DEPTH.water);
        this.main.setFlipX(dir > 0).setAngle(dir * (f < 0.5 ? -8 : 8));
      }
      if (since < RUN_MS && run % HUMP_MS < dtMs && phase > 0) this.rings.push({ x: px, y: a.y + 4, age: 0, ms: 1000, rx: 9, ry: 2.8 });
      if (since >= RUN_MS + 500) {
        a.stage = 2;
        a.leftAt = a.age;
        a.x = Math.max(60, Math.min(300, a.x + dir * 52 * (RUN_MS / 1000)));
        a.tappedAge = -1; // it can be tapped once more
        this.hooks.sfx('plop');
        this.rings.push({ x: a.x, y: a.y + 5, age: 0, ms: 1300, rx: 12, ry: 3.5 });
      }
      return false;
    }
    // Popped up again: its head above the water, looking at you, then down for good.
    if (since > 2600) {
      this.rings.push({ x: a.x, y: a.y + 5, age: 0, ms: 1100, rx: 10, ry: 3 });
      return true;
    }
    const rise = Math.min(1, since / 300);
    this.place(this.main, 'otterHead', a.x, a.y + 2 - rise * 3 + Math.round(Math.sin(since / 300)), Math.min(1, since / 250) * (since > 2300 ? (2600 - since) / 300 : 1), tint, DEPTH.water);
    return false;
  }

  /** The upstream lantern: a small light drifts up the river with nothing under it. A tap puts it out softly. */
  private updateLantern(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    const out = a.tappedAge >= 0;
    const fadeEnd = Math.min(1, Math.max(0, (a.life - a.age) / 3000));
    const snuff = out ? Math.max(0, 1 - a.tappedAge / 1400) : 1;
    if (!out) a.x += a.speed * (dtMs / 1000);
    const bob = Math.round(Math.sin(a.age / 800));
    const al = alpha * fadeEnd * snuff;
    if (al <= 0) return out || a.x > W + 20;
    const flick = 0.75 + 0.25 * Math.sin(a.age / 130) * Math.sin(a.age / 310);
    const cx = Math.round(a.x);
    const cy = Math.round(a.y + bob);
    // The glow: stepped soft squares (it is a light, so it ignores the day tint).
    for (let r = 4; r >= 1; r--) {
      this.fx.fillStyle(PAL.gold, 0.035 * al * flick * (5 - r) / 2).fillRect(cx - r * 3 - 2, cy - 4 - r * 2, r * 6 + 4, r * 4 + 6);
    }
    this.place(this.main, 'lantern', cx, cy - 2, al, lift(tint), DEPTH.water);
    // Its reflection, shorter and dimmer, and the light on the water around it.
    this.place(this.second, 'lantern', cx, cy + 18, al * 0.35 * flick, lift(tint), DEPTH.water - 0.01);
    this.second.setFlipY(true);
    this.fx.fillStyle(PAL.gold, 0.25 * al * flick).fillRect(cx - 7, cy + 10, 14, 1).fillRect(cx - 4, cy + 12, 8, 1);
    return a.x > W + 24;
  }

  /** The paper boat floats downstream past the dock; a tap catches it (about 1 time in 4 it holds worms). */
  private updatePaperBoat(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    const caught = a.tappedAge >= 0;
    if (!caught) a.x += a.dir * a.speed * (dtMs / 1000);
    const bob = Math.round(Math.sin(a.age / 450));
    if (caught) {
      const t = a.tappedAge / 700;
      if (t >= 1) return true;
      this.place(this.main, 'paperBoat', a.x, a.y + bob - t * 12, alpha * (1 - t), tint, DEPTH.water);
      return false;
    }
    this.place(this.main, 'paperBoat', a.x, a.y + bob, alpha, tint, DEPTH.water);
    // A short wake and a ring now and then.
    for (let i = 1; i <= 3; i++) this.fx.fillStyle(multiply(PAL.foam, tint), alpha * (0.7 - i * 0.16)).fillRect(Math.round(a.x) + 8 + i * 3, Math.round(a.y) + 5 + bob, 1, 1);
    return a.x < -20;
  }

  /** The heron stands in the shallows, perfectly still, staring at Bestia (a boof from the dock); a tap and it stalks off, offended. */
  private updateHeron(a: Active, dtMs: number, alpha: number, tint: number): boolean {
    if (a.stage === 0) {
      if (a.nextSound === 0 && a.age > 1800) {
        a.nextSound = 1;
        this.hooks.sfx('boof'); // Bestia stares back, and says so
      }
      const left = a.life - a.age;
      if (left < 6000) {
        a.stage = 1; // it has had enough and wanders off by itself
        a.leftAt = a.age;
        return false;
      }
      this.place(this.main, 'heronStand', a.x, a.y, alpha, tint, DEPTH.water);
      this.main.setOrigin(0.5, 1).setFlipX(true);
      this.ring(a.x, a.y, 9, 2.2, 0.5 * alpha, tint);
      return false;
    }
    // Stalking off to the right, slowly, one long leg at a time.
    const since = a.age - a.leftAt;
    a.x += 15 * (dtMs / 1000);
    const step = Math.floor(since / 420) % 2 === 0 ? 'heronStep' : 'heronStand';
    const al = alpha * Math.max(0, 1 - Math.max(0, a.x - 330) / 40);
    this.place(this.main, step, a.x, a.y, al, tint, DEPTH.water);
    this.main.setOrigin(0.5, 1).setFlipX(false);
    if (Math.floor(since / 420) !== Math.floor((since - dtMs) / 420)) this.rings.push({ x: a.x, y: a.y, age: 0, ms: 900, rx: 6, ry: 1.8 });
    return a.x > 372;
  }

  private updateShape(a: Active, dtMs: number, tint: number): boolean {
    const under = tint;
    if (a.tappedAge >= 0) {
      // It sinks: down a few pixels and gone.
      const t = Math.min(1, a.tappedAge / 800);
      this.place(this.main, 'shape', a.x, a.y + t * 10, 0.62 * (1 - t), under, DEPTH.under);
      return t >= 1;
    }
    a.x += a.dir * 4 * (dtMs / 1000); // a slow drift
    const al = 0.65 * Math.min(1, a.age / 2600) * Math.min(1, (a.life - a.age) / 2800);
    if (a.stage === 0 && a.age > 3500) {
      a.stage = 1; // one slow ripple above it, as if something breathed out
      this.rings.push({ x: a.x, y: a.y - 1, age: 0, ms: 2600, rx: 24, ry: 5 });
    }
    this.place(this.main, 'shape', a.x, a.y + Math.round(Math.sin(a.age / 900)), al, under, DEPTH.under);
    this.main.setFlipX(a.dir < 0).setAngle(0);
    return false;
  }
}
