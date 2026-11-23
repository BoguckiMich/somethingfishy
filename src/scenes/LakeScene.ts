import Phaser from 'phaser';
import { pageParams } from '../urlParams';
import { sound } from '../audio/sound';
import { dayLook, lerpColor, moonArc, sunArc, type DayLook } from '../art/dayCycle';
import {
  BOBBER_X,
  distanceToY,
  DOCK,
  FAR_SHORE_TOP,
  FAR_SHORE_Y,
  NEAR_SHORE_TOP,
  ROD_TIP,
  SHORE_Y,
  W,
} from '../art/layout';
import { PAL } from '../art/palette';
import { FONT, FS, textPad } from '../font';
import { applyCameraZoom, sharpenTexts } from '../renderScale';
import { drawFrame } from './frameDraw';
import { mulberry32 } from '../art/raster';
import { ALEX_FEET_Y, ALEX_HANDS_KEY, ALEX_HAND, SHOW_OFF_FISH_ANCHOR, alexKey, alexShowOffKey } from '../art/characters';
import { lookEvent, newLook, tickLook, type LookDir, type LookState } from './anglerLook';
import { fishKey, fishSizeClass } from '../art/fishArt';
import { createTextures, repaintSky, TEX } from '../art/textures';
import { castDistance, chargePower } from '../core/casting';
import { advanceClock, formatClock, NEW_GAME_CLOCK, timeOfDay, type GameClock } from '../core/clock';
import { FISH_PATTERNS, newCatchBar, type FishProfile } from '../core/catchBar';
import { speciesById, SPECIES } from '../core/data/fish';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import { SHOP } from '../core/data/shop';
import type { GameEvent } from '../core/events';
import { fightProfile, formatCatchSize, rollHookedFish, type HookedFish } from '../core/fish';
import {
  addCatch,
  applyEvent,
  canCast,
  cheapestIndex,
  equippedRod,
  freeWormsIfStuck,
  newPlayer,
  releasePending,
  swapForCheapest,
  toBagFish,
  type BagFish,
  type PlayerState,
} from '../core/inventory';
import { INITIAL_STATE, step, type FishingInput, type FishingState, type SessionContext } from '../core/fishingSession';
import type { SoundSettings } from '../core/soundSettings';
import { clearProfile, DEFAULT_PROFILE, loadProfile, saveProfile, type Profile } from '../core/profile';
import { showBagFullCard } from '../ui/bagFullCard';
import { openBagPanel, openShopPanel } from '../ui/bagShop';
import { openLogPanel } from '../ui/logPanel';
import { openSoundBoard } from '../ui/soundBoard';
import { recordCatch, type CatchOutcome, type FishLog } from '../core/fishLog';
import { backupSave, clearSave, isSandbox, loadSave, startOver, writeSave, type SaveData } from '../core/save';
import { encodeSaveCode } from '../core/saveCode';
import { showNameOverlay } from '../ui/nameOverlay';
import { openSettingsPanel } from '../ui/settingsPanel';
import type { PanelHandle } from '../ui/panel';
import { BAR_TOP, BottomBar } from './BottomBar';
import { CatchBarView } from './CatchBarView';
import { companionEvent, companionPress, startPlayNow, tickCompanions } from './companions/behaviour';
import { CompanionView } from './companions/CompanionView';
import { HAPTICS, vibrate } from './haptics';

const NIBBLE_ANIM_MS = 260;
const TOAST_MS = 1800;
/** The show-off of a first-of-its-kind catch stays up longer (tap works after the usual guard). */
const NEW_SPECIES_SHOW_OFF_MS = 8000;
const RIPPLE_MS = 1200;
/** The clock is saved this often (real ms of play) besides every player change. */
const CLOCK_SAVE_MS = 10_000;

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
  [252, 376],
  [252, 404],
  [252, 432],
];

/** She stands near the dock's far end, feet on the planks. */
/** Catch screen text stack (game px): title, size line, badge, note; the note's bottom must stay above Alex's head. */
const CATCH_TITLE_Y = 206;
const CATCH_SUB_Y = 240;
const CATCH_BADGE_Y = 274;
const CATCH_NOTE_Y = 296;
const CATCH_TEXT_LIMIT = 324;
const ALEX_POS = { x: 192, y: DOCK.y + 28 - ALEX_FEET_Y };
const ROD_HAND = { x: ALEX_POS.x + ALEX_HAND.x, y: ALEX_POS.y + ALEX_HAND.y };
const PENCIL = new Phaser.Geom.Rectangle(326, 4, 30, 26);
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

/** Dev-only: a made-up log for ?debug=log (about half the species) and ?log=all. */
function debugLog(which: 'half' | 'all'): FishLog {
  const log: FishLog = {};
  SPECIES.forEach((sp, i) => {
    if (which === 'half' && i % 2 === 1) return;
    const lengthCm = Math.round(sp.lengthCm[0] + (sp.lengthCm[1] - sp.lengthCm[0]) * (0.25 + ((i * 37) % 70) / 100));
    log[sp.id] = { count: 1 + ((i * 5) % 9), bestLengthCm: lengthCm, bestWeightG: Math.round(sp.bodyFactor * lengthCm ** 3) };
  });
  return log;
}

function hash01(n: number): number {
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

/** Lake screen: the angler on the dock, casting a float into the lake. */
export class LakeScene extends Phaser.Scene {
  private state: FishingState = INITIAL_STATE;
  /** Coins, worms, bag, rod and log: one plain object, saved on every change via setPlayer. */
  private player: PlayerState = newPlayer();
  private ctx: SessionContext = {
    location: QUIET_LAKE,
    rod: RODS[0],
    barGear: RODS[0].barGear,
    rng: Math.random,
    timeOfDay: () => timeOfDay(this.clock.minute),
    canCast: () => canCast(this.player),
  };
  /** A DOM panel (bag, shop) or the bag-full card is open: the lake waits. */
  private panel: PanelHandle | null = null;
  private bottomBar!: BottomBar;
  private wormLabel!: Phaser.GameObjects.Text;
  private coinLabel!: Phaser.GameObjects.Text;
  private wormIcon!: Phaser.GameObjects.Image;
  private coinIcon!: Phaser.GameObjects.Image;
  private wormCue!: Phaser.GameObjects.Text;
  private wormCueAge = Infinity;
  private clock: GameClock = NEW_GAME_CLOCK;
  /** Dev flags in the URL: nothing is loaded or saved (see isSandbox). */
  private sandbox = false;
  /** The last write to storage failed (the settings panel says so). */
  private saveFailed = false;
  private sinceClockSave = 0;
  private devTag!: Phaser.GameObjects.Text;

  // Scenery images (tinted by the day cycle).
  private sunImg!: Phaser.GameObjects.Image;
  private moonImg!: Phaser.GameObjects.Image;
  private cloudImgs: { img: Phaser.GameObjects.Image; y: number; speed: number; x: number }[] = [];
  private waterImg!: Phaser.GameObjects.Image;
  private reflectionImg!: Phaser.GameObjects.Image;
  private worldImgs: Phaser.GameObjects.Image[] = [];
  private alexImg!: Phaser.GameObjects.Image;
  private look: LookState = newLook(Math.random);
  /** Dev-only ?debug=look=left|right: freeze her gaze for screenshots. */
  private lookOverride: LookDir | null = null;
  private companions!: CompanionView;
  private profile: Profile = DEFAULT_PROFILE;
  private tags: { text: Phaser.GameObjects.Text; age: number }[] = [];
  private swallowUp = false;
  private bobberImg!: Phaser.GameObjects.Image;
  private catchBar!: CatchBarView;
  /** The fish she holds up in the show-off (a separate sprite so slice 6 can swap species). */
  private showOffFish!: Phaser.GameObjects.Image;
  private showOffHands!: Phaser.GameObjects.Image;
  private caughtText!: Phaser.GameObjects.Text;
  private caughtSub!: Phaser.GameObjects.Text;
  /** Eased rod bend while fighting: more while the thumb is down, less when released. */
  private fightBend = 8;
  /** Dev-only ?debug=caught: the show-off never times out or gets dismissed. */
  private freezeCaught = false;
  /** What the current show-off means for the log (set on fishCaught, shown on the catch screen). */
  private catchOutcome: CatchOutcome = { kind: 'normal' };
  private caughtBadge!: Phaser.GameObjects.Text;
  private caughtNote!: Phaser.GameObjects.Text;

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
  /** The fetch phase last frame, to bark when it changes. */
  private lastPlayPhase: string | null = null;
  private elapsed = 0;

  constructor() {
    super('Lake');
  }

  create(): void {
    applyCameraZoom(this);
    // Dev helper: ?time=22 starts the clock at 22:00, to check night/dawn without waiting.
    const params = pageParams();
    this.sandbox = isSandbox([...params.keys()]);
    const saveStatus = this.setupSave(params);
    const startHour = Number(params.get('time'));
    if (startHour >= 0 && startHour < 24 && !!params.get('time')) {
      this.clock = { ...NEW_GAME_CLOCK, minute: startHour * 60 };
    }

    createTextures(this);
    // Dev-only: ?debug=waiting forces the waiting state at 10 m (screenshots).
    if (params.get('debug') === 'waiting') {
      this.state = { kind: 'waiting', distanceM: 10, zone: 'shallow', hooked: { speciesId: 'perch', lengthCm: 20, weightG: 150 }, untilMs: 1e9, nibblesLeft: 0, hadNibble: false };
    }
    const dbg = params.get('debug') ?? '';
    if (dbg === 'look=left' || dbg === 'look=right') this.lookOverride = dbg.slice(5) as LookDir;
    // Dev-only: ?fish=<pattern>&diff=<0..1> forces the fish; ?debug=fight / ?debug=caught jump into those states.
    if (params.has('fish') || params.has('diff')) {
      const pattern = FISH_PATTERNS.find((p) => p === params.get('fish')) ?? 'smooth';
      const diff = Number(params.get('diff') ?? 0.5);
      const fishOverride: FishProfile = { pattern, difficulty: Phaser.Math.Clamp(Number.isFinite(diff) ? diff : 0.5, 0, 1) };
      this.ctx = { ...this.ctx, fishOverride };
    }
    // Dev-only: ?species=<id> forces the species that bites; ?rod=<id> picks a rod (carbon reaches deep water).
    const speciesParam = params.get('species');
    if (speciesParam && speciesById(speciesParam)) this.ctx = { ...this.ctx, speciesOverride: speciesParam };
    // Dev-only: ?rod=<id> owns that rod; ?coins=N and ?worms=N set the purse. Everything resets on reload.
    const rod = RODS.find((r) => r.id === params.get('rod'));
    if (rod) this.setPlayer({ ...this.player, rodId: rod.id });
    const coinsParam = Number(params.get('coins'));
    if (params.has('coins') && Number.isFinite(coinsParam)) this.setPlayer({ ...this.player, coins: Math.max(0, Math.floor(coinsParam)) });
    const wormsParam = Number(params.get('worms'));
    if (params.has('worms') && Number.isFinite(wormsParam)) this.setPlayer({ ...this.player, worms: Math.max(0, Math.floor(wormsParam)) });
    if (dbg === 'log') this.setPlayer({ ...this.player, log: debugLog('half') });
    if (params.get('log') === 'all') this.setPlayer({ ...this.player, log: debugLog('all') });
    this.syncRod();
    if (dbg === 'fight' || dbg === 'caught') {
      // The forced species (default perch) at a rolled size, in its own zone.
      const hooked = rollHookedFish('shallow', timeOfDay(this.clock.minute), this.ctx.rng, this.ctx.speciesOverride ?? 'perch');
      const species = speciesById(hooked.speciesId)!;
      const fish: FishProfile = this.ctx.fishOverride ?? fightProfile(species, hooked.lengthCm);
      const distanceM = species.zone === 'deep' ? 25 : 10;
      if (dbg === 'fight') {
        this.state = { kind: 'fighting', distanceM, zone: species.zone, hooked, fish, bar: newCatchBar(fish, this.ctx.barGear, this.ctx.rng) };
      } else {
        this.state = { kind: 'caught', distanceM, zone: species.zone, hooked, fish, shownMs: 0 };
        this.freezeCaught = true;
        this.noteCatch(hooked, false); // the dev catch goes through the log like a real one
      }
    }
    this.buildScenery();
    this.buildUi();
    sharpenTexts(this); // every Phaser text rasterises at device resolution
    if (saveStatus === 'broken') this.showToast("Your save couldn't be read, starting fresh");

    this.setupProfile(params);
    this.setupDebugPanels(dbg);
    // Let the companions settle in (at night the dog is already dozing when the game opens).
    for (let t = 0; t < 2000; t += 50) {
      tickCompanions(this.companions.state, 50, { fishing: 'idle', night: timeOfDay(this.clock.minute) === 'night' });
    }
    if (params.get('debug') === 'afk') {
      // Dev-only: jump into the grass play and fast-forward to a fetch in progress.
      startPlayNow(this.companions.state);
      for (let t = 0; t < 1500; t += 50) tickCompanions(this.companions.state, 50, { fishing: 'idle', night: false });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.panel) return;
      if (this.handleTap(pointer.worldX, pointer.worldY)) {
        this.swallowUp = true; // a pet or a button press never reaches the fishing state machine
        return;
      }
      if (this.state.kind === 'idle' && !canCast(this.player)) {
        this.swallowUp = true;
        this.blockedCast();
        return;
      }
      companionPress(this.companions.state);
      this.send({ type: 'press' });
    });
    this.input.on('pointerup', () => {
      if (this.swallowUp) {
        this.swallowUp = false;
        return;
      }
      this.send({ type: 'release' });
    });
    this.input.on('gameout', () => this.send({ type: 'release' }));

    this.render();
  }

  /**
   * Loads the saved game (unless sandboxed), asks the browser to keep the storage, and hooks the
   * "leaving the page" events that save the clock. Returns the load status for a toast.
   */
  private setupSave(params: URLSearchParams): 'fresh' | 'loaded' | 'broken' | 'sandbox' {
    const store = this.safeStorage();
    if (params.get('reset') === 'save') clearSave(store);
    try {
      void navigator.storage?.persist?.()?.catch(() => undefined);
    } catch {
      // ignore: persistence is a nicety
    }
    if (this.sandbox) return 'sandbox';
    const loaded = loadSave(store);
    this.player = loaded.save.player;
    this.clock = loaded.save.clock;
    this.persist();
    const onHide = () => {
      if (document.visibilityState === 'hidden') this.persist();
    };
    const onPageHide = () => this.persist();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    });
    return loaded.status;
  }

  private currentSave(): SaveData {
    return { version: 1, player: this.player, clock: this.clock };
  }

  /** Writes the game to storage (a no-op in the dev sandbox) and remembers whether it worked. */
  private persist(): void {
    if (this.sandbox) return;
    this.sinceClockSave = 0;
    this.saveFailed = !writeSave(this.safeStorage(), this.currentSave());
  }

  /** The one way the player state changes: it is saved right after. */
  private setPlayer(p: PlayerState): void {
    this.player = p;
    this.persist();
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs;
    this.stateAge += deltaMs;
    this.clock = advanceClock(this.clock, deltaMs);
    this.sinceClockSave += deltaMs;
    if (this.sinceClockSave >= CLOCK_SAVE_MS) this.persist();
    if (!(this.freezeCaught && this.state.kind === 'caught')) this.send({ type: 'tick', dtMs: deltaMs });

    if (this.state.kind === 'casting' || this.state.kind === 'retrieving') {
      const durationMs = this.state.kind === 'casting' ? 350 + this.state.distanceM * 25 : 300 + this.state.distanceM * 15;
      this.anim = Math.min(1, this.anim + deltaMs / durationMs);
      if (this.anim >= 1) {
        if (this.state.kind === 'casting') {
          this.addRipple(this.state.distanceM, false);
          sound.play('plop');
          this.send({ type: 'landed' });
        } else {
          this.send({ type: 'retrieved' });
        }
      }
    }

    tickLook(this.look, deltaMs, this.state.kind, Math.random);
    for (const r of this.ripples) r.age += deltaMs;
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_MS);
    this.nibbleAge += deltaMs;
    this.toastAge += deltaMs;

    this.updateSound(deltaMs);
    this.companions.update(
      deltaMs,
      { fishing: this.state.kind, night: timeOfDay(this.clock.minute) === 'night' },
      this.elapsed,
      dayLook(this.clock.minute).worldTint,
    );
    this.render(deltaMs);
  }

  /** Ambient follows the game clock; the reel clicks while the catch bar is held; the dog barks at fetch. */
  private updateSound(deltaMs: number): void {
    sound.setMinute(this.clock.minute);
    sound.reel(deltaMs, this.state.kind === 'fighting' && this.state.bar.holding);
    const play = this.companions.state;
    const phase = play.mode === 'play' ? play.play.phase : null;
    if (phase !== this.lastPlayPhase && (phase === 'bring' || phase === 'spin')) sound.play('boof');
    this.lastPlayPhase = phase;
  }

  private send(input: FishingInput): void {
    const prev = this.state;
    const { state: next, events } = step(prev, input, this.ctx);
    for (const e of events) this.onEvent(e);
    if (next === prev) return;
    if (next.kind !== prev.kind) {
      this.anim = 0;
      this.stateAge = 0;
    }
    this.state = next;
    // The show-off is over: the fish goes into the bag (or the bag-full card asks).
    if (prev.kind === 'caught' && next.kind === 'idle') this.stowCatch(prev.hooked);
  }

  /**
   * A won fight goes in the log before the bag decision. A new species gets the longer show-off;
   * a new species or record makes the companions react bigger.
   */
  private noteCatch(hooked: HookedFish, celebrate: boolean): void {
    const r = recordCatch(this.player.log, hooked);
    this.setPlayer({ ...this.player, log: r.log });
    this.catchOutcome = r.outcome;
    this.ctx = { ...this.ctx, showOffMs: r.outcome.kind === 'newSpecies' ? NEW_SPECIES_SHOW_OFF_MS : undefined };
    if (celebrate && r.outcome.kind !== 'normal') companionEvent(this.companions.state, 'fishCaught', true);
  }

  /** The player's side of a game event: bait use. */
  private applyToPlayer(e: GameEvent): void {
    const r = applyEvent(this.player, e, this.ctx.rng);
    this.setPlayer(r.state);
    if (r.wormUsed) this.wormCueAge = 0;
  }

  /** Keeps the session's rod and catch-bar gear in step with the equipped rod. */
  private syncRod(): void {
    const rod = equippedRod(this.player);
    this.ctx = { ...this.ctx, rod, barGear: rod.barGear };
  }

  private stowCatch(hooked: HookedFish): void {
    const r = addCatch(this.player, hooked);
    if (r.result === 'added') {
      this.setPlayer(r.state);
      this.showToast(`${speciesById(hooked.speciesId)?.name ?? 'Fish'} goes in the bag`);
      return;
    }
    this.askBagFull(r.fish);
  }

  private askBagFull(fish: BagFish): void {
    const cheapest = this.player.bag[cheapestIndex(this.player.bag)];
    this.swallowUp = false;
    this.panel = showBagFullCard(
      fish,
      cheapest,
      () => {
        this.setPlayer(releasePending(this.player));
        this.panel = null;
        this.showToast('Released it back into the lake');
      },
      () => {
        this.setPlayer(swapForCheapest(this.player, fish).state);
        this.panel = null;
        this.showToast('Swapped');
      },
    );
  }

  private openPlayerPanel(kind: 'bag' | 'shop' | 'log' | 'settings', startWith?: string): void {
    if (this.state.kind !== 'idle' || this.panel) return;
    this.swallowUp = false;
    const store = {
      get: () => this.player,
      set: (p: PlayerState) => {
        this.setPlayer(p);
        this.syncRod();
      },
    };
    const onClose = () => (this.panel = null);
    this.panel =
      kind === 'bag' ? openBagPanel(store, onClose)
      : kind === 'shop' ? openShopPanel(store, onClose)
      : kind === 'settings' ? openSettingsPanel(this.settingsStore(), onClose)
      : openLogPanel(() => this.player.log, onClose, startWith);
  }

  /** What the settings panel may ask of the scene. */
  private settingsStore() {
    return {
      exportCode: () => encodeSaveCode(this.currentSave(), this.profile),
      applyImport: (save: SaveData, profile: Profile) => this.loadGame(save, profile),
      startOver: () => this.startNewGame(),
      openNames: () => this.openNames(),
      canSave: () => !this.saveFailed && this.safeStorage() !== undefined,
      soundSettings: () => sound.current,
      setSoundSettings: (s: SoundSettings) => sound.set(s),
      sandbox: this.sandbox,
    };
  }

  /** Replaces the running game with an imported one (the old save is kept as a backup). */
  private loadGame(save: SaveData, profile: Profile): void {
    if (!this.sandbox) backupSave(this.safeStorage());
    this.clock = save.clock;
    this.setPlayer(save.player);
    this.syncRod();
    this.profile = profile;
    if (!this.sandbox) saveProfile(this.safeStorage(), profile);
    this.showToast('Game loaded');
  }

  /** Start over: everything but the names resets (the old save is kept as a backup). */
  private startNewGame(): void {
    if (!this.sandbox) backupSave(this.safeStorage());
    const fresh = startOver(this.currentSave());
    this.clock = fresh.clock;
    this.setPlayer(fresh.player);
    this.syncRod();
    this.showToast('A fresh start');
  }

  private openNames(): void {
    showNameOverlay(this.profile, false, (p) => this.applyProfile(p));
  }

  /** A press while out of worms: the soft-lock guard may help, otherwise point to the shop. */
  private blockedCast(): void {
    const guard = freeWormsIfStuck(this.player);
    if (guard.granted) {
      this.setPlayer(guard.state);
      this.showToast('The bait shop owner slips you a few worms');
    } else {
      this.showToast('Out of worms, visit the shop');
    }
  }

  /** Dev-only: ?debug=log|shop|bag|bagfull open the panels with a filled bag (screenshots). */
  private setupDebugPanels(dbg: string): void {
    if (dbg === 'sounds') {
      this.panel = openSoundBoard(this.clock.minute, () => (this.panel = null));
      return;
    }
    if (dbg === 'settings') {
      this.openPlayerPanel('settings');
      return;
    }
    if (dbg === 'log') {
      this.openPlayerPanel('log', pageParams().get('species') ?? undefined);
      return;
    }
    if (dbg !== 'shop' && dbg !== 'bag' && dbg !== 'bagfull') return;
    const mid = (id: string, share: number): BagFish => {
      const sp = SPECIES.find((x) => x.id === id)!;
      const lengthCm = Math.round(sp.lengthCm[0] + (sp.lengthCm[1] - sp.lengthCm[0]) * share);
      return toBagFish({ speciesId: id, lengthCm, weightG: Math.round(sp.bodyFactor * lengthCm ** 3) });
    };
    const ids = ['roach', 'perch', 'bleak', 'crucian', 'eel', 'bream', 'tench', 'carp', 'pike', 'rudd'];
    const count = dbg === 'bag' ? 7 : dbg === 'shop' ? 5 : SHOP.bagSlots;
    this.setPlayer({ ...this.player, bag: ids.slice(0, count).map((id, i) => mid(id, 0.2 + ((i * 37) % 70) / 100)) });
    if (dbg === 'bagfull') this.askBagFull(mid('catfish', 0.5));
    else this.openPlayerPanel(dbg);
  }

  /** Feedback for things the core reports: ripples, haptics, messages. */
  private onEvent(e: GameEvent): void {
    this.applyToPlayer(e);
    companionEvent(this.companions.state, e.type, false);
    lookEvent(this.look, e.type, Math.random);
    const s = this.state;
    const distanceM = 'distanceM' in s ? s.distanceM : 0;
    switch (e.type) {
      case 'nibble':
        this.nibbleAge = 0;
        this.addRipple(distanceM, false);
        vibrate(HAPTICS.nibble);
        sound.play('nibble');
        break;
      case 'bite':
        this.addRipple(distanceM, true);
        vibrate(HAPTICS.bite);
        sound.play('bite');
        break;
      case 'hooked':
        this.showToast(`Hooked! ${this.profile.companion} cheers!`);
        vibrate(HAPTICS.hooked);
        sound.play('hook');
        break;
      case 'fishEscaped':
        this.showToast(e.reason === 'tooEarly' ? 'Too early, you scared it off' : 'Too slow, it got away…');
        vibrate(HAPTICS.escaped);
        sound.play('slack');
        break;
      case 'fishCaught':
        vibrate(HAPTICS.caught);
        this.noteCatch({ speciesId: e.speciesId, lengthCm: e.lengthCm, weightG: e.weightG }, true);
        sound.play(this.catchOutcome.kind === 'normal' ? 'catch' : 'fanfare');
        break;
      case 'fishLost':
        this.showToast('It got away…');
        vibrate(HAPTICS.escaped);
        sound.play('slack');
        break;
      case 'cast':
        // The state is still the charging one: a fuller charge makes a higher, louder whoosh.
        sound.play('cast', { charge: s.kind === 'charging' ? chargePower(s.heldMs) : 0.5 });
        break;
    }
  }

  private addRipple(distanceM: number, big: boolean): void {
    this.ripples.push({ x: BOBBER_X, y: distanceToY(distanceM), age: 0, big });
  }

  /** Shows who someone is for a moment. */
  private showTag(index: number, name: string, x: number, y: number): void {
    const t = this.tags[index];
    t.text.setText(name).setPosition(Math.round(Phaser.Math.Clamp(x, 40, W - 40)), Math.round(y));
    t.age = 0;
  }

  /** Taps on the dog, Pajkel or the pencil button are handled here. Returns true when consumed. */
  private handleTap(x: number, y: number): boolean {
    // During the fight and the show-off every press belongs to the fishing state machine.
    if (this.state.kind === 'fighting' || this.state.kind === 'caught') return false;
    // The bottom bar: its buttons work only while idle, and a tap there never casts.
    if (this.state.kind === 'idle' && this.bottomBar.covers(x, y)) {
      const hit = this.bottomBar.hit(x, y);
      if (hit) this.openPlayerPanel(hit);
      return true;
    }
    if (PENCIL.contains(x, y)) {
      this.openNames();
      return true;
    }
    const dog = this.companions.dogRect();
    if (dog.contains(x, y)) {
      this.companions.pet();
      sound.play('boof');
      this.showTag(2, this.profile.dog, dog.centerX, dog.y - 14);
      this.showToast(`${this.profile.dog} wags happily`);
      return true;
    }
    const paj = this.companions.pajRect();
    if (paj.contains(x, y)) {
      this.showTag(1, this.profile.companion, paj.centerX, paj.y - 2);
      return true;
    }
    return false;
  }

  /** First launch: ask for names; otherwise use the stored ones. ?reset=profile clears them. */
  private setupProfile(params: URLSearchParams): void {
    const store = this.safeStorage();
    if (params.get('reset') === 'profile') clearProfile(store);
    const stored = loadProfile(store);
    if (stored) this.profile = stored;
    // Dev-only: ?skipnames (or any ?debug=) skips the first-launch card.
    const skip = params.has('skipnames') || params.has('debug');
    if (!stored && !skip) {
      showNameOverlay(DEFAULT_PROFILE, true, (p) => this.applyProfile(p, true));
    }
  }

  private applyProfile(p: Profile, welcome = false): void {
    this.profile = p;
    saveProfile(this.safeStorage(), p);
    if (welcome) {
      this.showTag(0, p.player, ALEX_POS.x + 16, ALEX_POS.y - 4);
      this.showTag(1, p.companion, 150, 358);
      this.showTag(2, p.dog, 178, 402);
    }
  }

  private safeStorage(): Storage | undefined {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
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

    this.alexImg = this.add.image(ALEX_POS.x, ALEX_POS.y, alexKey('forward', 0)).setOrigin(0, 0).setDepth(Z.angler);
    this.worldImgs.push(this.alexImg);
    this.showOffFish = this.add
      .image(ALEX_POS.x + SHOW_OFF_FISH_ANCHOR.x, ALEX_POS.y + SHOW_OFF_FISH_ANCHOR.y, fishKey('perch', 0))
      .setOrigin(0, 0)
      .setDepth(Z.angler + 0.5)
      .setVisible(false);
    this.worldImgs.push(this.showOffFish);
    // Her hands go over the fish so they grip it.
    this.showOffHands = this.add.image(ALEX_POS.x, ALEX_POS.y, ALEX_HANDS_KEY).setOrigin(0, 0).setDepth(Z.angler + 0.6).setVisible(false);
    this.worldImgs.push(this.showOffHands);
    this.companions = new CompanionView(this);

    this.action = this.add.graphics().setDepth(Z.action);
    this.bobberImg = this.add.image(0, 0, TEX.bobber).setDepth(Z.bobber).setVisible(false);
    this.fireflies = this.add.graphics().setDepth(Z.fireflies);
    this.catchBar = new CatchBarView(this);

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
    const textStyle = { fontFamily: FONT, fontSize: `${FS.body}px`, color: TEXT };
    const pad = { padding: textPad(9, 5) };
    this.ui = this.add.graphics().setDepth(Z.uiPanel);
    this.clockLabel = this.add.text(8, 8, '', { ...textStyle, ...pad }).setDepth(Z.uiText);
    const statStyle = { ...textStyle, padding: { ...textPad(8, 4), left: 27 } };
    this.wormLabel = this.add.text(8, 40, '', statStyle).setDepth(Z.uiText);
    this.coinLabel = this.add.text(70, 40, '', statStyle).setDepth(Z.uiText);
    this.wormIcon = this.add.image(0, 0, TEX.worm).setOrigin(0, 0).setDepth(Z.uiText);
    this.coinIcon = this.add.image(0, 0, TEX.coin).setOrigin(0, 0).setDepth(Z.uiText);
    this.wormCue = this.add
      .text(0, 0, '-1 worm', { fontFamily: FONT, fontSize: `${FS.body}px`, color: '#ffb0a0', stroke: '#241a2e', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.bottomBar = new BottomBar(this, Z.uiText);
    this.devTag = this.add
      .text(W - 8, 38, 'DEV · not saving', { fontFamily: FONT, fontSize: `${FS.tiny}px`, color: ALERT, padding: textPad(5, 3, FS.tiny) })
      .setOrigin(1, 0)
      .setDepth(Z.uiText)
      .setVisible(this.sandbox);
    this.zoneLabel = this.add
      .text(W / 2, 92, '', { ...textStyle, ...pad })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.toast = this.add
      .text(W / 2, 120, '', { ...textStyle, ...pad, color: ALERT })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.alertMark = this.add
      .text(0, 0, '!', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5, 1)
      .setDepth(Z.alert)
      .setVisible(false);
    this.caughtText = this.add
      .text(W / 2, CATCH_TITLE_Y, 'Caught!', { fontFamily: FONT, fontSize: `${FS.title}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtSub = this.add
      .text(W / 2, CATCH_SUB_Y, '', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: TEXT, stroke: '#241a2e', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtBadge = this.add
      .text(W / 2, CATCH_BADGE_Y, '', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtNote = this.add
      .text(W / 2, CATCH_NOTE_Y, '', {
        fontFamily: FONT, fontSize: `${FS.body}px`, color: TEXT, align: 'center', stroke: '#241a2e', strokeThickness: 4,
        wordWrap: { width: W - 16 }, lineSpacing: -2,
      })
      .setOrigin(0.5, 0)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.hint = this.add.text(W / 2, BAR_TOP - 18, '', { ...textStyle, ...pad }).setOrigin(0.5).setDepth(Z.uiText);
    for (let i = 0; i < 3; i++) {
      const text = this.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${FS.body}px`, color: TEXT, padding: textPad(6, 3) })
        .setOrigin(0.5, 1)
        .setDepth(Z.uiText)
        .setVisible(false);
      this.tags.push({ text, age: Infinity });
    }
  }

  // ---- Rendering ---------------------------------------------------------------------------

  private render(_deltaMs = 0): void {
    const look = dayLook(this.clock.minute);
    this.applyLook(look);
    this.drawWaterFx(look);
    this.drawPosts(look);
    this.drawFireflies(look);

    // Angler: 2-frame breathing, and the head turns when she glances around.
    const breath = (Math.floor(this.elapsed / 900) % 2) as 0 | 1;
    const showingOff = this.state.kind === 'caught';
    this.alexImg.setTexture(showingOff ? alexShowOffKey(breath) : alexKey(this.lookOverride ?? this.look.dir, breath));
    this.showOffFish.setVisible(showingOff);
    this.showOffHands.setVisible(showingOff);
    if (this.state.kind === 'caught') {
      const { speciesId, lengthCm } = this.state.hooked;
      this.showOffFish.setTexture(fishKey(speciesId, fishSizeClass(speciesId, lengthCm)));
      // Held level at chest height at its real size: whole pixels, centred on the anchor.
      const fw = this.showOffFish.width;
      const fh = this.showOffFish.height;
      this.showOffFish.setPosition(
        ALEX_POS.x + SHOW_OFF_FISH_ANCHOR.x - Math.floor(fw / 2),
        ALEX_POS.y + SHOW_OFF_FISH_ANCHOR.y - Math.floor(fh / 2),
      );
    }

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
    const tight = s.kind === 'bite' || s.kind === 'fighting';
    if (s.kind === 'fighting') {
      this.fightBend += ((s.bar.holding ? 18 : 8) - this.fightBend) * Math.min(1, _deltaMs / 110);
    }
    const tip = this.rodTip();
    // The rod, line and bobber are put away while she shows off the catch.
    if (s.kind !== 'caught') this.drawRod(g, look, tip);
    if (bobber) {
      const slack = s.kind === 'lost' ? 22 * Math.min(1, this.stateAge / 220) : 0;
      this.drawLine(g, look, tip, bobber.x, bobber.y, s.kind === 'waiting' ? 6 : tight ? 0 : s.kind === 'lost' ? 4 : 2, slack);
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
    if (s.kind === 'fighting') this.catchBar.update(s.bar, this.ctx.barGear, lerpColor(0xffffff, look.worldTint, 0.35), s.hooked.speciesId);
    else this.catchBar.hide();
    const pop = Math.min(1, 0.45 + this.stateAge / 160);
    const popScale = pop + 0.18 * Math.exp(-this.stateAge / 140) * Math.sin(this.stateAge / 40);
    this.caughtText.setVisible(s.kind === 'caught').setScale(popScale);
    this.caughtSub.setVisible(s.kind === 'caught').setScale(popScale);
    if (s.kind === 'caught') {
      this.caughtText.setText(speciesById(s.hooked.speciesId)?.name ?? 'Caught!');
      this.caughtSub.setText(formatCatchSize(s.hooked.lengthCm, s.hooked.weightG));
      const o = this.catchOutcome;
      this.caughtBadge.setText(o.kind === 'newSpecies' ? 'New species!' : o.kind === 'newRecord' ? '★ New record!' : '');
      this.caughtNote.setText(
        o.kind === 'newSpecies' ? (speciesById(s.hooked.speciesId)?.fact ?? '') : o.kind === 'newRecord' ? `was ${o.previousCm} cm` : '',
      );
    }
    if (s.kind === 'caught') {
      // A long fact (up to 3 lines at VT323 25 px) would run into Alex's head: lift the whole text stack so the
      // fact ends CATCH_TEXT_LIMIT, the stack's bottom limit (her head top).
      const noteBottom = CATCH_NOTE_Y + this.caughtNote.height;
      const lift = this.caughtNote.text ? Math.min(0, CATCH_TEXT_LIMIT - noteBottom) : 0;
      this.caughtText.setY(CATCH_TITLE_Y + lift);
      this.caughtSub.setY(CATCH_SUB_Y + lift);
      this.caughtBadge.setY(CATCH_BADGE_Y + lift);
      this.caughtNote.setY(CATCH_NOTE_Y + lift);
    }
    this.caughtBadge.setVisible(s.kind === 'caught' && this.catchOutcome.kind !== 'normal').setScale(popScale);
    this.caughtNote.setVisible(s.kind === 'caught' && this.catchOutcome.kind !== 'normal');

    // Labels.
    this.clockLabel.setText(`Day ${this.clock.day}  ${formatClock(this.clock.minute)}`);
    if (s.kind === 'waiting') {
      const zone = this.ctx.location.zones.find((z) => z.id === s.zone)!;
      this.zoneLabel.setText(`${zone.name} · ${s.distanceM.toFixed(1)} m`).setVisible(true);
    } else if (s.kind === 'idle' || s.kind === 'caught') {
      this.zoneLabel.setVisible(false);
    }
    this.wormLabel.setText(String(this.player.worms));
    this.coinLabel.setText(String(this.player.coins)).setX(this.wormLabel.x + this.wormLabel.width + 4);
    this.wormCueAge += _deltaMs;
    this.wormCue
      .setVisible(this.wormCueAge < 1200)
      .setAlpha(Math.min(1, (1200 - this.wormCueAge) / 400))
      .setPosition(this.wormLabel.x + this.wormLabel.width / 2, this.wormLabel.y + this.wormLabel.height + 2 - this.wormCueAge / 100);
    this.toast.setVisible(this.toastAge < TOAST_MS).setAlpha(Math.min(1, (TOAST_MS - this.toastAge) / 300));
    this.hint.setText(
      s.kind === 'idle' ? (canCast(this.player) ? 'Hold to charge, release to cast' : 'Out of worms, visit the shop')
      : s.kind === 'charging' ? 'Release to cast!'
      : s.kind === 'waiting' ? 'Wait for the bobber to go under…'
      : s.kind === 'bite' ? 'TAP NOW!'
      : s.kind === 'fighting' ? 'Hold to raise the bar'
      : s.kind === 'caught' ? 'Tap to continue'
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
    if (s.kind === 'fighting') {
      // The bobber jerks with the fish: it follows the fish height on the bar and its speed.
      const { fish, fishVel } = s.bar;
      const kick = Phaser.Math.Clamp(fishVel * 9, -10, 10);
      const jitter = Math.sin(this.elapsed / 45) * Math.min(2.5, 0.6 + Math.abs(fishVel) * 4);
      return {
        x: BOBBER_X + Math.round((fish - 0.5) * 24 + kick * 0.6 + jitter),
        y: distanceToY(s.distanceM) + 2 + Math.round((0.5 - fish) * 8 - kick * 0.5),
      };
    }
    if (s.kind === 'lost') {
      // Nothing pulls on it any more: it just floats and bobs.
      return { x: BOBBER_X, y: distanceToY(s.distanceM) + Math.round(Math.sin(this.elapsed / 400) * 1.2) };
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
      case 'fighting': {
        const hold = s.bar.holding;
        dx = 3 + Math.sin(t * 18) * (hold ? 1.5 : 1);
        dy = tow * (hold ? 11 : 6) + Math.sin(t * 29) * (hold ? 2 : 1.2);
        bend = this.fightBend + Math.sin(t * 24) * (hold ? 1.6 : 0.8);
        break;
      }
      case 'lost': {
        // The tip springs back when the fish comes off.
        const ms = this.stateAge;
        dy = -10 * Math.exp(-ms / 160) * Math.cos(ms / 55);
        bend = 3 + 8 * Math.exp(-ms / 200);
        break;
      }
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
      pts.push({ x, y, t, th: t * total < 9 ? 2 : 1 });
    }
    // Subtle rim: a translucent shadow pixel under and beside the rod.
    for (const p of pts) g.fillStyle(rim, p.th > 1 ? 0.7 : 0.4).fillRect(p.x + 1, p.y + 1, p.th, p.th).fillRect(p.x - 1, p.y, 1, 1);
    for (const p of pts) {
      const grip = p.t * total < 9;
      const c = grip ? ((p.x + p.y) % 3 === 0 ? PAL.sandDark : PAL.sand) : p.t < 0.7 ? PAL.woodHi : PAL.strawLight;
      g.fillStyle(tint(c)).fillRect(p.x, p.y, p.th, p.th);
    }
    // Line guides.
    for (const gt of [0.45, 0.68, 0.88]) {
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
    g.fillStyle(PAL.redLight).fillRect(tip.x, tip.y, 2, 1);
  }

  /** `sag` bows the line sideways, `droop` lets it hang down (a slack line). */
  private drawLine(g: Phaser.GameObjects.Graphics, look: DayLook, tip: { x: number; y: number }, bx: number, by: number, sag: number, droop = 0): void {
    const color = multiply(PAL.white, lerpColor(0xffffff, look.worldTint, 0.6));
    const cx = (tip.x + bx) / 2 + sag;
    const cy = (tip.y + by) / 2 + droop;
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
      drawFrame(g, l, top, w, h, 'hud', a);
    };
    panel(this.clockLabel);
    panel(this.wormLabel);
    panel(this.coinLabel);
    panel(this.zoneLabel);
    panel(this.toast);
    panel(this.hint);
    panel(this.devTag);
    for (const t of this.tags) {
      t.age += 16;
      t.text.setVisible(t.age < 2400);
      panel(t.text);
    }
    // Worm and coin icons sit in the left padding of their labels.
    const place = (icon: Phaser.GameObjects.Image, label: Phaser.GameObjects.Text) =>
      icon.setPosition(Math.round(label.x) + 5, Math.round(label.y + label.height / 2) - 8).setVisible(label.visible);
    place(this.wormIcon, this.wormLabel);
    place(this.coinIcon, this.coinLabel);
    this.bottomBar.draw(g, {
      enabled: this.state.kind === 'idle' && !this.panel,
      bagCount: this.player.bag.length,
      bagSlots: SHOP.bagSlots,
    });
    // Pencil button (rename), top right.
    drawFrame(g, PENCIL.x, PENCIL.y, PENCIL.width, PENCIL.height, 'buttonWood');
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i < 2 ? PAL.pink : i < 7 ? PAL.gold : PAL.cream).fillRect(PENCIL.x + 8 + i * 1.5, PENCIL.y + 18 - i * 1.5, 3, 3);
    }
  }
}


