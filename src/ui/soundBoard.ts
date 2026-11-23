import { AMBIENT_LAYERS, SFX_NAMES, sound, type AmbientLayer } from '../audio/sound';
import { formatClock } from '../core/clock';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

const sectionTitle = (text: string) =>
  el('div', `font:bold 13px monospace;color:${COLORS.gold};margin:12px 0 6px;border-bottom:2px solid ${COLORS.woodLight};padding-bottom:3px`, text);

/**
 * Dev-only (?debug=sounds): a button per sound effect, a solo switch per ambient layer and a
 * time-of-day slider that drives the ambient crossfade, to audition everything on a phone.
 */
export function openSoundBoard(startMinute: number, onClose: () => void): PanelHandle {
  const solo = new Set<AmbientLayer>();
  let minute = Math.round(startMinute) % 1440;

  const panel: PanelHandle = openPanel(
    'Sound board (dev)',
    (body) => {
      const settings = sound.current;
      if (!settings.sfx || !settings.ambience) {
        body.append(el('div', `font-size:12px;color:${COLORS.amber};padding:3px 0`, 'A switch is off in Settings: those sounds stay silent.'));
      }

      body.append(sectionTitle('Effects'));
      const grid = el('div', 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px');
      for (const name of SFX_NAMES) {
        grid.append(woodButton(name, () => sound.play(name, name === 'cast' ? { charge: 0.6 } : {}), { small: true, sfx: null }));
      }
      body.append(grid);
      const cast = el('div', 'display:flex;gap:6px;margin-top:6px');
      for (const [label, charge] of [['cast soft', 0.05], ['cast full', 1]] as const) {
        const b = woodButton(label, () => sound.play('cast', { charge }), { small: true, sfx: null });
        b.style.flex = '1';
        cast.append(b);
      }
      body.append(cast);

      body.append(sectionTitle('Ambient layers (solo)'));
      const layers = el('div', 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px');
      for (const layer of AMBIENT_LAYERS) {
        const b = woodButton(`${solo.has(layer) ? '[x]' : '[ ]'} ${layer}`, () => {
          if (solo.has(layer)) solo.delete(layer);
          else solo.add(layer);
          sound.setSolo(solo.size > 0 ? solo : null);
          panel.refresh();
        }, { small: true });
        layers.append(b);
      }
      body.append(layers);
      body.append(el('div', `font-size:11px;color:${COLORS.cream};padding-top:4px`, solo.size > 0 ? 'Solo: only the ticked layers play.' : 'No solo: the time slider decides the mix.'));

      body.append(sectionTitle('Time of day'));
      const label = el('div', `font:bold 16px monospace;color:${COLORS.text};text-align:center`, formatClock(minute));
      const slider = el('input', 'display:block;width:100%;box-sizing:border-box;margin:6px 0 0');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '1439';
      slider.step = '1';
      slider.value = String(minute);
      slider.addEventListener('input', () => {
        minute = Number(slider.value);
        label.textContent = formatClock(minute);
        sound.setDebugMinute(minute);
      });
      body.append(label, slider);
    },
    () => {
      sound.setSolo(null);
      sound.setDebugMinute(null);
      onClose();
    },
  );
  sound.setDebugMinute(minute);
  return panel;
}
