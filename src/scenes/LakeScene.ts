import Phaser from 'phaser';
import { castDistance, chargePower } from '../core/casting';
import { advanceClock, daylight, formatClock, NEW_GAME_CLOCK, type GameClock } from '../core/clock';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import type { GameEvent } from '../core/events';
import { INITIAL_STATE, step, type FishingInput, type FishingState, type SessionContext } from '../core/fishingSession';
import { HAPTICS, vibrate } from './haptics';

// ---- Layout (base resolution 360×640, portrait) ----------------------------------------------
const W = 360;
const H = 640;
const FAR_SHORE_Y = 150; // where the water starts at the top
const FAR_WATER_Y = 170; // y of the farthest castable point (location.maxDistanceM)
const SHORE_Y = 520; // y of distance 0 (the near shore)
const ROD_TIP = { x: 214, y: 508 };
const BOBBER_X = 214;

const NIBBLE_ANIM_MS = 260;
const TOAST_MS = 1800;
const RIPPLE_MS = 1200;

const COLORS = {
  sky: [0x8ecae6, 0xa6d8ee, 0xbfe3f2],
  farTrees: 0x2d6a4f,
  farTreesDark: 0x1b4332,
  deepWater: [0x1d4e89, 0x22588f, 0x276296],
  shallowWater: [0x2f7aa8, 0x3a88b5, 0x4796c2],
  shimmer: 0xbfe3f2,
  grass: 0x6a994e,
  grassDark: 0x4f7a3a,
  sand: 0xd4b483,
  dock: 0x8b5e34,
  dockDark: 0x6b4423,
  line: 0xf1faee,
  bobberTop: 0xe63946,
  bobberBottom: 0xf1faee,
  meterBg: 0x1b2b3a,
  meterFill: 0xf4a261,
  meterFull: 0xe76f51,
  night: 0x0b1026,
  warm: 0xff8c42,
  star: 0xfdf6e3,
  text: '#f1faee',
  alert: '#ffd166',
};

/** Converts a cast distance in meters into a screen y coordinate. */
function distanceToY(distanceM: number): number {
  const t = distanceM / QUIET_LAKE.maxDistanceM;
  return SHORE_Y - t * (SHORE_Y - FAR_WATER_Y);
}

/** Lake screen: the angler on the dock, casting a float into the lake. */
export class LakeScene extends Phaser.Scene {
  private state: FishingState = INITIAL_STATE;
  private ctx: SessionContext = { location: QUIET_LAKE, rod: RODS[0], rng: Math.random };
  private clock: GameClock = NEW_GAME_CLOCK;

  private dynamic!: Phaser.GameObjects.Graphics;
  private sky!: Phaser.GameObjects.Graphics;
  private zoneLabel!: Phaser.GameObjects.Text;
  private clockLabel!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private alertMark!: Phaser.GameObjects.Text;

  /** Animation progress 0..1 for the current casting/retrieving state. */
  private anim = 0;
  /** Ripple rings on the water. */
  private ripples: { x: number; y: number; age: number; big: boolean }[] = [];
  /** Time since the last nibble, for the bobber dip animation. */
  private nibbleAge = Infinity;
  private toastAge = Infinity;
  private elapsed = 0;

  constructor() {
    super('Lake');
  }

  create(): void {
    // Dev helper: ?time=22 starts the clock at 22:00, to check night/dawn without waiting.
    const startHour = Number(new URLSearchParams(location.search).get('time'));
    if (startHour >= 0 && startHour < 24 && location.search.includes('time=')) {
      this.clock = { ...NEW_GAME_CLOCK, minute: startHour * 60 };
    }

    this.drawBackground();
    this.dynamic = this.add.graphics();
    this.sky = this.add.graphics(); // day/night tint + stars, drawn over the world, under the UI

    const textStyle = { fontFamily: 'monospace', fontSize: '14px', color: COLORS.text };
    const panel = { backgroundColor: '#1b2b3aaa', padding: { x: 8, y: 4 } };
    this.clockLabel = this.add.text(10, 10, '', { ...textStyle, ...panel });
    this.zoneLabel = this.add
      .text(W / 2, 40, '', { ...textStyle, ...panel, fontSize: '16px' })
      .setOrigin(0.5)
      .setVisible(false);
    this.toast = this.add
      .text(W / 2, 110, '', { ...textStyle, ...panel, fontSize: '18px', color: COLORS.alert })
      .setOrigin(0.5)
      .setVisible(false);
    this.alertMark = this.add
      .text(0, 0, '!', { fontFamily: 'monospace', fontSize: '22px', color: COLORS.alert, stroke: '#1b2b3a', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.hint = this.add.text(W / 2, H - 24, '', textStyle).setOrigin(0.5);

    this.input.on('pointerdown', () => this.send({ type: 'press' }));
    this.input.on('pointerup', () => this.send({ type: 'release' }));
    this.input.on('gameout', () => this.send({ type: 'release' }));

    this.render();
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs;
    this.clock = advanceClock(this.clock, deltaMs);
    this.send({ type: 'tick', dtMs: deltaMs });

    if (this.state.kind === 'casting' || this.state.kind === 'retrieving') {
      const durationMs = this.state.kind === 'casting' ? 350 + this.state.distanceM * 25 : 300 + this.state.distanceM * 15;
      this.anim = Math.min(1, this.anim + deltaMs / durationMs);
      if (this.anim >= 1) {
        if (this.state.kind === 'casting') {
          this.addRipple(this.state.distanceM, false);
          this.send({ type: 'landed' });
        } else {
          this.send({ type: 'retrieved' });
        }
      }
    }

    for (const r of this.ripples) r.age += deltaMs;
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_MS);
    this.nibbleAge += deltaMs;
    this.toastAge += deltaMs;

    this.render();
  }

  private send(input: FishingInput): void {
    const { state: next, events } = step(this.state, input, this.ctx);
    for (const e of events) this.onEvent(e);
    if (next === this.state) return;
    if (next.kind !== this.state.kind) this.anim = 0;
    this.state = next;
  }

  /** Feedback for things the core reports: ripples, haptics, messages. */
  private onEvent(e: GameEvent): void {
    const s = this.state;
    const distanceM = 'distanceM' in s ? s.distanceM : 0;
    switch (e.type) {
      case 'nibble':
        this.nibbleAge = 0;
        this.addRipple(distanceM, false);
        vibrate(HAPTICS.nibble);
        break;
      case 'bite':
        this.addRipple(distanceM, true);
        vibrate(HAPTICS.bite);
        break;
      case 'hooked':
        this.showToast('Hooked!');
        vibrate(HAPTICS.hooked);
        break;
      case 'fishEscaped':
        this.showToast(e.reason === 'tooEarly' ? 'Too early, you scared it off' : 'Too slow, it got away…');
        vibrate(HAPTICS.escaped);
        break;
      case 'cast':
        break;
    }
  }

  private addRipple(distanceM: number, big: boolean): void {
    this.ripples.push({ x: BOBBER_X, y: distanceToY(distanceM), age: 0, big });
  }

  private showToast(text: string): void {
    this.toast.setText(text);
    this.toastAge = 0;
  }

  // ---- Rendering ---------------------------------------------------------------------------

  /** Static scenery, drawn once. */
  private drawBackground(): void {
    const g = this.add.graphics();

    // Sky in pixel-ish bands.
    const skyBand = FAR_SHORE_Y / COLORS.sky.length;
    COLORS.sky.forEach((c, i) => g.fillStyle(c).fillRect(0, i * skyBand, W, skyBand + 1));

    // Far shore tree line.
    g.fillStyle(COLORS.farTreesDark).fillRect(0, FAR_SHORE_Y - 22, W, 22);
    for (let x = -8; x < W; x += 18) {
      const h = 18 + ((x * 7919) % 13);
      g.fillStyle(x % 36 === 0 ? COLORS.farTrees : COLORS.farTreesDark);
      g.fillTriangle(x, FAR_SHORE_Y - 10, x + 14, FAR_SHORE_Y - 10 - h, x + 28, FAR_SHORE_Y - 10);
    }

    // Water: deep (far) and shallow (near), each in bands.
    const boundaryY = distanceToY(QUIET_LAKE.zones[0].toM);
    const bands = (top: number, bottom: number, colors: number[]) => {
      const h = (bottom - top) / colors.length;
      colors.forEach((c, i) => g.fillStyle(c).fillRect(0, top + i * h, W, h + 1));
    };
    bands(FAR_SHORE_Y, boundaryY, COLORS.deepWater);
    bands(boundaryY, SHORE_Y, COLORS.shallowWater);

    // Near shore: grass, sand edge, dock.
    g.fillStyle(COLORS.sand).fillRect(0, SHORE_Y, W, 10);
    g.fillStyle(COLORS.grass).fillRect(0, SHORE_Y + 10, W, H - SHORE_Y - 10);
    for (let x = 4; x < W; x += 11) {
      g.fillStyle(COLORS.grassDark).fillRect(x, SHORE_Y + 16 + ((x * 31) % 60), 2, 4);
    }
    g.fillStyle(COLORS.dockDark).fillRect(150, SHORE_Y - 30, 64, 100);
    g.fillStyle(COLORS.dock);
    for (let y = SHORE_Y - 30; y < SHORE_Y + 70; y += 10) g.fillRect(152, y, 60, 8);

    // Angler (placeholder): sitting figure at the end of the dock.
    const ax = 182;
    const ay = SHORE_Y - 6;
    g.fillStyle(0x264653).fillRect(ax - 7, ay, 14, 16); // body
    g.fillStyle(0xf4c095).fillRect(ax - 5, ay - 10, 10, 10); // head
    g.fillStyle(0xe9c46a).fillRect(ax - 8, ay - 13, 16, 4); // straw hat brim
    g.fillStyle(0xe9c46a).fillRect(ax - 5, ay - 17, 10, 5); // hat top

    // Rod.
    g.lineStyle(2, 0x5c3d1e).lineBetween(ax + 6, ay + 6, ROD_TIP.x, ROD_TIP.y);
  }

  /** Everything that moves, redrawn each frame. */
  private render(): void {
    const g = this.dynamic;
    g.clear();

    this.drawShimmer(g);

    for (const r of this.ripples) {
      const t = r.age / RIPPLE_MS;
      const scale = r.big ? 2 : 1;
      g.lineStyle(1, COLORS.shimmer, 1 - t).strokeEllipse(r.x, r.y, (8 + t * 30) * scale, (3 + t * 10) * scale);
    }

    const s = this.state;
    const bobber = this.bobberPosition();
    if (bobber) {
      const tight = s.kind === 'bite' || s.kind === 'hooked';
      this.drawLine(g, bobber.x, bobber.y, s.kind === 'waiting' ? 6 : tight ? 0 : 2);
      this.drawBobber(g, bobber.x, bobber.y, s.kind === 'bite' || s.kind === 'hooked');
    }

    this.alertMark.setVisible(s.kind === 'bite' && bobber !== null);
    if (s.kind === 'bite' && bobber) {
      const pop = Math.sin(this.elapsed / 60) * 2;
      this.alertMark.setPosition(bobber.x, bobber.y - 10 + pop);
    }

    if (s.kind === 'charging') this.drawPowerMeter(g, chargePower(s.heldMs));

    this.drawDayNight();

    // Labels.
    this.clockLabel.setText(`Day ${this.clock.day}  ${formatClock(this.clock.minute)}`);
    if (s.kind === 'waiting') {
      const zone = this.ctx.location.zones.find((z) => z.id === s.zone)!;
      this.zoneLabel.setText(`${zone.name} · ${s.distanceM.toFixed(1)} m`).setVisible(true);
    } else if (s.kind === 'idle') {
      this.zoneLabel.setVisible(false);
    }
    this.toast.setVisible(this.toastAge < TOAST_MS).setAlpha(Math.min(1, (TOAST_MS - this.toastAge) / 300));
    this.hint.setText(
      s.kind === 'idle' ? 'Hold to charge, release to cast'
      : s.kind === 'charging' ? 'Release to cast!'
      : s.kind === 'waiting' ? 'Wait for the bobber to go under…'
      : s.kind === 'bite' ? 'TAP NOW!'
      : s.kind === 'hooked' ? 'Tap to reel in (catch bar: slice 4)'
      : '',
    );
  }

  private bobberPosition(): { x: number; y: number } | null {
    const s = this.state;
    if (s.kind === 'casting') {
      // Arc from rod tip to the landing point; "height" shown as upward offset.
      const t = this.anim;
      const targetY = distanceToY(s.distanceM);
      const y = Phaser.Math.Linear(ROD_TIP.y, targetY, t) - Math.sin(Math.PI * t) * (30 + s.distanceM * 2);
      return { x: Phaser.Math.Linear(ROD_TIP.x, BOBBER_X, t), y };
    }
    if (s.kind === 'waiting') {
      const bob = Math.round(Math.sin(this.elapsed / 400) * 1.2);
      // A nibble tugs the bobber down briefly.
      const dip = this.nibbleAge < NIBBLE_ANIM_MS ? Math.round(Math.sin((this.nibbleAge / NIBBLE_ANIM_MS) * Math.PI) * 3) : 0;
      return { x: BOBBER_X, y: distanceToY(s.distanceM) + bob + dip };
    }
    if (s.kind === 'bite') {
      const shake = Math.round(Math.sin(this.elapsed / 30));
      return { x: BOBBER_X + shake, y: distanceToY(s.distanceM) + 3 };
    }
    if (s.kind === 'hooked') {
      const thrash = Math.round(Math.sin(this.elapsed / 70) * 3);
      return { x: BOBBER_X + thrash, y: distanceToY(s.distanceM) + 2 };
    }
    if (s.kind === 'retrieving') {
      const t = this.anim * this.anim; // ease-in: starts slow, speeds up
      return { x: BOBBER_X, y: Phaser.Math.Linear(distanceToY(s.distanceM), ROD_TIP.y, t) };
    }
    return null;
  }

  private drawLine(g: Phaser.GameObjects.Graphics, bx: number, by: number, sag: number): void {
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(ROD_TIP.x, ROD_TIP.y),
      new Phaser.Math.Vector2((ROD_TIP.x + bx) / 2 + sag, (ROD_TIP.y + by) / 2),
      new Phaser.Math.Vector2(bx, by),
    );
    g.lineStyle(1, COLORS.line, 0.8);
    g.strokePoints(curve.getPoints(16));
  }

  /** `under`: pulled below the surface, only the antenna tip shows. */
  private drawBobber(g: Phaser.GameObjects.Graphics, x: number, y: number, under: boolean): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!under) {
      g.fillStyle(COLORS.bobberBottom).fillRect(px - 2, py, 5, 3);
      g.fillStyle(COLORS.bobberTop).fillRect(px - 2, py - 3, 5, 3);
    }
    g.fillStyle(COLORS.bobberTop).fillRect(px, py - 6, 1, 3); // antenna
  }

  /**
   * Power feedback, kept in the top half of the screen so a thumb holding anywhere near the
   * bottom never covers it: a horizontal bar up top, plus a marker on the water showing where
   * the bobber would land right now.
   */
  private drawPowerMeter(g: Phaser.GameObjects.Graphics, power: number): void {
    const full = power > 0.95;
    const color = full ? COLORS.meterFull : COLORS.meterFill;

    // Bar.
    const w = 240;
    const x = (W - w) / 2;
    const y = 72;
    g.fillStyle(COLORS.meterBg, 0.85).fillRect(x - 3, y - 3, w + 6, 16);
    g.fillStyle(color).fillRect(x, y, Math.round(w * power), 10);

    // Landing marker on the water.
    const distanceM = castDistance(power, this.ctx.rod);
    const ly = Math.round(distanceToY(distanceM));
    const pulse = 1 + Math.sin(this.elapsed / 120) * 0.15;
    g.lineStyle(1, color, 0.9).strokeEllipse(BOBBER_X, ly, 14 * pulse, 5 * pulse);
    g.fillStyle(color).fillRect(BOBBER_X, ly, 1, 1);
  }

  private drawShimmer(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.shimmer, 0.35);
    for (let i = 0; i < 14; i++) {
      const y = FAR_SHORE_Y + 12 + ((i * 97) % (SHORE_Y - FAR_SHORE_Y - 20));
      const speed = 0.006 + (i % 3) * 0.003;
      const x = ((i * 53 + this.elapsed * speed) % (W + 40)) - 20;
      g.fillRect(Math.round(x), y, 6 + (i % 4) * 3, 1);
    }
  }

  /** Night darkening, warm light at dawn/dusk, stars at night. Placeholder until the art pass. */
  private drawDayNight(): void {
    const g = this.sky;
    g.clear();
    const light = daylight(this.clock.minute);
    const dark = 1 - light;
    if (dark > 0) g.fillStyle(COLORS.night, dark * 0.6).fillRect(0, 0, W, H);
    const warm = 4 * light * (1 - light); // peaks halfway through dawn and dusk
    if (warm > 0) g.fillStyle(COLORS.warm, warm * 0.15).fillRect(0, 0, W, H);
    if (dark > 0.3) {
      for (let i = 0; i < 24; i++) {
        const twinkle = 0.5 + 0.5 * Math.sin(this.elapsed / 500 + i * 1.7);
        g.fillStyle(COLORS.star, (dark - 0.3) * twinkle);
        g.fillRect((i * 149) % W, 6 + ((i * 61) % (FAR_SHORE_Y - 40)), 1, 1);
      }
    }
  }
}
