import { NEW_GAME_CLOCK, MINUTES_PER_DAY, type GameClock } from './clock';
import { BAITS, baitById } from './data/baits';
import { speciesById } from './data/fish';
import { RODS } from './data/rods';
import { SHOP } from './data/shop';
import { LINES, REELS } from './data/tackle';
import { newPlayer, type BagFish, type PlayerState } from './inventory';
import { isValidDate } from './daily/dates';
import { newDaily, type DailyState } from './daily/daily';
import { DAILY_BOX } from './data/daily';
import { QUEST_TUNING } from './data/quests';
import { speciesCaught, type FishLog } from './fishLog';
import { normalizeNotes } from './moments/moments';
import { QUEST_KINDS, QUEST_TIMES, newQuests, type Quest, type QuestsState } from './quests/quests';

/**
 * Saving: the player's belongings and the clock, as one versioned JSON object. Pure: storage is
 * injected, and loading always normalises, so a hand-edited or old save can never crash the game.
 */
export interface SaveData {
  version: 1;
  player: PlayerState;
  clock: GameClock;
}

export const SAVE_KEY = 'rybki.save.v1';
export const SAVE_BACKUP_KEY = 'rybki.save.backup';
export const SAVE_BROKEN_KEY = 'rybki.save.broken';
export const CURRENT_VERSION = 1;

/** vN → vN+1 steps, keyed by N. Empty until the format first changes. */
export const MIGRATIONS: Record<number, (old: unknown) => unknown> = {};

export const newSave = (): SaveData => ({ version: 1, player: newPlayer(), clock: NEW_GAME_CLOCK });

/** A fresh game; the names live elsewhere and are not touched. */
export const startOver = (_save: SaveData): SaveData => newSave();

/** Any URL parameter other than `skipnames` / `reset` makes a dev sandbox: no loading, no saving. */
export function isSandbox(paramNames: readonly string[]): boolean {
  return paramNames.some((n) => n !== 'skipnames' && n !== 'reset');
}

// ---- Normalising ----------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Integer ≥ min, or the fallback for anything that is not a finite number. */
const intAtLeast = (v: unknown, min: number, fallback: number): number => (isNum(v) ? Math.max(min, Math.floor(v)) : fallback);

function normalizeBagFish(v: unknown): BagFish | null {
  if (!isObj(v) || typeof v.speciesId !== 'string' || !speciesById(v.speciesId)) return null;
  if (!isNum(v.lengthCm) || !isNum(v.weightG) || !isNum(v.price)) return null;
  if (v.lengthCm <= 0 || v.weightG <= 0 || v.price < 0) return null;
  return { speciesId: v.speciesId, lengthCm: v.lengthCm, weightG: v.weightG, price: v.price };
}

function normalizeLog(v: unknown): FishLog {
  const log: FishLog = {};
  if (!isObj(v)) return log;
  for (const [id, e] of Object.entries(v)) {
    if (!speciesById(id) || !isObj(e)) continue;
    if (!isNum(e.count) || !isNum(e.bestLengthCm) || !isNum(e.bestWeightG)) continue;
    if (e.count < 1 || e.bestLengthCm <= 0 || e.bestWeightG <= 0) continue;
    log[id] = { count: Math.floor(e.count), bestLengthCm: e.bestLengthCm, bestWeightG: e.bestWeightG };
  }
  return log;
}

function normalizeDaily(v: unknown): DailyState {
  if (!isObj(v)) return newDaily();
  const date = isValidDate(v.lastBoxDate) ? v.lastBoxDate : null;
  // A box date needs a tier of at least 1; no date means no box yet.
  const tier = isNum(v.streakTier) ? Math.min(DAILY_BOX.maxTier, Math.max(0, Math.floor(v.streakTier))) : 0;
  return date === null ? newDaily() : { lastBoxDate: date, streakTier: Math.max(1, tier) };
}

/** A saved quest, or null when it cannot be trusted (unknown kind or species, bad numbers). */
function normalizeQuest(v: unknown): Quest | null {
  if (!isObj(v) || !QUEST_KINDS.includes(v.kind as Quest['kind']) || !isObj(v.params) || !isObj(v.reward)) return null;
  const kind = v.kind as Quest['kind'];
  if (!isNum(v.params.target) || v.params.target < 1) return null;
  const target = Math.floor(v.params.target);
  const params: Quest['params'] = { target };
  if (kind === 'catchSpecies') {
    const sp = typeof v.params.speciesId === 'string' ? speciesById(v.params.speciesId) : undefined;
    if (!sp || sp.rarity === 'legendary') return null;
    params.speciesId = sp.id;
  }
  if (kind === 'catchAtTime') {
    if (!QUEST_TIMES.includes(v.params.timeOfDay as never)) return null;
    params.timeOfDay = v.params.timeOfDay as Quest['params']['timeOfDay'];
  }
  const progress = isNum(v.progress) ? Math.min(target, Math.max(0, Math.floor(v.progress))) : 0;
  const done = progress >= target;
  return {
    kind,
    params,
    progress,
    done,
    // A claim only counts for a finished quest.
    claimed: done && v.claimed === true,
    reward: {
      coins: Math.min(1000, intAtLeast(v.reward.coins, 0, 0)),
      worms: Math.min(100, intAtLeast(v.reward.worms, 0, 0)),
      // A known bait with at least 1 piece, or no bait part at all.
      ...(isObj(v.reward.bait) && baitById(v.reward.bait.id as string) && intAtLeast(v.reward.bait.n, 0, 0) > 0
        ? { bait: { id: v.reward.bait.id as string, n: Math.min(20, intAtLeast(v.reward.bait.n, 0, 0)) } }
        : {}),
    },
  };
}

function normalizeQuests(v: unknown): QuestsState {
  if (!isObj(v) || !isValidDate(v.date) || !Array.isArray(v.list)) return newQuests();
  const list = v.list.map(normalizeQuest).filter((q): q is Quest => q !== null).slice(0, QUEST_TUNING.perDay);
  if (list.length === 0) return newQuests(); // nothing usable left: roll afresh today
  return { date: v.date, rerollUsed: v.rerollUsed === true, list };
}

/** Bait counts: only known special baits, whole numbers >= 1 (anything else counts as 0 and is dropped). */
export function normalizeBaits(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const b of BAITS) {
    const n = intAtLeast(v[b.id], 0, 0);
    if (n > 0) out[b.id] = Math.min(n, 9999);
  }
  return out;
}

function normalizePlayer(v: unknown): PlayerState {
  const p = isObj(v) ? v : {};
  const bag = Array.isArray(p.bag) ? p.bag.map(normalizeBagFish).filter((f): f is BagFish => f !== null) : [];
  return {
    coins: intAtLeast(p.coins, 0, SHOP.startCoins),
    worms: intAtLeast(p.worms, 0, SHOP.startWorms),
    // Special baits and the chosen one: nothing stored when there is nothing (older saves have neither key).
    ...(Object.keys(normalizeBaits(p.baits)).length > 0 ? { baits: normalizeBaits(p.baits) } : {}),
    ...(typeof p.baitId === 'string' && baitById(p.baitId) ? { baitId: p.baitId } : {}),
    bag: bag.slice(0, SHOP.bagSlots),
    rodId: RODS.some((r) => r.id === p.rodId) ? (p.rodId as string) : RODS[0].id,
    // Line and reel: only a known id is kept (an unknown one means none); no key at all when none.
    ...(LINES.some((l) => l.id === p.lineId) ? { lineId: p.lineId as string } : {}),
    ...(REELS.some((r) => r.id === p.reelId) ? { reelId: p.reelId as string } : {}),
    log: normalizeLog(p.log),
    daily: normalizeDaily(p.daily),
    quests: normalizeQuests(p.quests),
    notes: normalizeNotes(p.notes),
  };
}

function normalizeClock(v: unknown): GameClock {
  const c = isObj(v) ? v : {};
  const minute = isNum(c.minute) ? c.minute : NEW_GAME_CLOCK.minute;
  return { day: intAtLeast(c.day, 1, 1), minute: Math.min(Math.max(0, minute), MINUTES_PER_DAY - 0.001) };
}

/** Anything → a valid current-version save. Never throws. */
export function normalizeSave(raw: unknown): SaveData {
  const r = isObj(raw) ? raw : {};
  return { version: 1, player: normalizePlayer(r.player), clock: normalizeClock(r.clock) };
}

// ---- Parsing --------------------------------------------------------------------------------

export type ParseResult = { ok: true; save: SaveData } | { ok: false; reason: 'unreadable' | 'tooNew' };

export interface MigrationSetup {
  migrations: Record<number, (old: unknown) => unknown>;
  currentVersion: number;
}

const DEFAULT_SETUP: MigrationSetup = { migrations: MIGRATIONS, currentVersion: CURRENT_VERSION };

/** Migrates an already-parsed document up to the current version, then normalises it. */
export function migrateAndNormalize(doc: unknown, setup: MigrationSetup = DEFAULT_SETUP): ParseResult {
  if (!isObj(doc) || !isNum(doc.version)) return { ok: false, reason: 'unreadable' };
  let version = Math.floor(doc.version);
  if (version > setup.currentVersion) return { ok: false, reason: 'tooNew' };
  let current: unknown = doc;
  try {
    while (version < setup.currentVersion) {
      const step = setup.migrations[version];
      if (!step) return { ok: false, reason: 'unreadable' };
      current = step(current);
      version++;
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  return { ok: true, save: normalizeSave(current) };
}

export function parseSave(text: string, setup?: MigrationSetup): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  return migrateAndNormalize(doc, setup);
}

// ---- Storage --------------------------------------------------------------------------------

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;
type RemovableStorage = Pick<Storage, 'removeItem'>;

export type LoadResult = { save: SaveData; status: 'fresh' | 'loaded' | 'broken' };

/** Loads the save; a bad or too-new one is kept under SAVE_BROKEN_KEY and a fresh game starts. */
export function loadSave(storage: (ReadableStorage & Partial<WritableStorage>) | undefined): LoadResult {
  let text: string | null = null;
  try {
    text = storage?.getItem(SAVE_KEY) ?? null;
  } catch {
    return { save: newSave(), status: 'fresh' };
  }
  if (!text) return { save: newSave(), status: 'fresh' };
  const r = parseSave(text);
  if (r.ok) return { save: r.save, status: 'loaded' };
  try {
    storage?.setItem?.(SAVE_BROKEN_KEY, text);
  } catch {
    // ignore: nothing more we can do
  }
  return { save: newSave(), status: 'broken' };
}

/** Returns false when the save could not be stored (the game still works for this session). */
export function writeSave(storage: WritableStorage | undefined, save: SaveData): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: RemovableStorage | undefined): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore: nothing to clear
  }
}

/** Copies the current raw save to SAVE_BACKUP_KEY (a devtools rescue before import/start over). */
export function backupSave(storage: (ReadableStorage & Partial<WritableStorage>) | undefined): void {
  try {
    const text = storage?.getItem(SAVE_KEY);
    if (text) storage?.setItem?.(SAVE_BACKUP_KEY, text);
  } catch {
    // ignore: the backup is best effort
  }
}

/** What the import confirm shows: "7/12 species, 340 coins". */
export const saveSummary = (save: SaveData): { species: number; coins: number } => ({
  species: speciesCaught(save.player.log),
  coins: save.player.coins,
});
