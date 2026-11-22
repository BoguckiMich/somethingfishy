# Rybki — Game Design

A cozy, fishing-only game in the spirit of Stardew Valley / Terraria. Made as a gift.
Working title: **Rybki** (to be renamed later).

This doc records decisions. When a decision changes, update it here.

---

## 1. Platform & tech

| Decision | Choice |
|---|---|
| Delivery | Web game as a PWA (installable to phone home screen), playable in desktop browser |
| Engine | Phaser 4 + TypeScript, bundled with Vite |
| Tests | Vitest, for pure game logic |
| PWA | `vite-plugin-pwa` (added in the deploy slice) |
| Hosting | GitHub Pages |
| Orientation | Portrait for now (base resolution 360×640, scaled to fit) |
| Language | English first; text kept in one place so translations (e.g. Polish) are easy to add |
| Saving | Local (localStorage) + export/import save code. Cloud sync later, maybe. |

### Architecture rule

`src/core/` is **pure TypeScript with no Phaser imports**: fish data, spawn rules, economy,
catch-bar physics, clock, state machines. It is unit-tested.

`src/scenes/` is the Phaser layer: rendering, input, animation, sound. It reads core state
and sends events to it. It contains no game rules.

Why: the long-term direction is a Stardew-like walkable world. With rules separated from
rendering, the portrait lake screen becomes one scene of a bigger world instead of a rewrite.

**Location is a first-class concept** in the data model from day one, even with one lake.

---

## 2. Look & feel

- Pixel art with real detail (Stardew-like) at 360×640. Sprites are **hand-authored in code** as
  palette grids (`src/art/`), turned into textures at startup: no downloads, no licences, version-
  controlled. Pack art or custom art can replace individual sprites later.
- Cozy: no energy, no stress. Losing a fish costs only the bait.
- Accelerated day/night clock: ~20 real minutes = one in-game day; paused when the game is closed.
- Ambient sound (water, birds, crickets at night) + SFX in v1. Music later.
- Haptics (`navigator.vibrate`) on bites and key moments where supported.

---

## 3. v1 gameplay loop

1. **Cast** — hold to charge a power meter, release to cast. Distance decides the zone:
   *shallow* (near shore) or *deep* (far). The starter rod only reaches shallow water.
   *Future:* dragging the thumb left/right while charging aims the cast (see Ideas below).
2. **Wait / bite** — the bobber gives a few small *nibbles* (fake-outs), then a big dip with
   a "!" and a ~1 s window to tap. Tapping on a nibble scares the fish away. Shy species nibble more.
3. **Fight** — Stardew-style vertical catch bar:
   - Hold to raise the catch zone, release and it falls (gravity).
   - Progress fills while the fish is inside the zone, drains while outside. Full = caught, empty = lost.
   - Each species has a movement pattern (smooth, darting, sinker, floater, erratic) + difficulty.
   - **Gear modifies the bar:** rod → zone size; reel → zone responsiveness/weight;
     line → progress drain rate; bait/lure → calms fish / shrinks its movements.
4. **Result** — each catch rolls a size/weight. The fish log keeps personal bests per species
   (a star when a record is beaten).
5. **Bag & shop** — caught fish go into a 10-slot bag. Shop: sell fish (sell all / keep),
   buy worms, buy 2 rod upgrades (each: more cast distance + bigger catch zone).
6. **Screens** — the lake is always the main screen; Bag / Shop / Fish log open as overlay panels
   from a bottom bar.
7. **Which fish bites** — v1: time of day + depth zone. (Bait type in v2; weather/seasons later.)

### v1 fish roster (proposed)

| Fish | Zone | Time | Notes |
|---|---|---|---|
| Roach | shallow | day | common starter |
| Rudd | shallow | day | |
| Bleak | shallow | day | tiny, darting |
| Perch | shallow | day | |
| Crucian carp | shallow | any | |
| Eel | shallow | night | |
| Bream | deep | any | |
| Tench | deep | dawn/dusk | |
| Carp | deep | any | strong |
| Pike | deep | day | darting |
| Zander | deep | dusk/night | |
| Catfish | deep | night | heavy, sinker |
| *Legendary* | deep | ? | brutal, needs best gear |

**Legendaries** are brutally hard and gear-dependent. Caught once for the log; afterwards
rematches are possible for personal-best size records.

Tuning (prices, spawn weights, difficulty) lives in data files under `src/core/data/` so it can
be tweaked without touching logic.

---

## 4. Roadmap

- **v1** — one lake, float fishing, worms only, ~12 fish + 1 legendary, log, bag, shop, 2 rod upgrades.
- **v1.5 Daily habit** — daily bait box + daily quests (rewards: worms + coins), right after saving lands.
  See §5.
- **v2a Worm farm** — soil plots near the lake; feed them (leaves, scraps, compost); worms multiply
  over in-game days; feed type decides worm type (earthworm, red wiggler, nightcrawler).
- **v2b Fields & bait crafting** — grow crops (corn, wheat, hemp…); craft two layers of bait:
  *hook bait* (decides which fish bite) and *groundbait / zanęta* (attracts fish, raises bite rate).
  Recipes are unlockables.
- **v2c Spinning** — lures/wobblers, active cast-and-retrieve; retrieve speed + lure depth decide
  what attacks. Predators: pike, perch, zander.
- **v2d Feeder / bottom fishing** — heavy cast, bite alarm, patient; maybe 2 rods. Carp, bream, catfish.
- **After v2** — weekly quests (once bait/lure systems give interesting rewards). See §5.
- **Later** — more locations (river, pond, sea, ice fishing), fly fishing, weather & seasons,
  walkable Stardew-like world (landscape), music, personal touches (her own legendary fish), cloud sync.

### Ideas (not scheduled)
- **Aimed casting** — while holding to charge, sliding the thumb left/right changes the cast
  direction (the landing marker follows). It only matters once the lake has *features* worth
  aiming at: reeds, lily pads, a sunken log, a drop-off, each holding different fish or better
  bite rates. Build the two together, otherwise aiming is cosmetic.
  Core impact: cast result becomes distance + angle (a 2D point), and "zone" lookup becomes a
  point-in-area check; keep that in mind when extending `Location`.

### Parked on purpose
Personal touches · weather & seasons · cloud sync · landscape/walkable world · music · treasure chests.

---

## 5. Retention: daily & weekly content (future)

Goal: a gentle reason to open the game every day. It should feel cozy and never punishing.

**Daily quests**
- 3 small quests per day, e.g. "Catch 5 roach", "Catch a fish at dawn",
  "Catch something in deep water", "Sell 200 coins' worth of fish".
- Rolled from a quest pool, weighted toward what she has unlocked (no deep-water quests before the rod upgrade).
- Reset at local midnight (real time, not the in-game clock).
- One free reroll per day.

**Weekly quests**
- 1–3 bigger goals, e.g. "Catch 3 different deep-water species",
  "Beat 2 personal-best sizes", "Catch a zander at night".
- Reset on Monday.
- Better rewards: rare bait, groundbait recipes, cosmetics, lure blueprints (once spinning exists).

**Daily bait box**
- One free box per day ("The bait shop left a package on the dock").
- Contents are rolled from a loot table: worms (common), special baits, groundbait ingredients,
  seeds for the bait fields, and a small chance of a rare item.
- A streak bonus makes the box contents better over consecutive days.
- No punishment for missing a day: the streak pauses or drops a tier instead of resetting to zero.
  It's cozy, not a guilt trip.

**Possible extras**
- "Fish of the day": one species gives bonus coins or bonus quest progress today.
- Weekly "tournament" vs her own records (biggest fish of a chosen species this week).
- Seasonal/holiday events later (ties into weather & seasons).

**Tech notes**
- Pure logic in `src/core/quests/`: quest definitions, a seeded daily roll (seed = date),
  progress tracking driven by game events (`fishCaught`, `fishSold`, ...).
- Reward tables in `src/core/data/`, so they're tunable.
- Use device time for resets, but guard against clock changes (store the last claim date
  and never grant twice for the same date).
- Depends on: saving (slice 8), and ideally the bait systems (v2), so rewards have variety.

**Roadmap decision:** build the daily box and daily quests soon after v1 saving lands, even with
only worms and coins as rewards. They're cheap and create the daily habit early. Weekly quests
come once the v2 bait and lure systems provide more interesting rewards.

**Design implication for earlier slices:** the core should emit game events (`fishCaught`,
`fishSold`, …) from the start, so quests can subscribe to them later without refactoring.

---

## 6. Workflow

- Work in small vertical slices, one branch per slice (`slice/NN-name`).
- Each slice: core logic + tests, then the scene layer. Reviewed (diff) and play-tested before merge.
- Run locally: `npm run dev` (exposed on the LAN, so a phone on the same Wi-Fi can open it).

### Slice plan

1. Lake scene, hold-to-charge casting, bobber, distance zones ✅
2. Game clock (day/night) + bite system (nibbles, hook window) ← *current*
3. Art pass: hand-authored pixel-art sprites (angler, dock, water, trees, bobber), day/night palettes
4. Catch bar fight
5. Fish data, spawn rules, sizes, catch result
6. Bag, shop, coins, rod upgrades
7. Fish log + personal bests
8. Saving (local + export code)
9. Sound + second art pass (UI panels, fish sprites)
10. PWA + GitHub Pages deploy
11. Legendary fish
12. Daily bait box + daily quests (§5)
