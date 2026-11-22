import Phaser from 'phaser';
import { castDistance, chargePower } from '../core/casting';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import { INITIAL_STATE, step, type FishingEvent, type FishingState, type SessionContext } from '../core/fishingSession';

// ---- Layout (base resolution 360×640, portrait) ----------------------------------------------
const W = 360;
const H = 640;
const FAR_SHORE_Y = 150; // where the water starts at the top
const FAR_WATER_Y = 170; // y of the farthest castable point (location.maxDistanceM)
const SHORE_Y = 520; // y of distance 0 (the near shore)
const ROD_TIP = { x: 214, y: 508 };
const BOBBER_X = 214;

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
  text: '#f1faee',
};

/** Converts a cast distance in meters into a screen y coordinate. */
function distanceToY(distanceM: number): number {
  const t = distanceM / QUIET_LAKE.maxDistanceM;
  return SHORE_Y - t * (SHORE_Y - FAR_WATER_Y);
}

/** Lake screen: the angler on the dock, casting a float into the lake. */
export class LakeScene extends Phaser.Scene {
  private state: FishingState = INITIAL_STATE;
  private ctx: SessionContext = { location: QUIET_LAKE, rod: RODS[0] };

  private dynamic!: Phaser.GameObjects.Graphics;
  private zoneLabel!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  /** Animation progress 0..1 for the current casting/retrieving state. */
  private anim = 0;
  /** Ripple rings spawned when the bobber lands. */
  private ripples: { x: number; y: number; age: number }[] = [];
  private time0 = 0;

  constructor() {
    super('Lake');
  }

  create(): void {
    this.drawBackground();
    this.dynamic = this.add.graphics();

    const textStyle = { fontFamily: 'monospace', fontSize: '14px', color: COLORS.text };
    this.zoneLabel = this.add
      .text(W / 2, 40, '', { ...textStyle, fontSize: '16px', backgroundColor: '#1b2b3aaa', padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setVisible(false);
    this.hint = this.add.text(W / 2, H - 24, '', textStyle).setOrigin(0.5);

    this.input.on('pointerdown', () => this.send({ type: 'press' }));
    this.input.on('pointerup', () => this.send({ type: 'release' }));
    this.input.on('gameout', () => this.send({ type: 'release' }));

    this.render();
  }

  update(_time: number, deltaMs: number): void {
    this.time0 += deltaMs;
    this.send({ type: 'tick', dtMs: deltaMs });

    if (this.state.kind === 'casting' || this.state.kind === 'retrieving') {
      const durationMs = this.state.kind === 'casting' ? 350 + this.state.distanceM * 25 : 300 + this.state.distanceM * 15;
      this.anim = Math.min(1, this.anim + deltaMs / durationMs);
      if (this.anim >= 1) {
        if (this.state.kind === 'casting') {
          this.ripples.push({ x: BOBBER_X, y: distanceToY(this.state.distanceM), age: 0 });
          this.send({ type: 'landed' });
        } else {
          this.send({ type: 'retrieved' });
        }
      }
    }

    for (const r of this.ripples) r.age += deltaMs;
    this.ripples = this.ripples.filter((r) => r.age < 1200);

    this.render();
  }

  private send(event: FishingEvent): void {
    const next = step(this.state, event, this.ctx);
    if (next === this.state) return;
    if (next.kind !== this.state.kind) this.anim = 0;
    this.state = next;
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
      const t = r.age / 1200;
      g.lineStyle(1, COLORS.shimmer, 1 - t).strokeEllipse(r.x, r.y, 8 + t * 30, 3 + t * 10);
    }

    const s = this.state;
    const bobber = this.bobberPosition();
    if (bobber) {
      this.drawLine(g, bobber.x, bobber.y, s.kind === 'waiting' ? 6 : 2);
      this.drawBobber(g, bobber.x, bobber.y);
    }

    if (s.kind === 'charging') this.drawPowerMeter(g, chargePower(s.heldMs));

    // Zone label & hint.
    if (s.kind === 'waiting') {
      const zone = this.ctx.location.zones.find((z) => z.id === s.zone)!;
      this.zoneLabel.setText(`${zone.name} · ${s.distanceM.toFixed(1)} m`).setVisible(true);
    } else if (s.kind === 'idle') {
      this.zoneLabel.setVisible(false);
    }
    this.hint.setText(
      s.kind === 'idle' ? 'Hold to charge, release to cast'
      : s.kind === 'charging' ? 'Release to cast!'
      : s.kind === 'waiting' ? 'Waiting for a bite… tap to reel in'
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
      const bob = Math.round(Math.sin(this.time0 / 400) * 1.2);
      return { x: BOBBER_X, y: distanceToY(s.distanceM) + bob };
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

  private drawBobber(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    g.fillStyle(COLORS.bobberBottom).fillRect(px - 2, py, 5, 3);
    g.fillStyle(COLORS.bobberTop).fillRect(px - 2, py - 3, 5, 3);
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
    const pulse = 1 + Math.sin(this.time0 / 120) * 0.15;
    g.lineStyle(1, color, 0.9).strokeEllipse(BOBBER_X, ly, 14 * pulse, 5 * pulse);
    g.fillStyle(color).fillRect(BOBBER_X, ly, 1, 1);
  }

  private drawShimmer(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.shimmer, 0.35);
    for (let i = 0; i < 14; i++) {
      const y = FAR_SHORE_Y + 12 + ((i * 97) % (SHORE_Y - FAR_SHORE_Y - 20));
      const speed = 0.006 + (i % 3) * 0.003;
      const x = ((i * 53 + this.time0 * speed) % (W + 40)) - 20;
      g.fillRect(Math.round(x), y, 6 + (i % 4) * 3, 1);
    }
  }
}
