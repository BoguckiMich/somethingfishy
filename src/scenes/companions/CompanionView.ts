import Phaser from 'phaser';
import { DOG_SIZE, PAJ_SIZE, PAJ_WALK_SIZE, dogKey, type DogFrame, type PajWalkPose } from '../../art/characters';
import { TEX, pajSitKey, pajWalkKey } from '../../art/textures';
import {
  createCompanions,
  dogView,
  pajWalkFrame,
  petDog,
  tickCompanions,
  type CompanionContext,
  type Companions,
} from './behaviour';

const DEPTH = 14;

/** Phaser layer for Pajkel and the dog: owns the images, the pure state machine owns the logic. */
export class CompanionView {
  readonly state: Companions;
  private paj: Phaser.GameObjects.Image;
  private dog: Phaser.GameObjects.Image;
  private stick: Phaser.GameObjects.Image;
  private zs: Phaser.GameObjects.Image[] = [];
  private hearts: { img: Phaser.GameObjects.Image; age: number }[] = [];

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
      const key: PajWalkPose = p.shape === 'walk' ? (['walk0', 'walk1', 'walk2', 'walk3'] as const)[pajWalkFrame(s)] : p.shape === 'throw' ? 'throw' : 'stand';
      this.paj.setTexture(pajWalkKey(key)).setOrigin(0.5, 50 / PAJ_WALK_SIZE.h).setFlipX(p.face < 0);
    }
    this.paj.setPosition(Math.round(p.x), Math.round(p.y)).setTint(tint);

    // The dog.
    const v = dogView(s);
    const frame: DogFrame = {
      shape: v.shape,
      tail: v.shape === 'lie' ? v.tail : v.shape === 'sit' || v.shape === 'stand' ? v.tail % 2 : 0,
      perked: v.shape === 'lie' || v.shape === 'sit' || v.shape === 'stand' ? v.perked : false,
      step: v.shape === 'run' ? v.step : 0,
    };
    const d = s.dog;
    const wiggle = d.petMs > 0 ? Math.round(Math.sin(elapsed / 45)) : 0;
    this.dog
      .setTexture(dogKey(frame))
      .setOrigin(0.5, 23 / DOG_SIZE.h)
      .setFlipX(d.face < 0)
      .setPosition(Math.round(d.x) + wiggle, Math.round(d.y - d.hop))
      .setTint(tint);

    // Sleeping "z"s.
    const asleep = v.shape === 'sleep';
    this.zs.forEach((z, i) => {
      z.setVisible(asleep);
      if (!asleep) return;
      const t = ((elapsed / 1600 + i * 0.5) % 1);
      z.setPosition(Math.round(d.x + 8 + i * 6 + t * 5), Math.round(d.y - 22 - t * 14)).setAlpha(1 - t);
    });

    // Stick.
    const st = s.stick;
    this.stick.setVisible(st.state !== 'hidden').setPosition(Math.round(st.x), Math.round(st.y)).setTint(tint);
    if (st.state === 'carried') this.stick.setFlipX(d.face < 0);

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
