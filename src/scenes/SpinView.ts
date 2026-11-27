import Phaser from 'phaser';
import { PAL } from '../art/palette';
import { lerpColor } from '../art/dayCycle';
import { LIE_HINT_MS, LURE_COLOURS, followerPose, glintLook, spinRodMotion } from '../art/spinFx';
import type { GameEvent } from '../core/events';
import type { FishingState } from '../core/fishingSession';
import { lyingStill, type Follower, type SpinState } from '../core/spinning';
import { HINT_SPIN_CASTS } from '../core/tips';
import { sound } from '../audio/sound';
import { HAPTICS, vibrate } from './haptics';

/**
 * The spinning retrieve on the lake (slice 32): what Alex's lure, line and the shadow behind it look like, and the small cues around them.
 * The pure `SpinState` goes in (`core/spinning.ts`), pixels come out; every number of the look is in `art/spinFx.ts` (tested). LakeScene owns
 * the rod's place in the scene, the line and the toasts; this view owns the lure's glint, its ripple trail, the follower (a dark shadow
 * with a V-wake that fades in on `follow` and out on `followLost`), the strike and nip splashes, the snag hold, the idle hint, and the
 * slim spinning rod drawn in place of the float rod. It is also where the spin events are felt (haptics and sound).
 */

const DEPTH = 16;
const SHADOW = 0x10233a;
const DEEP = 0x1d3c5c;
/** The lure lives this long as a ripple trail point (ms). */
const TRAIL_MS = 800;
const TRAIL_EVERY_MS = 140;
const SPLASH_MS = 380;
/** A strike jolts the rod for this long (ms); a nip makes the shadow dart back for this long. */
const JOLT_MS = 260;
const DART_MS = 420;
/** The snag: the rod stays bent and the line tight this long before the empty line is reeled in (ms). */
const SNAG_HOLD_MS = 1300;
/** The follower fades in and out over this long (ms). */
const FADE_MS = 320;

export interface SpinHost {
  /** Shows a toast at once / queues it behind the one showing. */
  toast(text: string): void;
  queueToast(text: string): void;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  big: boolean;
}

/** What the view needs from the scene each frame. */
export interface SpinFrame {
  state: FishingState;
  /** Where the lure is (the bobber's place for the state), or null. */
  pos: { x: number; y: number } | null;
  /** The scene's day tint, applied to every colour. */
  tintFx: (c: number) => number;
  elapsedMs: number;
}

/** A ring of single pixels (the scene's own `pixelEllipse`). */
function ring(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  const n = Math.max(10, Math.ceil((rx + ry) * 2.2));
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

export class SpinView {
  private g: Phaser.GameObjects.Graphics;
  /** The lure of this cast (a spin cast), or null for a float cast. */
  private lure: string | null = null;
  /** The lure is still on the line (a snag or a snapped line takes it). */
  private onLine = false;
  /** Which cast of the hint's first three this one is (0 .. 2), or 3+ for none. */
  private castIndex = HINT_SPIN_CASTS;
  private splashes: Splash[] = [];
  private trail: { x: number; y: number; age: number }[] = [];
  private trailAcc = 0;
  private joltMs = Infinity;
  private dartMs = Infinity;
  private snagMs = 0;
  private lieMs = 0;
  private spinMs = 0;
  /** The follower on screen: 0 = gone .. 1 = shown; `shown` keeps its last look so it can fade out. */
  private fade = 0;
  private shown: { f: Follower; distanceM: number; depth: number; away: number } | null = null;
  private lastPos: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, private host: SpinHost) {
    this.g = scene.add.graphics().setDepth(DEPTH);
  }

  /** A spin cast: the lure is on the line. `castsBefore` = how many spin casts she made before (the first three show the hint). */
  begin(lure: string, castsBefore: number): void {
    this.reset();
    this.lure = lure;
    this.onLine = true;
    this.castIndex = castsBefore;
  }

  /** The cast is over (back to idle): the float rig is on again. */
  end(): void {
    this.reset();
    this.lure = null;
    this.onLine = false;
  }

  private reset(): void {
    this.splashes = [];
    this.trail = [];
    this.trailAcc = 0;
    this.joltMs = Infinity;
    this.dartMs = Infinity;
    this.snagMs = 0;
    this.lieMs = 0;
    this.spinMs = 0;
    this.fade = 0;
    this.shown = null;
    this.g.clear();
  }

  /** This cast is a spin cast (the lure takes the bobber's place). */
  get active(): boolean {
    return this.lure !== null;
  }

  /** The snag's hold is running: the line stays tight and the rod bent, the retrieve animation waits. */
  get snagging(): boolean {
    return this.snagMs > 0;
  }

  hide(): void {
    this.g.clear();
  }

  /** The events the spinning rod makes: cues the player feels (the core has already decided everything). `pos` is where the lure is. */
  onEvent(e: GameEvent, pos: { x: number; y: number } | null): void {
    const at = pos ?? this.lastPos;
    switch (e.type) {
      case 'strike':
        this.joltMs = 0;
        if (at) this.splashes.push({ x: at.x, y: at.y, age: 0, big: true });
        vibrate(HAPTICS.bite);
        sound.play('bite');
        break;
      case 'nip':
        this.dartMs = 0;
        if (at) this.splashes.push({ x: at.x, y: at.y, age: 0, big: false });
        vibrate(HAPTICS.nibble);
        sound.play('nibble');
        break;
      case 'snag':
        this.snagMs = SNAG_HOLD_MS;
        this.onLine = false;
        this.host.toast('Snagged on a root...');
        vibrate(HAPTICS.lineRed);
        sound.play('creak');
        break;
      case 'lureLost':
        this.onLine = false;
        break;
      case 'lureSpat':
        this.host.queueToast('It spat the lure out.');
        break;
    }
  }

  /** Ages the timers by one frame (the scene's `update`). */
  tick(dtMs: number, state: FishingState): void {
    this.joltMs += dtMs;
    this.dartMs += dtMs;
    if (this.snagMs > 0) this.snagMs = Math.max(0, this.snagMs - dtMs);
    for (const s of this.splashes) s.age += dtMs;
    this.splashes = this.splashes.filter((s) => s.age < SPLASH_MS);
    for (const t of this.trail) t.age += dtMs;
    this.trail = this.trail.filter((t) => t.age < TRAIL_MS);
    if (state.kind === 'spinning') {
      this.spinMs += dtMs;
      this.lieMs = lyingStill(state.spin) ? this.lieMs + dtMs : 0;
      if (state.spin.holding) {
        this.trailAcc += dtMs;
      } else {
        this.trailAcc = 0;
      }
    } else {
      this.lieMs = 0;
    }
    // The shadow fades in while a follower swims and out when it has gone (it drifts back as it leaves).
    const sp = state.kind === 'spinning' ? state.spin : undefined;
    if (sp?.follower) {
      this.fade = Math.min(1, this.fade + dtMs / FADE_MS);
      this.shown = { f: sp.follower, distanceM: sp.distanceM, depth: sp.depth, away: 0 };
    } else if (!sp) {
      // Out of the retrieve (a strike set the hook, the lure came in): the shadow is gone at once.
      this.fade = 0;
      this.shown = null;
    } else if (this.shown) {
      this.fade = Math.max(0, this.fade - dtMs / (FADE_MS * 1.6));
      this.shown.away += dtMs * 0.02;
      if (this.fade <= 0) this.shown = null;
    }
  }

  /** The line from the rod tip bows as the lure is reeled, and goes dead tight when snagged. */
  lineLook(state: FishingState): { sag: number; droop: number } | null {
    if (this.snagMs > 0) return { sag: 0, droop: 0 };
    if (state.kind === 'spinning') return { sag: 1.5, droop: state.spin.holding ? 0 : 5 };
    return null;
  }

  /** The hint line: the idle lure on the bottom, a strike waiting for the thumb, the first three casts' help. Empty = none. */
  hint(state: FishingState): string {
    if (state.kind !== 'spinning') return '';
    const s = state.spin;
    if (s.strikeWindowMs !== undefined) return 'Reel now!';
    if (this.lieMs >= LIE_HINT_MS) return 'Reel it in or switch to the float.';
    if (this.castIndex < HINT_SPIN_CASTS) return Math.floor(this.spinMs / 3500) % 2 === 0 ? 'Hold to reel, let go to pause' : 'Watch for a shadow...';
    return '';
  }

  /** The rod while the lure is in the water (see `spinRodMotion`): its tip offset and bend. */
  rodMotion(state: FishingState, elapsedMs: number): { dx: number; dy: number; bend: number } {
    const jolt = this.joltMs < JOLT_MS ? 1 - this.joltMs / JOLT_MS : 0;
    const holding = state.kind === 'spinning' && state.spin.holding;
    return spinRodMotion(holding, elapsedMs, jolt, this.snagMs > 0);
  }

  /** Draws everything of the retrieve for this frame (the line and the rod are the scene's). */
  draw(f: SpinFrame): void {
    const g = this.g;
    g.clear();
    const t = f.tintFx;
    if (f.pos) this.lastPos = f.pos;
    const s = f.state.kind === 'spinning' ? f.state.spin : null;
    if (s && f.pos) this.drawTrail(g, s, f.pos, t);
    this.drawFollower(g, f, t);
    if (this.onLine && f.pos && this.lure) this.drawLure(g, this.lure, f.pos, s?.depth ?? 0, s?.holding ?? false, f.elapsedMs, t);
    for (const sp of this.splashes) this.drawSplash(g, sp, t);
  }

  // ---- The lure ---------------------------------------------------------------------------------------------------

  /** The glint just under the surface: it sinks and dims with depth, and twinkles near the top. */
  private drawLure(g: Phaser.GameObjects.Graphics, id: string, p: { x: number; y: number }, depth: number, holding: boolean, ms: number, t: (c: number) => number): void {
    const look = glintLook(depth, holding, ms);
    const col = LURE_COLOURS[id] ?? LURE_COLOURS.spinner;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const dim = (c: number) => t(lerpColor(c, DEEP, look.deep * 0.6));
    // A soft halo so a dimmed lure can still be found on the bottom, and a dark pixel row under it to set it off the bright water.
    g.fillStyle(t(PAL.foam), 0.14 * look.alpha).fillRect(x - 4, y - 1, 9, 2).fillRect(x - 2, y - 2, 5, 4);
    g.fillStyle(SHADOW, 0.35 * look.alpha).fillRect(x - 2, y + 2, 5, 1);
    switch (id) {
      case 'wobbler':
        g.fillStyle(dim(col.blade), look.alpha).fillRect(x - 2, y - 1, 5, 1);
        g.fillStyle(dim(col.body), look.alpha).fillRect(x - 2, y, 5, 1);
        g.fillStyle(dim(PAL.pineDark), look.alpha).fillRect(x, y - 1, 1, 2).fillRect(x + 2, y - 1, 1, 2);
        break;
      case 'jig':
        g.fillStyle(dim(col.body), look.alpha).fillRect(x - 2, y - 1, 2, 2);
        g.fillStyle(dim(col.blade), look.alpha).fillRect(x, y - 1, 3, 2).fillRect(x + 2, y + 1, 1, 1);
        break;
      default:
        g.fillStyle(dim(col.blade), look.alpha).fillRect(x - 2, y - 1, 4, 2);
        g.fillStyle(dim(col.shine), look.alpha).fillRect(x - 2, y - 1, 2, 1);
        g.fillStyle(dim(col.body), look.alpha).fillRect(x, y + 1, 2, 1);
    }
    if (look.sparkle) g.fillStyle(t(col.shine), 0.9 * look.alpha).fillRect(x + 2, y - 2, 1, 1).fillRect(x - 2, y - 2, 1, 1).fillRect(x, y - 3, 1, 1);
  }

  /** A faint ripple trail behind the lure while it is reeled. */
  private drawTrail(g: Phaser.GameObjects.Graphics, s: SpinState, p: { x: number; y: number }, t: (c: number) => number): void {
    while (this.trailAcc >= TRAIL_EVERY_MS) {
      this.trailAcc -= TRAIL_EVERY_MS;
      this.trail.push({ x: p.x, y: p.y, age: 0 });
    }
    for (const r of this.trail) {
      const k = r.age / TRAIL_MS;
      ring(g, Math.round(r.x), Math.round(r.y) + 1, 2 + k * 6, 0.6 + k * 1.8, t(PAL.foam), (1 - k) * 0.4 * (1 - 0.5 * s.depth));
    }
  }

  // ---- The follower -----------------------------------------------------------------------------------------------

  /** A dark shadow with a V-wake behind the head, trailing the lure by `followerGapM` (it closes in) and fading with `fade`. */
  private drawFollower(g: Phaser.GameObjects.Graphics, fr: SpinFrame, t: (c: number) => number): void {
    const sh = this.shown;
    if (!sh || this.fade <= 0 || !fr.pos) return;
    const dart = this.dartMs < DART_MS ? Math.sin((this.dartMs / DART_MS) * Math.PI) * 16 : 0;
    const pose = followerPose(sh.f, sh.distanceM, dart + sh.away);
    const sway = Math.round(Math.sin(fr.elapsedMs / 330 + sh.f.lengthCm) * 1.5);
    const cx = Math.round(fr.pos.x) + sway;
    const headY = Math.round(fr.pos.y - pose.gapPx);
    const a = this.fade * (0.6 - 0.2 * sh.depth);
    const len = pose.lengthPx;
    const w = pose.widthPx;
    // The body: a long ellipse along the water (the fish swims toward the dock), widest a third from the head.
    for (let i = 0; i < len; i++) {
      const u = i / (len - 1 || 1);
      const half = Math.max(0.5, (w / 2) * Math.sin(Math.PI * Math.min(1, 0.15 + 0.85 * (1 - u) ** 0.8)) * (u > 0.75 ? 0.6 : 1));
      const y = headY - i;
      const x0 = Math.round(cx - half + (i > len * 0.7 ? Math.sin(fr.elapsedMs / 120) : 0));
      g.fillStyle(SHADOW, a).fillRect(x0, y, Math.max(1, Math.round(half * 2)), 1);
    }
    // The tail fin: flared at the far end, beating.
    const tailY = headY - len;
    const beat = Math.round(Math.sin(fr.elapsedMs / 110));
    g.fillStyle(SHADOW, a * 0.9).fillRect(cx - 2 + beat, tailY - 1, 5, 1).fillRect(cx - 1 + beat, tailY - 2, 3, 1);
    // The V-wake: two foam arms spreading back from the head, thinning out.
    const arm = Math.min(7, 3 + Math.round(len / 3));
    for (let k = 1; k <= arm; k++) {
      const fa = this.fade * (1 - k / (arm + 1)) * 0.75;
      const spread = Math.round(k * 1.1 + w / 2);
      g.fillStyle(t(PAL.foam), fa).fillRect(cx - spread, headY - Math.round(k * 0.9), 1, 1).fillRect(cx + spread, headY - Math.round(k * 0.9), 1, 1);
    }
    g.fillStyle(t(PAL.foam), this.fade * 0.5).fillRect(cx - 1, headY + 1, 3, 1);
  }

  // ---- Splashes ---------------------------------------------------------------------------------------------------

  private drawSplash(g: Phaser.GameObjects.Graphics, sp: Splash, t: (c: number) => number): void {
    const k = sp.age / SPLASH_MS;
    const sc = sp.big ? 1 : 0.55;
    const x = Math.round(sp.x);
    const y = Math.round(sp.y);
    ring(g, x, y, (3 + k * 12) * sc, (1 + k * 4) * sc, t(PAL.foam), (1 - k) * 0.95);
    if (k > 0.2) ring(g, x, y, (3 + (k - 0.2) * 12) * sc, (1 + (k - 0.2) * 4) * sc, t(PAL.foam), (1 - k) * 0.55);
    const drops = sp.big ? 8 : 4;
    for (let i = 0; i < drops; i++) {
      const ang = (i / drops) * Math.PI * 2 + 0.4;
      const rise = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (sp.big ? 9 : 5);
      g.fillStyle(t(PAL.white), (1 - k) * 0.95).fillRect(Math.round(x + Math.cos(ang) * (2 + k * 9) * sc), Math.round(y - rise * (0.5 + 0.5 * Math.abs(Math.sin(ang * 2)))), 1, 1);
    }
  }

  // ---- The slim spinning rod --------------------------------------------------------------------------------------

  /**
   * The spinning rod, in place of the float rod: a slimmer green blade (1 px past the cork grip) with four guides, a rounder reel under the
   * grip with a crank knob that turns while she reels. `hand` is where she holds it, `tip` where the blade ends.
   */
  drawRod(g: Phaser.GameObjects.Graphics, t: (c: number) => number, hand: { x: number; y: number }, tip: { x: number; y: number; bend: number }, reeling: boolean, elapsedMs: number): void {
    const dxv = tip.x - hand.x;
    const dyv = tip.y - hand.y;
    const len = Math.hypot(dxv, dyv) || 1;
    const ux = dxv / len;
    const uy = dyv / len;
    const p0 = { x: hand.x - ux * 6, y: hand.y - uy * 6 };
    const total = len + 6;
    const ctrl = { x: (p0.x + tip.x) / 2 - uy * tip.bend, y: (p0.y + tip.y) / 2 + ux * tip.bend };
    const n = Math.ceil(total * 1.5);
    const pts: { x: number; y: number; t: number; grip: boolean; thick: boolean }[] = [];
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const v = 1 - u;
      const x = Math.round(v * v * p0.x + 2 * v * u * ctrl.x + u * u * tip.x);
      const y = Math.round(v * v * p0.y + 2 * v * u * ctrl.y + u * u * tip.y);
      if (x === lx && y === ly) continue;
      lx = x;
      ly = y;
      pts.push({ x, y, t: u, grip: u * total < 8, thick: u * total < len * 0.4 });
    }
    for (const p of pts) g.fillStyle(PAL.outline, p.thick ? 0.7 : 0.45).fillRect(p.x + 1, p.y + 1, p.thick ? 2 : 1, p.thick ? 2 : 1).fillRect(p.x - 1, p.y, 1, 1);
    for (const p of pts) {
      const c = p.grip ? ((p.x + p.y) % 3 === 0 ? PAL.sandDark : PAL.sand) : p.t < 0.5 ? PAL.leafHi : PAL.leafLight;
      g.fillStyle(t(c)).fillRect(p.x, p.y, p.thick ? 2 : 1, p.thick ? 2 : 1);
    }
    for (const gt of [0.32, 0.5, 0.68, 0.86]) {
      const p = pts[Math.min(pts.length - 1, Math.floor(gt * pts.length))];
      g.fillStyle(t(PAL.white)).fillRect(p.x + 1, p.y - 1, 1, 1);
    }
    // A thin gold wrap above the grip.
    const wrap = pts[Math.min(pts.length - 1, Math.floor((9 / total) * pts.length))];
    g.fillStyle(t(PAL.gold)).fillRect(wrap.x, wrap.y, 1, 1);
    // The reel: a round body under the grip, a spool, and the crank knob going round while she reels.
    const rx = Math.round(hand.x - ux * 1) - 2;
    const ry = Math.round(hand.y - uy * 1) + 2;
    g.fillStyle(PAL.outline).fillRect(rx - 1, ry - 1, 8, 7);
    g.fillStyle(t(PAL.stone)).fillRect(rx, ry, 6, 5);
    g.fillStyle(t(PAL.stoneLight)).fillRect(rx, ry, 4, 2);
    g.fillStyle(t(PAL.stoneDark)).fillRect(rx + 1, ry + 3, 4, 1);
    const turn = reeling ? (elapsedMs / 110) % (Math.PI * 2) : 0.6;
    const kx = Math.round(rx + 3 + Math.cos(turn) * 3);
    const ky = Math.round(ry + 2 + Math.sin(turn) * 2.4);
    g.fillStyle(PAL.outline).fillRect(kx - 1, ky - 1, 3, 3);
    g.fillStyle(t(PAL.gold)).fillRect(kx, ky, 1, 1);
    g.fillStyle(PAL.redLight).fillRect(tip.x, tip.y, 2, 1);
  }
}
