# 10 — CEO Creative Review: Story & Mobile UI/UX Proposals

**Date:** 2026-11-25  
**Author:** CEO / Creative Director (synthesizing **Storyteller** and **UI/UX Designer** pitches)  
**Scope:** Research-and-pitch pass only — zero code edits. Built on top of `main` *after* the A1 fixes from `docs/review/08-roadmap-proposal.md`. Every top claim was verified directly against the current source files.

---

## 1. CEO Brief

### What "better" means for THIS game and THIS player
For *Something Fishy*, "better" is **not** more systems, louder rewards, or mobile-game retention hooks. It means deepening the feeling that Quiet Lake (and soon River Bend) is **Alex's own private 10–15 minute sanctuary in bed** — effortless to play one-handed with the sound low or off, rewarding her Stardew Valley / Terraria love of earned, high-stakes legendary and trophy catches, and making her genuinely smile, laugh, or feel a quiet chill at the three shivers without ever breaking the cozy spell or nagging her.

### My 3 Biggest Worries After Reading the Docs
1. **The silent-in-bed blind spot:** Slices 14–25 were almost all verified as muted stills in headless Edge. In real life, Alex plays in bed with sound low or off, dim light, and one thumb. Subtle audio cues, 1-second bite windows, and tiny 1× pixel indicators risk vanishing when muted — while conversely, when sound *is* on at 15% volume, rain, wind, campfire, and the river are completely silent.
2. **Living company vs. static props (and personal-gift warmth left on the table):** Camp items (5,500 coins) are largely static sprites (Bestia never uses her bed, the campfire doesn't crackle), and tapping Pajkel only flashes his name tag. The "love letter" heart of the game can shine much brighter through tiny, earned, non-cheesy interactions.
3. **Feature density vs. picture-book clarity at 360×640:** The lake now juggles quests, story chapters, checklists, hourly weather, fish of the day, 3 rare trophies, camp items, perfect-catch medals, a road map, and bedtime — all on a 360×640 canvas. Without ruthless subtraction and thumb-first ergonomics, a cozy lakeside gift turns into a crowded dashboard.

---

## 2. Top 10 Proposals (Ranked by Noticeability to Alex vs. Effort)

### 1. Silent-First Bite, Night Bobber & Catch-Bar Press Feedback
- **Source:** UI/UX (#1 + #4a)
- **Player experience (Before → After):**
  - *Before:* With sound off (or on iOS where `navigator.vibrate` is unsupported), a nibble is a 3 px dip, a real bite is a small `!` with a 1000 ms window, the bobber is tinted dark indigo at night (`worldTint` 55%), and holding the thumb down during a fight only shifts the green catch band from `0.50` to `0.62` alpha — barely legible in dim bedroom light.
  - *After:* Nibbles pop 2–3 white droplet pixels; a real bite flashes a 1-frame warm-gold splash crown, a subtle 2 px warm-gold screen-edge pulse (caught by peripheral vision), and a draining gold underline under `"TAP NOW!"`. At night (`moonAlpha > 0.3`), the bobber's top 2×2 tip stays untinted cream/amber. During fights, holding brightens the green band's top rim white and drifts 2–3 tiny upward chevron pixels inside the zone, with a 2 px white gleam on the rising progress meniscus.
- **Why it fits THIS game:** Directly solves the #1 failure mode of playing muted in bed without adding a single permanent HUD element. Makes tough fights feel crisp and responsive even with zero audio.
- **Evidence:** `src/core/fishingSession.ts:77` (`hookWindowMs: 1000`); `src/scenes/haptics.ts:1-8`; `src/scenes/LakeScene.ts:3335` (`bobberImg` tinted by `worldTint`); `src/scenes/CatchBarView.ts:88-93,120-125`.
- **Effort:** **S–M** · **Risk:** Low (purely additive canvas drawing; keep the screen-edge pulse gentle so it never feels like a damage flash).

---

### 2. Protect Shiver #1 from Duck Tax + Visual Silence for the 3 Shivers
- **Source:** Storyteller (#3 + #2, merged)
- **Player experience (Before → After):**
  - *Before:* The A1 fix set `q4FallbackBundles: 1`. Because `Duck Tax` is just 1 bleak (caught in the first 5 minutes), almost every player triggers Q4 during the day as a plain bottle and **permanently misses Shiver #1** (the blinking star). Worse, when Q4 *does* play at night, fireflies keep blinking, the car keeps puffing `Zzz`, and `"...it blinked."` floats in celebratory coin-gold `#ffd35a`.
  - *After:* Raise `q4FallbackBundles` to `3`, and if a day-only player still gets the bottle first, let the blinking star play once the first time she later fishes past midnight with Pajkel in the car (upgrading her Q4 journal entry). During the 3 shivers (Q4, O5, S5) only: fade out fireflies and pause dock ripples (**visual silence**), render shiver floats in pale moon-white `#c4d4ff` with a slower drift, and fire one soft 25 ms haptic heartbeat (gated by a Settings toggle).
- **Why it fits THIS game:** There are only three real shivers in the entire story. Protecting Shiver #1 from an accidental 5-minute bypass — and making it land with sound off — preserves the whole emotional arc.
- **Evidence:** `src/core/data/story.ts:130` (`q4FallbackBundles: 1`); `src/core/story/story.ts:112`; `src/core/data/checklist.ts:47-51` (Duck Tax = 1 bleak); `src/scenes/StoryView.ts:126` (`#ffd35a`); `src/scenes/LakeScene.ts:2686-2690,3138-3153`.
- **Effort:** **S** · **Risk:** Low (update story unit tests for `q4FallbackBundles: 3`).

---

### 3. Tap-to-Chat Pajkel & Cornerman Reactions
- **Source:** Storyteller (#1 + #7a, merged)
- **Player experience (Before → After):**
  - *Before:* Tapping Bestia gives a wiggle, heart, boof, and toast. Tapping Pajkel only flashes his name tag like a museum label. He also stays silent when Alex loses a monster fish or nails a perfect catch on a hard species.
  - *After:* Tapping Pajkel on the dock triggers his existing `look` frame and a ≤40-character context-aware bubble (~5 s cooldown): reacts to weather, time of day, bag fullness (`"Bag's looking heavy."`), his deck chair if owned (`"Best 600 coins ever."`), Bestia sleeping (`"Don't wake the boss."`), and a rare 1-in-10 warm partner line (`"Glad we came out here."`, `"Warm enough?"`, `"Your turn to drive back."`). On losing a hard fish (`difficulty >= 0.75`), he offers quiet solidarity (`"Whoa, that one was huge."`); on a hard perfect catch, genuine awe (`"Did you just one-shot that?!"`). Scale bubble display time by length (`clamp(2400 + len * 40, 2800, 4200)` ms) so longer lines don't vanish mid-read.
- **Why it fits THIS game:** Turns Pajkel from a passive backdrop into *real company* and delivers tasteful "love letter" warmth without breaking the rule against cheesy monologues.
- **Evidence:** `src/scenes/LakeScene.ts:1924-1928` (tap only calls `showTag`), `1498-1504`; `src/scenes/companions/behaviour.ts:84,91,456` (`look` pose, `BUBBLE_MS = 3000`, `pajSay`).
- **Effort:** **S** · **Risk:** Low (ensure bubble sits clear of Alex's hair and uses `{player}/{companion}/{dog}` tokens).

---

### 4. Cast Charge "Rangefinder" Zone Notches & Live Zone Tag
- **Source:** UI/UX (#2)
- **Player experience (Before → After):**
  - *Before:* While charging a cast, `drawPowerMeter` shows 10 generic ticks and a water ellipse — Alex cannot tell whether she will land in `Shallow` or `Deep` (or River Bend's `Riffle` / `Seam` / `Bend pool`) until *after* the bobber splashes down.
  - *After:* Draw crisp 2 px zone-boundary notch(es) directly on the charge bar (at `zone.toM / rod.maxCastM`), show a compact live zone tag under the bar (`Shallow` → flips to `Deep` as the fill crosses the notch), and give `power >= 1` (`FULL_POWER_HOLD_MS`) a 1-frame crisp white detent flash.
- **Why it fits THIS game:** Alex hunts specific species and trophies by zone; with River Bend adding *three* zones, a Braun-style notched meter teaches depth intuitively with zero tutorial text.
- **Evidence:** `src/scenes/LakeScene.ts:3348-3374`; `src/core/casting.ts:13`; `src/core/data/locations.ts:11-14,41-45`.
- **Effort:** **S** · **Risk:** Very low (zone boundaries already live on `this.loc.zones`).

---

### 5. Checklist-Fit Protection in Bag/Shop, One-Tap Bait Equip & Thumb-Arc Close
- **Source:** UI/UX (#6)
- **Player experience (Before → After):**
  - *Before:* Checking which bag fish fit the Checklist, handing them in, selling the rest, and buying worms currently takes **11 taps across 4 panels** with 3 top-right `X` stretches. Worse, `"Sell all"` silently sells checklist-needed fish with zero warning, and buying special bait leaves worms equipped (4 extra taps to switch).
  - *After:* Show a small `"Checklist"` pip on any matching fish in Bag/Sell (`fittingSlots(p, f).length > 0`), add a 1-line amber warning + `"Open Checklist"` wood button right above `"Sell all"` when a bag fish fits an open slot (cutting check-and-hand-in from 6 taps to 2), add an inline `"Use now"` pill right after buying special bait in Shop, and pin `Close`/`Back` into the bottom `footer` of every scrollable panel.
- **Why it fits THIS game:** Eliminates the single most frustrating accidental-regret moment (selling a rare checklist fish) and removes 4–6 repetitive taps from every 10-minute bed session.
- **Evidence:** `src/ui/bagShop.ts:72-84,320-326,357-372`; `src/ui/panel.ts:142`; `src/ui/checklistPanel.ts:174-176`; `src/ui/questPanel.ts:147-149,206-208`; `src/ui/logPanel.ts:109-111,148-150`.
- **Effort:** **M** · **Risk:** Low (`fittingSlots` already exists in `src/core/checklist/checklist.ts`).

---

### 6. The Bedside Soundscape: Soft Rain, Campfire Crackle & River Rush
- **Source:** Storyteller (#4)
- **Player experience (Before → After):**
  - *Before:* `AMBIENT_LAYERS` only has `water`, `birds`, `frogs`, `crickets`, and `drone`. Pouring rain is silent, the river is silent, and the 800-coin Campfire promises `"Crackles by the car"` while making zero sound.
  - *After:* Add three warm, low-pass-filtered procedural layers in `AmbientBed` tuned for quiet phone speakers in bed: soft rain patter scaled by `weatherVis('rain')`, gentle dusk/night campfire crackle when `hasCamp(player, 'campfire')`, and steadier river rush when `loc.background === 'river'`. Pair rain with tiny splashes on the dock/car roof so muted players feel it too.
- **Why it fits THIS game:** Turns a 10-minute session at 15% volume into a genuine bedtime wind-down ritual, fulfils the Campfire's shop description, and prepares River Bend's atmosphere.
- **Evidence:** `src/audio/ambient.ts:7,51-56`; `src/core/data/camp.ts:15`; `src/scenes/LakeScene.ts:3080-3090`.
- **Effort:** **M** · **Risk:** Low-Medium (must be tuned by ear on a real phone speaker so rain/river never sounds like harsh white-noise hiss).

---

### 7. Zero-Guilt Welcome Back & Picture-Book Opening Spread
- **Source:** Storyteller (#6) + UI/UX (#3, merged)
- **Player experience (Before → After):**
  - *Before:* First launch slams an 84%-opaque modal with bureaucratic copy (`"Who is fishing today? (stored on this device only)"`) and pops 3 overlapping name tags at once. Returning on a new day shows `"Days in a row: 1"` on the Bait Box — subtle streak guilt — with zero personal greeting.
  - *After:* Lighten the first-launch backdrop to `0.55` so the sunlit lake peeks above, replace the parenthetical with `"Name your crew — changeable anytime in Settings"` plus 16×16 character portraits, and stagger the 3 name tags by 350 ms. On the Bait Box, keep the forgiving `-1` tier math but rename `"Days in a row"` to `"Regular's crate · Tier X/5"` (zero streak framing) and rotate 6–8 charming bait-shop delivery tags (`"Fresh worms! The duck followed my van."`). On the first calm moment of a new real date, Pajkel says one warm welcome-back line (`"Coffee's still hot."`, or after 3+ days away: `"Bestia kept your seat warm."`).
- **Why it fits THIS game:** A gift for a tired wife in bed should feel like a storybook and a warm couch — never a cookie banner or a Duolingo streak counter.
- **Evidence:** `src/ui/nameOverlay.ts:76,90-95`; `src/ui/baitBoxCard.ts:13,37`; `src/core/daily/daily.ts:111-112`; `src/scenes/LakeScene.ts:1299-1304,2021-2038`.
- **Effort:** **S** · **Risk:** Very low.

---

### 8. "Warm Lamp" In-Bed Mode, Catch-Bar Side Toggle & Safer Catch Guard
- **Source:** UI/UX (#5 + #4b + #10, merged)
- **Player experience (Before → After):**
  - *Before:* Playing at 11 PM real time during in-game noon blasts bright sky blue (`0xaadef6`) and bright gold buttons in a dark bedroom. The catch bar is hardcoded to the right edge (`x = 304`), where a right-handed thumb can block `sinker`/`abyssal` dives. And `showOffGuardMs` is only `400 ms`, so an excited thumb coming off a hard fight accidentally skips the catch screen.
  - *After:* Add two Settings toggles: **"Bedtime dim"** (warm-amber `brightness(0.80) sepia(0.14)` filter across canvas, panels, and letterbox bands) and **"Catch bar side: Right / Left"** (mirrors `BAR_FRAME` to `x = 8` for unobstructed right-thumb play), plus a **Haptics On/Off** toggle. Raise `showOffGuardMs` to **750 ms** (normal) / **1100 ms** (New Species / Gold / Trophy / Legendary), fade in `"Tap to continue"` only after the guard passes, and put a soft dark scrim behind the catch text stack so it never collides with `coinLabel` or vanishes against bright noon water.
- **Why it fits THIS game:** Engineered specifically for Alex's real posture: one-handed, in bed, fighting hard legendaries in dim light.
- **Evidence:** `src/scenes/CatchBarView.ts:12-17`; `src/core/fishingSession.ts:82`; `src/scenes/LakeScene.ts:186-198,2440-2500`; `src/art/dayCycle.ts:32,36`.
- **Effort:** **S–M** · **Risk:** Low (update any unit tests asserting `showOffGuardMs === 400`).

---

### 9. Living Shore, Sandwich Duck Callback & Found-Bottles Scrapbook
- **Source:** UI/UX (#7) + Storyteller (#9 + #10, merged)
- **Player experience (Before → After):**
  - *Before:* After Q2's sandwich heist, the duck goes back to being anonymous. Random bottle notes (including key foreshadowing like `"— The Lake"` and warm water) vanish forever once closed. On the shore, nothing hints that a bag fish fits the Checklist on the Sign, and tapping Sign/Board/Crate while the bobber is out silently does nothing.
  - *After:* (1) Once `Q2` is done, 1 in 3 duck moments becomes the "Sandwich Run" — the duck pauses eyeing Pajkel's chair; tapping it makes it bolt while Pajkel mutters `"Not today, pal."` / `"My sandwich is in the car."`. (2) Add a folded `"Found bottles (X/13)"` drawer at the bottom of the Story tab using `player.notes.read` (already saved!), and sharpen the redundant Q4/Q5 journal thoughts so Alex's voice pops. (3) Add a tiny fluttering cream ribbon on the shore Sign when the bag holds a checklist-fitting fish, and show a gentle `"Reel in first"` hint instead of silently swallowing shore taps while waiting.
- **Why it fits THIS game:** Deepens the running comedy and mystery notebook using assets and save fields that already exist — zero extra HUD clutter.
- **Evidence:** `src/scenes/MomentsView.ts:412-427`; `src/core/data/story.ts:99,107-108`; `src/ui/questPanel.ts:139-151`; `src/scenes/LakeScene.ts:1938-1964`.
- **Effort:** **S–M** · **Risk:** Low.

---

### 10. Field-Guide Fish Log (Thumb Flip + "Active Now" Pip) & Compact Shop Tackle Strip
- **Source:** UI/UX (#11 + #8 trimmed, merged)
- **Player experience (Before → After):**
  - *Before:* Browsing 4 species in the Fish Log takes 12+ taps (`Tile → Scroll → Back → Tile`), locked icons have no legend, and you can't see at a glance which uncaught fish bite *right now*. In Shop `Buy`, `Your tackle` eats ~180 px vertically and rod descriptions wrap into 4–5 cramped prose lines.
  - *After:* In the Fish Log, pin `< Prev · Back · Next >` in `footer` for one-handed page flipping, add a 1-line icon key (`~ Shallow · ≈ Deep · ☀ Day · ☾ Night`), and put a subtle gold corner pip on non-trophy tiles active at the current game clock. In Shop `Buy`, collapse `Your tackle` into one 48 px horizontal 4-icon strip, stack rod stats into 2–3 crisp lines, and pin compact jump-anchor pills (`Bait · Gear · Camp`) at the top (scrolling smoothly without hiding the Night Kit).
- **Why it fits THIS game:** Turns the Fish Log into a cozy bedside pocket field guide and cures Shop scroll fatigue before River Bend adds more gear.
- **Evidence:** `src/ui/logPanel.ts:50-57,101-113,127-152`; `src/ui/bagShop.ts:189-205,341-458`.
- **Effort:** **M** · **Risk:** Low.

---

### Verified Narrative & Copy Bugs (Quick-Fix Queue from Storyteller's Audit)
*Not ranked as creative pitches, but verified live in code post-A1 and cheap (S) to fix alongside the above:*
- **Q2 (`duck`) & Q5 (`prints`) can fire while Pajkel & Bestia are asleep in the car (00:00–05:00):** `LakeScene.ts:1277-1281,1366-1368` lets `duck` and `prints` run while `isInCar(c)` is true, making Bestia bark (`StoryView.ts:169`) from inside a closed car and delaying Pajkel's sandwich/footprint reaction until 05:00 AM. Fix: hold `duck`/`prints` while companions are in the car.
- **Old Mossback hint leaks into River Bend:** `LakeScene.ts:1306-1314` never checks `loc.id === QUIET_LAKE.id`, so Pajkel hints about a Quiet Lake trophy while at the river.
- **First-catch Trophy line dropped at night:** `LakeScene.ts:1493-1495` skips `TROPHY_TEXT.pajkelFirst[id]` if `mode === 'bed'` instead of queuing it for 05:00.
- **Fog lines fire in clear afternoon sun:** `LakeScene.ts:1299-1304` plays `"Can't see the far shore."` even after 10:00 AM when visible fog is `0`.
- **15 hardcoded `Alex`/`Pajkel`/`Bestia` strings across 6 files** (`pajkelLines.ts:8,11,17,20`, `rare.ts:75`, `story.ts:40-41,99`, `checklistPanel.ts:137`, `carMap.ts:44`, `camp.ts:16-17`) still ignore custom names.

---

## 3. CEO Rulings on Conflicts Between Storyteller & UI/UX

1. **Pajkel's Expanded Banter & Longer Bubbles vs. Catch-Screen Calm**
   - *Conflict:* Storyteller wants more Pajkel bubbles (tap-to-chat, cornerman lines, welcome-back, duck callbacks) and longer display times (up to 5.2 s). UI/UX wants to quieten catch-screen clutter, eliminate bubble/hair overlaps, and keep the canvas calm.
   - *Ruling:* **Split by game state.** In **idle/waiting**, Storyteller wins: tap-to-chat, welcome-back, and duck callbacks are opt-in or rare and bring the dock to life — cap scaled duration at **4.2 s** (not 5.2 s) and position bubbles clear of Alex's hair. On the **catch screen**, UI/UX wins: cut routine bag toasts and duplicate `"Gold!"` text, and restrict Pajkel catch bubbles to true milestones (Record, Medal, Trophy, Hard Perfect/Loss).

2. **Bottom Bar Space & Notice Board vs. Cozy Label-Free Shore**
   - *Conflict:* UI/UX wants to delete `BOARD_BTN` and merge `Bag + Shop` to reclaim ~58 px on the bottom bar; Storyteller wants high discoverability for story bottles, found-bottles scrapbook, and corkboard life.
   - *Ruling:* **Delete `BOARD_BTN` AND merge `Bag + Shop` into `Shop · n/10`.** Spend the freed ~58 px on a real 44×44 `Settings` button and breathing room for `Log` and `Bait` — do *not* add a Notice Board button to the bottom bar. Keep the shore sign as the diegetic home for Quests/Story/Checklist, boosted by the fluttering cream ribbon (checklist-ready fish) plus the `"Open Checklist"` shortcut inside Shop `Sell`.

3. **In-Bed Haptics (Shiver Heartbeat & Cast Detent) vs. Nightstand Silence**
   - *Conflict:* Storyteller wants a 25 ms haptic pulse on the 3 shivers; UI/UX wants an 8 ms max-cast detent haptic — while `haptics.ts` currently vibrates unconditionally, which can buzz audibly in bed.
   - *Ruling:* **Add a Haptics On/Off toggle in Settings first**, and gate *all* vibration behind it. **Approve** the 25 ms shiver pulse (3 times in the whole game — huge muted payoff). **Cut** the 8 ms max-cast detent haptic (100+ buzzes per session is fatiguing in bed; the 1-frame white flash on the bar does the job silently).

4. **Shop `Buy` Sub-Tabs vs. Keeping the Night Kit Discoverable**
   - *Conflict:* UI/UX proposed splitting Shop `Buy` into 3 hidden sub-tabs (`Bait · Gear · Camp`) to reduce scroll. However, `GAME_DESIGN.md:509-510` explicitly documents that Alex/the developer missed the Night Kit when it wasn't immediately visible.
   - *Ruling:* **No hidden sub-tabs inside `Buy`.** Keep all sections in one scrollable list, shrink scroll height via UI/UX's 48 px horizontal `Your tackle` strip and 2-line rod specs, and place **smooth-scroll jump pills** (`Bait · Gear · Camp`) at the top. Zero hidden items, zero scroll fatigue.

---

## 4. Three Things to Remove, Cut, or Quieten

1. **REMOVE top-right `BOARD_BTN`** (`src/scenes/LakeScene.ts:223,1900-1903,3377-3400`) — Hardest thumb corner, duplicates the shore sign, bypasses `tapSign()` (missing story bottles and leaving sign glint stuck), collides with `updateToast`, and crowds the Catch Bar's top fish icon. Deleting it cleans up the sky and solves 3 bugs at once.
2. **MERGE standalone `Bag` button into `Shop · n/10`** (`src/scenes/BottomBar.ts:12,18,96` & `src/ui/bagShop.ts:223-244`) — `Bag` eats 27% of the 360 px bottom bar for a read-only fish list whose only action is `"Go to Shop"` (which already opens on `Sell` when the bag has fish). Merging frees ~58 px so `Settings` hits 44×44, cuts 2 taps per sell trip, and stops the bottom bar from feeling wall-to-wall cramped.
3. **QUIETEN redundant catch/hint chatter & streak guilt** (`LakeScene.ts:1545,1447,1630,2449`, `baitBoxCard.ts:13`, `mapPanel.ts:159`) — Drop the routine `"X goes in the bag"` toast, suppress any top toast that duplicates `this.hint.text`, drop literal `"Gold!"` text under the Gold Star sprite, remove `"Days in a row"` streak phrasing from the Bait Box, and cut the early-access `"New places are on the way. Check back soon!"` banner from the Road Map.

---

## 5. Full Employee Idea Lists (Trimmed, with CEO Disposition)

### Storyteller (10 Pitches)
1. **Tap-to-Chat Pajkel** — **ACCEPTED** → Top 10 (#3).
2. **Visual Silence & Haptic Heartbeat for the 3 Shivers** — **ACCEPTED** → Top 10 (#2; haptic gated by Settings toggle).
3. **Protect Shiver #1 from Duck Tax + Second-Chance Blink** — **ACCEPTED** → Top 10 (#2).
4. **Bedside Soundscape (Campfire, Soft Rain, River Rush)** — **ACCEPTED** → Top 10 (#6).
5. **Picture-Book Timing (Scaled Bubbles + Bestia Micro-Emotes)** — **PARTIALLY ACCEPTED** → Scaled bubble duration merged into #3; Bestia `?`/`!` story emotes **DEFERRED to M2 polish** (cute, but requires new animation hooks in `CompanionView` for only 2 Quiet Lake beats).
6. **Zero-Guilt Welcome Back** — **ACCEPTED** → Top 10 (#7).
7. **Cornerman Pajkel, Warm Mug & Living Camp (Bestia's Bed)** — **PARTIALLY ACCEPTED** → Cornerman lines merged into #3; **Warm Mug** and **Bestia sleeping in her bed** **DEFERRED to Camp Polish slice** (already tracked in `HANDOFF.md:169` and needs new camp/bed art redraw first).
8. **Radio-Drama Offscreen World (Bait Box & Corkboard)** — **PARTIALLY ACCEPTED** → Rotating Bait Box delivery tags folded into #7; corkboard header **REJECTED** (adds vertical height to an already busy Notice Board panel at 360×640).
9. **Sandwich Duck Ongoing Vendetta** — **ACCEPTED** → Top 10 (#9).
10. **Keepsake Scrapbook (Sharper Journal + Found-Bottles Drawer)** — **ACCEPTED** → Top 10 (#9).

### UI/UX Designer (12 Pitches)
1. **Silent-First Bite & Nibble Visual Language** — **ACCEPTED** → Top 10 (#1).
2. **Cast Charge "Rangefinder" Zone Preview** — **ACCEPTED** → Top 10 (#4; dropped 8 ms cast haptic).
3. **Picture-Book Opening Spread** — **ACCEPTED** → Top 10 (#7).
4. **Muted Catch-Bar Micro-Juice & Left/Right Handedness Toggle** — **ACCEPTED** → Split cleanly into #1 (press juice) and #8 (side toggle).
5. **"Warm Lamp" In-Bed Mode & Midday Scrim Contrast** — **ACCEPTED** → Top 10 (#8).
6. **Checklist-Fit Protection, One-Tap Bait Equip & Bottom Close** — **ACCEPTED** → Top 10 (#5).
7. **Living Environmental Affordances for Shore Objects** — **PARTIALLY ACCEPTED** → Sign ribbon & `"Reel in first"` hint merged into #9; car dusk dome-light glow and tappable Tent **DEFERRED** (tent interactivity belongs in the Camp Polish slice).
8. **Bento-Box Shop Layout & Scannable Stat Lines** — **PARTIALLY ACCEPTED** → Compact `Your tackle` strip + stacked stat lines merged into #10; hidden `Bait/Gear/Camp` sub-tabs **REJECTED** (replaced with scroll-jump pills so the Night Kit stays visible).
9. **Fight-Focus HUD Quietening & Low-Bait Chip Warning** — **DEFERRED / QUICK-WIN** → Low-bait amber warning is a great 3-line tweak to include when touching `BottomBar.ts` (for the `Bag+Shop` merge), while fading top HUD during fights is **REJECTED** (players check the clock during 02:00–04:00 Pale One hunts).
10. **Safer Catch-Screen Guard & Cohesive Catch Plaque** — **ACCEPTED** → Top 10 (#8).
11. **Field-Guide Fish Log (Thumb Flip + Active Now + Icon Key)** — **ACCEPTED** → Top 10 (#10).
12. **Smart Bag-Full Math & Keyboard-Safe Modal Centering** — **DEFERRED to Polish** → Both are solid S-effort fixes, just slightly lower daily noticeability for Alex than the Top 10 (bag-full triggers rarely once she sells regularly, and names are typed once).

---

## 6. Five Questions for the Developer (Whose Answers Most Change the Ranking)

1. **Does Alex play on Android or iPhone, and does she usually have sound at 0% or ~15% in bed?**  
   *(If iOS or 0% sound, #1 Silent-First Bite/Catch-Bar and #8 Bedtime Dim jump to undisputed #1–#2, and #6 Bedside Soundscape drops in priority; if Android at 15% volume, #6 jumps into the top 3.)*
2. **Has Alex already passed Q4 on her real save, or hasn't she started / is still early?**  
   *(If she hasn't hit Q4 yet, #2 Protect Shiver #1 from Duck Tax is an urgent hotfix before her next session. If she already got the day bottle, the "second-chance midnight blink" becomes the key part.)*
3. **Are you comfortable merging `Bag` + `Shop` into one bottom-bar button (`Shop · 4/10`) and deleting top-right `BOARD_BTN`?**  
   *(Both touch muscle memory from earlier builds; confirming this unlocks the 44×44 `Settings` button and fixes the top-right update-toast/fight-bar collision in one pass.)*
4. **How personal is "too personal" for Pajkel's tap-to-chat lines (#3)?**  
   *(Since the repo is public on GitHub Pages and Polish friends play-test it, should the 1-in-10 warm partner lines stay universally cozy like `"Glad we came out here."` / `"Warm enough?"`, or include subtle inside jokes?)*
5. **Would you rather ship the quick Quiet Lake polish batch (#1–#4, all S/S–M) *before* River Bend's current & fish slices (25c–25g), or bundle #4 (Rangefinder) and #6 (River audio) directly into River Bend?**  
   *(Bundling #4 and #6 into M2 avoids touching `drawPowerMeter` and `AmbientBed` twice, while shipping #1–#3 first makes Alex's very next Quiet Lake session noticeably warmer and fairer.)*
