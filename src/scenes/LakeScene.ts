import Phaser from 'phaser';
import { pageParams } from '../urlParams';
import { todayLocal } from '../localDate';
import { boxAvailable, dailyOf, openBox, tierFor } from '../core/daily/daily';
import { showBaitBoxCard } from '../ui/baitBoxCard';
import { openBaitPicker } from '../ui/baitPicker';
import { showQuestPanel, type NoticeTab } from '../ui/questPanel';
import { showChecklistPanel, showRoadFixedCard } from '../ui/checklistPanel';
import { allButPetrol, bundleTotal, checklistRewardText, doneCount as checklistDone, fittingSlots, withBundlesDone } from '../core/checklist/checklist';
import { showBottleCard, showStoryCard } from '../ui/bottleCard';
import { StoryView } from './StoryView';
import { PALE_BEAT, STORY_TUNING, type ChapterDef } from '../core/data/story';
import { blinkIsNight, blinkLines, chapterById, lineText, markPaleSeen, markSeen, nextLine, paleBeatDue, queueLines, recordMilestones, storyMilestones, storyOf, todaysChapter, isNightVisit, withFlag } from '../core/story/story';
import { claimStar, newScheduler, openBottle, pickMoment, tickScheduler, type Scheduler } from '../core/moments/moments';
import { MOMENT_KINDS, type MomentKind } from '../core/data/moments';
import { MomentsView } from './MomentsView';
import { applyCatchToPlayer, claimableCount, doneCount, questsOf, syncQuests } from '../core/quests/quests';
import type { ZoneId } from '../core/location';
import { sound } from '../audio/sound';
import { cssColor, dayLook, lerpColor, letterboxBands, moonArc, sunArc, type DayLook } from '../art/dayCycle';
import {
  BOBBER_X,
  distanceToY,
  DOCK,
  FAR_SHORE_TOP,
  FAR_SHORE_Y,
  NEAR_SHORE_TOP,
  ROD_TIP,
  SHORE_Y,
  H,
  W,
} from '../art/layout';
import { PAL } from '../art/palette';
import { FONT, FS, textPad } from '../font';
import { applyCameraZoom, sharpenTexts } from '../renderScale';
import { drawFrame } from './frameDraw';
import { mulberry32 } from '../art/raster';
import { ALEX_FEET_Y, ALEX_HANDS_KEY, DOG_SIZE, ALEX_HAND, SHOW_OFF_FISH_ANCHOR, alexKey, alexShowOffKey } from '../art/characters';
import { lookEvent, newLook, tickLook, type LookDir, type LookState } from './anglerLook';
import { fishHugKey, fishKey, fishSizeClass, isHugged } from '../art/fishArt';
import { createTextures, ensureSignTexture, lanternKey, repaintSky, TEX, weatherKey } from '../art/textures';
import { SIGN_GLINT, SIGN_SIZE, signNoteCenter, signSlots, type SignLook } from '../art/signArt';
import { activeGlints, allSeen, GLINTS, glintPhase, isSeen, markCast, markSeen as markHintSeen, pickTip, signAction, TIP_TUNING, type Glint, type Tip } from '../core/tips';
import { CAR_PARTS, CAR_SIZE, carKey } from '../art/carArt';
import { LANTERN_FLAME, LANTERN_SIZE } from '../art/lanternArt';
import { crossedCompanionBedtime, crossedWarning, inCarWindow, inSleepWindow, inWarnHour, lanternGlow, loadClock, morningClock, napWakeClock, wakeGreeting, warningLines, type NapOption } from '../core/bedtime';
import { fadeView, newSleepFade, tickSleepFade, type SleepFade } from '../core/sleepFade';
import { showMapPanel } from '../ui/mapPanel';
import { canOpenMap, napAvailable } from '../core/carMap';
import { showNapCard } from '../ui/napCard';
import { castDistance, chargePower } from '../core/casting';
import { advanceClock, daylight, formatClock, NEW_GAME_CLOCK, timeOfDay, type GameClock } from '../core/clock';
import { FISH_PATTERNS, newCatchBar, type FishProfile } from '../core/catchBar';
import { isLegendary, isTrophy, speciesById, SPECIES } from '../core/data/fish';
import { HINT_GAP_MS, PAJKEL_HINT_LINES, RARE_TUNING, TROPHY_TEXT } from '../core/data/rare';
import { addTrophy, boardIds, fullBoard } from '../core/rare';
import { showTrophyCard } from '../ui/trophyCard';
import { campfireKey, ensureTrophyBoardTexture, windsockKey } from '../art/textures';
import { BED_SIZE, CAMPFIRE_FLAME, CAMPFIRE_FRAMES, CAMPFIRE_SIZE, POLE_ANCHOR, POLE_SIZE, TENT_ANCHOR, TENT_SIZE } from '../art/campArt';
import { BED_POS, FIRE_FEET, LIGHT_POLE, SOCK_FEET, SOCK_ORIGIN_X, TENT_FEET } from '../art/campLayout';
import { allCamp, hasCamp, windsockLevel } from '../core/camp';
import { PALE_ONE } from '../core/data/legendary';
import { eerieLevel, eerieLook } from '../core/eerie';
import { slipsAway } from '../core/legendary';
import { QUIET_LAKE } from '../core/data/locations';
import { RODS } from '../core/data/rods';
import { LINES, REELS } from '../core/data/tackle';
import { SHOP } from '../core/data/shop';
import type { GameEvent } from '../core/events';
import { fightProfile, formatCatchSize, rollHookedFish, weightG, type HookedFish } from '../core/fish';
import {
  addCatch,
  applyEvent,
  addBait,
  baitCount,
  canCast,
  chosenBait,
  cheapestIndex,
  effectiveBarGear,
  equippedRod,
  freeWormsIfStuck,
  hasNightKit,
  nightKitForSale,
  totalBait,
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
import { recordCatch, speciesCaught, type CatchOutcome, type FishLog } from '../core/fishLog';
import { backupSave, clearSave, isSandbox, loadSave, startOver, writeSave, type SaveData } from '../core/save';
import { encodeSaveCode } from '../core/saveCode';
import { showNameOverlay } from '../ui/nameOverlay';
import { openSettingsPanel } from '../ui/settingsPanel';
import type { PanelHandle } from '../ui/panel';
import { BAR_TOP, BottomBar, baitChipRect } from './BottomBar';
import { BAITS, WORM_ID, baitById } from '../core/data/baits';
import { CatchBarView } from './CatchBarView';
import { carVariant, chairEmpty, companionEvent, companionPress, trophyCheer, dogVisible, isInCar, pajVisible, pickLine, startBedtime, startInCar, startNap, startPlayNow, steamShows, tickCompanions, wakeUp } from './companions/behaviour';
import { BEDTIME_LINES, GOLD_LINES, MEDAL_LINES, RECORD_LINES, WEATHER_LINES } from '../core/data/pajkelLines';
import { WEATHER_IDS, WEATHER_LOOK, type WeatherId } from '../core/data/weather';
import { fogStrength, weatherEffects, weatherLineDue, weatherOfTheDay, type WeatherEffects } from '../core/daily/weather';
import { weatherLook } from '../art/weatherArt';
import { fishOfTheDay } from '../core/daily/fotd';
import { isGoldOrBetter, lengthForStar, tierFor as catchTierFor, type Tier } from '../core/data/stars';
import { starKey } from '../art/starArt';
import { CompanionView } from './companions/CompanionView';
import { HAPTICS, vibrate } from './haptics';
import { resolveRelease, type ShoreObject } from '../core/tapHold';
import { enqueueToast, nextToast } from '../core/toastQueue';

const NIBBLE_ANIM_MS = 260;
const TOAST_MS = 1800;
/** How long the 01:00 bedtime warning stays up. */
const WARN_MS = 5000;
/** The show-off of a first-of-its-kind catch stays up longer (tap works after the usual guard). */
const NEW_SPECIES_SHOW_OFF_MS = 8000;
const RIPPLE_MS = 1200;
/** Where the hugged fish's head end sits on Alex's sprite (her chest), and how far the hug leans to her side (sprite px). */
const HUG_HEAD_Y = 23;
const HUG_DX = 0;
/** How long the "it slips away" line stays where the hint speaks. */
const SLIP_NOTE_MS = 4500;
const SLIP_NOTE = 'It slips back into the dark water…';
/** Time constant (ms) of the eerie look easing in and out. */
const EERIE_EASE_MS = 700;
const EERIE_GREEN = 0x1e4a2c; // dark murky green: darkens and greens the water rather than brightening it
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
const CATCH_SUB_Y = 234;
const CATCH_BADGE_Y = 258;
const CATCH_NOTE_Y = 274;
const CATCH_FOTD_Y = 182;
/** The perfect-catch line goes this far above the fish-of-the-day line when both show. */
const CATCH_PERFECT_GAP = 24;
const FOTD_TEXT = '#8fe3b0';
const CATCH_TEXT_LIMIT = 324;
/** Pajkel's speech bubble over his head starts at about y 300 during the show-off (31 px per line, 2 lines for a long one): the stack must end above it. */
const CATCH_BUBBLE_TOP = 298;
/** Room the "Fits the checklist!" tag takes under the size line (slice 22b). */
const CATCH_FITS_GAP = 26;
const ALEX_POS = { x: 192, y: DOCK.y + 28 - ALEX_FEET_Y };
const ROD_HAND = { x: ALEX_POS.x + ALEX_HAND.x, y: ALEX_POS.y + ALEX_HAND.y };
/**
 * The notice-board sign (slice 22c, 1.5x bigger in 22d): right of the dock on the grass, feet on the shore line. Its
 * sprite (36 x 38) ends at y 498 and the fetch lawn (PLAY_AREA, y 500-554) starts below it, so the two never overlap;
 * the 56 x 56 tap area is just above the lawn too (y 444-500), right of the dock (x 116-244) and the crate's tap area.
 */
const SIGN_FEET = { x: 276, y: 498 };
const SIGN_HIT = new Phaser.Geom.Rectangle(SIGN_FEET.x - 28, SIGN_FEET.y - 54, 56, 56);
/** A 9 x 9 sun, half sun or moon in front of the clock (slice 22c), and how big it is drawn. */
const CLOCK_ICON_SCALE = 2;
const QUEST_CUE_MS = 1800;
/** The crate from the bait shop: feet position on the dock, and a finger-sized (44 x 44) tap area around it. */
const CRATE_FEET = { x: 214, y: 458 };
const CRATE_HIT = new Phaser.Geom.Rectangle(CRATE_FEET.x - 22, CRATE_FEET.y - 34, 44, 44);
/** How often the device date is re-read (a game left open past midnight gets the new crate). */
const DATE_CHECK_MS = 5000;
const GLINT_N = 130;
/**
 * The car (slice 16): its front quarter peeks in from the LEFT screen edge, on the grass between the
 * bushes and the bottom bar. Why there: the dock, the crate, the fetch area (x 112-320) and the right
 * edge (bushes, the throw targets) are all busy, the HUD is at the top and the bar starts at y 602,
 * while the lower left is only grass and a bush. Its wheels touch down at y 546, clear of the hint line
 * (y 567-600) and the bar (y 602+).
 */
const CAR_POS = { x: 0, y: 500 };
/** The notice-board button, top right (a second way in beside the sign): 44 x 44, above the catch bar (it starts at y 50). */
const BOARD_BTN = new Phaser.Geom.Rectangle(W - 8 - 44, 4, 44, 44);
const CAR_HIT = new Phaser.Geom.Rectangle(0, 494, 84, 58);
/**
 * The trophy board (slice 23d): on the grass above the car at the left, left of the dock (x 116+), clear of the car (y 500+) and of the
 * fetch lawn (PLAY_AREA x 100+, y 500+). Its feet are at the bottom middle; the tap area is a little bigger than the 40 x 34 sprite.
 */
const TROPHY_FEET = { x: 58, y: 492 };
const TROPHY_HIT = new Phaser.Geom.Rectangle(TROPHY_FEET.x - 28, TROPHY_FEET.y - 46, 56, 48);
/** Where the camp items stand (slice 23e): the spots and the reasons are in art/campLayout.ts. */
const LIGHT_BULBS = [PAL.redLight, PAL.gold, PAL.leafHi, PAL.blueFlower, PAL.pink] as const;
/** The dock lantern's feet, and the centre of its glow (between the lantern and Alex, near the dock end). */
const LANTERN_FEET = { x: 180, y: 388 };
const GLOW_CENTER = { x: 194, y: 374 };
const GLOW_RX = 64;
const GLOW_COLOR = 0xffa94a;
/** A "Zzz..." from the car lasts this long. */
const ZZZ_MS = 1500;

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
    if (which === 'half' && (i % 2 === 1 || sp.rarity === 'legendary')) return; // half: the legendary stays "???"
    const lengthCm = Math.round(sp.lengthCm[0] + (sp.lengthCm[1] - sp.lengthCm[0]) * (0.25 + ((i * 37) % 70) / 100));
    log[sp.id] = { count: 1 + ((i * 5) % 9), bestLengthCm: lengthCm, bestWeightG: Math.round(sp.bodyFactor * lengthCm ** 3) };
  });
  return log;
}

function hash01(n: number): number {
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

/** Real ms of calm play before today's chapter shows up (60-90 s). */
function rollStoryDelay(): number {
  return STORY_TUNING.delayMs.min + Math.random() * (STORY_TUNING.delayMs.max - STORY_TUNING.delayMs.min);
}

/** Lake screen: the angler on the dock, casting a float into the lake. */
const ALL_MILESTONES: Record<string, boolean> = { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true, Q7: true };

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
    minute: () => this.clock.minute,
    canCast: () => canCast(this.player),
    baitId: () => chosenBait(this.player),
    fotdId: () => this.fotdId(),
    weatherFx: () => this.weatherNow(),
  };
  /** A DOM panel (bag, shop) or the bag-full card is open: the lake waits. */
  private panel: PanelHandle | null = null;
  private bottomBar!: BottomBar;
  private coinLabel!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  /** The sun, half sun or moon in front of the clock (slice 22c). */
  private clockIcon!: Phaser.GameObjects.Image;
  /** Today's weather (slice 23b): its icon next to the clock, the rain/wind overlay and the fog. */
  private weatherIcon!: Phaser.GameObjects.Image;
  private weatherFxG!: Phaser.GameObjects.Graphics;
  private fogFx!: Phaser.GameObjects.Graphics;
  /** Dev flag ?weather=: that weather today (null = by the date). */
  private weatherOverride: WeatherId | null = null;
  /** The first-launch name card is up: Pajkel keeps his weather line for after it. */
  private nameCardOpen = false;
  private wormCue!: Phaser.GameObjects.Text;
  private wormCueAge = Infinity;
  private clock: GameClock = NEW_GAME_CLOCK;
  /** Dev flags in the URL: nothing is loaded or saved (see isSandbox). */
  private sandbox = false;
  /** Dev flag ?milestones=all: every story milestone counts as met (sandboxed). */
  private milestonesAll = false;
  /** The last write to storage failed (the settings panel says so). */
  private saveFailed = false;
  private sinceClockSave = 0;
  private devTag!: Phaser.GameObjects.Text;
  private boardImg!: Phaser.GameObjects.Image;

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
  /** Today's date on the device (YYYY-MM-DD), re-read every few seconds. */
  private today = todayLocal();
  private sinceDateCheck = 0;
  /** Number of finished quests last time we looked: a rise means "Quest done!" once back at idle. */
  private seenDone = 0;
  private questCue!: Phaser.GameObjects.Text;
  private questCueAge = Infinity;
  /** The notice-board sign on the shore and the twinkles of the things not tapped yet (slice 22c). */
  private signImg!: Phaser.GameObjects.Image;
  /** The trophy board (slice 23d) and the key of the texture it shows now ('' = not shown). */
  private trophyImg!: Phaser.GameObjects.Image;
  private trophyKey = '';
  /** Real ms until Pajkel next says a rare-fish hint while idle (-1 = not set yet). */
  private hintLineMs = -1;
  /** Dev flag ?rare=<id>: the next landed cast bites that trophy (once). */
  private rareDev: string | null = null;
  /** What the last catch did on the trophy board: not a trophy, first, bigger than the mounted one, or no bigger. */
  private catchTrophy: 'none' | 'first' | 'better' | 'same' = 'none';
  private glintFx!: Phaser.GameObjects.Graphics;
  /** The idle hint (slice 22c): which line is up, how long it has been, and whether a one-off line has had its turn. */
  private tip: Tip | null = null;
  private tipAge = 0;
  /** The open quest panel, so a day change can refresh it. */
  private questPanel: PanelHandle | null = null;
  /** Lake moments (slice 14): the next-one timer, the one on screen, and the dev spawn flag. */
  private moments!: MomentsView;
  private momentGap: Scheduler = newScheduler(Math.random);
  private lastMoment: MomentKind | null = null;
  private debugMoment: { kind: MomentKind; inMs: number } | null = null;
  /** Story chapters (slice 21): the pictures, the chapter being told, the delivery timer and the line queue clock. */
  private story!: StoryView;
  private storyOn = true;
  /** Dev flag ?journal=all: the road counts as fixed for the Story tab. */
  private journalAll = false;
  private storyRun: { chapter: ChapterDef; night: boolean; preMs: number } | null = null;
  private storyTimerMs = rollStoryDelay();
  private storyLineMs = 0;
  /** Dev flag ?story=Qn: that chapter is today's, whatever the date rule says (null once seen). */
  private storyDev: ChapterDef | null = null;
  /** The Pale One slipped back and its card waits for a calm moment. */
  private paleCardPending = false;
  /** ?debug=bubble: ms until Pajkel says a line (dev only), or null. */
  private debugBubbleInMs: number | null = null;
  private debugToastInMs: number | null = null;
  private crateImg!: Phaser.GameObjects.Image;
  // Slice 16: the car, the lantern, bedtime and naps.
  private carImg!: Phaser.GameObjects.Image;
  private carFx!: Phaser.GameObjects.Graphics;
  private lanternImg!: Phaser.GameObjects.Image;
  private lanternFx!: Phaser.GameObjects.Graphics;
  // Slice 23e: the camp items.
  private campFire!: Phaser.GameObjects.Image;
  private campTent!: Phaser.GameObjects.Image;
  private campPole!: Phaser.GameObjects.Image;
  /** The lights' second pole, standing where the tent's ridge pole would be while the tent is not owned. */
  private campPole2!: Phaser.GameObjects.Image;
  private campBed!: Phaser.GameObjects.Image;
  private campSock!: Phaser.GameObjects.Image;
  private campFx!: Phaser.GameObjects.Graphics;
  private campSparks: { x: number; y: number; age: number; life: number; vx: number }[] = [];
  private sparkClock = 0;
  private carZs: { img: Phaser.GameObjects.Image; age: number }[] = [];
  private sinceAutoZ = 0;
  private fadeGfx!: Phaser.GameObjects.Graphics;
  private fadeText!: Phaser.GameObjects.Text;
  /** The sleep fade while it runs (bedtime without the kit, or a nap), else null. */
  private sleepFade: SleepFade | null = null;
  private fadeWoke = false;
  /** The nap's wake-up time, set when the nap starts. */
  private napTarget: NapOption | null = null;
  /** 00:00 passed and the sequence is waiting for a fight, the show-off or a panel to end. */
  private bedPending = false;
  /** 01:00 passed without the kit and the warning is waiting for a fight, a panel or a card to end. */
  private warnPending = false;
  private warnAge = Infinity;
  private warnText!: Phaser.GameObjects.Text;
  private lastBedPhase: string | null = null;
  private crateFx!: Phaser.GameObjects.Graphics;
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
  /** The star of the current catch (slice 19) and whether it was today's fish. */
  /** The tier of the catch on show (stars or a medal), already raised by a perfect catch (slice 23f). */
  private catchStar: Tier = 'none';
  /** The fish never left the green zone (slice 23f); a perfect catch is also stored on the bag fish. */
  private catchPerfect = false;
  private catchFotd = false;
  /** The caught fish fits an open checklist slot and has room in the bag (slice 20). */
  private catchFits = false;
  private caughtFits!: Phaser.GameObjects.Text;
  private caughtFitsBack!: Phaser.GameObjects.Graphics;
  private caughtStarsBack!: Phaser.GameObjects.Graphics;
  private caughtStars!: Phaser.GameObjects.Image;
  private caughtFotd!: Phaser.GameObjects.Text;
  private caughtPerfect!: Phaser.GameObjects.Text;
  /** Dev flag ?fotd=<id>: forces today's fish. */
  private fotdOverride: string | undefined;
  private caughtNote!: Phaser.GameObjects.Text;
  /** A line that takes over the hint for a moment once back at idle (the legendary slipping away). */
  private slipNoteAge = Infinity;
  /** Eased eerie look: green overlay alpha on the water and how still the water is (0..1). */
  private eerieTint = 0;
  private eerieCalm = 0;
  /** Drift clock of the water dashes: runs slower while the lake is still. */
  private driftT = 0;
  private eerieFx!: Phaser.GameObjects.Graphics;

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
  /** Toasts said during the fight, shown once it is over (they would cover the bar). */
  private pendingToasts: string[] = [];
  /** True once the state being entered is the fight: set before a step's events are handled. */
  private fightToasts = false;
  /** The shore object the current press started on (tap opens it, hold casts), or null. */
  private holdOn: ShoreObject | null = null;
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
    // The dev sandbox pretends every hint was seen (a clean lake for the other flags); ?debug=fresh pretends none was.
    if (this.sandbox) this.setPlayer({ ...this.player, seen: params.get('debug') === 'fresh' ? (params.get('casts') === '3' ? ['cast1', 'cast2', 'cast3', 'crate', 'sign', 'dog'] : []) : allSeen() });
    // Same for Pajkel's weather line (slice 23b): only ?weather= (or ?debug=weatherline) lets him say it in the sandbox.
    if (this.sandbox && !params.has('weather') && params.get('debug') !== 'weatherline') this.setPlayer({ ...this.player, weatherSeen: this.today });
    const startHour = Number(params.get('time'));
    if (startHour >= 0 && startHour < 24 && !!params.get('time')) {
      this.clock = { ...NEW_GAME_CLOCK, minute: startHour * 60 };
    }

    // Slice 16 dev flags: ?kit=1 owns the night kit, ?debug=bedtime starts the clock at 23:59:30 (the companions'
    // midnight), ?debug=warn at 00:59:50 (the 01:00 warning), ?debug=sleep at 01:59:30 (Alex's 02:00),
    // ?debug=incar starts with Pajkel and Bestia asleep in the car (at 03:00, with the kit).
    if (params.get('kit') === '1') this.setPlayer({ ...this.player, nightKit: true });
    if (params.get('debug') === 'bedtime') this.clock = { ...this.clock, minute: 23 * 60 + 59.5 };
    if (params.get('debug') === 'warn') this.clock = { ...this.clock, minute: 59 + 50 / 60 };
    if (params.get('debug') === 'sleep') this.clock = { ...this.clock, minute: 119.5 };
    if (params.get('debug') === 'incar') {
      this.setPlayer({ ...this.player, nightKit: true });
      if (!params.get('time')) this.clock = { ...this.clock, minute: 3 * 60 };
    }

    createTextures(this);
    // Dev-only: ?debug=waiting forces the waiting state at 10 m (screenshots).
    if (params.get('debug') === 'waiting') {
      this.state = { kind: 'waiting', distanceM: 10, zone: 'shallow', hooked: { speciesId: 'perch', lengthCm: 20, weightG: 150 }, untilMs: 1e9, nibblesLeft: 0, hadNibble: false };
    }
    const dbg = params.get('debug') ?? '';
    const debugKind = dbg.startsWith('moment=') ? MOMENT_KINDS.find((k) => k === dbg.slice(7)) : undefined;
    if (debugKind) this.debugMoment = { kind: debugKind, inMs: 1000 };
    if (dbg === 'bubble') this.debugBubbleInMs = 1000;
    // Dev-only: ?toast=<ms> says a long toast that many ms after load (default 1000) (during ?debug=fight it must wait for the fight to end).
    if (params.has('toast')) this.debugToastInMs = Number(params.get('toast')) || 1000;
    if (dbg === 'look=left' || dbg === 'look=right') this.lookOverride = dbg.slice(5) as LookDir;
    // Dev-only: ?fish=<pattern>&diff=<0..1> forces the fish; ?debug=fight / ?debug=caught jump into those states.
    if (params.has('fish') || params.has('diff')) {
      const pattern = FISH_PATTERNS.find((p) => p === params.get('fish')) ?? 'smooth';
      const diff = Number(params.get('diff') ?? 0.5);
      const fishOverride: FishProfile = { pattern, difficulty: Phaser.Math.Clamp(Number.isFinite(diff) ? diff : 0.5, 0, 1) };
      this.ctx = { ...this.ctx, fishOverride };
    }
    // Dev-only: ?species=<id> forces the species that bites; ?rod=<id> picks a rod (carbon reaches deep water).
    const fotdParam = params.get('fotd');
    if (fotdParam && speciesById(fotdParam)) this.fotdOverride = fotdParam;
    this.weatherOverride = WEATHER_IDS.find((w) => w === params.get('weather')) ?? null;
    const speciesParam = params.get('species') === 'legendary' ? PALE_ONE.speciesId : params.get('species');
    if (speciesParam && speciesById(speciesParam)) this.ctx = { ...this.ctx, speciesOverride: speciesParam };
    // Dev-only: ?rod=<id> owns that rod; ?coins=N and ?worms=N set the purse. Everything resets on reload.
    const rod = RODS.find((r) => r.id === params.get('rod'));
    if (rod) this.setPlayer({ ...this.player, rodId: rod.id });
    // ?line=braided|fluoro and ?reel=smooth|pro own that line / reel (sandboxed like ?rod=).
    const line = LINES.find((l) => l.id === params.get('line'));
    if (line) this.setPlayer({ ...this.player, lineId: line.id });
    const reel = REELS.find((r) => r.id === params.get('reel'));
    if (reel) this.setPlayer({ ...this.player, reelId: reel.id });
    // ?bait=<id> chooses that bait and gives 10; ?baits=all gives 10 of every special bait (sandboxed, never saved).
    const baitParam = BAITS.find((b) => b.id === params.get('bait'));
    if (baitParam) this.setPlayer({ ...addBait(this.player, baitParam.id, 10), baitId: baitParam.id });
    if (params.get('baits') === 'all') for (const b of BAITS) this.setPlayer(addBait(this.player, b.id, 10));
    // Dev-only (slice 23d): ?rare=goldenTench|mossback|silverGhost makes that fish bite on the next cast; ?trophies=all fills the board.
    const rareParam = params.get('rare');
    if (rareParam && isTrophy(speciesById(rareParam))) this.rareDev = rareParam;
    if (params.get('trophies') === 'all') {
      const board = fullBoard(this.today);
      const log = { ...this.player.log };
      for (const [id, t] of Object.entries(board)) log[id] ??= { count: 1, bestLengthCm: t.lengthCm, bestWeightG: t.weightG };
      log.pale ??= { count: 1, bestLengthCm: 182, bestWeightG: 64000 };
      this.setPlayer({ ...this.player, trophies: board, log });
    }
    // Dev-only (slice 23e): ?camp=all owns every camp item.
    if (params.get('camp') === 'all') this.setPlayer({ ...this.player, camp: allCamp() });
    const coinsParam = Number(params.get('coins'));
    if (params.has('coins') && Number.isFinite(coinsParam)) this.setPlayer({ ...this.player, coins: Math.max(0, Math.floor(coinsParam)) });
    const wormsParam = Number(params.get('worms'));
    if (params.has('worms') && Number.isFinite(wormsParam)) this.setPlayer({ ...this.player, worms: Math.max(0, Math.floor(wormsParam)) });
    // Dev-only: ?cl=done fills every checklist slot but the petrol payment; ?cl=all fills them all (road fixed).
    if (params.get('cl') === 'done') this.setPlayer(allButPetrol(this.player));
    if (params.get('cl') === 'all') this.setPlayer(allButPetrol({ ...this.player, checklist: undefined }, true));
    // Dev-only: ?bundles=N finishes the first N checklist bundles (shop gear gates, slice 23a; applied after ?cl=).
    if (params.has('bundles')) this.setPlayer(withBundlesDone(this.player, Math.max(0, Math.floor(Number(params.get('bundles')) || 0))));
    // Dev-only: ?story=Q1..Q7 makes that chapter today's and starts it in ~3 s; ?story=pale shows the Pale One card.
    const storyParam = params.get('story');
    if (storyParam === 'pale') this.paleCardPending = true;
    else if (storyParam) {
      const ch = chapterById(storyParam.toUpperCase());
      if (ch) {
        this.storyDev = ch;
        this.storyTimerMs = 3000;
      }
    }
    this.milestonesAll = params.get('milestones') === 'all';
    this.storyOn = !this.sandbox || storyParam !== null || this.milestonesAll;
    // Dev-only: ?journal=all marks every chapter seen (the night Q4, the Pale One and the road fixed) so the Story tab is full;
    // with `&looked=1` the dot is already read. Nothing is queued, so Pajkel stays quiet.
    if (params.get('journal') === 'all') {
      const done = Object.fromEntries(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'].map((id, i) => [id, `2026-11-0${i + 1}`]));
      this.journalAll = true;
      this.setPlayer({ ...this.player, story: { done, queue: [], pale: true, paleOn: '2026-11-04', blinkNight: true } });
    }
    if (dbg === 'log') this.setPlayer({ ...this.player, log: debugLog('half') });
    if (params.get('log') === 'all') this.setPlayer({ ...this.player, log: debugLog('all') });
    // Dev-only: ?perfect=1 with a dev log gives every species the medal as its best tier (the log tiles and cards show the medal).
    if (params.get('perfect') === '1' && Object.keys(this.player.log).length > 0) {
      const log: FishLog = {};
      for (const [id, e] of Object.entries(this.player.log)) log[id] = { ...e, bestTier: 'medal' };
      this.setPlayer({ ...this.player, log });
    }
    // Dev-only: ?logcount=N sets every caught species' count to N (fish knowledge tiers).
    const logCount = Number(params.get('logcount'));
    if (logCount >= 1) {
      const log: FishLog = {};
      for (const [id, e] of Object.entries(this.player.log)) log[id] = { ...e, count: Math.floor(logCount) };
      this.setPlayer({ ...this.player, log });
    }
    this.syncRod();
    this.syncQuestsNow();
    // Dev-only: ?qdone=1 finishes the first quest (see the Claim button).
    // ?qdone=all finishes AND claims every quest (the board opens folded).
    const qd = params.get('qdone');
    if (qd === '1' || qd === 'all') {
      const q = questsOf(this.player);
      if (q.list.length > 0) {
        const list = q.list.map((x, i) => (i === 0 || qd === 'all' ? { ...x, progress: x.params.target, done: true, claimed: qd === 'all' } : x));
        this.setPlayer({ ...this.player, quests: { ...q, list } });
      }
    }
    this.seenDone = doneCount(questsOf(this.player));
    let devCatch: { hooked: HookedFish; zone: ZoneId; perfect: boolean } | undefined;
    if (dbg === 'fight' || dbg === 'caught') {
      // The forced species (default perch) at a rolled size, in its own zone.
      let hooked = rollHookedFish('shallow', timeOfDay(this.clock.minute), this.ctx.rng, this.ctx.speciesOverride ?? 'perch');
      const species = speciesById(hooked.speciesId)!;
      // ?star=gold|silver|bronze|none makes the show-off fish that star.
      const starParam = (['gold', 'silver', 'bronze', 'none'] as const).find((s) => s === params.get('star'));
      if (starParam) {
        const lengthCm = lengthForStar(species, starParam);
        hooked = { ...hooked, lengthCm, weightG: weightG(species, lengthCm) };
      }
      const fish: FishProfile = this.ctx.fishOverride ?? fightProfile(species, hooked.lengthCm);
      const distanceM = species.zone === 'deep' ? 25 : 10;
      if (dbg === 'fight') {
        this.state = { kind: 'fighting', distanceM, zone: species.zone, hooked, fish, bar: newCatchBar(fish, this.ctx.barGear, this.ctx.rng) };
      } else {
        this.state = { kind: 'caught', distanceM, zone: species.zone, hooked, fish, shownMs: 0 };
        this.freezeCaught = true;
        devCatch = { hooked, zone: species.zone, perfect: params.get('perfect') === '1' }; // noted after buildUi: Pajkel (companions) must exist to speak
      }
    }
    this.buildScenery();
    this.buildUi();
    if (devCatch) this.noteCatch(devCatch.hooked, devCatch.zone, false, devCatch.perfect); // the dev catch goes through the log like a real one
    sharpenTexts(this); // every Phaser text rasterises at device resolution
    if (saveStatus === 'broken') this.showToast("Your save couldn't be read, starting fresh");

    this.setupProfile(params);
    this.setupDebugPanels(dbg);
    // Let the companions settle in (at night the dog is already dozing when the game opens).
    for (let t = 0; t < 2000; t += 50) {
      tickCompanions(this.companions.state, 50, { fishing: 'idle', night: timeOfDay(this.clock.minute) === 'night' });
    }
    // Opening the game between 00:00 and 05:00 finds them already asleep in the car.
    if (inCarWindow(this.clock.minute)) startInCar(this.companions.state);
    if (params.get('debug') === 'afk') {
      // Dev-only: jump into the grass play and fast-forward to a fetch in progress. &giveback=1 makes every round end with the stick given back.
      if (params.get('giveback') === '1') this.companions.state.giveBackChance = 1;
      startPlayNow(this.companions.state);
      for (let t = 0; t < 1500; t += 50) tickCompanions(this.companions.state, 50, { fishing: 'idle', night: false });
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') this.refreshDate();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', onVisible));

    // A long press on a phone can fire the context menu: keep it off the game.
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.holdOn = null;
      if (this.panel || this.sleepFade) return;
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
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const hold = this.holdOn;
      this.holdOn = null;
      if (this.swallowUp) {
        this.swallowUp = false;
        return;
      }
      // The browser took the touch away (pointercancel / touchcancel): that is not a release, so it casts nothing.
      if (pointer.wasCanceled) {
        this.send({ type: 'cancel' });
        return;
      }
      if (hold && this.state.kind === 'charging') {
        const over = this.holdHit(hold, pointer.worldX, pointer.worldY) ? hold : null;
        if (resolveRelease(this.state.heldMs, hold, over) === 'action') {
          this.send({ type: 'cancel' }); // back to idle: no cast, no bait
          this.actOn(hold);
          return;
        }
      }
      this.send({ type: 'release' });
    });
    // Leaving the canvas: a mouse release as before; a finger that slid off (or was taken away) cancels instead of casting.
    this.input.on('gameout', () => {
      this.holdOn = null;
      this.send({ type: this.input.activePointer.wasTouch ? 'cancel' : 'release' });
    });

    this.updateEerie(0, true); // opening inside the window (or a dev fight) starts with the look already there
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
    // A save loaded between 02:00 and 05:00 without the night kit wakes at 05:00 (no sequence).
    this.clock = loadClock(this.clock, hasNightKit(this.player));
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
    this.player = recordMilestones(p);
    this.persist();
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs;
    this.stateAge += deltaMs;
    const minuteBefore = this.clock.minute;
    this.clock = advanceClock(this.clock, deltaMs);
    this.sinceClockSave += deltaMs;
    this.sinceDateCheck += deltaMs;
    if (this.sinceDateCheck >= DATE_CHECK_MS) this.refreshDate();
    if (this.sinceClockSave >= CLOCK_SAVE_MS) this.persist();
    // A map opened over a waiting line holds the line: no nibble or bite is missed behind the panel.
    const lineHeld = this.panel !== null && this.state.kind === 'waiting';
    if (!lineHeld && !(this.freezeCaught && this.state.kind === 'caught')) this.send({ type: 'tick', dtMs: deltaMs });

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
    this.fightToasts = this.state.kind === 'fighting';
    {
      const n = nextToast(this.pendingToasts, { fighting: this.fightToasts, caught: this.state.kind === 'caught', busy: this.toastAge < TOAST_MS });
      this.pendingToasts = n.pending;
      if (n.show) this.showToast(n.show);
    }
    this.slipNoteAge += deltaMs;
    this.updateEerie(deltaMs);

    this.updateBedtime(deltaMs, minuteBefore);
    this.updateSound(deltaMs);
    this.updateStory(deltaMs);
    this.updateMoments(deltaMs);
    if (this.debugToastInMs !== null && (this.debugToastInMs -= deltaMs) <= 0) {
      this.debugToastInMs = null;
      this.showToast('Quest done! +40 coins, +5 worms');
    }
    if (this.debugBubbleInMs !== null && (this.debugBubbleInMs -= deltaMs) <= 0) {
      this.companions.say(pickLine(RECORD_LINES));
      this.debugBubbleInMs = null;
    }
    this.companions.update(
      deltaMs,
      { fishing: this.state.kind, night: timeOfDay(this.clock.minute) === 'night' },
      this.elapsed,
      this.look2().worldTint,
      steamShows(timeOfDay(this.clock.minute)),
    );
    this.render(deltaMs);
  }

  // ---- Bedtime, naps and the sleep fade (slice 16) ----------------------------------------------

  /** Calm enough for bedtime to start: nothing but an idle or waiting line, no panel or card, no fade. */
  private calmForBed(): boolean {
    return (this.state.kind === 'idle' || this.state.kind === 'waiting') && !this.panel && !this.sleepFade;
  }

  /**
   * 00:00 starts the companions' sequence to the car (waiting out a fight, the show-off or a panel
   * first); they stay there until 05:00. At 01:00 without the kit a warning toast; at 02:00 without
   * the kit the screen fades once they are in the car (just fades if for some reason they are not).
   */
  private updateBedtime(deltaMs: number, minuteBefore: number): void {
    const c = this.companions.state;
    const kit = hasNightKit(this.player);
    const m = this.clock.minute;
    if (crossedCompanionBedtime(minuteBefore, m)) this.bedPending = true;
    if (!kit && crossedWarning(minuteBefore, m)) this.warnPending = true;
    if (!inCarWindow(m)) this.bedPending = false;
    if (!inWarnHour(m) || kit) this.warnPending = false;
    if (c.mode === 'bed') this.bedPending = false;
    const alexSleepy = !kit && inSleepWindow(m);
    if (this.bedPending && c.mode !== 'bed' && !alexSleepy && this.calmForBed()) {
      this.bedPending = false;
      startBedtime(c, pickLine(BEDTIME_LINES));
    }
    // Loaded, bought the kit or woke from a nap inside the night: they simply start in the car.
    if (inCarWindow(m) && c.mode === 'dock' && !this.bedPending) startInCar(c);
    // Everybody is up at 05:00 (with a fade running they climb out as the screen clears instead).
    if (c.mode === 'bed' && c.bed?.kind === 'night' && isInCar(c) && !inCarWindow(m) && !this.sleepFade) wakeUp(c);
    // The warning at 01:00 (once a night; it waits for a calm moment).
    if (this.warnPending && this.calmForBed()) {
      this.warnPending = false;
      this.showWarning();
    }
    // Asleep in the car for a nap, or Alex's own 02:00 without the kit: the screen fades once she has nothing in hand.
    if (!this.sleepFade && this.calmForBed()) {
      if (isInCar(c) && c.bed?.kind === 'nap') this.startSleepFade('nap');
      else if (alexSleepy && (c.mode !== 'bed' || (isInCar(c) && c.bed?.kind === 'night'))) this.startSleepFade('night');
    }
    if (this.sleepFade) this.tickFade(deltaMs);
  }

  private showWarning(): void {
    this.warnText.setText(warningLines(nightKitForSale(this.player)).join('\n'));
    this.warnAge = 0;
  }

  private startSleepFade(kind: 'night' | 'nap'): void {
    // Nothing may be on the line while she sleeps: a waiting line is reeled in quietly.
    if (this.state.kind === 'waiting') {
      this.state = INITIAL_STATE;
      this.stateAge = 0;
    }
    const kit = hasNightKit(this.player);
    const wakeAt = kind === 'nap' && this.napTarget ? napWakeClock(this.clock, this.napTarget.minute, kit) : morningClock(this.clock);
    this.sleepFade = newSleepFade(kind === 'nap' ? 'Nap time...' : 'Time for bed...', kind === 'nap' ? wakeGreeting(wakeAt.minute) : 'Good morning!');
    this.fadeWoke = false;
  }

  private tickFade(deltaMs: number): void {
    const f = this.sleepFade;
    if (!f) return;
    const r = tickSleepFade(f, deltaMs);
    this.sleepFade = r.fade;
    const c = this.companions.state;
    if (r.jump) {
      const kit = hasNightKit(this.player);
      const nap = c.bed?.kind === 'nap' && this.napTarget;
      this.clock = nap ? napWakeClock(this.clock, this.napTarget!.minute, kit) : morningClock(this.clock);
      this.napTarget = null;
      // Alex's 02:00 where they were not in the car yet (the screen is black): they are in it now.
      if (c.mode !== 'bed') startInCar(c);
      // A nap that ends in the night: they stay in the car until 05:00.
      if (c.bed && inCarWindow(this.clock.minute)) {
        c.bed.kind = 'night';
        this.fadeWoke = true;
      }
      this.persist();
    }
    // They climb out while the screen clears.
    if (!this.fadeWoke && r.fade.phase === 'in') {
      this.fadeWoke = true;
      wakeUp(c);
    }
    if (r.done) this.sleepFade = null;
  }

  /** The nap card: only from the dock, with Alex idle. */
  private openNapCard(): void {
    const c = this.companions.state;
    if (this.state.kind !== 'idle' || this.panel || c.mode !== 'dock') return;
    this.swallowUp = false;
    this.panel = showNapCard(
      hasNightKit(this.player),
      (o) => {
        this.napTarget = o;
        startNap(this.companions.state);
      },
      () => (this.panel = null),
      this.clock.minute,
    );
  }

  /** The trophy board's card (slice 23d): only while idle. */
  private openTrophies(): void {
    if (this.state.kind !== 'idle' || this.panel) return;
    this.swallowUp = false;
    sound.play('boof');
    this.panel = showTrophyCard(this.player.trophies, this.player.log, () => (this.panel = null));
  }

  /** Can the road map open right now (fix/board-and-car)? Any companion mode; Alex idle or the bobber waiting. */
  private mapAllowed(): boolean {
    return canOpenMap({ fishing: this.state.kind, panelOpen: !!this.panel, fading: !!this.sleepFade });
  }

  /** The road map (slice 18): from the car at any time `canOpenMap` allows; "Nap in the car..." there opens the nap card when possible. */
  private openMap(): void {
    if (!this.mapAllowed()) return;
    this.swallowUp = false;
    this.panel = showMapPanel(
      {
        nap: () => napAvailable({ fishing: this.state.kind, mode: this.companions.state.mode, asleepInCar: isInCar(this.companions.state) }),
        onNap: () => this.openNapCard(),
        onChecklist: () => this.openChecklist(),
        checklist: { done: checklistDone(this.player), total: bundleTotal },
      },
      () => (this.panel = null),
    );
  }

  /** The Quiet Lake checklist (slice 20), from the map or the notice board. Only while idle. */
  private openChecklist(): void {
    if (!this.mapAllowed()) return;
    this.swallowUp = false;
    this.panel = showChecklistPanel(
      {
        get: () => this.player,
        fotdId: () => this.fotdId(),
        set: (p) => this.setPlayer(p),
        onHandIn: (r, bundle, allFixed) => {
          if (!r.finished) return;
          sound.play('coin');
          const text = r.reward ? checklistRewardText(r.reward) : '';
          this.showToast(text ? `${bundle.name} done! ${text}` : `${bundle.name} done!`);
          if (allFixed) {
            this.panel?.close();
            sound.play('fanfare');
            this.panel = showRoadFixedCard(() => (this.panel = null));
          }
        },
      },
      () => (this.panel = null),
    );
  }

  /** A tap on the car (never casts): asleep inside makes a "Zzz...", otherwise the road map. */
  private tapCar(): void {
    if (!this.mapAllowed()) return;
    this.markHint('car');
    // Asleep inside: a "Zzz..." puffs and the map opens anyway (it is only a panel, the sleep goes on).
    if (isInCar(this.companions.state)) {
      this.spawnZzz(true);
      if (Math.random() < 1 / 3) sound.play('sleepyBoof');
    }
    this.openMap();
  }

  private spawnZzz(big: boolean): void {
    const img = this.add
      .image(CAR_POS.x + CAR_PARTS.window.x + 12, CAR_POS.y + CAR_PARTS.window.y, big ? TEX.zBig : TEX.zSmall)
      .setDepth(Z.angler + 1);
    this.carZs.push({ img, age: 0 });
  }

  /**
   * Lake moments: the gap counts down only while she is idle or the bobber waits (no panel); a
   * fight or the show-off fades a moment on screen out quickly. Which one comes is core/moments.
   */
  private updateMoments(deltaMs: number): void {
    const kind = this.state.kind;
    const calm = (kind === 'idle' || kind === 'waiting') && !this.panel && !this.storyBusy();
    if (kind === 'fighting' || kind === 'caught') {
      this.moments.fadeOut();
      this.story.fadeOut();
    }
    if (this.moments.kind === null) {
      if (this.debugMoment) {
        this.debugMoment.inMs -= deltaMs;
        if (this.debugMoment.inMs <= 0) {
          this.startMoment(this.debugMoment.kind);
          this.debugMoment = null;
        }
      } else {
        const r = tickScheduler(this.momentGap, deltaMs, calm, Math.random);
        this.momentGap = r.scheduler;
        if (r.due) this.startMoment(pickMoment(this.clock.minute, Math.random, this.lastMoment));
      }
    }
    sound.setUncanny(this.moments.uncanny || this.story.uncanny);
  }

  private startMoment(kind: MomentKind): void {
    this.lastMoment = kind;
    this.moments.spawn(kind);
    if (kind === 'duck') sound.play('boof'); // Bestia sees the duck
  }

  /** The bottle's note card (the worms inside are granted at once). Only while idle. */
  private openBottleCard(): void {
    if (this.state.kind !== 'idle' || this.panel) return;
    this.swallowUp = false;
    const r = openBottle(this.player, this.clock.minute, Math.random);
    this.setPlayer(r.player);
    this.panel = showBottleCard(r.contents, () => (this.panel = null));
  }

  // ---- Story chapters (slice 21) ----------------------------------------------------------------

  /** Today's chapter at this place: the dev flag, else the pure date rule (only when the story is on). */
  private dueChapter(): ChapterDef | null {
    if (!this.storyOn) return null;
    return this.storyDev ?? todaysChapter(storyOf(this.player), this.today, QUIET_LAKE.id, this.milestonesAll ? ALL_MILESTONES : storyMilestones(this.player));
  }

  /** A chapter is due or being told: random moments wait. */
  private storyBusy(): boolean {
    return this.storyRun !== null || this.dueChapter() !== null;
  }

  /** The wax seal on the notice board: today's chapter is waiting or out on the water. */
  private storyBadge(): boolean {
    return this.storyBusy();
  }

  /** Pajkel can say something: not in bed (asleep, going to bed, waking). */
  private pajCanSpeak(): boolean {
    return this.companions.state.mode !== 'bed';
  }

  /** Real ms until Pajkel's next rare-fish hint: sooner on a foggy day (the weather Old Mossback needs). */
  private hintGap(): number {
    const g = this.weatherId() === 'fog' ? HINT_GAP_MS.matching : HINT_GAP_MS.normal;
    return g.min + Math.random() * (g.max - g.min);
  }

  private storyCalm(): boolean {
    const c = this.companions.state;
    const calmKind = this.state.kind === 'idle' || this.state.kind === 'waiting';
    return calmKind && !this.panel && !this.sleepFade && !this.bedPending && (c.mode !== 'bed' || isInCar(c)) && this.moments.kind === null && this.story.kind === null;
  }

  private updateStory(deltaMs: number): void {
    // First night visit: the game clock at or after 21:00 while playing (Q4's milestone).
    if (this.player.milestones?.night !== true && isNightVisit(this.clock.minute)) this.setPlayer(withFlag(this.player, 'night'));
    // The Pale One card and Pajkel's queued lines.
    if (this.paleCardPending && this.state.kind === 'idle' && !this.panel && !this.sleepFade) {
      this.paleCardPending = false;
      this.swallowUp = false;
      this.setPlayer({ ...this.player, story: markPaleSeen(storyOf(this.player), this.today) });
      this.panel = showStoryCard(PALE_BEAT.title, PALE_BEAT.lines, () => {
        this.panel = null;
        this.storyLineMs = Math.max(this.storyLineMs, 1000);
      });
    }
    this.storyLineMs = Math.max(0, this.storyLineMs - deltaMs);
    const calmKind = this.state.kind === 'idle' || this.state.kind === 'waiting';
    // Pajkel's weather line, once per real date, a few seconds after the first calm moment (slice 23b).
    const wid = this.weatherId();
    if (wid && this.elapsed > 3500 && calmKind && !this.panel && !this.nameCardOpen && !this.sleepFade && this.companions.state.bubble === null && this.pajCanSpeak() && weatherLineDue(this.player.weatherSeen, this.today)) {
      this.setPlayer({ ...this.player, weatherSeen: this.today });
      this.companions.say(pickLine(WEATHER_LINES[wid]));
      this.storyLineMs = Math.max(this.storyLineMs, 4000);
    }
    // Pajkel hints at Old Mossback now and then while idle (slice 23d), more often on a foggy day; not once it is caught.
    if (this.hintLineMs < 0) this.hintLineMs = this.hintGap();
    this.hintLineMs -= deltaMs;
    if (this.hintLineMs <= 0 && calmKind && !this.panel && !this.nameCardOpen && !this.sleepFade && this.companions.state.bubble === null && this.pajCanSpeak() && this.storyLineMs <= 0) {
      this.hintLineMs = this.hintGap();
      if (!this.player.log.mossback) {
        this.companions.say(pickLine(PAJKEL_HINT_LINES.mossback));
        this.storyLineMs = Math.max(this.storyLineMs, 4000);
      }
    }
    if (this.storyLineMs <= 0 && calmKind && !this.panel && !this.sleepFade && this.companions.state.bubble === null) {
      const next = nextLine(storyOf(this.player), this.pajCanSpeak());
      if (next) {
        this.setPlayer({ ...this.player, story: next.story });
        this.companions.say(next.text);
        this.storyLineMs = STORY_TUNING.lineGapMs.min + Math.random() * (STORY_TUNING.lineGapMs.max - STORY_TUNING.lineGapMs.min);
      }
    }
    // The chapter: first Q3's line before the bottle, then the delivery timer.
    const run = this.storyRun;
    if (run && run.preMs > 0) {
      run.preMs -= deltaMs;
      if (run.preMs <= 0) this.story.start('bottle');
      return;
    }
    if (run || !this.storyOn) return;
    const chapter = this.dueChapter();
    if (!chapter || !this.storyCalm()) return;
    this.storyTimerMs -= deltaMs;
    if (this.storyTimerMs <= 0) this.beginChapter(chapter);
  }

  private beginChapter(chapter: ChapterDef): void {
    const c = this.companions.state;
    this.storyRun = { chapter, night: false, preMs: 0 };
    switch (chapter.kind) {
      case 'bottle': {
        const before = chapter.before ?? [];
        if (before.length > 0 && this.pajCanSpeak()) {
          // He says his line first; the bottle floats in a few seconds later.
          this.companions.say(lineText(before[0]) ?? '');
          this.storyRun.preMs = 3600;
        } else {
          if (before.length > 0) this.setPlayer({ ...this.player, story: queueLines(storyOf(this.player), before) });
          this.story.start('bottle');
        }
        break;
      }
      case 'blink': {
        const night = blinkIsNight(isInCar(c), timeOfDay(this.clock.minute) === 'night');
        this.storyRun.night = night;
        this.story.start(night ? 'blink' : 'bottle');
        break;
      }
      default:
        this.story.start(chapter.kind);
    }
  }

  /** A self-playing picture ended; cut short (a fight) means it is not seen and comes back a bit later. */
  private storyFinished(seen: boolean): void {
    if (!this.storyRun) return;
    if (seen) this.completeChapter();
    else {
      this.storyRun = null;
      this.storyTimerMs = STORY_TUNING.retryMs;
    }
  }

  /** The sealed bottle was tapped: its note card opens and the chapter counts as seen. Only while idle. */
  private openStoryBottle(): void {
    const run = this.storyRun;
    if (!run || this.state.kind !== 'idle' || this.panel) return;
    this.swallowUp = false;
    const text = run.chapter.text ?? '';
    this.story.clear();
    this.completeChapter();
    this.panel = showBottleCard({ noteId: run.chapter.id, text, worms: 0 }, () => {
      this.panel = null;
      this.storyLineMs = Math.max(this.storyLineMs, 1000);
    });
  }

  /** She has seen the chapter: it is saved with today's date and Pajkel's lines are queued. */
  private completeChapter(): void {
    const run = this.storyRun;
    if (!run) return;
    const lines = run.chapter.kind === 'blink' ? blinkLines(run.night) : undefined;
    this.setPlayer({ ...this.player, story: markSeen(storyOf(this.player), run.chapter.id, this.today, lines, run.night) });
    if (this.storyDev?.id === run.chapter.id) this.storyDev = null;
    this.storyRun = null;
    this.storyTimerMs = rollStoryDelay();
    this.storyLineMs = Math.max(this.storyLineMs, 700);
  }

  /** How eerie the lake is right now (pure rule in core/eerie): eases the picture and tells the sound. */
  private updateEerie(deltaMs: number, snap = false): void {
    const s = this.state;
    const fightingLegend = s.kind === 'fighting' && isLegendary(speciesById(s.hooked.speciesId));
    const level = eerieLevel(this.clock.minute, fightingLegend);
    const look = eerieLook(level);
    const k = snap ? 1 : 1 - Math.exp(-deltaMs / EERIE_EASE_MS);
    this.eerieTint += (look.tint - this.eerieTint) * k;
    this.eerieCalm += (Math.max(look.calm, this.story.calm) - this.eerieCalm) * k;
    this.driftT += (deltaMs / 1000) * (1 - 0.9 * this.eerieCalm);
    sound.setEerie(level);
  }

  /** Ambient follows the game clock; the reel clicks while the catch bar is held; the dog barks at fetch. */
  private updateSound(deltaMs: number): void {
    sound.setMinute(this.clock.minute);
    sound.reel(deltaMs, this.state.kind === 'fighting' && this.state.bar.holding);
    const play = this.companions.state;
    const phase = play.mode === 'play' ? play.play.phase : null;
    if (phase !== this.lastPlayPhase && (phase === 'bring' || phase === 'dodge' || phase === 'spin')) sound.play('boof');
    this.lastPlayPhase = phase;
    // Bedtime: Bestia boofs when called, and the car door thunks shut (going in and coming out).
    const bp = play.mode === 'bed' ? (play.bed?.phase ?? null) : null;
    if (bp !== this.lastBedPhase) {
      if (bp === 'call') sound.play('boof');
      if (bp === 'doorShut' || bp === 'exitShut') sound.play('thunk');
    }
    this.lastBedPhase = bp;
  }

  private send(input: FishingInput): void {
    const prev = this.state;
    // Dev flag ?rare=<id>: the cast that lands now bites that trophy, once.
    const forceRare = this.rareDev !== null && input.type === 'landed' && prev.kind === 'casting';
    const { state: next, events } = step(prev, input, forceRare ? { ...this.ctx, speciesOverride: this.rareDev! } : this.ctx);
    if (forceRare) this.rareDev = null;
    this.fightToasts = next.kind === 'fighting';
    // A release that was too short for a cast: say how it works.
    if (prev.kind === 'charging' && next.kind === 'idle' && input.type === 'release') this.showToast('Hold to charge, release to cast');
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
  private noteCatch(hooked: HookedFish, zone: ZoneId, celebrate: boolean, perfect = false): void {
    const r = recordCatch(this.player.log, hooked, perfect);
    const species = speciesById(hooked.speciesId);
    this.catchPerfect = perfect;
    this.catchStar = species ? catchTierFor(species, hooked.lengthCm, perfect) : 'none';
    this.catchFotd = hooked.speciesId === this.fotdId();
    this.catchFits = !slipsAway(hooked.speciesId) && !isTrophy(species) && this.player.bag.length < SHOP.bagSlots && fittingSlots(this.player, toBagFish(hooked, undefined, perfect)).length > 0;
    // The catch also moves today's quests (the game clock gives the time of day, the log the record).
    const q = applyCatchToPlayer({ ...this.player, log: r.log }, {
      speciesId: hooked.speciesId,
      zone,
      timeOfDay: timeOfDay(this.clock.minute),
      isRecord: r.outcome.kind === 'newRecord',
    });
    this.setPlayer(zone === 'deep' ? withFlag(q.player, 'deep') : q.player);
    this.catchOutcome = r.outcome;
    // A rare trophy (slice 23d) goes on the board, not in the bag; its first catch gets the longest show-off and a special cheer.
    let trophyFirst = false;
    this.catchTrophy = 'none';
    if (isTrophy(species)) {
      const t = addTrophy(this.player.trophies, hooked, this.today, perfect);
      if (t.first || t.improved) this.setPlayer({ ...this.player, trophies: t.trophies });
      this.catchTrophy = t.first ? 'first' : t.improved ? 'better' : 'same';
      trophyFirst = t.first;
    }
    const showOffMs = slipsAway(hooked.speciesId) ? PALE_ONE.showOffMs : trophyFirst ? RARE_TUNING.showOffMs : r.outcome.kind === 'newSpecies' ? NEW_SPECIES_SHOW_OFF_MS : undefined;
    this.ctx = { ...this.ctx, showOffMs };
    if (celebrate && r.outcome.kind !== 'normal') companionEvent(this.companions.state, 'fishCaught', true);
    if (trophyFirst) {
      trophyCheer(this.companions.state);
      const line = TROPHY_TEXT.pajkelFirst[hooked.speciesId];
      if (line && this.companions.state.mode !== 'bed') this.companions.say(line);
    }
    // Pajkel praises a record out loud (slice 15a). The dev catch (celebrate = false) speaks too, so ?debug=caught&log=all shows it.
    // Not while he is off to bed or asleep in the car: then the car only puffs a sleepy Zzz.
    const medal = this.catchStar === 'medal';
    const gold = isGoldOrBetter(this.catchStar) && r.outcome.kind === 'normal';
    if ((r.outcome.kind === 'newRecord' || gold || medal) && !trophyFirst) {
      const c = this.companions.state;
      if (c.mode !== 'bed') this.companions.say(pickLine(medal ? MEDAL_LINES : gold ? GOLD_LINES : RECORD_LINES));
      else if (isInCar(c)) this.spawnZzz(true);
    }
  }

  /** The player's side of a game event: bait use. */
  private applyToPlayer(e: GameEvent): void {
    const before = chosenBait(this.player);
    const r = applyEvent(this.player, e, this.ctx.rng);
    this.setPlayer(r.state);
    if (r.baitUsed) {
      // The "-1" cue floats up from the bait chip (the one bait counter, slice 22c).
      this.wormCueAge = 0;
      this.wormCue.setText(`-1 ${baitById(r.baitUsed)?.name.toLowerCase() ?? 'worm'}`);
      const after = chosenBait(r.state);
      if (after !== before && baitCount(r.state, before) <= 0) {
        const name = (id: string) => baitById(id)?.name.toLowerCase() ?? 'worms';
        this.showToast(after === WORM_ID && r.state.worms <= 0 ? `Out of ${name(before)}` : `Out of ${name(before)}, using ${name(after)}`);
      }
    }
  }

  /** Keeps the session's rod and catch-bar gear in step with the equipped rod, line and reel. */
  private syncRod(): void {
    this.ctx = { ...this.ctx, rod: equippedRod(this.player), barGear: effectiveBarGear(this.player) };
  }

  private stowCatch(hooked: HookedFish): void {
    // A legendary is a trophy: no bag slot (so the bag-full card never shows), no coins. It was logged already.
    if (slipsAway(hooked.speciesId)) {
      this.slipNoteAge = 0;
      if (paleBeatDue(storyOf(this.player))) this.paleCardPending = true;
      return;
    }
    // A trophy goes straight to the board (it was put there when it was caught): no bag slot, no coins.
    if (isTrophy(speciesById(hooked.speciesId))) {
      if (this.catchTrophy === 'better') this.showToast('A bigger one for the board!');
      else if (this.catchTrophy === 'same') this.showToast(TROPHY_TEXT.backInLake);
      return;
    }
    const r = addCatch(this.player, hooked, this.fotdId(), this.catchPerfect);
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

  private openPlayerPanel(kind: 'bag' | 'shop' | 'log' | 'bait' | 'settings', startWith?: string): void {
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
      kind === 'bag' ? openBagPanel(store, onClose, () => { this.panel?.close(); this.openPlayerPanel('shop'); })
      : kind === 'shop' ? openShopPanel(store, onClose)
      : kind === 'bait' ? openBaitPicker(store, onClose)
      : kind === 'settings' ? openSettingsPanel(this.settingsStore(), onClose)
      : openLogPanel(() => this.player.log, onClose, startWith);
  }

  /** What the settings panel may ask of the scene. */
  private settingsStore() {
    return {
      exportCode: () => encodeSaveCode(this.currentSave(), this.profile),
      applyImport: (save: SaveData, profile: Profile) => this.loadGame(save, profile),
      startOver: () => this.startNewGame(),
      profile: () => this.profile,
      saveNames: (p: Profile) => this.applyProfile(p),
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
    this.syncQuestsNow();
    this.seenDone = doneCount(questsOf(this.player));
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
    this.syncQuestsNow();
    this.seenDone = doneCount(questsOf(this.player));
    this.showToast('A fresh start');
  }

  /** A press while out of worms: the soft-lock guard may help, otherwise point to the shop. */
  private blockedCast(): void {
    const guard = freeWormsIfStuck(this.player);
    if (guard.granted) {
      this.setPlayer(guard.state);
      this.showToast('The bait shop owner slips you a few worms');
    } else {
      this.showToast(totalBait(this.player) > 0 ? 'Out of worms, choose another bait' : 'Out of worms, visit the shop');
    }
  }

  /** Dev-only: ?debug=log|shop|bag|bagfull open the panels with a filled bag (screenshots). */
  private setupDebugPanels(dbg: string): void {
    if (dbg === 'sounds') {
      this.panel = openSoundBoard(this.clock.minute, () => (this.panel = null));
      return;
    }
    if (dbg === 'box') {
      this.openBaitBox();
      return;
    }
    if (dbg === 'nap') {
      this.openNapCard();
      return;
    }
    if (dbg === 'map') {
      this.openMap();
      return;
    }
    if (dbg === 'checklist') {
      const mk = (id: string, share: number): BagFish => {
        const sp = SPECIES.find((x) => x.id === id)!;
        const lengthCm = Math.round(sp.lengthCm[0] + (sp.lengthCm[1] - sp.lengthCm[0]) * share);
        return toBagFish({ speciesId: id, lengthCm, weightG: Math.round(sp.bodyFactor * lengthCm ** 3) });
      };
      const bag = [mk('roach', 0.3), mk('bleak', 0.2), mk('crucian', 0.4), mk('carp', 0.95), mk('perch', 0.95), mk('eel', 0.4)];
      const base = this.player.coins < 600 ? { ...this.player, coins: 600 } : this.player;
      const next = { ...base, bag };
      this.setPlayer(next);
      this.openChecklist();
      return;
    }
    if (dbg === 'quests') {
      this.openQuests(new URLSearchParams(window.location.search).get('tab') === 'story' ? 'story' : 'quests');
      return;
    }
    if (dbg === 'baits') {
      this.openPlayerPanel('bait');
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
    const count = Number(pageParams().get('bagn') ?? (dbg === 'bag' ? 7 : dbg === 'shop' ? 5 : SHOP.bagSlots));
    // ?perfect=1: every second fish in the dev bag was caught perfectly (silver / gold / medal pictures in the rows).
    const perfectBag = pageParams().get('perfect') === '1';
    this.setPlayer({ ...this.player, bag: ids.slice(0, count).map((id, i) => ({ ...mid(id, 0.2 + ((i * 37) % 70) / 100), ...(perfectBag && i % 2 === 1 ? { perfect: true as const } : {}) })) });
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
        this.noteCatch({ speciesId: e.speciesId, lengthCm: e.lengthCm, weightG: e.weightG }, e.zone, true, e.perfect === true);
        sound.play(this.catchOutcome.kind === 'normal' && !isGoldOrBetter(this.catchStar) && !this.catchPerfect && !slipsAway(e.speciesId) ? 'catch' : 'fanfare');
        break;
      case 'fishLost':
        this.showToast(e.slipped ? 'It slipped the hook!' : 'It got away…');
        vibrate(HAPTICS.escaped);
        sound.play('slack');
        break;
      case 'cast':
        this.setPlayer({ ...this.player, seen: markCast(this.player.seen) });
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

  private refreshDate(): void {
    this.sinceDateCheck = 0;
    const before = this.weatherId();
    this.today = todayLocal();
    if (this.weatherId() !== before) this.lastSkyKey = -1;
    this.syncQuestsNow();
  }

  /** Makes the stored quests today's: a new day pays what was finished and rolls three new ones. */
  private syncQuestsNow(): void {
    const r = syncQuests(this.player, this.today);
    if (!r.rolled) return;
    this.setPlayer(r.player);
    this.seenDone = doneCount(questsOf(this.player));
    if (r.paid) {
      const bait = Object.values(r.paid.baits).reduce((a, b) => a + b, 0);
      this.showToast(`Yesterday's quests paid: +${r.paid.coins} coins, +${r.paid.worms} worms${bait > 0 ? `, +${bait} bait` : ''}`);
    }
    this.questPanel?.refresh();
  }

  /** Today's weather (slice 23b): the dev flag, else the pure pick from the date. */
  private weatherId(): WeatherId | undefined {
    return this.weatherOverride ?? weatherOfTheDay(this.today);
  }

  /** What today's weather does to the bites right now (the fog rule knows the clock). */
  private weatherNow(): WeatherEffects | undefined {
    const id = this.weatherId();
    return id ? weatherEffects(id, this.clock.minute) : undefined;
  }

  /** The day look with today's weather on it (overcast and rain go grey). */
  private look2(): DayLook {
    const id = this.weatherId();
    return id ? weatherLook(dayLook(this.clock.minute), WEATHER_LOOK.grey[id]) : dayLook(this.clock.minute);
  }

  /** Today's fish (slice 19): the dev flag, else the pure pick from the date and her gear. */
  private fotdId(): string | undefined {
    return this.fotdOverride ?? fishOfTheDay(this.today, this.player)?.id;
  }

  /** The quest panel from the notice-board button. Only while idle. */
  private openQuests(startTab?: NoticeTab): void {
    if (this.state.kind !== 'idle' || this.panel) return;
    this.swallowUp = false;
    const handle = showQuestPanel(
      {
        get: () => this.player,
        set: (p) => this.setPlayer(p),
        today: () => this.today,
        fotdId: () => this.fotdId(),
        openChecklist: () => this.openChecklist(),
        checklist: () => ({ done: checklistDone(this.player), total: bundleTotal }),
        roadFixed: () => this.roadFixed(),
        names: () => ({ alex: this.profile.player, paj: this.profile.companion }),
      },
      () => {
        this.panel = null;
        this.questPanel = null;
      },
      startTab,
    );
    this.panel = handle;
    this.questPanel = handle;
  }

  /** The Quiet Lake checklist is done: the road is fixed (the last journal page). */
  private roadFixed(): boolean {
    return this.journalAll || checklistDone(this.player) >= bundleTotal;
  }

  private crateVisible(): boolean {
    return boxAvailable(dailyOf(this.player), this.today);
  }

  /** The crate card: offers the box; taking it grants the contents and saves. Only while idle. */
  private openBaitBox(): void {
    if (this.state.kind !== 'idle' || this.panel || !this.crateVisible()) return;
    this.swallowUp = false;
    this.markHint('crate');
    const tier = tierFor(dailyOf(this.player), this.today);
    this.panel = showBaitBoxCard(
      tier,
      () => {
        const r = openBox(this.player, this.today, Math.random);
        if (r.contents && pageParams().get('boxbait') === 'glow') {
          // Dev-only: ?boxbait=glow forces 2 glow bait into the box (to see the card).
          const forced = { ...r.contents, baits: { ...r.contents.baits, glow: 2 } };
          this.setPlayer(addBait(r.player, 'glow', 2));
          return forced;
        }
        if (r.contents) this.setPlayer(r.player);
        return r.contents;
      },
      () => (this.panel = null),
    );
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
    // The notice-board button (top right), a second way in beside the sign: opens at once, only while idle.
    if (BOARD_BTN.contains(x, y)) {
      if (this.state.kind === 'idle') this.openQuests();
      return true;
    }
    // The car, the crate, the sign and Pajkel's empty chair: tap = open, hold = cast (see objectTouched).
    if (this.holdHit('car', x, y)) return this.objectTouched('car');
    if (this.holdHit('crate', x, y)) return this.objectTouched('crate');
    if (this.holdHit('board', x, y)) return this.objectTouched('board');
    // A moment on the lake: a tap on it never starts a cast. The bottle opens a card, so only while idle.
    const momentOk = (this.state.kind === 'idle' || this.state.kind === 'waiting') && !this.panel;
    if (momentOk && this.story.tap(x, y, this.state.kind === 'idle')) return true;
    if (momentOk && this.moments.tap(x, y, this.state.kind === 'idle')) return true;
    // The notice-board sign: a tap never casts while idle or waiting; it acts only while idle. It wins over petting
    // Bestia (or tagging Pajkel) inside its box, so it is checked before them.
    if (this.holdHit('sign', x, y)) return this.objectTouched('sign');
    const dog = this.companions.dogRect();
    if (dogVisible(this.companions.state) && this.companions.state.mode !== 'bed' && dog.contains(x, y)) {
      this.markHint('dog');
      this.companions.pet();
      sound.play('boof');
      this.showTag(2, this.profile.dog, dog.centerX, dog.y - 14);
      this.showToast(`${this.profile.dog} wags happily`);
      return true;
    }
    const paj = this.companions.pajRect();
    if (pajVisible(this.companions.state) && this.companions.state.mode !== 'bed' && paj.contains(x, y)) {
      this.showTag(1, this.profile.companion, paj.centerX, paj.y - 2);
      return true;
    }
    // His empty chair (with the thermos) while he is away or asleep in the car: a tap never casts.
    if (this.holdHit('chair', x, y)) return this.objectTouched('chair');
    return false;
  }

  /** Does this point hit the shore object, and can it be touched in the current state? */
  private holdHit(obj: ShoreObject, x: number, y: number): boolean {
    const k = this.state.kind;
    // Charging counts too, so a release can tell the finger is still on the object it pressed.
    const on = k === 'idle' || k === 'waiting' || k === 'charging';
    switch (obj) {
      case 'car':
        return CAR_HIT.contains(x, y);
      case 'crate':
        return (k === 'idle' || k === 'charging') && this.crateVisible() && CRATE_HIT.contains(x, y);
      case 'sign':
        return on && SIGN_HIT.contains(x, y);
      case 'chair':
        return on && chairEmpty(this.companions.state) && this.companions.chairRect().contains(x, y);
      case 'board':
        return on && this.trophyKey !== '' && TROPHY_HIT.contains(x, y);
    }
  }

  /**
   * A press landed on a shore object. While she can cast from idle, the press starts the charge as usual and the
   * object waits for the release (short tap there = its action, a hold = a cast). Otherwise it acts at once.
   */
  private objectTouched(obj: ShoreObject): boolean {
    if (this.state.kind === 'idle' && !this.panel && canCast(this.player)) {
      this.holdOn = obj;
      return false;
    }
    this.actOn(obj);
    return true;
  }

  private actOn(obj: ShoreObject): void {
    switch (obj) {
      case 'car':
        this.tapCar();
        break;
      case 'crate':
        this.openBaitBox();
        break;
      case 'sign':
        this.tapSign();
        break;
      case 'board':
        this.openTrophies();
        break;
      case 'chair': {
        const r = this.companions.chairRect();
        this.showTag(1, `${this.profile.companion}'s chair`, r.centerX, r.y - 2);
        break;
      }
    }
  }

  /** A first tap on a shore thing stops its glint (saved). */
  private markHint(id: Glint): void {
    if (isSeen(this.player.seen, id)) return;
    this.setPlayer({ ...this.player, seen: markHintSeen(this.player.seen, id) });
  }

  /** The sign: the sealed bottle when it floats, else today's waiting chapter (the same start as the delivery), else the quests. */
  private tapSign(): void {
    if (this.state.kind !== 'idle' || this.panel) return;
    this.markHint('sign');
    const chapter = this.dueChapter();
    const action = signAction({
      bottleOnWater: this.storyRun !== null && this.story.kind === 'bottle',
      chapterWaiting: chapter !== null && this.storyRun === null,
      calm: this.storyCalm(),
    });
    if (action === 'bottle') this.openStoryBottle();
    else if (action === 'chapter' && chapter) this.beginChapter(chapter);
    else this.openQuests();
  }

  /** First launch: ask for names; otherwise use the stored ones. ?reset=profile clears them. */
  private setupProfile(params: URLSearchParams): void {
    const store = this.safeStorage();
    if (params.get('reset') === 'profile') clearProfile(store);
    const stored = loadProfile(store);
    if (stored) this.profile = stored;
    // Dev-only: ?skipnames (or any ?debug=) skips the first-launch card.
    const skip = params.has('skipnames') || params.has('debug') || params.has('story');
    if (!stored && !skip) {
      this.nameCardOpen = true;
      showNameOverlay(DEFAULT_PROFILE, true, (p) => {
        this.nameCardOpen = false;
        this.applyProfile(p, true);
      });
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
    // During the fight the toast would cover the catch bar: it waits (and is shown after the fight and the show-off).
    if (this.fightToasts) {
      this.pendingToasts = enqueueToast(this.pendingToasts, text);
      return;
    }
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
    this.eerieFx = this.add.graphics().setDepth(Z.waterFx + 0.5);
    // Weather (slice 23b): fog over the water and far shore, and the rain over the whole scene (under the UI).
    this.fogFx = this.add.graphics().setDepth(Z.waterDecor + 0.5);
    this.weatherFxG = this.add.graphics().setDepth(Z.fireflies + 0.5);

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
    // The car's shadow and picture, the lantern and its glow, the fade.
    this.carFx = this.add.graphics().setDepth(Z.postFx - 0.2);
    this.carImg = this.add.image(CAR_POS.x, CAR_POS.y, carKey('closed')).setOrigin(0, 0).setDepth(Z.postFx);
    this.worldImgs.push(this.carImg);
    this.lanternImg = this.add.image(LANTERN_FEET.x, LANTERN_FEET.y, lanternKey(false)).setOrigin(0.5, 1).setDepth(Z.angler - 0.1).setVisible(false);
    this.lanternFx = this.add.graphics().setDepth(Z.angler + 0.4);
    this.crateImg = this.add.image(CRATE_FEET.x, CRATE_FEET.y, TEX.crate).setOrigin(0.5, 1).setDepth(Z.angler - 0.2);
    this.worldImgs.push(this.crateImg);
    this.crateFx = this.add.graphics().setDepth(Z.angler - 0.1);
    this.signImg = this.add.image(SIGN_FEET.x, SIGN_FEET.y, ensureSignTexture(this, this.signLook())).setOrigin(0.5, 1).setDepth(Z.angler - 0.2);
    this.worldImgs.push(this.signImg);
    this.trophyImg = this.add.image(TROPHY_FEET.x, TROPHY_FEET.y, ensureTrophyBoardTexture(this, [])).setOrigin(0.5, 1).setDepth(Z.angler - 0.2).setVisible(false);
    this.worldImgs.push(this.trophyImg);
    this.glintFx = this.add.graphics().setDepth(Z.angler + 0.45);
    // The camp (slice 23e): ground things sort by their feet's y, a hair behind the other shore things (Z.angler - 0.3 .. -0.2).
    const campDepth = (feetY: number) => Z.angler - 0.3 + feetY / 10000;
    this.campTent = this.add.image(TENT_FEET.x - TENT_SIZE.w / 2, TENT_FEET.y - TENT_SIZE.h, TEX.campTent).setOrigin(0, 0).setDepth(campDepth(TENT_FEET.y)).setVisible(false);
    this.campPole = this.add.image(LIGHT_POLE.x, LIGHT_POLE.y, TEX.campPole).setOrigin(0, 0).setDepth(campDepth(LIGHT_POLE.y + POLE_SIZE.h)).setVisible(false);
    this.campPole2 = this.add.image(TENT_FEET.x - TENT_SIZE.w / 2 + TENT_ANCHOR.x - POLE_ANCHOR.x, TENT_FEET.y - TENT_SIZE.h + TENT_ANCHOR.y - POLE_ANCHOR.y, TEX.campPole).setOrigin(0, 0).setDepth(campDepth(TENT_FEET.y - TENT_SIZE.h + POLE_SIZE.h)).setVisible(false);
    this.campBed = this.add.image(BED_POS.x, BED_POS.y, TEX.campBed).setOrigin(0, 0).setDepth(campDepth(BED_POS.y + BED_SIZE.h)).setVisible(false);
    this.campSock = this.add.image(SOCK_FEET.x, SOCK_FEET.y, windsockKey(0, 0)).setOrigin(SOCK_ORIGIN_X, 1).setFlipX(true).setDepth(campDepth(SOCK_FEET.y)).setVisible(false);
    this.worldImgs.push(this.campTent, this.campPole, this.campPole2, this.campBed, this.campSock);
    this.campFire = this.add.image(FIRE_FEET.x, FIRE_FEET.y, campfireKey(0)).setOrigin(0.5, 1).setDepth(campDepth(FIRE_FEET.y)).setVisible(false);
    this.campFx = this.add.graphics().setDepth(Z.angler - 0.15);

    this.action = this.add.graphics().setDepth(Z.action);
    this.bobberImg = this.add.image(0, 0, TEX.bobber).setDepth(Z.bobber).setVisible(false);
    this.fireflies = this.add.graphics().setDepth(Z.fireflies);
    this.catchBar = new CatchBarView(this);
    this.moments = new MomentsView(
      this,
      {
        sfx: (name) => sound.play(name),
        claimStar: () => {
          const r = claimStar(this.player, Math.random);
          this.setPlayer(r.player);
          return r.coins;
        },
        openBottle: () => this.openBottleCard(),
      },
      Math.random,
    );

    this.story = new StoryView(this, {
      sfx: (name) => sound.play(name),
      tapBottle: () => this.openStoryBottle(),
      finished: (seen) => this.storyFinished(seen),
    });

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
    // The clock: a 9 x 9 sun, half sun or moon sits in the left padding. Coins stay under it in their own frame.
    this.clockLabel = this.add.text(8, 8, '', { ...textStyle, padding: { ...textPad(9, 5), left: 9 + 9 * CLOCK_ICON_SCALE + 5, right: 9 + 9 * CLOCK_ICON_SCALE + 5 } }).setDepth(Z.uiText);
    this.clockIcon = this.add.image(0, 0, TEX.clockSun).setOrigin(0, 0).setScale(CLOCK_ICON_SCALE).setDepth(Z.uiText);
    this.weatherIcon = this.add.image(0, 0, weatherKey('sunny')).setOrigin(0, 0).setScale(CLOCK_ICON_SCALE).setDepth(Z.uiText);
    const statStyle = { ...textStyle, padding: { ...textPad(8, 4), left: 27 } };
    this.coinLabel = this.add.text(8, 40, '', statStyle).setDepth(Z.uiText);
    this.coinIcon = this.add.image(0, 0, TEX.coin).setOrigin(0, 0).setDepth(Z.uiText);
    this.wormCue = this.add
      .text(0, 0, '-1 worm', { fontFamily: FONT, fontSize: `${FS.body}px`, color: '#ffb0a0', stroke: '#241a2e', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.bottomBar = new BottomBar(this, Z.uiText);
    this.boardImg = this.add.image(BOARD_BTN.centerX, BOARD_BTN.centerY, TEX.board).setScale(2).setDepth(Z.uiText);
    this.questCue = this.add
      .text(W / 2, 150, 'Quest done!', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: '#ffd35a', stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.fadeGfx = this.add.graphics().setDepth(Z.uiText + 20);
    this.fadeText = this.add
      .text(W / 2, 640 / 2, '', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: TEXT, align: 'center', padding: textPad(9, 5) })
      .setOrigin(0.5)
      .setDepth(Z.uiText + 21)
      .setVisible(false);
    this.devTag = this.add
      .text(BOARD_BTN.x - 6, 8, 'DEV · not saving', { fontFamily: FONT, fontSize: `${FS.tiny}px`, color: ALERT, padding: textPad(5, 3, FS.tiny) })
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
      .text(W / 2, CATCH_TITLE_Y, 'Caught!', { fontFamily: FONT, fontSize: `${FS.heading}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtSub = this.add
      .text(W / 2, CATCH_SUB_Y, '', { fontFamily: FONT, fontSize: `${FS.body}px`, color: TEXT, stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtBadge = this.add
      .text(W / 2, CATCH_BADGE_Y, '', { fontFamily: FONT, fontSize: `${FS.body}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 4 })
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
    // Size stars sit right of the length line on a dark backing; the fish-of-the-day line tops the text stack (slice 19);
    // "Fits the checklist!" is a small wood tag at the bottom of the stack (slice 22b).
    this.caughtFitsBack = this.add.graphics().setDepth(Z.uiText).setVisible(false);
    this.caughtFits = this.add
      .text(W / 2, 0, 'Fits the checklist!', { fontFamily: FONT, fontSize: `${FS.small}px`, color: '#f3e3bf', padding: textPad(0, 0, FS.small) })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtStarsBack = this.add.graphics().setDepth(Z.uiText).setVisible(false);
    this.caughtStars = this.add.image(0, CATCH_SUB_Y, starKey('bronze')).setOrigin(0, 0.5).setScale(2).setDepth(Z.uiText).setVisible(false);
    this.caughtPerfect = this.add
      .text(W / 2, CATCH_FOTD_Y, 'Perfect catch! +1 star', { fontFamily: FONT, fontSize: `${FS.body}px`, color: ALERT, stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.caughtFotd = this.add
      .text(W / 2, CATCH_FOTD_Y, 'Fish of the day! x2', { fontFamily: FONT, fontSize: `${FS.body}px`, color: FOTD_TEXT, stroke: '#241a2e', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(Z.uiText)
      .setVisible(false);
    this.hint = this.add.text(W / 2, BAR_TOP - 18, '', { ...textStyle, ...pad }).setOrigin(0.5).setDepth(Z.uiText);
    // The 01:00 bedtime warning: a gentle toast just above the hint line.
    this.warnText = this.add
      .text(W / 2, BAR_TOP - 44, '', { ...textStyle, ...pad, align: 'center', wordWrap: { width: W - 40 } })
      .setOrigin(0.5, 1)
      .setDepth(Z.uiText)
      .setVisible(false);
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
    const look = this.look2();
    this.applyLook(look);
    this.drawWaterFx(look);
    this.drawEerie();
    this.drawWeather(look);
    this.drawPosts(look);
    this.drawFireflies(look);
    this.moments.update(_deltaMs, look.worldTint);
    this.story.update(_deltaMs, look.worldTint);

    // Angler: 2-frame breathing, and the head turns when she glances around.
    const breath = (Math.floor(this.elapsed / 900) % 2) as 0 | 1;
    const showingOff = this.state.kind === 'caught';
    this.alexImg.setTexture(showingOff ? alexShowOffKey(breath) : alexKey(this.lookOverride ?? this.look.dir, breath));
    this.showOffFish.setVisible(showingOff);
    this.showOffHands.setVisible(showingOff);
    if (this.state.kind === 'caught') {
      const { speciesId, lengthCm } = this.state.hooked;
      if (isHugged(speciesId)) {
        // Too big for the chest: she hugs its head end (the sprite turned head-up) and the tail drags down onto the dock.
        this.showOffFish.setTexture(fishHugKey(speciesId));
        const fw = this.showOffFish.width;
        this.showOffFish.setPosition(ALEX_POS.x + SHOW_OFF_FISH_ANCHOR.x - Math.floor(fw / 2) + HUG_DX, ALEX_POS.y + HUG_HEAD_Y);
      } else {
        this.showOffFish.setTexture(fishKey(speciesId, fishSizeClass(speciesId, lengthCm)));
        // Held level at chest height at its real size: whole pixels, centred on the anchor.
        const fw = this.showOffFish.width;
        const fh = this.showOffFish.height;
        this.showOffFish.setPosition(
          ALEX_POS.x + SHOW_OFF_FISH_ANCHOR.x - Math.floor(fw / 2),
          ALEX_POS.y + SHOW_OFF_FISH_ANCHOR.y - Math.floor(fh / 2),
        );
      }
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
    if (s.kind === 'fighting') this.catchBar.update(s.bar, this.ctx.barGear, lerpColor(0xffffff, look.worldTint, 0.35), s.hooked.speciesId, s.fish.slipAfterMs);
    else this.catchBar.hide();
    const pop = Math.min(1, 0.45 + this.stateAge / 160);
    const popScale = pop + 0.18 * Math.exp(-this.stateAge / 140) * Math.sin(this.stateAge / 40);
    this.caughtText.setVisible(s.kind === 'caught').setScale(popScale);
    this.caughtSub.setVisible(s.kind === 'caught').setScale(popScale);
    if (s.kind === 'caught') {
      this.caughtText.setText(speciesById(s.hooked.speciesId)?.name ?? 'Caught!');
      this.caughtSub.setText(formatCatchSize(s.hooked.lengthCm, s.hooked.weightG));
      const o = this.catchOutcome;
      const badge = o.kind === 'newSpecies' ? 'New species!' : o.kind === 'newRecord' ? '★ New record!' : '';
      this.caughtBadge.setText(isGoldOrBetter(this.catchStar) ? (badge ? `${badge} Gold!` : 'Gold!') : badge);
      this.caughtNote.setText(
        this.catchTrophy === 'first' ? TROPHY_TEXT.firstLine : o.kind === 'newSpecies' ? (speciesById(s.hooked.speciesId)?.fact ?? '') : o.kind === 'newRecord' ? `was ${o.previousCm} cm` : '',
      );
    }
    if (s.kind === 'caught') {
      // A long fact (up to 3 lines at VT323 25 px) would run into Alex's head: lift the whole text stack so the
      // fact ends CATCH_TEXT_LIMIT, the stack's bottom limit (her head top).
      const noteBottom = CATCH_NOTE_Y + this.caughtNote.height;
      // The checklist tag hangs right under the size and star line; the record and the fact move down to make room.
      const tag = this.catchFits ? CATCH_FITS_GAP : 0;
      const fitsY = CATCH_SUB_Y + 28;
      const bottom = noteBottom + tag;
      const bubbleText = this.companions.state.bubble?.text ?? '';
      const limit = Math.min(CATCH_TEXT_LIMIT, CATCH_BUBBLE_TOP - (bubbleText.length > 24 ? 31 : 0));
      const lift = this.caughtNote.text || this.catchFits ? Math.min(0, limit - bottom) : 0;
      this.caughtText.setY(CATCH_TITLE_Y + lift);
      this.caughtSub.setY(CATCH_SUB_Y + lift);
      this.caughtBadge.setY(CATCH_BADGE_Y + tag + lift);
      this.caughtNote.setY(CATCH_NOTE_Y + tag + lift);
      this.caughtFotd.setY(CATCH_FOTD_Y + lift);
      this.caughtPerfect.setY(CATCH_FOTD_Y - (this.catchFotd ? CATCH_PERFECT_GAP : 0) + lift);
      this.caughtFits.setY(fitsY + lift);
      this.caughtFitsBack.clear();
      if (this.catchFits) {
        const w = Math.round(this.caughtFits.width) + 14;
        this.caughtFitsBack.fillStyle(0x241a2e, 1).fillRect(W / 2 - w / 2 - 2, fitsY + lift - 12, w + 4, 24);
        this.caughtFitsBack.fillStyle(0x5c3a22, 1).fillRect(W / 2 - w / 2, fitsY + lift - 10, w, 20);
        this.caughtFitsBack.fillStyle(0xcb9c5a, 1).fillRect(W / 2 - w / 2, fitsY + lift - 10, w, 2);
      }
      // The stars sit just right of the length line, popping with it.
      if (this.catchStar !== 'none') {
        this.caughtStars.setTexture(starKey(this.catchStar)).setScale(2 * popScale);
        this.caughtStars.setPosition(W / 2 + (this.caughtSub.displayWidth / 2) + 6, CATCH_SUB_Y + lift);
        // A dark backing so the stars stay readable on bright midday water.
        const sb = this.caughtStars;
        this.caughtStarsBack.clear().fillStyle(0x241a2e, 0.75).fillRect(sb.x - 3, sb.y - sb.displayHeight / 2 - 2, sb.displayWidth + 6, sb.displayHeight + 4);
      }
    }
    this.caughtStars.setVisible(s.kind === 'caught' && this.catchStar !== 'none');
    this.caughtFotd.setVisible(s.kind === 'caught' && this.catchFotd).setScale(popScale);
    // "Perfect catch! +1 star" sits above the fish-of-the-day line when both show (slice 23f).
    this.caughtPerfect
      .setText(this.catchStar === 'medal' ? 'Perfect catch! Medal!' : this.catchStar === 'none' ? 'Perfect catch!' : 'Perfect catch! +1 star')
      .setVisible(s.kind === 'caught' && this.catchPerfect)
      .setScale(popScale);
    this.caughtFits.setVisible(s.kind === 'caught' && this.catchFits).setScale(popScale);
    this.caughtFitsBack.setVisible(s.kind === 'caught' && this.catchFits);
    this.caughtStarsBack.setVisible(s.kind === 'caught' && this.catchStar !== 'none');
    this.caughtBadge.setVisible(s.kind === 'caught' && this.caughtBadge.text !== '').setScale(popScale);
    this.caughtNote.setVisible(s.kind === 'caught' && this.catchOutcome.kind !== 'normal');

    this.drawCrate();
    this.drawSign();
    this.drawTrophyBoard();
    this.drawCar(look, _deltaMs);
    this.drawLantern(look);
    this.drawCamp(look, _deltaMs);
    this.drawFade();

    // Labels.
    this.clockLabel.setText(`Day ${this.clock.day} · ${formatClock(this.clock.minute)}`);
    const tod = timeOfDay(this.clock.minute);
    const wid = this.weatherId();
    this.weatherIcon.setVisible(!!wid);
    if (wid) this.weatherIcon.setTexture(weatherKey(wid));
    this.clockIcon.setTexture(tod === 'day' ? TEX.clockSun : tod === 'night' ? TEX.clockMoon : TEX.clockHalf);
    if (s.kind === 'waiting') {
      const zone = this.ctx.location.zones.find((z) => z.id === s.zone)!;
      this.zoneLabel.setText(`${zone.name} · ${s.distanceM.toFixed(1)} m`).setVisible(true);
    } else if (s.kind === 'idle' || s.kind === 'caught' || s.kind === 'fighting') {
      this.zoneLabel.setVisible(false);
    }
    this.coinLabel.setText(String(this.player.coins));
    // "Quest done!": shown once back at idle with no panel open, after the fight and show-off.
    const doneNow = doneCount(questsOf(this.player));
    if (s.kind === 'idle' && !this.panel) {
      if (doneNow > this.seenDone) this.questCueAge = 0;
      this.seenDone = doneNow;
    }
    this.questCueAge += _deltaMs;
    this.questCue
      .setVisible(this.questCueAge < QUEST_CUE_MS)
      .setAlpha(Math.min(1, (QUEST_CUE_MS - this.questCueAge) / 500))
      .setY(150 - this.questCueAge / 80);
    this.wormCueAge += _deltaMs;
    this.wormCue
      .setVisible(this.wormCueAge < 1200)
      .setAlpha(Math.min(1, (1200 - this.wormCueAge) / 400))
      .setPosition(baitChipRect().centerX, baitChipRect().y - 16 - this.wormCueAge / 100);
    this.toast.setVisible(this.toastAge < TOAST_MS).setAlpha(Math.min(1, (TOAST_MS - this.toastAge) / 300));
    this.warnAge += _deltaMs;
    this.warnText.setVisible(this.warnAge < WARN_MS).setAlpha(Math.min(1, (WARN_MS - this.warnAge) / 400));
    this.updateTip(_deltaMs);
    this.hint.setText(
      s.kind === 'idle' ? this.tipText()
      : s.kind === 'charging' ? 'Release to cast!'
      : s.kind === 'waiting' ? 'Wait for the bobber to go under…'
      : s.kind === 'bite' ? 'TAP NOW!'
      : s.kind === 'fighting' ? 'Hold to raise the bar'
      : s.kind === 'caught' ? (slipsAway(s.hooked.speciesId) ? 'Tap to let it go' : 'Tap to continue')
      : '',
    );
    if (s.kind === 'idle' && this.slipNoteAge < SLIP_NOTE_MS) this.hint.setText(SLIP_NOTE);
    this.hint.setColor(s.kind === 'bite' ? ALERT : TEXT);
    this.drawPanels();
  }

  /**
   * The idle hint (slice 22c): one line by priority (core/tips), none when nothing applies. Lines 3 and later
   * show for about 6 s once per occasion (an occasion ends when the line stops applying or another one wins).
   * Out of idle the state is left alone, so a fight does not use up a line.
   */
  private updateTip(deltaMs: number): void {
    if (this.state.kind !== 'idle') return;
    const next = pickTip({
      canCast: canCast(this.player),
      baitTotal: totalBait(this.player),
      seen: this.player.seen,
      bagFull: this.player.bag.length >= SHOP.bagSlots,
      boxWaiting: this.crateVisible(),
      questReady: claimableCount(questsOf(this.player)) > 0,
      storyWaiting: this.storyBusy(),
    });
    if (next?.id !== this.tip?.id) this.tipAge = 0;
    else if (!this.panel) this.tipAge += deltaMs;
    this.tip = next;
  }

  /** The hint's text: empty (no line, no frame) when nothing applies or a one-off line has had its turn. */
  private tipText(): string {
    const t = this.tip;
    return t && (!t.once || this.tipAge < TIP_TUNING.onceMs) ? t.text : '';
  }

  /** The notice-board sign's look now: a note per open quest (pinned when done), the seal while a chapter waits. */
  private signLook(): SignLook {
    return { slots: signSlots(questsOf(this.player)), seal: this.storyBadge(), flutter: (Math.floor(this.elapsed / 700) % 2) as 0 | 1 };
  }

  /** The trophy board shows once a rare fish is mounted (slice 23d); its texture changes with the set of mounted fish. */
  private drawTrophyBoard(): void {
    // The Pale One alone does not bring the board: it appears with the first rare fish.
    const shown = this.player.trophies && Object.keys(this.player.trophies).length > 0 ? boardIds(this.player.trophies, this.player.log) : [];
    const key = shown.length > 0 ? ensureTrophyBoardTexture(this, shown) : '';
    if (key !== this.trophyKey) {
      this.trophyKey = key;
      if (key) this.trophyImg.setTexture(key);
    }
    this.trophyImg.setVisible(key !== '');
  }

  /** Follows the quests and the story, and twinkles the shore things she has not tapped yet (only while idle). */
  private drawSign(): void {
    const look = this.signLook();
    this.signImg.setTexture(ensureSignTexture(this, look));
    const g = this.glintFx;
    g.clear();
    // A soft gold glow behind each claimable note that breathes, and a small twinkle on its pin (always, so the sign
    // says "something to claim" even while fishing).
    look.slots.forEach((s, i) => {
      if (s !== 'claim') return;
      const at = signNoteCenter(i);
      const cx = SIGN_FEET.x - SIGN_SIZE.w / 2 + at.x;
      const cy = SIGN_FEET.y - SIGN_SIZE.h + at.y;
      const k = 0.5 + 0.5 * Math.sin((this.elapsed / 1400) * Math.PI * 2);
      g.fillStyle(PAL.gold, 0.14 + 0.14 * k).fillRect(cx - 9, cy - 10, 18, 20);
      g.fillStyle(PAL.gold, 0.18 + 0.18 * k).fillRect(cx - 6, cy - 7, 12, 14);
      const t = (this.elapsed / 1000) % 2.4;
      if (t < 0.5) this.twinkle(g, cx + 4, cy - 6, Math.sin((t / 0.5) * Math.PI));
    });
    if (this.state.kind !== 'idle' || this.panel || this.sleepFade) return;
    const c = this.companions.state;
    const dog = c.dog;
    const spots: Record<Glint, { x: number; y: number } | null> = {
      car: { x: CAR_POS.x + CAR_PARTS.window.x + 14, y: CAR_POS.y + CAR_PARTS.window.y - 1 },
      sign: { x: SIGN_FEET.x - SIGN_SIZE.w / 2 + SIGN_GLINT.x, y: SIGN_FEET.y - SIGN_SIZE.h + SIGN_GLINT.y },
      dog: { x: dog.x + 6, y: dog.y - DOG_SIZE.h - 2 },
      crate: null, // the crate has its own, constant twinkle (drawCrate)
    };
    const live = activeGlints(this.player.seen, { car: true, sign: true, dog: dogVisible(c) && c.mode !== 'bed' });
    if (live.includes('car')) this.drawCarCue(g);
    for (const id of live) {
      const k = glintPhase(this.elapsed, GLINTS.indexOf(id));
      const at = spots[id];
      if (k < 0 || !at) continue;
      this.twinkle(g, Math.round(at.x), Math.round(at.y), Math.sin(k * Math.PI));
    }
  }

  /** Until the car is tapped once: a small gold map pin bobs above its roof (its purpose is easy to miss). */
  private drawCarCue(g: Phaser.GameObjects.Graphics): void {
    const x = CAR_POS.x + 34;
    const y = CAR_POS.y - 28 + Math.round(3 * Math.sin(this.elapsed / 320));
    const O = PAL.outline;
    // A 9 x 11 teardrop pin with a hole, outlined, and its small shadow.
    g.fillStyle(O, 0.25).fillRect(x - 6, y + 24, 12, 3);
    const rows = ['..ooooo..', '.oGGGGGo.', 'oGGGGGGGo', 'oGGoooGGo', 'oGGoooGGo', 'oGGGGGGGo', '.oGGGGGo.', '.oGGGGGo.', '..oGGGo..', '...oGo...', '....o....'];
    rows.forEach((row, ry) =>
      [...row].forEach((c, rx) => {
        if (c === '.') return;
        g.fillStyle(c === 'o' ? O : PAL.gold).fillRect(x - 9 + rx * 2, y + ry * 2, 2, 2);
      }),
    );
  }

  /** The little "+" twinkle (the crate's), k 0..1..0. */
  private twinkle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, k: number): void {
    const arm = k > 0.6 ? 3 : 2;
    g.fillStyle(PAL.white, 0.5 + 0.5 * k);
    g.fillRect(cx, cy - arm, 1, arm * 2 + 1);
    g.fillRect(cx - arm, cy, arm * 2 + 1, 1);
    g.fillStyle(PAL.gold, 0.8 * k).fillRect(cx - 1, cy - 1, 3, 3);
  }

  /** The car (the variant follows the door and the interior light), its shadow, a dim LED at night, the "Zzz..." floats. */
  private drawCar(look: DayLook, deltaMs: number): void {
    const c = this.companions.state;
    const variant = carVariant(c);
    this.carImg.setTexture(carKey(variant));
    const g = this.carFx;
    g.clear();
    // Soft shadow under the car.
    g.fillStyle(PAL.outline, 0.22).fillRect(CAR_POS.x, CAR_POS.y + CAR_SIZE.h - 2, 70, 4);
    g.fillStyle(PAL.outline, 0.12).fillRect(CAR_POS.x, CAR_POS.y + CAR_SIZE.h + 2, 62, 2);
    const night = 1 - look.sunAlpha;
    const led = CAR_PARTS.led;
    // The headlight strip is dim at night: a faint pale glow over the LED, never a beam.
    g.fillStyle(PAL.foam, 0.18 + 0.3 * Math.max(0, night)).fillRect(CAR_POS.x + led.x, CAR_POS.y + led.y - 1, led.w, 3);
    if (variant === 'light') {
      // Warm light spilling from the windows.
      const w = CAR_PARTS.window;
      g.fillStyle(PAL.gold, 0.1).fillRect(CAR_POS.x + w.x - 6, CAR_POS.y + w.y - 6, w.w + 12, w.h + 12);
      g.fillStyle(PAL.gold, 0.16).fillRect(CAR_POS.x + w.x - 3, CAR_POS.y + w.y - 3, w.w + 6, w.h + 6);
      g.fillStyle(PAL.strawLight, 0.3).fillRect(CAR_POS.x + w.x, CAR_POS.y + w.y, w.w - 4, w.h - 2);
    }
    // Zzz floats (from a tap, and now and then on their own while they sleep).
    this.sinceAutoZ += deltaMs;
    if (isInCar(c) && this.sinceAutoZ > 3200) {
      this.sinceAutoZ = 0;
      this.spawnZzz(false);
    }
    for (const z of this.carZs) {
      z.age += deltaMs;
      const t = z.age / ZZZ_MS;
      z.img.setPosition(Math.round(CAR_POS.x + CAR_PARTS.window.x + 12 + t * 8), Math.round(CAR_POS.y + CAR_PARTS.window.y - t * 22)).setAlpha(Math.max(0, 1 - t));
    }
    this.carZs = this.carZs.filter((z) => {
      if (z.age >= ZZZ_MS) z.img.destroy();
      return z.age < ZZZ_MS;
    });
  }

  /** The dock lantern (owned with the night kit) and its warm, stepped glow from 20:00 to 05:00. */
  private drawLantern(look: DayLook): void {
    const own = hasNightKit(this.player);
    const glow = own ? lanternGlow(this.clock.minute) : 0;
    this.lanternImg.setVisible(own).setTexture(lanternKey(glow > 0.02));
    if (glow > 0.02) this.lanternImg.clearTint();
    else this.lanternImg.setTint(look.worldTint);
    const g = this.lanternFx;
    g.clear();
    if (glow <= 0.02) return;
    // Concentric flat ellipses, each a little brighter towards the middle: reads as pixel-art light.
    const flicker = 1 + 0.05 * Math.sin(this.elapsed / 170) + 0.03 * Math.sin(this.elapsed / 61);
    const rings = 7;
    for (let i = 0; i < rings; i++) {
      const rx = (GLOW_RX * (rings - i)) / rings;
      const ry = rx * 0.8;
      g.fillStyle(GLOW_COLOR, 0.05 * glow * flicker);
      for (let y = -Math.floor(ry); y < ry; y += 2) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((y + 1) / ry) ** 2)));
        if (half > 0) g.fillRect(GLOW_CENTER.x - half, GLOW_CENTER.y + y, half * 2, 2);
      }
    }
    // The flame itself.
    const fx = LANTERN_FEET.x - Math.floor(LANTERN_SIZE.w / 2) + LANTERN_FLAME.x;
    const fy = LANTERN_FEET.y - LANTERN_SIZE.h + LANTERN_FLAME.y;
    g.fillStyle(PAL.gold, 0.25 * glow).fillRect(fx - 3, fy - 3, 7, 7);
  }

  /**
   * The camp items she owns (slice 23e): the tent, the pole and the bed are plain tinted sprites; the campfire flickers over 3 frames
   * and glows from 20:00 to 05:00 (the lantern's ramp) with a few rising sparks; the string lights are small coloured bulbs on a sagging
   * wire that shine at night; the windsock hangs limp, half or fully blown out by today's weather and flaps a little.
   */
  private drawCamp(look: DayLook, deltaMs: number): void {
    const p = this.player;
    this.companions.setDeckChair(hasCamp(p, 'deckchair'));
    this.campTent.setVisible(hasCamp(p, 'tent'));
    this.campBed.setVisible(hasCamp(p, 'dogbed'));
    const lights = hasCamp(p, 'lights');
    this.campPole.setVisible(lights);
    this.campPole2.setVisible(lights && !hasCamp(p, 'tent'));
    const sock = hasCamp(p, 'windsock');
    this.campSock.setVisible(sock);
    const g = this.campFx;
    g.clear();
    const glow = lanternGlow(this.clock.minute);

    if (sock) {
      const level = windsockLevel(this.weatherId());
      const period = [1100, 520, 260][level];
      this.campSock.setTexture(windsockKey(level, (Math.floor(this.elapsed / period) % 2) as 0 | 1));
    }

    if (hasCamp(p, 'campfire')) {
      const frame = Math.floor(this.elapsed / 130 + Math.sin(this.elapsed / 900) * 1.5);
      this.campFire.setVisible(true).setTexture(campfireKey(((frame % CAMPFIRE_FRAMES) + CAMPFIRE_FRAMES) % CAMPFIRE_FRAMES));
      // The logs go dark with the evening like everything else; the fire itself does not (the tint fades to white as the glow rises).
      this.campFire.setTint(lerpColor(look.worldTint, 0xffffff, Math.max(glow, 0.35)));
      const cx = FIRE_FEET.x - CAMPFIRE_SIZE.w / 2 + CAMPFIRE_FLAME.x;
      const cy = FIRE_FEET.y - CAMPFIRE_SIZE.h + CAMPFIRE_FLAME.y;
      if (glow > 0.02) {
        const flicker = 1 + 0.07 * Math.sin(this.elapsed / 110) + 0.04 * Math.sin(this.elapsed / 47);
        const rings = 6;
        for (let i = 0; i < rings; i++) {
          const rx = (54 * flicker * (rings - i)) / rings;
          const ry = rx * 0.7;
          g.fillStyle(GLOW_COLOR, 0.085 * glow);
          for (let y = -Math.floor(ry); y < ry; y += 2) {
            const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((y + 1) / ry) ** 2)));
            if (half > 0) g.fillRect(cx - half, cy + 2 + y, half * 2, 2);
          }
        }
        g.fillStyle(PAL.gold, 0.2 * glow).fillRect(cx - 4, cy - 3, 9, 8);
      }
      // A spark now and then rises from the flames and fades (more at dusk and night).
      this.sparkClock += deltaMs;
      if (this.sparkClock > (glow > 0.02 ? 420 : 1600)) {
        this.sparkClock = 0;
        if (this.campSparks.length < 5) this.campSparks.push({ x: cx + (Math.random() - 0.5) * 6, y: cy - 4, age: 0, life: 900 + Math.random() * 600, vx: (Math.random() - 0.5) * 8 });
      }
      this.campSparks = this.campSparks.filter((s) => (s.age += deltaMs) < s.life);
      for (const s of this.campSparks) {
        const t = s.age / s.life;
        g.fillStyle(t < 0.5 ? PAL.gold : PAL.redLight, 1 - t).fillRect(Math.round(s.x + s.vx * t), Math.round(s.y - 22 * t), 1, 1);
      }
    } else {
      this.campFire.setVisible(false);
      this.campSparks = [];
    }

    if (lights) {
      // The wire from the tent's ridge pole to the pole: a shallow sag, a bulb every ~9 px.
      const ax = TENT_FEET.x - TENT_SIZE.w / 2 + TENT_ANCHOR.x;
      const ay = TENT_FEET.y - TENT_SIZE.h + TENT_ANCHOR.y;
      const bx = LIGHT_POLE.x + POLE_ANCHOR.x;
      const by = LIGHT_POLE.y + POLE_ANCHOR.y;
      const sag = 3;
      const wireY = (x: number) => {
        const t = (x - ax) / (bx - ax);
        return Math.round(ay + (by - ay) * t + sag * 4 * t * (1 - t));
      };
      g.fillStyle(multiply(PAL.outline, look.worldTint), 1);
      for (let x = ax; x <= bx; x++) g.fillRect(x, wireY(x), 1, 1);
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const x = Math.round(ax + ((bx - ax) * i) / (n + 1));
        const y = wireY(x) + 2; // the bulb hangs from a 1 px socket under the wire
        const col = LIGHT_BULBS[i % LIGHT_BULBS.length];
        // A gentle twinkle: each bulb dips now and then, out of step with its neighbours.
        const tw = 0.82 + 0.18 * Math.sin(this.elapsed / 380 + i * 1.9);
        if (glow > 0.02) {
          g.fillStyle(col, 0.14 * glow * tw).fillRect(x - 4, y - 3, 10, 10);
          g.fillStyle(col, 0.18 * glow * tw).fillRect(x - 2, y - 2, 6, 7);
          g.fillStyle(PAL.outline, 1).fillRect(x, y - 1, 2, 1);
          g.fillStyle(col, 1).fillRect(x, y, 2, 3);
          g.fillStyle(PAL.white, 0.75 * glow * tw).fillRect(x, y, 1, 1);
        } else {
          g.fillStyle(multiply(PAL.outline, look.worldTint), 1).fillRect(x, y - 1, 2, 1);
          g.fillStyle(multiply(col, look.worldTint), 1).fillRect(x, y, 2, 3);
        }
      }
    }
  }

  /** The black cover and the line of text while Alex sleeps. */
  private drawFade(): void {
    const g = this.fadeGfx;
    g.clear();
    const f = this.sleepFade;
    this.fadeText.setVisible(f !== null);
    if (!f) return;
    const v = fadeView(f);
    g.fillStyle(0x0a0e1e, v.alpha).fillRect(0, 0, W, 640);
    this.fadeText.setText(v.text).setAlpha(v.textAlpha);
  }

  /** The crate shows while today's box is unopened, with a small twinkle to catch the eye. */
  private drawCrate(): void {
    const on = this.crateVisible();
    this.crateImg.setVisible(on);
    this.crateFx.clear();
    if (!on) return;
    const t = (this.elapsed % 2400) / 2400;
    if (t > 0.45) return;
    this.twinkle(this.crateFx, CRATE_FEET.x + 5, CRATE_FEET.y - 15, Math.sin((t / 0.45) * Math.PI)); // 0..1..0
  }

  /**
   * Tall phones (slice 22c): the page around the 360 x 640 game is painted like the world, the sky's top colour
   * above and the grass below, so the letterbox bands read as more lake instead of a navy strip.
   */
  private paintBands(look: DayLook): void {
    try {
      const b = letterboxBands(look);
      const css = `linear-gradient(to bottom, ${cssColor(b.top)} 50%, ${cssColor(b.bottom)} 50%)`;
      document.documentElement.style.background = css;
      document.body.style.background = css;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssColor(b.top));
    } catch {
      // no DOM or a locked-down page: the bands just stay navy
    }
  }

  /** Sky, sun, moon, clouds, stars and every tint for the current time of day. */
  private applyLook(look: DayLook): void {
    // Repaint the sky gradient when its colours moved (about every 2 in-game minutes).
    const skyKey = Math.floor(this.clock.minute / 2);
    if (skyKey !== this.lastSkyKey) {
      this.lastSkyKey = skyKey;
      repaintSky(this, look.skyTop, look.skyBottom);
      this.paintBands(look);
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
      const x = ((c.x + (this.elapsed / 1000) * c.speed * (this.weatherId() === 'windy' ? 2.2 : 1)) % (W + 80)) - 60;
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
    // The Pale One's window: the lake goes still (fewer, fainter sparkles, slow dashes, quiet glints).
    const calm = this.eerieCalm;
    const still = 1 - 0.85 * calm;

    for (const sp of this.sparkles) {
      const v = Math.sin(t * sp.speed + sp.phase);
      if (v < 0.55 + 0.35 * calm) continue;
      const a = (v - 0.55 - 0.35 * calm) / (0.45 - 0.35 * calm);
      g.fillStyle(sparkleColor, a * 0.85 * lightLevel * still).fillRect(sp.x, sp.y, a > 0.7 ? 2 : 1, 1);
    }

    // Drifting dashes (a windy day: more of them, and faster).
    const windy = this.weatherId() === 'windy';
    g.fillStyle(sparkleColor, (windy ? 0.3 : 0.22) * lightLevel * still);
    for (let i = 0; i < (windy ? 26 : 12); i++) {
      const y = FAR_SHORE_Y + 14 + ((i * 97) % (SHORE_Y - FAR_SHORE_Y - 40));
      const speed = 4 + (i % 3) * 3;
      const x = ((i * 53 + this.driftT * speed * (windy ? 2.6 : 1)) % (W + 40)) - 20;
      g.fillRect(Math.round(x), y, 5 + (i % 4) * 3, 1);
    }

    if (this.weatherId() === 'rain') this.drawRainRipples(g, sparkleColor, lightLevel, still);

    // Glitter under whichever body is up: short twinkling sparkles, densest at the horizon.
    const sun = sunArc(this.clock.minute);
    const moon = moonArc(this.clock.minute);
    const sunStr = look.sunAlpha * (sun.up ? 1 : 0);
    const moonStr = look.moonAlpha * (moon.up ? 1 : 0);
    const useSun = sunStr >= moonStr;
    const body = useSun ? sun : moon;
    const strength = (useSun ? sunStr : moonStr * 0.95) * (0.7 + 0.3 * Math.min(1, body.height * 1.6)) * still;
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

  /** Rain rings on the lake: a fixed set of slots that each bloom and fade, in a new spot every round (no state). */
  private drawRainRipples(g: Phaser.GameObjects.Graphics, color: number, lightLevel: number, still: number): void {
    const t = this.elapsed / 1000;
    const span = SHORE_Y - FAR_SHORE_Y - 40;
    for (let i = 0; i < 16; i++) {
      const len = 1.5 + hash01(i * 2.3) * 0.9;
      const u = t / len + hash01(i * 5.1);
      const cyc = Math.floor(u);
      const p = u - cyc;
      const depth = Math.pow(hash01(i * 9.7 + cyc * 3.3), 0.8);
      const x = 8 + hash01(i * 1.9 + cyc * 7.7 + 4) * (W - 16);
      const y = FAR_SHORE_Y + 12 + depth * span;
      const k = 0.5 + depth * 0.8;
      pixelEllipse(g, Math.round(x), Math.round(y), (1 + p * 5) * k, (0.5 + p * 1.6) * k, color, (1 - p) * 0.95 * Math.max(0.5, lightLevel) * still);
    }
  }

  /** Weather over the lake (slice 23b): falling rain streaks, and the morning fog that thins out by 10:00. Both are skipped by the eerie night. */
  private drawWeather(look: DayLook): void {
    const id = this.weatherId();
    const rg = this.weatherFxG;
    const fg = this.fogFx;
    rg.clear();
    fg.clear();
    if (!id) return;
    const t = this.elapsed / 1000;
    const calmLeft = 1 - this.eerieCalm;
    if (id === 'rain') {
      const color = multiply(0xcfe3f2, look.worldTint);
      rg.fillStyle(color, 0.65 * calmLeft);
      for (let i = 0; i < 70; i++) {
        const speed = 230 + hash01(i * 3.7) * 110;
        const y = ((t * speed + hash01(i * 7.7) * (H + 30)) % (H + 30)) - 12;
        const x = Math.round(hash01(i * 2.9) * (W + 20) - y * 0.12);
        rg.fillRect(x, Math.round(y), 1, 3);
        rg.fillRect(x - 1, Math.round(y) + 3, 1, 2);
      }
    }
    if (id === 'fog') {
      // Full until 08:30, gone by 10:00, and off at night (the daylight factor) and in the Pale One's window.
      const strength = fogStrength(this.clock.minute) * daylight(this.clock.minute) * calmLeft;
      if (strength < 0.01) return;
      const top = FAR_SHORE_Y - 52;
      const bands = 24;
      const bandH = Math.ceil((SHORE_Y - top) / bands);
      const color = multiply(0xe4ebee, look.worldTint);
      for (let i = 0; i < bands; i++) {
        const u = i / (bands - 1);
        // Thickest low over the far shore, thinner toward the near water.
        const a = 0.7 * strength * Math.min(1, u * 2.5) * (1 - 0.65 * u);
        fg.fillStyle(color, a).fillRect(0, top + i * bandH, W, bandH);
      }
      // A few slow wisps on top.
      for (let i = 0; i < 6; i++) {
        const w = 90 + hash01(i * 4.1) * 80;
        const x = ((hash01(i * 1.3) * (W + w) + t * (3 + (i % 3) * 2)) % (W + w)) - w;
        const y = FAR_SHORE_Y + 8 + hash01(i * 8.9) * (SHORE_Y - FAR_SHORE_Y - 90);
        fg.fillStyle(color, 0.16 * strength).fillRect(Math.round(x), Math.round(y), Math.round(w), 7);
      }
    }
  }

  /** The sickly green wash over the water: faint in the Pale One's window, stronger (and slowly pulsing) while it fights. */
  private drawEerie(): void {
    const g = this.eerieFx;
    g.clear();
    if (this.eerieTint < 0.004) return;
    const pulse = 1 + 0.12 * Math.sin(this.elapsed / 900);
    g.fillStyle(EERIE_GREEN, Math.min(1, this.eerieTint * pulse)).fillRect(0, FAR_SHORE_Y, W, SHORE_Y - FAR_SHORE_Y + 4);
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
        pixelEllipse(g, x, base, 3 + p * 6, 1 + p * 2, color, (1 - p) * 0.75 * (1 - 0.6 * this.eerieCalm));
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
      // A windy day pushes the bobber a few px sideways (purely visual; the line follows it).
      const drift = this.weatherId() === 'windy' ? Math.round(Math.sin(this.elapsed / 1700) * 2.2 + Math.sin(this.elapsed / 610) * 0.8) : 0;
      return { x: BOBBER_X + drift, y: distanceToY(s.distanceM) + bob + dip };
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
    const full = power >= 1;
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
    if (full) g.fillStyle(PAL.gold).fillRect(x + w - 6, y - 1, 6, 14).fillStyle(PAL.white, 0.8).fillRect(x + w - 6, y - 1, 6, 2);
    g.fillStyle(PAL.woodDeep);
    for (let i = 1; i < 10; i++) g.fillRect(x + Math.round((w * i) / 10), y + 9, 1, 3);

    // Landing marker on the water.
    const distanceM = castDistance(power, this.ctx.rod);
    const ly = Math.round(distanceToY(distanceM));
    const pulse = 1 + Math.sin(this.elapsed / 120) * 0.2;
    pixelEllipse(g, BOBBER_X, ly, 8 * pulse, 2.5 * pulse, color, 0.95);
    g.fillStyle(color).fillRect(BOBBER_X, ly, 1, 1);
  }

  /** The notice-board button: dimmed unless a tap would open it; a gold badge when a quest can be claimed, a red wax seal when a chapter waits. */
  private drawBoardButton(g: Phaser.GameObjects.Graphics): void {
    const on = this.state.kind === 'idle' && !this.panel;
    const a = on ? 1 : 0.6;
    const b = BOARD_BTN;
    drawFrame(g, b.x, b.y, b.width, b.height, 'buttonWood', a);
    this.boardImg.setAlpha(a);
    if (claimableCount(questsOf(this.player)) > 0) {
      // Gold, breathing: "something to claim" (the same gold as the sign's glowing notes and the "Quest done!" cue).
      const k = 0.5 + 0.5 * Math.sin((this.elapsed / 1400) * Math.PI * 2);
      const bx = b.right - 9;
      const by = b.y - 1;
      g.fillStyle(PAL.gold, 0.25 + 0.25 * k).fillRect(bx - 2, by - 2, 15, 15);
      g.fillStyle(PAL.outline).fillRect(bx, by, 11, 11);
      g.fillStyle(PAL.gold).fillRect(bx + 1, by + 1, 9, 9);
      g.fillStyle(PAL.outline).fillRect(bx + 2, by + 5, 2, 2).fillRect(bx + 4, by + 6, 2, 2).fillRect(bx + 6, by + 4, 2, 2).fillRect(bx + 8, by + 2, 1, 2);
    }
    if (this.storyBadge()) {
      const sx = b.x - 4;
      const sy = b.y - 3;
      const rows = ['.ooo.', 'oRrRo', 'oRRRo', 'oRRDo', '.ooo.'];
      const col: Record<string, number> = { o: PAL.outline, R: PAL.red, r: PAL.redLight, D: PAL.redDark };
      rows.forEach((row, ry) => [...row].forEach((c, rx) => c !== '.' && g.fillStyle(col[c]).fillRect(sx + rx * 2, sy + ry * 2, 2, 2)));
    }
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
    panel(this.coinLabel);
    panel(this.zoneLabel);
    panel(this.toast);
    panel(this.warnText);
    panel(this.hint);
    panel(this.devTag);
    for (const t of this.tags) {
      t.age += 16;
      t.text.setVisible(t.age < 2400);
      panel(t.text);
    }
    // The coin icon sits in the left padding of its label; the clock icon too (9 x 9, drawn bigger).
    this.coinIcon.setPosition(Math.round(this.coinLabel.x) + 5, Math.round(this.coinLabel.y + this.coinLabel.height / 2) - 8);
    this.clockIcon.setPosition(Math.round(this.clockLabel.x) + 9, Math.round(this.clockLabel.y + this.clockLabel.height / 2) - Math.floor((9 * CLOCK_ICON_SCALE) / 2));
    this.weatherIcon.setPosition(Math.round(this.clockLabel.x + this.clockLabel.width) - 9 * CLOCK_ICON_SCALE - 9, Math.round(this.clockLabel.y + this.clockLabel.height / 2) - Math.floor((9 * CLOCK_ICON_SCALE) / 2));
    this.drawBoardButton(g);
    this.bottomBar.draw(g, {
      enabled: this.state.kind === 'idle' && !this.panel,
      bagCount: this.player.bag.length,
      bagSlots: SHOP.bagSlots,
      baitId: chosenBait(this.player),
      baitCount: baitCount(this.player, chosenBait(this.player)),
      logFound: speciesCaught(this.player.log),
      logTotal: SPECIES.length,
    });
  }
}


