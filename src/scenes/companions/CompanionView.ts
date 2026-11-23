import Phaser from 'phaser';
import { DOG_SIZE, PAJ_SIZE, PAJ_WALK_SIZE, dogKey, type DogFrame, type PajWalkPose } from '../../art/characters';
import { W } from '../../art/layout';
import { PAL } from '../../art/palette';
import { TEX, pajSitKey, pajWalkKey } from '../../art/textures';
import { FONT, FS, textPad } from '../../font';
import { drawFrame } from '../frameDraw';
import {
  bubbleAlpha,
  createCompanions,
  dogView,
  dogVisible,
  pajStretchHigh,
  pajVisible,
  pajSay,
  pajWalkFrame,
  petDog,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const DEPTH = 14;
/** The speech bubble: height of the tail (rows incl. the tip), the gap to the screen edge, and the canvas width it must stay inside. */
const BUBBLE_TAIL = 4;
/** Extra stalk so the box clears Alex's head, who stands right beside Pajkel on the dock. */
const BUBBLE_LIFT = 30;
const BUBBLE_MARGIN = 4;
const BUBBLE_VIEW_W = W;
const BUBBLE_INK = '#241a2e';
/** Above the characters and the show-off, below the HUD panels (LakeScene's uiPanel is 30). */
const BUBBLE_DEPTH = 28;

/** Phaser layer for Pajkel and the dog: owns the images, the pure state machine owns the logic. */
export class CompanionView {
  readonly state: Companions;
  private paj: Phaser.GameObjects.Image;
  private dog: Phaser.GameObjects.Image;
  private stick: Phaser.GameObjects.Image;
  private zs: Phaser.GameObjects.Image[] = [];
  private hearts: { img: Phaser.GameObjects.Image; age: number }[] = [];
  private bubbleGfx: Phaser.GameObjects.Graphics;
  private bubbleText: Phaser.GameObjects.Text;

  constructor(
    private scene: Phaser.Scene,
    rng: () => number = Math.random,
  ) {
    this.state = createCompanions(rng);
    this.paj = scene.add.image(0, 0, pajSitKey('sit', 0)).setDepth(DEPTH);
    this.dog = scene.add.image(0, 0, dogKey({ shape: 'lie', tail: 0, perked: false, step: 0 })).setDepth(DEPTH);
    this.stick = scene.add.image(0, 0, TEX.stick).setDepth(DEPTH + 1).setVisible(false);
    for (const key of [TEX.zSmall, TEX.zBig]) {
      this.zs.push(scene.add.image(0, 0, key).setDepth(DEPTH + 3).setVisible(false));
    }
    this.bubbleGfx = scene.add.graphics().setDepth(BUBBLE_DEPTH);
    this.bubbleText = scene
      .add.text(0, 0, '', { fontFamily: FONT, fontSize: `${FS.small}px`, color: BUBBLE_INK, padding: textPad(7, 4), align: 'center', wordWrap: { width: BUBBLE_VIEW_W - 2 * BUBBLE_MARGIN } })
      .setDepth(BUBBLE_DEPTH + 1)
      .setVisible(false);
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
    if (this.bubbleText.text !== b.text) this.bubbleText.setText(b.text);
    const w = Math.round(this.bubbleText.width);
    const h = Math.round(this.bubbleText.height);
    const tx = Math.round(p.x);
    const headTop = Math.round(p.y) - (p.shape === 'sit' || p.shape === 'sip' || p.shape === 'cheer' || p.shape === 'look' ? PAJ_SIZE.h - 2 : PAJ_WALK_SIZE.h - 2);
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

  /** Pets the dog and floats a heart. */
  pet(): void {
    petDog(this.state);
    const d = this.state.dog;
    const img = this.scene.add.image(Math.round(d.x), Math.round(d.y - 28), TEX.heart).setDepth(DEPTH + 4);
    this.hearts.push({ img, age: 0 });
  }

  /** Screen-space hit boxes for taps. */
  dogRect(): Phaser.Geom.Rectangle {
    const d = this.state.dog;
    return new Phaser.Geom.Rectangle(d.x - DOG_SIZE.w / 2 - 6, d.y - DOG_SIZE.h - 6, DOG_SIZE.w + 12, DOG_SIZE.h + 12);
  }

  pajRect(): Phaser.Geom.Rectangle {
    const p = this.state.paj;
    const sitting = p.shape === 'sit' || p.shape === 'sip' || p.shape === 'cheer' || p.shape === 'look';
    const w = sitting ? PAJ_SIZE.w : PAJ_WALK_SIZE.w;
    const h = sitting ? PAJ_SIZE.h : PAJ_WALK_SIZE.h;
    return new Phaser.Geom.Rectangle(p.x - w / 2, p.y - h, w, h);
  }

  update(dtMs: number, ctx: CompanionContext, elapsed: number, tint: number): void {
    const s = this.state;
    tickCompanions(s, dtMs, ctx);

    // Pajkel.
    const p = s.paj;
    const breath = (Math.floor(elapsed / 900) % 2) as 0 | 1;
    if (p.shape === 'sit' || p.shape === 'sip' || p.shape === 'cheer' || p.shape === 'look') {
      this.paj
        .setTexture(pajSitKey(p.shape, p.shape === 'sit' || p.shape === 'look' ? breath : 0))
        .setOrigin(0.5, 42 / PAJ_SIZE.h)
        .setFlipX(false);
    } else {
      const frame = pajWalkFrame(s);
      const key: PajWalkPose =
        p.shape === 'walk' ? (['walk0', 'walk1', 'walk2', 'walk3'] as const)[frame]
        : p.shape === 'carry' ? (['carry0', 'carry1', 'carry2', 'carry3'] as const)[s.paj.path.length === 0 ? 1 : frame]
        : p.shape === 'stretch' ? (pajStretchHigh(s) ? 'stretch1' : 'stretch0')
        : p.shape === 'throw' ? 'throw'
        : 'stand';
      this.paj.setTexture(pajWalkKey(key)).setOrigin(0.5, 50 / PAJ_WALK_SIZE.h).setFlipX(p.face < 0);
    }
    this.paj.setPosition(Math.round(p.x), Math.round(p.y)).setTint(tint).setVisible(pajVisible(s)).setAlpha(s.bed?.pajA ?? 1);

    // The dog.
    const v = dogView(s);
    const frame: DogFrame = {
      shape: v.shape,
      tail: v.shape === 'lie' ? v.tail : v.shape === 'sit' || v.shape === 'stand' ? v.tail % 2 : 0,
      perked: v.shape === 'lie' || v.shape === 'sit' || v.shape === 'stand' ? v.perked : false,
      step: v.shape === 'run' ? v.step : 0,
      carry: v.shape === 'run' && v.carry,
    };
    const d = s.dog;
    const wiggle = d.petMs > 0 ? Math.round(Math.sin(elapsed / 45)) : 0;
    this.dog
      .setTexture(dogKey(frame))
      .setOrigin(0.5, 23 / DOG_SIZE.h)
      .setFlipX(d.face < 0)
      .setPosition(Math.round(d.x) + wiggle, Math.round(d.y - d.hop))
      .setTint(tint)
      .setVisible(dogVisible(s))
      .setAlpha(s.bed?.dogA ?? 1);

    // Sleeping "z"s.
    const asleep = v.shape === 'sleep' && s.mode !== 'bed';
    this.zs.forEach((z, i) => {
      z.setVisible(asleep);
      if (!asleep) return;
      const t = ((elapsed / 1600 + i * 0.5) % 1);
      z.setPosition(Math.round(d.x + 8 + i * 6 + t * 5), Math.round(d.y - 22 - t * 14)).setAlpha(1 - t);
    });

    // Stick.
    const st = s.stick;
    // Carried, it is a bigger, angled stick gripped at the snout and flipped with the dog.
    const carried = st.state === 'carried';
    this.stick
      .setTexture(carried ? TEX.stickCarry : TEX.stick)
      .setVisible(st.state !== 'hidden')
      .setFlipX(carried && d.face < 0)
      .setPosition(Math.round(st.x), Math.round(st.y))
      .setTint(tint);

    this.drawBubble();

    // Hearts float up and fade.
    for (const h of this.hearts) {
      h.age += dtMs;
      h.img.setY(h.img.y - dtMs * 0.03).setAlpha(Math.max(0, 1 - h.age / 1000));
    }
    this.hearts = this.hearts.filter((h) => {
      if (h.age > 1000) h.img.destroy();
      return h.age <= 1000;
    });
  }
}
