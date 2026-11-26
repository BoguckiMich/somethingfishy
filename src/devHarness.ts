import type Phaser from 'phaser';
import { pageParams } from './urlParams';

/**
 * Dev-only play-test hook (scripts/playtest.mjs, docs/PLAYTEST_HARNESS.md): with `?harness=1` on the dev server the
 * game's own loop is stopped and `window.__rybki` lets a headless browser step the scene by hand, because software GL
 * renders only 1-2 fps. It never exists in a production build (pageParams() is empty there and DEV is false).
 */
export interface RybkiHarness {
  game: Phaser.Game;
  scene: Phaser.Scene;
  /** Advances game time by `ms` in 50 ms ticks (tweens, timers and LakeScene.update), then renders one frame. */
  tick(ms: number): void;
  /** Draws one frame without advancing time. */
  render(): void;
}

export function installHarness(game: Phaser.Game): void {
  if (!import.meta.env.DEV || pageParams().get('harness') !== '1') return;
  let now = performance.now();
  const scene = game.scene.getScene('Lake');
  const draw = () => game.step(now, 0.001);
  const h: RybkiHarness = {
    game,
    scene,
    tick(ms: number) {
      let left = ms;
      while (left > 0) {
        const dt = Math.min(50, left);
        left -= dt;
        now += dt;
        scene.sys.step(now, dt); // PRE_UPDATE/UPDATE events (input plugin, tweens, time) then scene.update
      }
      draw();
    },
    render: draw,
  };
  // Let the real loop boot and create the scene first; then it stops and only the harness advances time.
  const wait = window.setInterval(() => {
    if (!scene.sys.isActive() || !scene.children?.length) return;
    window.clearInterval(wait);
    game.loop.stop();
    (window as unknown as { __rybki: RybkiHarness }).__rybki = h;
  }, 100);
}
