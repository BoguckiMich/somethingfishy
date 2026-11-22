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
  [113, 376],
  [113, 404],
  [113, 432],
  [250, 376],
  [250, 404],
  [250, 432],
];

const ANGLER_POS = { x: 164, y: DOCK.y + 6 };
const ROD_HAND = { x: ANGLER_POS.x + 29, y: ANGLER_POS.y + 26 };
const GLINT_N = 130;

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

function hash01(n: number): number {
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
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
  private glintSpeed: number[] = [];
  private glintPhase: number[] = [];
  private stateAge = 0;
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
    // Dev-only: ?debug=waiting forces the waiting state at 10 m (screenshots).
    if (new URLSearchParams(location.search).get('debug') === 'waiting') {
      this.state = { kind: 'waiting', distanceM: 10, zone: 'shallow', untilMs: 1e9, nibblesLeft: 0, hadNibble: false };
    }
    this.buildScenery();
    this.buildUi();

    this.input.on('pointerdown', () => this.send({ type: 'press' }));
    this.input.on('pointerup', () => this.send({ type: 'release' }));
    this.input.on('gameout', () => this.send({ type: 'release' }));

    this.render();
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs;
    this.stateAge += deltaMs;
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
    if (next.kind !== this.state.kind) {
      this.anim = 0;
      this.stateAge = 0;
    }
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
      [TEX.lilyA, 30, 330],
      [TEX.lilyB, 62, 352],
      [TEX.lilyB, 16, 296],
      [TEX.lilyA, 292, 300],
      [TEX.lilyB, 322, 330],
      [TEX.lilyA, 296, 376],
      [TEX.lilyB, 30, 400],
      [TEX.lilyA, 326, 262],
      [TEX.lilyB, 52, 250],
      [TEX.lilyA, 70, 428],
      [TEX.lilyB, 290, 424],
      [TEX.reed, 4, 456],
      [TEX.reed, 22, 460],
      [TEX.reed, 322, 458],
      [TEX.reed, 340, 454],
      [TEX.reed, 340, 252],
      [TEX.reed, 8, 262],
    ];   for (const [key, x, y] of decor) {
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
    for (let i = 0; i < GLINT_N; i++) {
      this.glintSpeed.push(1.5 + rnd() * 3);
      this.glintPhase.push(rnd() * 6.28);
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
        y: 468 + rnd() * 150,
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
    const tip = this.rodTip();
    this.drawRod(g, look, tip);
    if (bobber) {
      this.drawLine(g, look, tip, bobber.x, bobber.y, s.kind === 'waiting' ? 6 : tight ? 0 : 2);
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
    const horizonY = FAR_SHORE_Y - 20;
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

    // Glitter under whichever body is up: short twinkling sparkles, densest at the horizon.
    const sun = sunArc(this.clock.minute);
    const moon = moonArc(this.clock.minute);
    const sunStr = look.sunAlpha * (sun.up ? 1 : 0);
    const moonStr = look.moonAlpha * (moon.up ? 1 : 0);
    const useSun = sunStr >= moonStr;
    const body = useSun ? sun : moon;
    const strength = (useSun ? sunStr : moonStr * 0.95) * (0.7 + 0.3 * Math.min(1, body.height * 1.6));
    if (strength < 0.04) return;
    const cx = body.x * W;
    const color = useSun ? lerpColor(0xfff3b4, look.skyBottom, 0.3) : 0xc4d4ff;
    const depthPx = (SHORE_Y - FAR_SHORE_Y) / 3;
    for (let i = 0; i < GLINT_N; i++) {
      const w = t * this.glintSpeed[i] + this.glintPhase[i];
      const v = Math.sin(w);
      if (v < 0.2) continue;
      const cyc = Math.floor(w / Math.PI);
      const r1 = hash01(i * 7.1 + cyc * 13.7);
      const r2 = hash01(i * 3.3 + cyc * 5.9 + 1);
      const r3 = hash01(i * 1.7 + cyc * 9.1 + 2);
      const u = Math.pow(r1, 1.3);
      const y = FAR_SHORE_Y + 5 + u * depthPx;
      const x = cx + (r2 - 0.5) * 2 * (4 + u * 28);
      const len = 1 + Math.floor(r3 * 3);
      g.fillStyle(color, v * strength * (1 - u * 0.7)).fillRect(Math.round(x), Math.round(y), len, 1);
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
      const tip = this.rodTip();
      const y = Phaser.Math.Linear(tip.y, targetY, t) - Math.sin(Math.PI * t) * (30 + s.distanceM * 2);
      return { x: Phaser.Math.Linear(tip.x, BOBBER_X, t), y };
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
      return { x: BOBBER_X, y: Phaser.Math.Linear(distanceToY(s.distanceM), this.rodTip().y, t) };
    }
    return null;
  }

  /** Current animated rod tip (and how much the rod bends), from the game state. */
  private rodTip(): { x: number; y: number; bend: number } {
    const s = this.state;
    const t = this.elapsed / 1000;
    let dx = 0;
    let dy = 0;
    let bend = 3;
    const bobberY = 'distanceM' in s ? distanceToY(s.distanceM) : ROD_TIP.y;
    const tow = Math.sign(bobberY - ROD_TIP.y) || 1;
    switch (s.kind) {
      case 'idle':
      case 'waiting':
        dx = Math.sin(t * 1.1);
        dy = Math.sin(t * 0.8 + 1) * 0.9;
        if (this.nibbleAge < NIBBLE_ANIM_MS) dy += Math.sin(this.nibbleAge / 32) * 2.5 * (1 - this.nibbleAge / NIBBLE_ANIM_MS);
        break;
      case 'charging': {
        const p = chargePower(s.heldMs);
        dx = -16 * p;
        dy = 52 * p;
        bend = 3 + 8 * p;
        break;
      }
      case 'casting': {
        const ms = this.stateAge;
        dy = ms < 110 ? Phaser.Math.Linear(40, -16, ms / 110) : -16 * Math.exp(-(ms - 110) / 110) * Math.cos((ms - 110) / 45);
        bend = ms < 110 ? 2 : 3 + Math.max(0, 8 * Math.exp(-(ms - 110) / 90));
        break;
      }
      case 'bite':
        dx = 4 + Math.sin(t * 40);
        dy = tow * 5;
        bend = 9;
        break;
      case 'hooked':
        dx = 3 + Math.sin(t * 22) * 1.5;
        dy = tow * 9 + Math.sin(t * 31) * 2;
        bend = 15 + Math.sin(t * 25) * 2;
        break;
      case 'retrieving':
        dy = 12 * Math.sin(this.anim * Math.PI);
        bend = 6;
        break;
    }
    return { x: Math.round(ROD_TIP.x + dx), y: Math.round(ROD_TIP.y + dy), bend };
  }

  /**
   * The rod, held out to the upper right: cork grip, small reel, a 2 px blank tapering to 1 px,
   * line guides and a red tip. Drawn as pixels with a dark rim so it reads on water and planks.
   */
  private drawRod(g: Phaser.GameObjects.Graphics, look: DayLook, tip: { x: number; y: number; bend: number }): void {
    const hand = ROD_HAND;
    const dxv = tip.x - hand.x;
    const dyv = tip.y - hand.y;
    const len = Math.hypot(dxv, dyv) || 1;
    const ux = dxv / len;
    const uy = dyv / len;
    // The butt pokes out behind the hand.
    const p0 = { x: hand.x - ux * 6, y: hand.y - uy * 6 };
    const total = len + 6;
    // Bend toward the right of the rod direction (the tip droops under load).
    const ctrl = { x: (p0.x + tip.x) / 2 - uy * tip.bend, y: (p0.y + tip.y) / 2 + ux * tip.bend };
    const tint = (c: number) => multiply(c, look.worldTint);
    const rim = PAL.outline;
    const n = Math.ceil(total * 1.5);
    const pts: { x: number; y: number; t: number; th: number }[] = [];
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = Math.round(u * u * p0.x + 2 * u * t * ctrl.x + t * t * tip.x);
      const y = Math.round(u * u * p0.y + 2 * u * t * ctrl.y + t * t * tip.y);
      if (x === lx && y === ly) continue;
      lx = x;
      ly = y;
      const dist = t * total;
      pts.push({ x, y, t, th: dist < 12 ? 3 : t < 0.62 ? 2 : 1 });
    }
    for (const p of pts) g.fillStyle(rim, 0.9).fillRect(p.x - 1, p.y - 1, p.th + 2, p.th + 2);
    for (const p of pts) {
      const grip = p.t * total < 12;
      const c = grip ? (p.x + p.y) % 3 === 0 ? PAL.sandDark : PAL.sand : p.t < 0.62 ? PAL.woodHi : PAL.strawLight;
      g.fillStyle(tint(c)).fillRect(p.x, p.y, p.th, p.th);
      if (!grip && p.th >= 2) g.fillStyle(tint(PAL.woodLight)).fillRect(p.x + 1, p.y + 1, 1, 1);
    }
    // Line guides.
    for (const gt of [0.36, 0.55, 0.72, 0.88]) {
      const p = pts[Math.min(pts.length - 1, Math.floor(gt * pts.length))];
      g.fillStyle(tint(PAL.white)).fillRect(p.x + 1, p.y - 1, 1, 1);
    }
    // Reel under the grip.
    const rx = Math.round(hand.x - ux * 1) - 1;
    const ry = Math.round(hand.y - uy * 1) + 2;
    g.fillStyle(rim).fillRect(rx - 1, ry - 1, 6, 6);
    g.fillStyle(tint(PAL.stone)).fillRect(rx, ry, 4, 4);
    g.fillStyle(tint(PAL.stoneLight)).fillRect(rx, ry, 2, 2);
    g.fillStyle(tint(PAL.gold)).fillRect(rx + 3, ry + 3, 1, 1);
    // Red tip.
    g.fillStyle(PAL.redLight).fillRect(tip.x, tip.y, 2, 2);
  }

  private drawLine(g: Phaser.GameObjects.Graphics, look: DayLook, tip: { x: number; y: number }, bx: number, by: number, sag: number): void {
    const color = multiply(PAL.white, lerpColor(0xffffff, look.worldTint, 0.6));
    const cx = (tip.x + bx) / 2 + sag;
    const cy = (tip.y + by) / 2;
    const len = Math.hypot(bx - tip.x, by - tip.y);
    const n = Math.max(6, Math.ceil(len / 1.5));
    g.fillStyle(color, 0.85);
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = Math.round(u * u * tip.x + 2 * u * t * cx + t * t * bx);
      const y = Math.round(u * u * tip.y + 2 * u * t * cy + t * t * by);
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


