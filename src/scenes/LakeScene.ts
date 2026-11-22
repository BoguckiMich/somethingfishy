import Phaser from 'phaser';
import { dayLook, lerpColor, moonArc, sunArc, type DayLook } from '../art/dayCycle';
import {
  BOBBER_X,
  distanceToY,
  DOCK,
  FAR_SHORE_TOP,
  FAR_SHORE_Y,
  H,
  NEAR_SHORE_TOP,
  ROD_TIP,
  SHORE_Y,
  W,
} from '../art/layout';
import { PAL } from '../art/palette';
import { mulberry32 } from '../art/raster';
import { createTextures, repaintSky, TEX } from '../art/textures';
import { castDistance, chargePower } from '../core/casting';
import { advanceClock, formatClock, NEW_GAME_CLOCK, type GameClock } from '../core/clock';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import type { GameEvent } from '../core/events';
import { INITIAL_STATE, step, type FishingInput, type FishingState, type SessionContext } from '../core/fishingSession';
import { HAPTICS, vibrate } from './haptics';

const NIBBLE_ANIM_MS = 260;
const TOAST_MS = 1800;
const RIPPLE_MS = 1200;

const TEXT = '#fff6e4';
const ALERT = '#ffd35a';

/** Depth layers, back to front. */
const Z = {
  sky: 0,
  stars: 1,
  celestial: 2,
  clouds: 3,
  farShore: 4,
  water: 5,
  waterGlow: 6,
  reflection: 7,
  waterFx: 8,
  waterDecor: 9,
  nearShore: 10,
  dock: 11,
  postFx: 12,
  posts: 13,
  angler: 14,
  action: 15,
  bobber: 16,
  alert: 17,
  fireflies: 18,
  uiPanel: 30,
  uiText: 31,
};

/** Dock posts standing in the water: [centre x, base y]. */
const POST_BASES: [number, number][] = [
  [147, 502],
  [147, 518],
  [219, 502],
  [219, 518],
];

const ANGLER_POS = { x: 172, y: 484 };
const ROD_HAND = { x: 190, y: 501 };

/** Multiplies two 0xRRGGBB colours (what setTint does on the GPU). */
function multiply(a: number, b: number): number {
  const ch = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** 1px ring drawn as individual pixels so it stays crisp. */
function pixelEllipse(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
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

/** Lake screen: the angler on the dock, casting a float into the lake. */
export class LakeScene extends Phaser.Scene {
  private state: FishingState = INITIAL_STATE;
  private ctx: SessionContext = { location: QUIET_LAKE, rod: RODS[0], rng: Math.random };
  private clock: GameClock = NEW_GAME_CLOCK;

  // Scenery images (tinted by the day cycle).
  private sunImg!: Phaser.GameObjects.Image;
  private moonImg!: Phaser.GameObjects.Image;
  private cloudImgs: { img: Phaser.GameObjects.Image; y: number; speed: number; x: number }[] = [];
  private waterImg!: Phaser.GameObjects.Image;
  private reflectionImg!: Phaser.GameObjects.Image;
  private worldImgs: Phaser.GameObjects.Image[] = [];
  private anglerImg!: Phaser.GameObjects.Image;
  private bobberImg!: Phaser.GameObjects.Image;

  // Per-frame graphics layers.
  private stars!: Phaser.GameObjects.Graphics;
  private waterGlow!: Phaser.GameObjects.Graphics;
  private waterFx!: Phaser.GameObjects.Graphics;
  private postFx!: Phaser.GameObjects.Graphics;
  private action!: Phaser.GameObjects.Graphics;
  private fireflies!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;

  private zoneLabel!: Phaser.GameObjects.Text;
  private clockLabel!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private alertMark!: Phaser.GameObjects.Text;

  private starPoints: { x: number; y: number; phase: number; big: boolean }[] = [];
  private sparkles: { x: number; y: number; phase: number; speed: number }[] = [];
  private flies: { x: number; y: number; ax: number; ay: number; sx: number; sy: number; phase: number; blink: number }[] = [];
  private lastSkyKey = -1;
  private lastGlowKey = -1;

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

    createTextures(this);
    this.buildScenery();
    this.buildUi();

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

    this.render(deltaMs);
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

  // ---- Building ----------------------------------------------------------------------------

  /** Static scenery: placed once; only tints and a few small effects change afterwards. */
  private buildScenery(): void {
    const img = (key: string, x: number, y: number, depth: number, tinted = true) => {
      const i = this.add.image(x, y, key).setOrigin(0, 0).setDepth(depth);
      if (tinted) this.worldImgs.push(i);
      return i;
    };

    img(TEX.sky, 0, 0, Z.sky, false);
    this.stars = this.add.graphics().setDepth(Z.stars);
    this.sunImg = this.add.image(0, 0, TEX.sun).setDepth(Z.celestial);
    this.moonImg = this.add.image(0, 0, TEX.moon).setDepth(Z.celestial);

    const cloudSpecs = [
      { key: TEX.clouds[0], x: 40, y: 34, speed: 3 },
      { key: TEX.clouds[1], x: 210, y: 62, speed: 2 },
      { key: TEX.clouds[2], x: 300, y: 18, speed: 4 },
    ];
    for (const c of cloudSpecs) {
      const i = this.add.image(c.x, c.y, c.key).setOrigin(0, 0).setDepth(Z.clouds);
      this.cloudImgs.push({ img: i, x: c.x, y: c.y, speed: c.speed });
    }

    img(TEX.farShore, 0, FAR_SHORE_TOP, Z.farShore);
    this.waterImg = img(TEX.water, 0, FAR_SHORE_Y, Z.water, false);
    this.waterGlow = this.add.graphics().setDepth(Z.waterGlow);
    this.reflectionImg = this.add.image(0, FAR_SHORE_Y + 4, TEX.reflection[0]).setOrigin(0, 0).setDepth(Z.reflection).setAlpha(0.7);
    this.waterFx = this.add.graphics().setDepth(Z.waterFx);

    // Decor on the water, away from the bobber column.
    const decor: [string, number, number][] = [
      [TEX.lilyA, 34, 468],
      [TEX.lilyB, 62, 484],
      [TEX.lilyB, 18, 448],
      [TEX.lilyA, 306, 450],
      [TEX.lilyB, 332, 470],
      [TEX.lilyA, 318, 492],
      [TEX.lilyB, 24, 392],
      [TEX.lilyA, 338, 400],
      [TEX.reed, 6, 504],
      [TEX.reed, 24, 508],
      [TEX.reed, 338, 506],
      [TEX.reed, 322, 510],
      [TEX.reed, 344, 330],
    ];
    for (const [key, x, y] of decor) {
      const i = this.add.image(x, y, key).setOrigin(0, key === TEX.reed ? 1 : 0).setDepth(Z.waterDecor);
      this.worldImgs.push(i);
    }

    img(TEX.nearShore, 0, NEAR_SHORE_TOP, Z.nearShore);
    img(TEX.dock, DOCK.x, DOCK.y, Z.dock);

    // Dock posts standing in the water.
    for (const [x, base] of POST_BASES) {
      const p = this.add.image(x, base, TEX.post).setOrigin(0.5, 1).setDepth(Z.posts);
      this.worldImgs.push(p);
    }
    this.postFx = this.add.graphics().setDepth(Z.postFx);

    this.anglerImg = this.add.image(ANGLER_POS.x, ANGLER_POS.y, TEX.angler[0]).setOrigin(0, 0).setDepth(Z.angler);
    this.worldImgs.push(this.anglerImg);

    this.action = this.add.graphics().setDepth(Z.action);
    this.bobberImg = this.add.image(0, 0, TEX.bobber).setDepth(Z.bobber).setVisible(false);
    this.fireflies = this.add.graphics().setDepth(Z.fireflies);

    // Fixed random layouts for stars, sparkles and fireflies.
    const rnd = mulberry32(77);
    for (let i = 0; i < 46; i++) {
      this.starPoints.push({ x: Math.floor(rnd() * W), y: 3 + Math.floor(rnd() * 112), phase: rnd() * 6.28, big: i % 9 === 0 });
    }
    for (let i = 0; i < 46; i++) {
      this.sparkles.push({
        x: Math.floor(rnd() * W),
        y: FAR_SHORE_Y + 10 + Math.floor(Math.pow(rnd(), 0.8) * (SHORE_Y - FAR_SHORE_Y - 24)),
        phase: rnd() * 6.28,
        speed: 0.8 + rnd() * 1.6,
      });
    }
    for (let i = 0; i < 16; i++) {
      this.flies.push({
        x: rnd() * W,
        y: 528 + rnd() * 96,
        ax: 8 + rnd() * 16,
        ay: 5 + rnd() * 10,
        sx: 0.3 + rnd() * 0.5,
        sy: 0.4 + rnd() * 0.6,
        phase: rnd() * 6.28,
        blink: 0.8 + rnd() * 1.2,
      });
    }
  }

  private buildUi(): void {
    const textStyle = { fontFamily: 'monospace', fontSize: '14px', color: TEXT };
    const pad = { padding: { x: 9, y: 5 } };
    this.ui = this.add.graphics().setDepth(Z.uiPanel);
    this.clockLabel = this.add.text(8, 8, '', { ...textStyle, ...pad }).setDepth(Z.uiText);
    this.zoneLabel = this.add
      .text(W / 2, 46, '', { ...textStyle, ...pad, fontSize: '16px' })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.toast = this.add
      .text(W / 2, 120, '', { ...textStyle, ...pad, fontSize: '18px', color: ALERT })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.alertMark = this.add
      .text(0, 0, '!', { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: ALERT, stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setDepth(Z.alert)
      .setVisible(false);
    this.hint = this.add.text(W / 2, H - 24, '', { ...textStyle, ...pad }).setOrigin(0.5).setDepth(Z.uiText);
  }

  // ---- Rendering ---------------------------------------------------------------------------

  private render(_deltaMs = 0): void {
    const look = dayLook(this.clock.minute);
    this.applyLook(look);
    this.drawWaterFx(look);
    this.drawPosts(look);
    this.drawFireflies(look);

    // Angler idle: 2-frame breathing.
    this.anglerImg.setTexture(TEX.angler[Math.floor(this.elapsed / 900) % 2]);

    const g = this.action;
    g.clear();
    const tintFx = (c: number) => multiply(c, look.worldTint);

    for (const r of this.ripples) {
      const t = r.age / RIPPLE_MS;
      const scale = r.big ? 2 : 1;
      pixelEllipse(g, r.x, r.y, (4 + t * 15) * scale, (1.5 + t * 5) * scale, tintFx(PAL.foam), (1 - t) * 0.9);
    }

    const s = this.state;
    const bobber = this.bobberPosition();
    const tight = s.kind === 'bite' || s.kind === 'hooked';
    const bend = s.kind === 'hooked' ? 7 : s.kind === 'bite' ? 3 : 0;
    this.drawRod(g, look, bend);
    if (bobber) {
      this.drawLine(g, look, bobber.x, bobber.y, s.kind === 'waiting' ? 6 : tight ? 0 : 2);
      if (s.kind === 'waiting') pixelEllipse(g, Math.round(bobber.x), Math.round(bobber.y) + 1, 4, 1, tintFx(PAL.foam), 0.45);
      this.placeBobber(bobber.x, bobber.y, tight, look);
    } else {
      this.bobberImg.setVisible(false);
    }

    this.alertMark.setVisible(s.kind === 'bite' && bobber !== null);
    if (s.kind === 'bite' && bobber) {
      const pop = Math.round(Math.sin(this.elapsed / 60) * 2);
      this.alertMark.setPosition(Math.round(bobber.x), Math.round(bobber.y) - 12 + pop);
    }

    if (s.kind === 'charging') this.drawPowerMeter(g, chargePower(s.heldMs));

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
    this.hint.setColor(s.kind === 'bite' ? ALERT : TEXT);
    this.drawPanels();
  }

  /** Sky, sun, moon, clouds, stars and every tint for the current time of day. */
  private applyLook(look: DayLook): void {
    // Repaint the sky gradient when its colours moved (about every 2 in-game minutes).
    const skyKey = Math.floor(this.clock.minute / 2);
    if (skyKey !== this.lastSkyKey) {
      this.lastSkyKey = skyKey;
      repaintSky(this, look.skyTop, look.skyBottom);
    }
    const glowKey = Math.floor(this.clock.minute / 4);
    if (glowKey !== this.lastGlowKey) {
      this.lastGlowKey = glowKey;
      this.waterGlow.clear();
      const bands = 22;
      for (let i = 0; i < bands; i++) {
        const a = 0.46 * Math.pow(1 - i / bands, 2.2);
        this.waterGlow.fillStyle(look.skyBottom, a).fillRect(0, FAR_SHORE_Y + i * 11, W, 11);
      }
    }

    for (const i of this.worldImgs) i.setTint(look.worldTint);
    this.waterImg.setTint(look.waterTint);
    this.reflectionImg.setTint(look.waterTint);
    this.reflectionImg.setTexture(TEX.reflection[Math.floor(this.elapsed / 650) % 3]);

    // Sun and moon on their arcs, rising behind the hills.
    const horizonY = 134;
    const topY = 26;
    const sun = sunArc(this.clock.minute);
    this.sunImg
      .setPosition(Math.round(sun.x * W), Math.round(horizonY - sun.height * (horizonY - topY)))
      .setAlpha(look.sunAlpha)
      .setTint(lerpColor(0xffffff, 0xff9c5a, Math.max(0, 1 - sun.height * 2.4)));
    const moon = moonArc(this.clock.minute);
    this.moonImg
      .setPosition(Math.round(moon.x * W), Math.round(horizonY - moon.height * (horizonY - topY)))
      .setAlpha(look.moonAlpha);

    for (const c of this.cloudImgs) {
      const x = ((c.x + (this.elapsed / 1000) * c.speed) % (W + 80)) - 60;
      c.img.setPosition(Math.round(x), c.y).setTint(look.cloudTint).setAlpha(0.94 - look.starAlpha * 0.3);
    }

    // Twinkling stars.
    const sg = this.stars;
    sg.clear();
    if (look.starAlpha > 0.02) {
      for (const st of this.starPoints) {
        const tw = 0.55 + 0.45 * Math.sin(this.elapsed / 600 + st.phase);
        const a = look.starAlpha * tw;
        sg.fillStyle(PAL.white, a).fillRect(st.x, st.y, 1, 1);
        if (st.big) {
          sg.fillStyle(PAL.white, a * 0.5);
          sg.fillRect(st.x - 1, st.y, 1, 1).fillRect(st.x + 1, st.y, 1, 1).fillRect(st.x, st.y - 1, 1, 1).fillRect(st.x, st.y + 1, 1, 1);
        }
      }
    }
  }

  /** Sparkles, drifting dashes and the sun/moon glint on the water. */
  private drawWaterFx(look: DayLook): void {
    const g = this.waterFx;
    g.clear();
    const t = this.elapsed / 1000;
    const sparkleColor = lerpColor(PAL.foam, look.skyBottom, 0.35);
    const lightLevel = Math.min(1, 0.35 + look.sunAlpha * 0.65 + look.moonAlpha * 0.25);

    for (const sp of this.sparkles) {
      const v = Math.sin(t * sp.speed + sp.phase);
      if (v < 0.55) continue;
      const a = (v - 0.55) / 0.45;
      g.fillStyle(sparkleColor, a * 0.85 * lightLevel).fillRect(sp.x, sp.y, a > 0.7 ? 2 : 1, 1);
    }

    // Drifting dashes.
    g.fillStyle(sparkleColor, 0.22 * lightLevel);
    for (let i = 0; i < 12; i++) {
      const y = FAR_SHORE_Y + 14 + ((i * 97) % (SHORE_Y - FAR_SHORE_Y - 40));
      const speed = 4 + (i % 3) * 3;
      const x = ((i * 53 + t * speed) % (W + 40)) - 20;
      g.fillRect(Math.round(x), y, 5 + (i % 4) * 3, 1);
    }

    // Glint under whichever body is up.
    const sun = sunArc(this.clock.minute);
    const moon = moonArc(this.clock.minute);
    const useSun = look.sunAlpha * (sun.up ? 1 : 0) >= look.moonAlpha * (moon.up ? 1 : 0);
    const body = useSun ? sun : moon;
    const strength = (useSun ? look.sunAlpha * (sun.up ? 1 : 0) : look.moonAlpha * (moon.up ? 1 : 0)) * (0.45 + 0.55 * Math.min(1, body.height * 1.6));
    if (strength < 0.04) return;
    const cx = Math.round(body.x * W);
    const color = useSun ? lerpColor(0xfff3b4, look.skyBottom, 0.25) : 0xdfe6ff;
    const frame = Math.floor(t * 5);
    for (let y = FAR_SHORE_Y + 6; y < 420; y += 3) {
      const depth = (y - FAR_SHORE_Y) / 270;
      const h = Math.sin(y * 12.9898 + frame * 78.233) * 43758.5453;
      const r = h - Math.floor(h);
      if (r < 0.28 + depth * 0.2) continue;
      const half = Math.round(2 + depth * 18 * r);
      const off = Math.round((r - 0.5) * 6 * (1 + depth * 2));
      g.fillStyle(color, strength * (0.85 - depth * 0.55)).fillRect(cx - half + off, y, half * 2, 1);
    }
  }

  private drawPosts(look: DayLook): void {
    const g = this.postFx;
    g.clear();
    const t = this.elapsed / 1000;
    const color = multiply(PAL.foam, look.waterTint);
    for (let i = 0; i < POST_BASES.length; i++) {
      const [x, base] = POST_BASES[i];
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.55 + i * 0.27 + k * 0.5) % 1;
        pixelEllipse(g, x, base, 3 + p * 6, 1 + p * 2, color, (1 - p) * 0.75);
      }
    }
  }

  private drawFireflies(look: DayLook): void {
    const g = this.fireflies;
    g.clear();
    if (look.fireflyAlpha < 0.03) return;
    const t = this.elapsed / 1000;
    for (const f of this.flies) {
      const blink = Math.pow(Math.max(0, Math.sin(t * f.blink + f.phase)), 0.6);
      const a = look.fireflyAlpha * blink;
      if (a < 0.05) continue;
      const x = Math.round(f.x + Math.sin(t * f.sx + f.phase) * f.ax);
      const y = Math.round(f.y + Math.sin(t * f.sy + f.phase * 2) * f.ay);
      g.fillStyle(PAL.fireflyGlow, a * 0.18).fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle(PAL.fireflyGlow, a * 0.4).fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle(PAL.firefly, a).fillRect(x, y, 2, 2);
    }
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

  /** The rod: a bent brown line from the angler's hands to ROD_TIP, drawn as pixels. */
  private drawRod(g: Phaser.GameObjects.Graphics, look: DayLook, bend: number): void {
    const p0 = ROD_HAND;
    const ctrl = { x: 206, y: 485 + bend };
    const dark = multiply(PAL.woodDeep, look.worldTint);
    const light = multiply(PAL.woodHi, look.worldTint);
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = Math.round(u * u * p0.x + 2 * u * t * ctrl.x + t * t * ROD_TIP.x);
      const y = Math.round(u * u * p0.y + 2 * u * t * ctrl.y + t * t * ROD_TIP.y);
      g.fillStyle(dark).fillRect(x - 1, y + 1, t < 0.35 ? 3 : 2, t < 0.35 ? 3 : 2);
      g.fillStyle(light).fillRect(x, y, t < 0.35 ? 2 : 1, t < 0.35 ? 2 : 1);
    }
    // Reel.
    g.fillStyle(multiply(PAL.stoneLight, look.worldTint)).fillRect(p0.x - 1, p0.y + 2, 2, 2);
    g.fillStyle(PAL.redLight).fillRect(ROD_TIP.x, ROD_TIP.y, 1, 1);
  }

  private drawLine(g: Phaser.GameObjects.Graphics, look: DayLook, bx: number, by: number, sag: number): void {
    const color = multiply(PAL.white, lerpColor(0xffffff, look.worldTint, 0.6));
    const cx = (ROD_TIP.x + bx) / 2 + sag;
    const cy = (ROD_TIP.y + by) / 2;
    const len = Math.hypot(bx - ROD_TIP.x, by - ROD_TIP.y);
    const n = Math.max(6, Math.ceil(len / 1.5));
    g.fillStyle(color, 0.85);
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = Math.round(u * u * ROD_TIP.x + 2 * u * t * cx + t * t * bx);
      const y = Math.round(u * u * ROD_TIP.y + 2 * u * t * cy + t * t * by);
      if (x === lx && y === ly) continue;
      g.fillRect(x, y, 1, 1);
      lx = x;
      ly = y;
    }
  }

  /** `under`: pulled below the surface, only the antenna tip shows. */
  private placeBobber(x: number, y: number, under: boolean, look: DayLook): void {
    const px = Math.round(x);
    const py = Math.round(y);
    this.bobberImg.setVisible(true).setTint(lerpColor(0xffffff, look.worldTint, 0.55));
    if (under) {
      this.bobberImg.setTexture(TEX.bobberUnder).setOrigin(0.5, 1).setPosition(px, py - 1);
    } else {
      this.bobberImg.setTexture(TEX.bobber).setOrigin(0.5, 5 / 9).setPosition(px, py);
    }
  }

  /**
   * Power feedback, kept in the top half of the screen so a thumb holding anywhere near the
   * bottom never covers it: a horizontal bar up top, plus a marker on the water showing where
   * the bobber would land right now.
   */
  private drawPowerMeter(g: Phaser.GameObjects.Graphics, power: number): void {
    const full = power > 0.95;
    const color = full ? PAL.redLight : PAL.gold;
    const edge = full ? PAL.red : PAL.sandDark;

    // Bar: dark frame, cream rim, amber fill with a highlight row and tick marks.
    const w = 240;
    const x = (W - w) / 2;
    const y = 78;
    g.fillStyle(PAL.outline).fillRect(x - 4, y - 3, w + 8, 18).fillRect(x - 3, y - 4, w + 6, 20);
    g.fillStyle(PAL.woodHi).fillRect(x - 3, y - 3, w + 6, 18);
    g.fillStyle(PAL.woodDeep).fillRect(x - 2, y - 2, w + 4, 16);
    const fillW = Math.round(w * power);
    g.fillStyle(edge).fillRect(x, y, fillW, 12);
    g.fillStyle(color).fillRect(x, y, fillW, 9);
    g.fillStyle(PAL.white, 0.55).fillRect(x, y, fillW, 2);
    g.fillStyle(PAL.woodDeep);
    for (let i = 1; i < 10; i++) g.fillRect(x + Math.round((w * i) / 10), y + 9, 1, 3);

    // Landing marker on the water.
    const distanceM = castDistance(power, this.ctx.rod);
    const ly = Math.round(distanceToY(distanceM));
    const pulse = 1 + Math.sin(this.elapsed / 120) * 0.2;
    pixelEllipse(g, BOBBER_X, ly, 8 * pulse, 2.5 * pulse, color, 0.95);
    g.fillStyle(color).fillRect(BOBBER_X, ly, 1, 1);
  }

  /** Warm panels behind the text labels. */
  private drawPanels(): void {
    const g = this.ui;
    g.clear();
    const panel = (t: Phaser.GameObjects.Text) => {
      if (!t.visible || t.text === '') return;
      const w = Math.round(t.width);
      const h = Math.round(t.height);
      const l = Math.round(t.x - t.originX * w);
      const top = Math.round(t.y - t.originY * h);
      const a = Math.min(1, t.alpha);
      g.fillStyle(PAL.outline, a).fillRect(l - 1, top, w + 2, h).fillRect(l, top - 1, w, h + 2);
      g.fillStyle(PAL.woodLight, a).fillRect(l, top, w, h);
      g.fillStyle(PAL.woodDeep, 0.9 * a).fillRect(l + 1, top + 1, w - 2, h - 2);
      g.fillStyle(PAL.woodDark, 0.9 * a).fillRect(l + 1, top + 1, w - 2, 1);
    };
    panel(this.clockLabel);
    panel(this.zoneLabel);
    panel(this.toast);
    panel(this.hint);
  }
}


