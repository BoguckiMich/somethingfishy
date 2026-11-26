import Phaser from 'phaser';
import { DOG_SIZE, EMPTY_CHAIR, PAJ_CUP, PAJ_HEAD_TOP, PAJ_ORIGIN_Y, PAJ_SIZE, PAJ_WALK_SIZE, dogKey, type DogFrame, type PajPose, type PajWalkPose, type StickVariant } from '../../art/characters';
import { W } from '../../art/layout';
import { lerpColor } from '../../art/dayCycle';
import { PAL } from '../../art/palette';
import { TEX, pajSitKey, pajWalkKey, stickGroundKey } from '../../art/textures';
import { FONT, FS, textPad } from '../../font';
import { WOOF_TEXT } from '../../core/data/pajkelLines';
import type { Spots } from '../../core/location';
import { tr } from '../../i18n/en';
import { drawFrame } from '../frameDraw';
import {
  bubbleAlpha,
  chairEmpty,
  createCompanions,
  dogView,
  dogVisible,
  groundStickAlpha,
  holdsCup,
  isSeatedShape,
  pajStretchHigh,
  pajVisible,
  pajSay,
  pajWalkFrame,
  isNapping,
  petDog,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const DEPTH = 14;
/** The wisp over the cup: one every STEAM_EVERY_MS, rising STEAM_RISE px and fading over STEAM_MS. */
const STEAM_EVERY_MS = 700;
const STEAM_MS = 1500;
const STEAM_RISE = 7;
/** The thrown stick turns one frame (45 degrees) every SPIN_MS; the landing puff shows two frames of PUFF_MS. */
const STICK_SPIN_MS = 80;
const PUFF_MS = 225;
/** The speech bubble: height of the tail (rows incl. the tip), the gap to the screen edge, and the canvas width it must stay inside. */
const BUBBLE_TAIL = 4;
/** Extra stalk so the box clears Alex's head, who stands right beside Pajkel on the dock. */
const BUBBLE_LIFT = 30;
const BUBBLE_MARGIN = 4;
const BUBBLE_VIEW_W = W;
const BUBBLE_INK = '#241a2e';
/** While he stands left of this x the bubble is at most SHORE_BUBBLE_W wide. */
const SHORE_BUBBLE_X = 130;
const SHORE_BUBBLE_W = 140;
/** Above the characters and the show-off, below the HUD panels (LakeScene's uiPanel is 30). */
const BUBBLE_DEPTH = 28;

/** Phaser layer for Pajkel and the dog: owns the images, the pure state machine owns the logic. */
export class CompanionView {
  readonly state: Companions;
  private paj: Phaser.GameObjects.Image;
  private dog: Phaser.GameObjects.Image;
  /** Which side of him she is drawn on; it only changes once she is 3 px past him, so sliding round him does not flicker. */
  private dogBehind = false;
  private stick: Phaser.GameObjects.Image;
  /** The empty camp chair at his dock spot, shown while he is away or in the car. */
  private chair: Phaser.GameObjects.Image;
  /** The deck chair from the camp shop (slice 23e): only the chair art changes, his seated frames are the same. */
  private deck = false;
  private steam: { img: Phaser.GameObjects.Image; age: number; x: number; y: number }[] = [];
  private steamClock = 0;
  private puff: Phaser.GameObjects.Image;
  private puffAge = Infinity;
  private lastStickState: string = 'hidden';
  /** Sticks lying on the grass (old ones and the spare), one image each, reused. */
  private ground: Phaser.GameObjects.Image[] = [];
  private zs: Phaser.GameObjects.Image[] = [];
  private hearts: { img: Phaser.GameObjects.Image; age: number; life: number }[] = [];
  private bubbleGfx: Phaser.GameObjects.Graphics;
  private bubbleText: Phaser.GameObjects.Text;
  /** Bestia's one "Woof!" after a five-skip pebble (slice 26b). */
  private woof: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    spots: Spots,
    rng: () => number = Math.random,
  ) {
    this.state = createCompanions(rng, spots);
    this.paj = scene.add.image(0, 0, pajSitKey('sit', 0)).setDepth(DEPTH);
    this.dog = scene.add.image(0, 0, dogKey({ shape: 'lie', tail: 0, perked: false, step: 0 })).setDepth(DEPTH);
    this.chair = scene.add.image(this.state.spots.companions.paj.x - PAJ_SIZE.w / 2 + EMPTY_CHAIR.x, this.state.spots.companions.paj.y - PAJ_ORIGIN_Y + EMPTY_CHAIR.y, TEX.emptyChair).setOrigin(0, 0).setDepth(DEPTH - 1).setVisible(false);
    this.stick = scene.add.image(0, 0, TEX.stickSpin[0]).setDepth(DEPTH + 1).setVisible(false);
    this.puff = scene.add.image(0, 0, TEX.stickPuff[0]).setDepth(DEPTH - 0.4).setVisible(false);
    for (let i = 0; i < 3; i++) this.steam.push({ img: scene.add.image(0, 0, TEX.steam).setOrigin(0.5, 1).setDepth(DEPTH + 2).setVisible(false), age: Infinity, x: 0, y: 0 });
    for (const key of [TEX.zSmall, TEX.zBig]) {
      this.zs.push(scene.add.image(0, 0, key).setDepth(DEPTH + 3).setVisible(false));
    }
    this.bubbleGfx = scene.add.graphics().setDepth(BUBBLE_DEPTH);
    this.bubbleText = scene
      .add.text(0, 0, '', { fontFamily: FONT, fontSize: `${FS.small}px`, color: BUBBLE_INK, padding: textPad(7, 4), align: 'center', wordWrap: { width: BUBBLE_VIEW_W - 2 * BUBBLE_MARGIN } })
      .setDepth(BUBBLE_DEPTH + 1)
      .setVisible(false);
    this.woof = scene.add
      .text(0, 0, tr(WOOF_TEXT), { fontFamily: FONT, fontSize: `${FS.small}px`, color: '#fff6e0', stroke: BUBBLE_INK, strokeThickness: 3, padding: textPad(2, 1) })
      .setOrigin(0.5, 1)
      .setDepth(BUBBLE_DEPTH)
      .setVisible(false);
  }


  /** Swaps his red camp chair for the striped deck chair (or back). */
  setDeckChair(on: boolean): void {
    this.deck = on;
  }

  /** Pajkel says a line in a speech bubble (a new one replaces the one showing). */
  say(text: string): void {
    pajSay(this.state, text);
  }

  /**
   * Draws the bubble over Pajkel's head: a cream pixel frame with a small tail pointing at him. It
   * follows him when he walks and is kept on screen (the tail slides along the bottom edge).
   */
  private drawBubble(): void {
    const b = this.state.bubble;
    this.bubbleGfx.clear();
    this.bubbleText.setVisible(b !== null);
    if (!b) return;
    const p = this.state.paj;
    const alpha = bubbleAlpha(b);
    // Out on the left shore (the pebble outing) the bubble wraps to two lines so it stays clear of Alex on the dock (slice 26b).
    this.bubbleText.setWordWrapWidth(p.x < SHORE_BUBBLE_X ? SHORE_BUBBLE_W : BUBBLE_VIEW_W - 2 * BUBBLE_MARGIN);
    const shown = tr(b.text); // the lines hold {player} {dog} {water} placeholders
    if (this.bubbleText.text !== shown) this.bubbleText.setText(shown);
    const w = Math.round(this.bubbleText.width);
    const h = Math.round(this.bubbleText.height);
    const tx = Math.round(p.x);
    const headTop = Math.round(p.y) - (isSeatedShape(p.shape) ? PAJ_ORIGIN_Y - PAJ_HEAD_TOP + 2 : PAJ_WALK_SIZE.h - 2);
    const left = Math.min(Math.max(tx - Math.round(w / 2), BUBBLE_MARGIN), BUBBLE_VIEW_W - BUBBLE_MARGIN - w);
    const top = headTop - h - BUBBLE_TAIL - BUBBLE_LIFT;
    // The tail stays within the straight part of the bottom edge.
    const tail = Math.min(Math.max(tx, left + 6), left + w - 7);
    const g = this.bubbleGfx;
    drawFrame(g, left, top, w, h, 'bubble', alpha);
    // The tail: open the bottom edge, flare once, run a 3 px stalk down to his head, then narrow to a point.
    const cream = PAL.cream;
    const rows = BUBBLE_TAIL + BUBBLE_LIFT;
    g.fillStyle(cream, alpha).fillRect(tail - 2, top + h - 2, 5, 2);
    for (let r = 0; r < rows - 1; r++) {
      const hw = r === 0 ? 2 : r < rows - 3 ? 1 : rows - 2 - r; // 2, then 1 down the stalk, then 1, 0
      g.fillStyle(PAL.outline, alpha).fillRect(tail - hw - 1, top + h + r, 2 * hw + 3, 1);
      g.fillStyle(cream, alpha).fillRect(tail - hw, top + h + r, 2 * hw + 1, 1);
    }
    g.fillStyle(PAL.outline, alpha).fillRect(tail, top + h + rows - 1, 1, 1);
    this.bubbleText.setPosition(left, top).setAlpha(alpha);
  }

  /** The wisps over the cup: one rises every STEAM_EVERY_MS while `cup` (its top, in sprite pixels) is held at his chest or mouth. */
  private updateSteam(dtMs: number, cup: { x: number; y: number } | undefined): void {
    const p = this.state.paj;
    this.steamClock += dtMs;
    if (cup && this.steamClock >= STEAM_EVERY_MS) {
      const w = this.steam.find((q) => q.age >= STEAM_MS);
      if (w) {
        this.steamClock = 0;
        w.age = 0;
        w.x = Math.round(p.x) - PAJ_SIZE.w / 2 + cup.x;
        w.y = Math.round(p.y) - PAJ_ORIGIN_Y + cup.y - 1;
      }
    }
    for (const w of this.steam) {
      w.age += dtMs;
      const t = w.age / STEAM_MS;
      w.img.setVisible(t < 1).setPosition(w.x + Math.round(Math.sin(t * Math.PI * 3)), Math.round(w.y - STEAM_RISE * t)).setAlpha(0.85 * (1 - t)); // untinted: steam is light, so it still shows at night
    }
  }

  /** Pets the dog and floats a heart. */
  pet(): void {
    const waking = isNapping(this.state);
    petDog(this.state);
    const d = this.state.dog;
    // Waking her from her nap: a longer heart, clearly above her.
    const img = this.scene.add.image(Math.round(d.x), Math.round(d.y - (waking ? 36 : 28)), TEX.heart).setDepth(DEPTH + 4);
    this.hearts.push({ img, age: 0, life: waking ? 1200 : 1000 });
  }

  /** A heart floats up over her head (a treat eaten, slice 30). */
  heart(): void {
    const d = this.state.dog;
    const img = this.scene.add.image(Math.round(d.x), Math.round(d.y - 30), TEX.heart).setDepth(DEPTH + 4);
    this.hearts.push({ img, age: 0, life: 1400 });
  }

  /** Screen-space hit boxes for taps. */
  dogRect(): Phaser.Geom.Rectangle {
    const d = this.state.dog;
    // At least 44 x 44 around the sprite's middle (a finger), slice 22c.
    const w = Math.max(DOG_SIZE.w + 12, 44);
    const h = Math.max(DOG_SIZE.h + 12, 44);
    return new Phaser.Geom.Rectangle(d.x - w / 2, d.y - DOG_SIZE.h / 2 - h / 2, w, h);
  }

  /** His empty chair with the thermos, at least 44 x 44 (a finger) around the drawn chair. */
  chairRect(): Phaser.Geom.Rectangle {
    const cx = this.state.spots.companions.paj.x - PAJ_SIZE.w / 2 + EMPTY_CHAIR.x + EMPTY_CHAIR.w / 2;
    const cy = this.state.spots.companions.paj.y - PAJ_ORIGIN_Y + EMPTY_CHAIR.y + EMPTY_CHAIR.h / 2;
    const w = Math.max(EMPTY_CHAIR.w + 8, 44);
    const h = Math.max(EMPTY_CHAIR.h + 8, 44);
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  }

  pajRect(): Phaser.Geom.Rectangle {
    const p = this.state.paj;
    if (isSeatedShape(p.shape)) return new Phaser.Geom.Rectangle(p.x - PAJ_SIZE.w / 2, p.y - PAJ_ORIGIN_Y, PAJ_SIZE.w, PAJ_SIZE.h);
    return new Phaser.Geom.Rectangle(p.x - PAJ_WALK_SIZE.w / 2, p.y - PAJ_WALK_SIZE.h, PAJ_WALK_SIZE.w, PAJ_WALK_SIZE.h);
  }

  /** `steam`: it is dawn, dusk or night, so the cup steams. */
  update(dtMs: number, ctx: CompanionContext, elapsed: number, tint: number, steam = false): void {
    const s = this.state;
    tickCompanions(s, dtMs, ctx);

    // Pajkel.
    const p = s.paj;
    const breath = (Math.floor(elapsed / 900) % 2) as 0 | 1;
    if (isSeatedShape(p.shape)) {
      // 'cheer' alternates its two frames quickly (the clap); the others breathe.
      const frame = p.shape === 'cheer' ? ((Math.floor(elapsed / 180) % 2) as 0 | 1) : breath;
      this.paj
        .setTexture(pajSitKey(p.shape as PajPose, frame, this.deck))
        .setOrigin(0.5, PAJ_ORIGIN_Y / PAJ_SIZE.h)
        .setFlipX(false);
    } else {
      const frame = pajWalkFrame(s);
      const key: PajWalkPose =
        p.shape === 'walk' ? (['walk0', 'walk1', 'walk2', 'walk3'] as const)[frame]
        : p.shape === 'carry' ? (['carry0', 'carry1', 'carry2', 'carry3'] as const)[s.paj.path.length === 0 ? 1 : frame]
        : p.shape === 'stretch' ? (pajStretchHigh(s) ? 'stretch1' : 'stretch0')
        : p.shape === 'throw' ? 'throw'
        : p.shape === 'bend' ? 'bend'
        : p.shape === 'pick' ? 'crouch0'
        : p.shape === 'pickUp' ? 'crouch1'
        : p.shape === 'windup' ? 'flick0'
        : p.shape === 'flick' ? 'flick1'
        : p.shape === 'rejoice' ? (Math.floor(elapsed / 180) % 2 === 0 ? 'stretch0' : 'stretch1')
        : 'stand';
      this.paj.setTexture(pajWalkKey(key)).setOrigin(0.5, 50 / PAJ_WALK_SIZE.h).setFlipX(p.face < 0);
    }
    this.paj.setPosition(Math.round(p.x), Math.round(p.y)).setTint(tint).setVisible(pajVisible(s)).setAlpha(s.bed?.pajA ?? 1);
    // His chair stays on the dock when he walks off (and while they sleep in the car), the thermos beside it.
    this.chair.setVisible(chairEmpty(s)).setTexture(this.deck ? TEX.emptyChairDeck : TEX.emptyChair).setTint(tint);
    this.updateSteam(dtMs, steam && holdsCup(p.shape) && pajVisible(s) && !chairEmpty(s) ? PAJ_CUP[p.shape as PajPose] : undefined);

    // The dog.
    const v = dogView(s);
    const curled = v.shape === 'curl';
    const frame: DogFrame = {
      shape: v.shape,
      tail: v.shape === 'lie' ? v.tail : v.shape === 'sit' || v.shape === 'stand' || v.shape === 'bow' || v.shape === 'eat' ? v.tail % 2 : 0,
      perked: v.shape === 'lie' || v.shape === 'sit' || v.shape === 'stand' ? v.perked : false,
      step: v.shape === 'run' ? v.step : v.shape === 'curl' ? v.breath : v.shape === 'eat' ? v.munch : 0,
      carry: v.shape === 'run' && v.carry,
    };
    const d = s.dog;
    const wiggle = d.petMs > 0 ? Math.round(Math.sin(elapsed / 45)) : 0;
    if (d.y < p.y - 3) this.dogBehind = true;
    else if (d.y > p.y + 3) this.dogBehind = false;
    this.dog
      .setTexture(dogKey(frame))
      .setOrigin(0.5, 23 / DOG_SIZE.h)
      .setFlipX(d.face < 0)
      .setPosition(Math.round(d.x) + wiggle, Math.round(d.y - d.hop))
      .setTint(curled ? lerpColor(tint, 0xffffff, 0.3) : tint)
      .setDepth(this.dogBehind ? DEPTH - 0.1 : DEPTH + 0.1) // behind him while she is further up the screen
      .setVisible(dogVisible(s))
      .setAlpha(s.bed?.dogA ?? 1);

    // Sleeping "z"s.
    const asleep = (v.shape === 'sleep' || curled) && s.mode !== 'bed';
    this.zs.forEach((z, i) => {
      z.setVisible(asleep);
      if (!asleep) return;
      // In her bed the z's come now and then (a slow cycle) from just above her head.
      const t = curled ? ((elapsed / 3600 + i * 0.22) % 1) * 1.6 : (elapsed / 1600 + i * 0.5) % 1;
      if (t >= 1) {
        z.setVisible(false);
        return;
      }
      z.setPosition(Math.round(d.x + (curled ? 6 : 8) + i * 6 + t * 5), Math.round(d.y - (curled ? 14 : 22) - t * 14)).setAlpha(1 - t);
    });

    // Stick: in the air it turns (four baked angles); carried it is a bigger, angled stick gripped at the
    // snout and flipped with the dog; lying where it landed it is a plain ground stick, under the characters.
    const st = s.stick;
    const carried = st.state === 'carried';
    const flying = st.state === 'flying';
    const key = carried ? TEX.stickCarry : flying ? TEX.stickSpin[Math.floor(elapsed / STICK_SPIN_MS) % 4] : stickGroundKey(st.variant as StickVariant);
    this.stick
      .setTexture(key)
      .setVisible(st.state !== 'hidden')
      .setFlipX(carried && d.face < 0)
      .setDepth(carried ? (this.dogBehind ? DEPTH - 0.05 : DEPTH + 1) : flying ? DEPTH + 1 : DEPTH - 0.5)
      .setPosition(Math.round(st.x), Math.round(st.y))
      .setTint(tint);
    // A little dust where it lands.
    if (this.lastStickState === 'flying' && st.state === 'ground') {
      this.puffAge = 0;
      this.puff.setPosition(Math.round(st.x), Math.round(st.y) + 1);
    }
    this.lastStickState = st.state;
    this.puffAge += dtMs;
    this.puff.setVisible(this.puffAge < 2 * PUFF_MS).setTexture(TEX.stickPuff[this.puffAge < PUFF_MS ? 0 : 1]).setAlpha(this.puffAge < PUFF_MS ? 1 : 0.7);

    // Sticks lying on the grass: under the characters, fading in and out.
    while (this.ground.length < s.sticks.length) this.ground.push(this.scene.add.image(0, 0, stickGroundKey(0)).setDepth(DEPTH - 0.5));
    this.ground.forEach((img, i) => {
      const g = s.sticks[i];
      img.setVisible(g !== undefined);
      if (g) img.setTexture(stickGroundKey(g.variant as StickVariant)).setPosition(Math.round(g.x), Math.round(g.y)).setAlpha(groundStickAlpha(g)).setTint(tint);
    });

    this.drawBubble();

    // A woof: pops up over her head and drifts up as it fades.
    const wl = s.woofMs;
    this.woof.setVisible(wl > 0 && dogVisible(s));
    if (wl > 0) {
      const t = 1 - wl / 800;
      this.woof.setPosition(Math.round(d.x - 6), Math.round(d.y - 30 - t * 6)).setAlpha(Math.min(1, wl / 250));
    }

    // Hearts float up and fade.
    for (const h of this.hearts) {
      h.age += dtMs;
      h.img.setY(h.img.y - dtMs * 0.03).setAlpha(Math.max(0, 1 - h.age / h.life));
    }
    this.hearts = this.hearts.filter((h) => {
      if (h.age > h.life) h.img.destroy();
      return h.age <= h.life;
    });
  }
}
