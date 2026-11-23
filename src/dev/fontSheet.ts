/**
 * Dev-only font comparison sheet (served at /dev/font-sheet.html, not part of the build). Each candidate is
 * shown as DOM text and as two canvas variants: "old" = drawn into a 360-px-wide canvas and CSS-scaled up with
 * image-rendering: pixelated (the game before device-resolution rendering), "new" = drawn at the real on-screen
 * resolution (src/renderScale.ts). Single column, meant to be opened on a phone over LAN.
 */

const TEXT = '#fff6e4';
const GAME_W = 360;
const WRAP_W = 320;

interface Candidate {
  family: string;
  licence: string;
  /** Font size (px) at which one design pixel is 1 px: an assumption per font, see `note`. */
  grid: number;
  note: string;
}

const CANDIDATES: Candidate[] = [
  { family: 'Tiny5', licence: 'OFL 1.1 (Tiny5 Project Authors)', grid: 10, note: 'previous game font; design pixel = 1/10 em' },
  { family: 'Pixelify Sans', licence: 'OFL 1.1 (Pixelify Sans Project Authors)', grid: 11, note: 'previous font (restored from git 1fd59da); pixel assumed 1/11 em, as slice 10b used' },
  { family: 'Pixelify+Tiny5 digits', licence: 'OFL 1.1, both parents', grid: 11, note: 'Pixelify Sans with digits 0-9 and capital B from Tiny5 (size-adjust 91% so its 1/10-em pixel matches 1/11)' },
  { family: 'Silkscreen', licence: 'OFL 1.1 (Silkscreen Project Authors)', grid: 8, note: 'caps-style face; pixel assumed 1/8 em' },
  { family: 'Jersey 10', licence: 'OFL 1.1 (Jersey 10 Project Authors)', grid: 10, note: 'pixel assumed 1/10 em (named after its 10 px design)' },
  { family: 'Micro 5', licence: 'OFL 1.1 (Micro 5 Project Authors)', grid: 5, note: 'very small; pixel assumed 1/5 em, so sensible sizes start at 2x' },
  { family: 'VT323', licence: 'OFL 1.1 (Peter Hull)', grid: 12.5, note: 'CHOSEN for the game; measured: design pixel = 0.08 em (12.5 px per em-pixel), cap height 7 px, x-height 5 px' },
];

interface Sample {
  text: string;
  wrap?: boolean;
}

const SAMPLES: Sample[] = [
  { text: '05:30   12 worms   1234 coins' },
  { text: 'Caught ×12   Best 41 cm' },
  { text: 'B 5 S 8 0 O 1 l I' },
  { text: 'The European eel spawns in the Sargasso Sea and can live for decades.', wrap: true },
  { text: 'Zażółć gęślą jaźń — Bestia, Pajkel, Alex' },
];

const POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ—×';

const state = { outline: true, thick: 3, bg: '#1b2b3a', custom: 0, showDom: true, showOld: true, showNew: true };

/** Characters the font lacks (the browser would draw them in a fallback font), found by width differences. */
function missingGlyphs(family: string): string {
  const c = document.createElement('canvas').getContext('2d')!;
  const w = (ch: string, fallback: string) => {
    c.font = `40px '${family}', ${fallback}`;
    return c.measureText(ch).width;
  };
  return [...POLISH].filter((ch) => w(ch, 'serif') !== w(ch, 'monospace')).join('');
}

function sizesFor(c: Candidate): number[] {
  const set = new Set<number>();
  for (const k of [1, 2, 3]) if (c.grid * k >= 10 && c.grid * k <= 33) set.add(c.grid * k);
  set.add(15);
  set.add(25);
  if (state.custom) set.add(state.custom);
  return [...set].sort((a, b) => a - b);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(t).width > maxW) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** Draws a sample into a canvas whose backing width is GAME_W * k; all coordinates are game units. */
function drawCanvas(family: string, size: number, sample: Sample, k: number, cls: string): HTMLCanvasElement {
  const font = `${size}px '${family}', monospace`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const lines = wrapLines(probe, sample.text, sample.wrap ? WRAP_W : GAME_W - 16);
  const lineH = Math.ceil(size * 1.3);
  const padY = 6 + state.thick;
  const hGame = lines.length * lineH + padY * 2;
  const cv = document.createElement('canvas');
  cv.className = `cv ${cls}`;
  cv.width = GAME_W * k;
  cv.height = hGame * k;
  const ctx = cv.getContext('2d')!;
  ctx.scale(k, k);
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.fillStyle = TEXT;
  ctx.strokeStyle = '#241a2e';
  ctx.lineWidth = state.thick * 2;
  const x = sample.wrap ? (GAME_W - WRAP_W) / 2 : 8;
  lines.forEach((l, i) => {
    const y = padY + i * lineH;
    if (state.outline) ctx.strokeText(l, x, y);
    ctx.fillText(l, x, y);
  });
  cv.style.aspectRatio = `${GAME_W} / ${hGame}`;
  return cv;
}

function domText(family: string, size: number, sample: Sample): HTMLElement {
  const d = document.createElement('div');
  d.className = 'dom wrap';
  d.textContent = sample.text;
  d.style.font = `${size}px/1.3 '${family}', monospace`;
  if (state.outline) {
    d.style.setProperty('-webkit-text-stroke', `${state.thick * 2}px #241a2e`);
    d.style.setProperty('paint-order', 'stroke fill');
  }
  return d;
}

function build(): void {
  const root = document.getElementById('sheet')!;
  root.replaceChildren();
  document.documentElement.style.setProperty('--bg', state.bg);
  const pageW = Math.min(560, document.documentElement.clientWidth) - 32; // stage inner width in CSS px
  const k = Math.min(6, Math.max(1, Math.ceil((pageW * (window.devicePixelRatio || 1)) / GAME_W)));
  for (const c of CANDIDATES) {
    const block = document.createElement('section');
    block.className = 'block';
    const miss = missingGlyphs(c.family);
    const h = document.createElement('h2');
    h.textContent = c.family;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.innerHTML = `${c.licence}. ${c.note}.<br>Polish glyphs: ${miss ? `<span class="flag">MISSING (fallback font drawn): ${miss}</span>` : 'all present'}`;
    block.append(h, meta);
    for (const size of sizesFor(c)) {
      const t = document.createElement('div');
      t.className = 'size';
      const mult = size / c.grid;
      t.textContent = `${size}px` + (Number.isInteger(mult) ? ` (${mult}x grid)` : size === 25 ? ' (game body size)' : size === 15 ? ' (old game body size, off-grid)' : ' (custom)');
      block.append(t);
      const variants: [string, boolean, (s: Sample) => HTMLElement][] = [
        ['DOM text', state.showDom, (s) => domText(c.family, size, s)],
        [`canvas "old": 360 px wide, CSS-scaled x${(pageW / GAME_W).toFixed(2)}, pixelated`, state.showOld, (s) => drawCanvas(c.family, size, s, 1, 'old')],
        [`canvas "new": device resolution (x${k})`, state.showNew, (s) => drawCanvas(c.family, size, s, k, 'new')],
      ];
      for (const [label, show, make] of variants) {
        if (!show) continue;
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = label;
        const stage = document.createElement('div');
        stage.className = 'stage';
        for (const s of SAMPLES) stage.append(make(s));
        block.append(tag, stage);
      }
    }
    root.append(block);
  }
}

function controls(): void {
  const el = document.getElementById('controls')!;
  const mk = (html: string) => {
    const l = document.createElement('label');
    l.innerHTML = html;
    el.append(l);
    return l;
  };
  mk('<input type="checkbox" checked> outline').querySelector('input')!.addEventListener('change', (e) => {
    state.outline = (e.target as HTMLInputElement).checked;
    build();
  });
  const bg = mk('bg <select><option value="#1b2b3a">night lake</option><option value="#4d4670">dusk</option><option value="#3b73b0">day water</option></select>').querySelector('select')!;
  bg.addEventListener('change', () => {
    state.bg = bg.value;
    build();
  });
  const th = mk('stroke <input type="range" min="1" max="5" value="3"> <span>3</span>');
  th.querySelector('input')!.addEventListener('input', (e) => {
    state.thick = Number((e.target as HTMLInputElement).value);
    th.querySelector('span')!.textContent = String(state.thick);
    build();
  });
  const cu = mk('extra size <input type="range" min="0" max="40" value="0"> <span>off</span>');
  cu.querySelector('input')!.addEventListener('change', (e) => {
    state.custom = Number((e.target as HTMLInputElement).value);
    cu.querySelector('span')!.textContent = state.custom ? `${state.custom}px` : 'off';
    build();
  });
  for (const [key, label] of [['showDom', 'DOM'], ['showOld', 'old'], ['showNew', 'new']] as const) {
    mk(`<input type="checkbox" checked> ${label}`).querySelector('input')!.addEventListener('change', (e) => {
      state[key] = (e.target as HTMLInputElement).checked;
      build();
    });
  }
}

async function main(): Promise<void> {
  controls();
  const probe = 'Aa0B Ąćęłńóśźż';
  await Promise.all(CANDIDATES.map((c) => document.fonts.load(`20px '${c.family}'`, probe).catch(() => undefined)));
  await document.fonts.ready;
  build();
}
void main();
