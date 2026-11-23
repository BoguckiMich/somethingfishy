import { FONT, FS } from '../font';
import { sound } from '../audio/sound';
import type { Profile } from '../core/profile';
import type { SoundSettings } from '../core/soundSettings';
import { saveSummary, type SaveData } from '../core/save';
import { decodeSaveCode, type DecodeResult } from '../core/saveCode';
import { SPECIES } from '../core/data/fish';
import { COLORS, el, openPanel, woodButton, type PanelHandle } from './panel';

/** What the settings panel needs from the scene; the rules live in core and the scene. */
export interface SettingsStore {
  /** The export code for the current game. */
  exportCode(): string;
  /** Replaces the running game (and the names) with an imported one. */
  applyImport(save: SaveData, profile: Profile): void;
  /** Resets everything but the names. */
  startOver(): void;
  /** Closes the panel's job and opens the name card. */
  openNames(): void;
  /** False when the last write failed or storage is missing. */
  canSave(): boolean;
  /** The Sounds / Ambience volumes, 0..100 (saved by the setter unless sandboxed). */
  soundSettings(): SoundSettings;
  setSoundSettings(s: SoundSettings): void;
  /** Dev sandbox: nothing here reaches storage. */
  sandbox: boolean;
}

const IMPORT_ERRORS: Record<Extract<DecodeResult, { ok: false }>['reason'], string> = {
  notACode: "That doesn't look like a Rybki code",
  incomplete: 'That code looks incomplete',
  tooNew: 'That code is from a newer version of the game',
  unreadable: "That code couldn't be read",
};

const sectionTitle = (text: string) =>
  el('div', `font:bold ${FS.body}px ${FONT};color:${COLORS.gold};margin:12px 0 6px;border-bottom:2px solid ${COLORS.woodLight};padding-bottom:3px`, text);

const note = (text: string, color: string = COLORS.cream) => el('div', `font-size:${FS.body}px;line-height:1.35;color:${color};padding:3px 0`, text);

const textArea = (readOnly: boolean): HTMLTextAreaElement => {
  const t = el(
    'textarea',
    [
      'box-sizing:border-box',
      'width:100%',
      'height:64px',
      'resize:none',
      'padding:6px',
      `font:${FS.small}px ${FONT}`,
      `color:${COLORS.text}`,
      'background:#2a1a12',
      'word-break:break-all',
      // body is user-select:none (game input); the code boxes must stay selectable for long-press.
      'user-select:text',
      '-webkit-user-select:text',
      '-webkit-touch-callout:default',
    ].join(';'),
  );
  t.className = 'rb-box';
  t.readOnly = readOnly;
  t.spellcheck = false;
  t.autocapitalize = 'off';
  return t;
};

const selectAll = (t: HTMLTextAreaElement) => {
  t.focus();
  t.select();
  t.setSelectionRange(0, t.value.length);
};

/**
 * Old-school copy for insecure contexts (the LAN dev server is plain http, where
 * navigator.clipboard does not exist). Needs an editable, selected textarea.
 */
const execCopy = (t: HTMLTextAreaElement): boolean => {
  const wasReadOnly = t.readOnly;
  try {
    t.readOnly = false;
    selectAll(t);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    t.readOnly = wasReadOnly;
    t.blur();
  }
};

const row = (...kids: HTMLElement[]) => {
  const r = el('div', 'display:flex;gap:8px;margin-top:6px');
  for (const k of kids) {
    k.style.flex = '1';
    r.append(k);
  }
  return r;
};

/**
 * A labelled volume slider (0..100 %, 0 reads "Off"). `onInput` fires while dragging,
 * `onRelease` once the thumb is let go (to play a sample at the new level).
 */
const volumeRow = (label: string, initial: number, onInput: (v: number) => void, onRelease: (v: number) => void): HTMLElement => {
  const r = el('div', 'display:flex;align-items:center;gap:10px;margin-top:8px');
  r.append(el('div', `font-size:${FS.body}px;color:${COLORS.text};width:76px;flex:none`, label));
  const slider = el('input', `flex:1;min-width:0;margin:0;accent-color:${COLORS.gold};height:24px`);
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '5';
  slider.value = String(initial);
  slider.setAttribute('aria-label', `${label} volume`);
  const value = el('div', `font-size:${FS.body}px;color:${COLORS.cream};width:44px;flex:none;text-align:right;padding-right:4px;box-sizing:border-box`);
  const paint = () => (value.textContent = Number(slider.value) === 0 ? 'Off' : `${slider.value}%`);
  slider.addEventListener('input', () => {
    paint();
    onInput(Number(slider.value));
  });
  slider.addEventListener('change', () => onRelease(Number(slider.value)));
  paint();
  r.append(slider, value);
  return r;
};

type Pending = { kind: 'import'; save: SaveData; profile: Profile } | { kind: 'startOver' };

/** The ⚙ panel: export, import, change names, start over. */
export function openSettingsPanel(store: SettingsStore, onClose: () => void): PanelHandle {
  let pending: Pending | null = null;
  let importMessage = '';
  let importText = '';
  let copyNote = '';

  const panel: PanelHandle = openPanel(
    'Settings',
    (body) => {
      if (pending) return buildConfirm(body, pending);
      buildMain(body);
    },
    onClose,
  );

  function buildConfirm(body: HTMLElement, p: Pending): void {
    const cancel = woodButton('Cancel', () => {
      pending = null;
      panel.refresh();
    });
    if (p.kind === 'import') {
      const { species, coins } = saveSummary(p.save);
      body.append(note(`This replaces your current game (${species}/${SPECIES.length} species, ${coins} coins). Continue?`, COLORS.text));
      body.append(
        row(
          woodButton('Yes, load it', () => {
            store.applyImport(p.save, p.profile);
            panel.close();
          }),
          cancel,
        ),
      );
    } else {
      body.append(note('Start over? Your fish log, coins and rods will be gone.', COLORS.text));
      body.append(
        row(
          woodButton('Yes, start over', () => {
            store.startOver();
            panel.close();
          }),
          cancel,
        ),
      );
    }
  }

  function buildMain(body: HTMLElement): void {
    if (store.sandbox) body.append(note('DEV sandbox: changes here are not saved', COLORS.amber));
    else if (!store.canSave()) body.append(note("Can't save on this device; use Export to keep your progress.", COLORS.amber));

    body.append(sectionTitle('Sound'));
    const sounds = store.soundSettings();
    body.append(
      volumeRow(
        'Sounds',
        sounds.sfx,
        (v) => store.setSoundSettings({ ...store.soundSettings(), sfx: v }),
        () => sound.play('coin'), // a sample at the new level
      ),
      volumeRow(
        'Ambience',
        sounds.ambience,
        (v) => store.setSoundSettings({ ...store.soundSettings(), ambience: v }),
        () => undefined, // the ambience itself is the sample
      ),
    );

    body.append(sectionTitle('Export'));
    body.append(note('Copy this code to keep your game or move it to another device.'));
    const code = store.exportCode();
    const out = textArea(true);
    out.value = code;
    body.append(out);
    const copied = () => {
      copyBtn.textContent = 'Copied!';
      status.textContent = '';
    };
    const copyBtn = woodButton('Copy', () => {
      // Last resort: select the text so a long-press shows the system Copy menu.
      const manual = () => {
        selectAll(out);
        copyNote = 'Press and hold the code, then Copy';
        status.textContent = copyNote;
      };
      const legacy = () => (execCopy(out) ? copied() : manual());
      const clip = window.isSecureContext ? navigator.clipboard : undefined;
      if (!clip?.writeText) return legacy();
      clip.writeText(code).then(copied, legacy);
    });
    const status = note(copyNote, COLORS.gold);
    body.append(row(copyBtn), status);

    body.append(sectionTitle('Import'));
    const inp = textArea(false);
    inp.placeholder = 'Paste a code here';
    inp.value = importText;
    inp.addEventListener('input', () => (importText = inp.value));
    body.append(inp);
    const msg = note(importMessage, COLORS.amber);
    body.append(
      row(
        woodButton('Load', () => {
          const r = decodeSaveCode(inp.value);
          if (!r.ok) {
            importMessage = IMPORT_ERRORS[r.reason];
            msg.textContent = importMessage;
            return;
          }
          importMessage = '';
          importText = '';
          pending = { kind: 'import', save: r.save, profile: r.profile };
          panel.refresh();
        }),
      ),
      msg,
    );

    body.append(sectionTitle('Names'));
    body.append(
      row(
        woodButton('Change names', () => {
          panel.close();
          store.openNames();
        }),
      ),
    );

    body.append(sectionTitle('Start over'));
    body.append(
      row(
        woodButton('Start over…', () => {
          pending = { kind: 'startOver' };
          panel.refresh();
        }),
      ),
    );
  }

  return panel;
}
