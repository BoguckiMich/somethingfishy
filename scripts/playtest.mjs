#!/usr/bin/env node
// Play-test harness: drives the game in headless Microsoft Edge like a phone. See `node scripts/playtest.mjs help`
// and docs/PLAYTEST_HARNESS.md. Needs the DEV server (the hook window.__rybki exists only there, with ?harness=1).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const W = 360;
const H = 640;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HELP = `Rybki play-test harness (headless Edge, phone emulation 360x640 @3x, touch input).
Coordinates are GAME coordinates: x 0-360, y 0-640 (top-left origin).

  start <url> [--port 9333]   launch Edge, open url, wait until the game is ready. Use the dev server, e.g.
                              http://localhost:4180/?harness=1&skipnames&time=12   (harness=1 is added if missing)
  stop                        kill Edge
  url <url>                   navigate to another url (harness=1 added if missing)
  tap x y                     touch down + up (short press)
  hold x y ms                 touch down, game time runs for ms, touch up (charge a cast, press the catch bar)
  swipe x1 y1 x2 y2 ms        touch down, drag, touch up
  step ms                     advance game time (50 ms ticks); nothing moves unless you step
  fight [maxMs]               auto-play the fight until it ends: the classic catch bar (hold when the fish is above the zone) or, when it is
                              a line fight (?catch=line or Settings), the line bot below (style-aware)
  fight-line [maxMs] [--mode decent|hold|never] [--until warn|cut|surge|steady|red|caught]
                              play a Line fight (slice 28). decent (default): hold while the tension is below the middle of the gold band and
                              no surge is showing, let go on a surge or above the middle. hold: never let go (the line snaps). never: never hold
                              (the hook slips from slack). --until stops the bot and leaves the thumb as it is: when a surge is telegraphed (the splash), at the first surge pull, at a steady
                              moment (tension in the gold band), in the red, or at the catch (default: until the fight ends)
  wait <kind> [maxMs]         step until fishing kind is idle|charging|casting|waiting|bite|fighting|caught|lost (default max 60000)
  state                       compact JSON: fishing kind, clock, coins, bag, panel, toast, bar info...
  text                        visible DOM text (panels are DOM overlays)
  click-text "<label>"        click the DOM button/element whose text matches (case-insensitive, exact first)
  shot <path.png> [--scale 1] screenshot (default 1080x1920; --scale 1 gives 360x640)
  eval "<js expr>"            evaluate JS in the page (window.__rybki.scene is the LakeScene), prints JSON
  help

Options for any command: --port N (default 9333). Game time only moves via step/hold/swipe/fight/tap.

Example 1, cast and catch a fish:
  node scripts/playtest.mjs start "http://localhost:4180/?harness=1&skipnames&time=12"
  node scripts/playtest.mjs hold 180 300 900      # hold anywhere on the water to charge; release = cast
  node scripts/playtest.mjs wait bite 60000       # line flies, lands, fish nibbles; stops the moment kind is "bite"
  node scripts/playtest.mjs tap 180 300           # bite window is only ~0.9 s of game time: tap at once to hook
  node scripts/playtest.mjs fight                 # or: hold 180 300 400 / step 300 by hand, watching state.bar
  node scripts/playtest.mjs shot out.png

Example 2, open a panel and read it:
  node scripts/playtest.mjs tap 60 618            # Bag button (bottom bar)
  node scripts/playtest.mjs text
  node scripts/playtest.mjs click-text "Close"

Example 3, pet the dog, check the sign:
  node scripts/playtest.mjs tap 276 498 && node scripts/playtest.mjs shot sign.png
`;

// ---------------------------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else pos.push(argv[i]);
}
const cmd = pos[0];
const port = Number(flags.port || 9333);
const pidFile = join(tmpdir(), `rybki-playtest-${port}.json`);
const profileDir = join(tmpdir(), `rybki-playtest-profile-${port}`);
const num = (s, name) => {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`bad number for ${name}: ${s}`);
  return n;
};

// ---------------------------------------------------------------------------------------------- CDP
async function httpJson(path) {
  const r = await fetch(`http://127.0.0.1:${port}${path}`);
  return r.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      const p = m.id && this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`));
      else p.resolve(m.result);
    });
  }
  static async connect() {
    const targets = await httpJson('/json');
    const t = targets.find((x) => x.type === 'page');
    if (!t) throw new Error('no page target');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('websocket error')), { once: true });
    });
    const c = new Cdp(ws);
    await c.emulate();
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  // Emulation lives only as long as the connection, so every command sets it again (same values: no visible change).
  async emulate() {
    await this.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  close() {
    this.ws.close();
  }
}

// ---------------------------------------------------------------------------------------------- page helpers
const tickJs = (ms) => `window.__rybki.tick(${ms})`;

async function canvasRect(c) {
  return c.eval(`(() => { const r = window.__rybki.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
}
const toClient = (r, x, y) => ({ x: r.l + (x * r.w) / W, y: r.t + (y * r.h) / H });

async function touch(c, type, r, x, y) {
  const touchPoints = type === 'touchEnd' ? [] : [{ ...toClient(r, x, y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await c.send('Input.dispatchTouchEvent', { type, touchPoints });
}

async function step(c, ms) {
  await c.eval(tickJs(ms));
}

async function readState(c) {
  return c.eval(`(() => {
    const sc = window.__rybki.scene;
    const s = sc.state;
    const m = sc.clock.minute;
    const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(m % 60)).padStart(2, '0');
    const out = { fishing: s.kind, clock: hh + ':' + mm, day: sc.clock.day };
    const p = sc.player;
    out.coins = p.coins; out.worms = p.worms; out.bag = p.bag.length; out.rod = p.rodId;
    out.bagFish = p.bag.map((f) => f.speciesId + (f.weightKg ? ' ' + f.weightKg + 'kg' : ''));
    if (s.kind === 'charging') out.heldMs = Math.round(s.heldMs);
    if (s.kind === 'casting' || s.kind === 'waiting' || s.kind === 'bite' || s.kind === 'retrieving') out.distanceM = Math.round(s.distanceM * 10) / 10;
    if (s.kind === 'waiting') out.untilBiteMs = Math.round(s.untilMs);
    if (s.kind === 'bite') out.hookWindowLeftMs = Math.round(s.windowLeftMs);
    if (s.kind === 'fighting') {
      const b = s.bar;
      out.bar = { zone: +b.zone.toFixed(2), fish: +b.fish.toFixed(2), progress: +b.progress.toFixed(2), holding: b.holding };
      if (s.line) {
        const l = s.line;
        out.line = { distanceM: +l.distanceM.toFixed(1), startM: l.startM, tension: +l.tension.toFixed(2), phase: l.phase, strength: +l.strength.toFixed(2), lateral: +l.lateral.toFixed(2), holding: l.holding, redS: +l.redS.toFixed(2), slackS: +l.slackS.toFixed(2) };
        delete out.bar;
      }
      out.fish = s.hooked.speciesId;
    }
    if (s.kind === 'caught') out.fish = s.hooked.speciesId;
    const panel = document.querySelector('.rb-panel');
    out.panel = panel ? (panel.innerText || '').split('\\n')[0] : null;
    try { out.toast = sc.toastAge < 1800 ? sc.toast.text || null : null; } catch (e) {}
    try { out.companions = sc.companions.state.mode; } catch (e) {}
    return out;
  })()`);
}

async function ensureReady(c) {
  const ok = await c.eval('!!(window.__rybki && window.__rybki.scene)');
  if (!ok) throw new Error('window.__rybki missing: is Edge started (`start`) and the url the DEV server with ?harness=1?');
}

function withHarness(url) {
  if (/[?&]harness=1/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'harness=1';
}

async function waitReady(c, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await c.eval('!!(window.__rybki && window.__rybki.scene)')) {
        await c.eval(tickJs(200));
        return;
      }
    } catch {
      /* page still navigating */
    }
    await sleep(300);
  }
  throw new Error('timed out waiting for window.__rybki (dev server running? url has ?harness=1?)');
}

// ---------------------------------------------------------------------------------------------- commands
const commands = {
  async start() {
    const url = pos[1];
    if (!url) throw new Error('usage: start <url>');
    if (existsSync(pidFile)) {
      try {
        process.kill(JSON.parse(readFileSync(pidFile, 'utf8')).pid, 0);
        throw new Error(`Edge already running on port ${port}; run stop first`);
      } catch (e) {
        if (String(e.message).includes('already running')) throw e;
      }
    }
    rmSync(profileDir, { recursive: true, force: true });
    mkdirSync(profileDir, { recursive: true });
    const child = spawn(
      EDGE,
      [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--mute-audio',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        `--window-size=${W},${H}`,
        'about:blank',
      ],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();
    writeFileSync(pidFile, JSON.stringify({ pid: child.pid, port }));
    for (let i = 0; ; i++) {
      try {
        await httpJson('/json/version');
        break;
      } catch {
        if (i > 80) throw new Error('Edge did not open its debugging port');
        await sleep(250);
      }
    }
    const c = await Cdp.connect();
    await c.send('Page.enable');
    await c.send('Page.navigate', { url: withHarness(url) });
    await waitReady(c);
    c.close();
    console.log(JSON.stringify({ ok: true, pid: child.pid, port }));
  },

  async stop() {
    if (existsSync(pidFile)) {
      const { pid } = JSON.parse(readFileSync(pidFile, 'utf8'));
      // taskkill /T takes the renderer/GPU children with it
      await new Promise((r) => spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('exit', r));
      rmSync(pidFile, { force: true });
    }
    console.log(JSON.stringify({ ok: true }));
  },

  async url(c) {
    if (!pos[1]) throw new Error('usage: url <url>');
    await c.send('Page.navigate', { url: withHarness(pos[1]) });
    await sleep(500);
    await waitReady(c);
    console.log(JSON.stringify({ ok: true }));
  },

  async tap(c) {
    const x = num(pos[1], 'x');
    const y = num(pos[2], 'y');
    const r = await canvasRect(c);
    await touch(c, 'touchStart', r, x, y);
    await step(c, 80);
    await touch(c, 'touchEnd', r, x, y);
    await step(c, 100);
    console.log(JSON.stringify(await readState(c)));
  },

  async hold(c) {
    const x = num(pos[1], 'x');
    const y = num(pos[2], 'y');
    const ms = num(pos[3], 'ms');
    const r = await canvasRect(c);
    await touch(c, 'touchStart', r, x, y);
    await step(c, ms);
    await touch(c, 'touchEnd', r, x, y);
    await step(c, 50);
    console.log(JSON.stringify(await readState(c)));
  },

  async swipe(c) {
    const [x1, y1, x2, y2, ms] = ['x1', 'y1', 'x2', 'y2', 'ms'].map((n, i) => num(pos[i + 1], n));
    const r = await canvasRect(c);
    const n = Math.max(2, Math.round(ms / 50));
    await touch(c, 'touchStart', r, x1, y1);
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      await step(c, ms / n);
      await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...toClient(r, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f), id: 1, force: 1 }] });
    }
    await touch(c, 'touchEnd', r, x2, y2);
    await step(c, 50);
    console.log(JSON.stringify(await readState(c)));
  },

  async step(c) {
    await step(c, num(pos[1], 'ms'));
    console.log(JSON.stringify(await readState(c)));
  },

  // Simple bot for the catch bar: finger down while the fish is above the zone centre (higher = up).
  async fight(c) {
    const style = await c.eval('(() => { const s = window.__rybki.scene.state; return s.kind === "fighting" && s.line ? "line" : "classic"; })()');
    if (style === 'line') return commands['fight-line'](c);
    const maxMs = Number(pos[1] || 60000);
    const r = await canvasRect(c);
    let down = false;
    let t = 0;
    for (; t < maxMs; t += 100) {
      const s = await readState(c);
      if (s.fishing !== 'fighting') break;
      const want = s.bar.fish + (s.bar.fish - s.bar.zone) * 0.0 > s.bar.zone;
      if (want && !down) await touch(c, 'touchStart', r, 180, 300);
      if (!want && down) await touch(c, 'touchEnd', r, 180, 300);
      down = want;
      await step(c, 100);
    }
    if (down) await touch(c, 'touchEnd', r, 180, 300);
    await step(c, 100);
    console.log(JSON.stringify({ fightMs: t, ...(await readState(c)) }));
  },

  // Slice 28: the Line fight bot. Reads only what a player sees: the tension, whether a surge is showing (the telegraph splash or the pull).
  async 'fight-line'(c) {
    const maxMs = Number(pos[1] || 90000);
    const mode = flags.mode || 'decent';
    const until = flags.until || 'caught';
    const r = await canvasRect(c);
    const probe = () => c.eval(`(() => {
      const s = window.__rybki.scene.state;
      if (s.kind !== 'fighting' || !s.line) return { kind: s.kind };
      const l = s.line;
      return { kind: s.kind, phase: l.phase, tension: l.tension, holding: l.holding, strength: l.strength, cutWarn: l.cutWarn, phaseT: l.phaseT, phaseTotal: l.phaseTotal };
    })()`);
    // The game starts a fight with the hooking press still down: one real press and release puts the thumb in sync.
    await touch(c, 'touchStart', r, 180, 300);
    await touch(c, 'touchEnd', r, 180, 300);
    let down = false;
    let t = 0;
    let stopped = null;
    for (; t < maxMs; t += 50) {
      const p = await probe();
      if (p.kind !== 'fighting') break;
      const surging = p.phase === 'warn' || p.phase === 'run';
      const want = mode === 'hold' ? true : mode === 'never' ? false : !surging && p.tension < 0.5;
      if (until === 'cut' && p.cutWarn > 0.1) { stopped = 'cut'; break; }
      if (until === 'warn' && p.phase === 'warn' && p.phaseT < p.phaseTotal * 0.5) { stopped = 'warn'; break; }
      if (until === 'surge' && p.phase === 'run' && p.phaseTotal - p.phaseT > 0.4) { stopped = 'surge'; break; }
      if (until === 'steady' && p.tension > 0.4 && p.tension < 0.6 && p.phase === 'calm' && p.holding) { stopped = 'steady'; break; }
      if (until === 'red' && p.tension > 0.8) { stopped = 'red'; break; }
      if (want !== down) {
        await touch(c, want ? 'touchStart' : 'touchEnd', r, 180, 300);
        down = want;
      }
      await step(c, 50);
    }
    if (!stopped && down) await touch(c, 'touchEnd', r, 180, 300);
    if (!stopped) await step(c, 100);
    console.log(JSON.stringify({ fightMs: t, mode, stopped, ...(await readState(c)) }));
  },

  async wait(c) {
    const kind = pos[1];
    if (!kind) throw new Error('usage: wait <kind> [maxMs]');
    const maxMs = Number(pos[2] || 60000);
    let t = 0;
    let s = await readState(c);
    for (; t < maxMs && s.fishing !== kind; t += 100) {
      await step(c, 100);
      s = await readState(c);
    }
    console.log(JSON.stringify({ waitedMs: t, reached: s.fishing === kind, ...s }));
  },

  async state(c) {
    console.log(JSON.stringify(await readState(c)));
  },

  async text(c) {
    console.log(await c.eval(`(() => {
      const nodes = [...document.body.querySelectorAll('*')].filter((e) => e.id !== 'game' && !e.closest('#game') && e.children.length === 0 && (e.innerText || '').trim());
      const lines = nodes.map((e) => (e.innerText || '').trim().replace(/\\s+/g, ' '));
      return lines.length ? lines.join('\\n') : '(no DOM text: no panel open)';
    })()`));
  },

  async 'click-text'(c) {
    const label = pos[1];
    if (!label) throw new Error('usage: click-text "<label>"');
    const hit = await c.eval(`(() => {
      const want = ${JSON.stringify(label)}.trim().toLowerCase();
      const all = [...document.body.querySelectorAll('button, [role=button], div, span')].filter((e) => !e.closest('#game') && e.offsetParent !== null);
      const txt = (e) => (e.innerText || '').trim().replace(/\\s+/g, ' ').toLowerCase();
      const exact = all.filter((e) => txt(e) === want);
      const part = all.filter((e) => txt(e).includes(want));
      const pool = exact.length ? exact : part;
      if (!pool.length) return null;
      // smallest element = the actual button, not a wrapper
      pool.sort((a, b) => a.innerText.length - b.innerText.length);
      const e = pool[0];
      e.scrollIntoView({ block: 'center' });
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, text: e.innerText.trim() };
    })()`);
    if (!hit) throw new Error(`no visible element with text "${label}"`);
    // real touch tap so the page's own handlers (pointer/touch/click) all see it
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hit.x, y: hit.y, id: 1 }] });
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await step(c, 150);
    console.log(JSON.stringify({ clicked: hit.text, ...(await readState(c)) }));
  },

  async shot(c) {
    const out = pos[1];
    if (!out) throw new Error('usage: shot <path.png>');
    await c.eval('window.__rybki.render()');
    const params = { format: 'png' };
    if (flags.scale) params.clip = { x: 0, y: 0, width: W, height: H, scale: Number(flags.scale) / 3 };
    const { data } = await c.send('Page.captureScreenshot', params);
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(JSON.stringify({ ok: true, path: resolve(out) }));
  },

  async eval(c) {
    if (!pos[1]) throw new Error('usage: eval "<js>"');
    const v = await c.eval(pos[1]);
    console.log(JSON.stringify(v === undefined ? null : v));
  },
};

// ---------------------------------------------------------------------------------------------- main
if (!cmd || cmd === 'help' || cmd === '--help') {
  console.log(HELP);
  process.exit(0);
}
if (!commands[cmd]) {
  console.error(`unknown command "${cmd}"\n\n${HELP}`);
  process.exit(2);
}
try {
  if (cmd === 'start' || cmd === 'stop') {
    await commands[cmd]();
  } else {
    const c = await Cdp.connect();
    try {
      if (cmd !== 'url') await ensureReady(c);
      await commands[cmd](c);
    } finally {
      c.close();
    }
  }
  process.exit(0);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
