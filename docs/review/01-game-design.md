# 01 — Game Design Review

**Reviewer:** Game Designer  
**Scope:** Core loop, catch-bar feel, economy & bait ROI, progression & gear gates, daily retention, weather/trophies, bedtime/naps, and River Bend (M2) design.

---

## Strengths (with evidence)

1. **Deterministic, bot-verified catch-bar physics:** `src/core/catchBar.ts:78-297` runs fixed 120 Hz substepping (`stepMs: 1000/120`), backed by scripted player bots (good 150 ms / sloppy 300 ms / passive) in `src/core/catchBar.test.ts:274-555`. Recent audit fixes (`docs/CATCH_MATH_AUDIT.md:155-215`) solved passive sinker wins (catfish passive 94% → 3%) and reel overshoot via sqrt-damped drag.
2. **Zero soft-lock economy safety net:** `src/core/inventory.ts:96-110,308-312` falls back cleanly across worms and special baits (`chosenBait`), and `freeWormsIfStuck()` grants 5 free worms whenever `totalBait === 0 && coins < 10 && bag.length === 0`. Even draining all coins into camp items at 0 bait cannot soft-lock the save.
3. **Cozy-first retention ergonomics:** Daily bait box streak drops only 1 tier on missed days, never to zero (`src/core/daily/daily.ts:46-52`); completed-but-unclaimed daily quests auto-pay at midnight (`src/core/quests/quests.ts:202-215`); 01:00 bedtime warning precedes the 02:00 sleep fade (`src/core/bedtime.ts:13-26`); checklist warns before handing in gold-star or Fish-of-the-Day catches (`src/core/checklist/checklist.ts:136-151`).
4. **Tactile casting guardrails:** `MIN_HOLD_MS = 180` (`src/core/casting.ts:7`) prevents accidental tap-casts, and `FULL_POWER_HOLD_MS = 250` (`src/core/casting.ts:13`) pauses the power bar at 100% so mobile players can reliably hit 30 m+ casts.
5. **Milestone-driven story structure:** `src/core/story/story.ts:99-112` ties Quiet Lake chapters to gameplay progression rather than raw calendar days, with a `perDay: 2` cap and a persisted Pajkel line queue that preserves the "he slept through it" running gag.

---

## Economy & Physics Math Audit

### Coins per Minute (Worms, 100% catch rate, 5 s cast/show-off overhead)
*Derived from `src/core/data/fish.ts`, `src/core/fish.ts:71-79` (`E[sizeShare]` = `1/3` for max < 80 cm, `0.4` for max ≥ 80 cm), and median fight times from `docs/CATCH_MATH_AUDIT.md:161-178`.*

| Setup | Dawn (1.7m) | Day (9.2m) | Dusk (1.7m) | Night (7.5m) | Full-Day Avg |
|---|---:|---:|---:|---:|---:|
| **Bamboo (shallow, worms)** | 42.9 cpm | 29.9 cpm | 42.9 cpm | 51.7 cpm | **~40 cpm** |
| **Fiberglass (deep, worms)** | 82.3 cpm | 100.2 cpm | 101.0 cpm | **150.6 cpm** | **~117 cpm** |
| **Fiberglass (deep, fish strip)** | 74.8 cpm | 116.7 cpm | 115.3 cpm | **200.5 cpm** | — |
| **Carbon (deep, worms)** | 89.8 cpm | 109.6 cpm | 110.3 cpm | **164.6 cpm** | **~128 cpm** |
| **Carbon (deep, fish strip)** | 81.6 cpm | 128.0 cpm | 126.1 cpm | **219.7 cpm** | — |

### Total Sinks & Pacing
Total Quiet Lake coin sinks = Rods (1,450) + Lines (2,600) + Reels (4,500) + Night Kit (2,500) + Petrol (500) + Camp (`src/core/data/camp.ts:15-20`, `800+600+1000+1500+1200+400 = 5,500`, not 5,300) = **17,050 coins**:
- **Normal play (no nap-spam):** ~2.3 hours total (~7–9 short 15-min visits).
- **Deep-Night + Fish Strip nap-spam:** **~80–95 minutes** to buy out the entire game.

### Bait ROI (Net Coins/Cast vs. Worms at 1 coin/cast)
- **Corn (3 coins/cast):** **Strictly negative ROI in 100% of zones and times.** At Deep Dawn (`{bream, tench, carp}`), all three receive ×3 so the weights cancel completely (`-2.0` coins/cast for zero effect). Deep Day `-6.9`, Deep Night `-17.7`, Shallow Day `-2.4`, Shallow Night `-6.4`.
- **Maggots (2 coins/cast):** Saves `0.4 × 5.25 s = 2.1 s` per shallow cast. Shallow Day improves `29.9 → 30.1 cpm` (**+0.7%**, flips negative if UI overhead > 5.5 s). Deep water: `-1.0` coin/cast for zero effect.
- **Fish Strip (4 coins/cast):** The only profitable shop bait — `+17.9` net coins/cast at Deep Night (`200–220 cpm`), `+5.1` at Deep Day, `+3.2` at Shallow Night.

### Perfect Catch Simulation (300 seeded fights of `src/core/catchBar.ts`)
Max zone terminal speed is `lift / drag = 0.60` u/s (no reel) to `0.71` u/s (Pro reel), while darting fish travel at **2.03–2.11 u/s** (3× faster than the zone). Because `isPerfect` (`catchBar.ts:161,275`) fails on a **single 8.33 ms tick** outside `half + 0.02`:

| Species | Fiberglass (150ms human) | Max Gear (150ms human) | Max Gear (0ms aimbot) |
|---|---:|---:|---:|
| Roach (shallow) | 50.3% | 61.7% | 100.0% |
| Bream (deep) | 6.7% | 15.0% | 58.7% |
| Carp (deep) | 1.3% | 5.3% | 42.0% |
| **Pike (deep)** | **0.0%** | **0.3%** | **5.3%** |
| **Golden Tench (trophy)** | **0.0%** | **0.0%** | **2.7%** |
| **Silver Ghost (trophy)** | **0.0%** | **0.0%** | **2.7%** |
| Old Mossback (trophy) | 1.0% | 4.0% | 56.0% |

---

## Problems

### Blocker

1. **Sunny weather `zoneWeight` is a mathematical no-op**
   - **Evidence:** `src/core/data/weather.ts:42` sets `sunny: { zoneWeight: { shallow: 1.4, deep: 0.75 } }`, but `src/core/fish.ts:36-38,56-67` filters `candidates` to a single `zone` before normalising `spawnWeight`. Multiplying every candidate in the pool by the same constant cancels out identically to `1.0`.
   - **Suggested fix:** Change `sunny` to modify `waitFactor` per zone (e.g., shallow `0.85`, deep `1.2`) or give sun-loving species `likes: ['sunny']`.
   - **Effort:** S

2. **Perfect Catch / Trophy Medals are physically impossible for humans on darting fish**
   - **Evidence:** `src/core/catchBar.ts:89-93,102,161,274-275`; simulation above shows **0.0%** human perfect rate on Golden Tench and Silver Ghost (and 0.3% on Pike) even on Carbon + Fluoro + Pro Reel. Directly breaks `docs/GAME_DESIGN.md:971` (*"perfect catch of a rare fish = top achievement"*).
   - **Suggested fix:** Replace zero-tolerance `!s.leftZone` with a small grace budget (e.g. `outsideTotalMs <= 350` ms, or only break perfect when continuously outside `> 150–200` ms) and re-sim to target ~15–25% perfect rate for a skilled player on max gear.
   - **Effort:** S

3. **River Bend `ZoneId` cannot separate Riffle vs. Seam fish pools**
   - **Evidence:** `src/core/location.ts:2` (`ZoneId = 'shallow' | 'deep'`); `src/core/data/locations.ts:42-44` maps both `riffle` and `seam` to `fishZone: 'shallow'`; `src/core/fish.ts:37` only checks `s.zone === zone`. Additionally, `locations.ts:46` has zero night shallow fish, causing `pickSpecies` (`fish.ts:59`) to ignore time-of-day at night.
   - **Suggested fix:** Let `Species` or `FishPool` target location zone `id`s (e.g., `riffle`, `seam`, `pool`) rather than collapsing everything into `'shallow' | 'deep'`.
   - **Effort:** M

### Major

4. **Gear gates are trivially bypassed by unbalanced Checklist bundles**
   - **Evidence:** `src/core/data/gearGates.ts:6-12` (`braided: 1, smooth: 1, carbon: 2, fluoro: 4, pro: 4`) counts all 6 bundles in `src/core/data/checklist.ts:26-57` equally. `duck-tax` (1 bleak = 30 s) unlocks Braided + Smooth; `dawn-chorus` (3 shallow commons = ~3 min) unlocks **Carbon Rod** before ever casting deep. Adding `petrol` (500 coins) + `shiny-ones` (3 gold fish farmed via shallow perfect roach) hits 4 bundles and unlocks **Fluoro + Pro** without catching a single deep or night fish.
   - **Suggested fix:** Gate gear on specific progression bundles (e.g., Carbon requires `bottom-of-things`; Fluoro/Pro require `night-shift`) or exclude `duck-tax` and `petrol` from gear-gate counts.
   - **Effort:** S

5. **Free unlimited naps + Deep Night inflation collapse the economy**
   - **Evidence:** `src/core/bedtime.ts:85-99`, `src/core/carMap.ts:42-47`, `src/core/data/fish.ts:112-127`. Deep Night + Fish Strip pays **200–220 cpm** (7× Shallow Day). Looping `Nap → Night (20:00)` clears the entire 17,050-coin shop in ~80–95 minutes and lets players spam dawn/dusk 30× in one Rain hour to brute-force Golden Tench.
   - **Suggested fix:** Compress Deep Night coin inflation (slightly raise Fish Strip cost or trim Catfish/Burbot base prices) and add a light cozy cooldown on naps (e.g., 2 real minutes or 1 nap per in-game day — see Studio Head ruling in `00-verdict.md`).
   - **Effort:** S–M

6. **Corn is a net-loss trap everywhere; Maggots are barely break-even**
   - **Evidence:** `src/core/data/baits.ts:38-51`, `src/core/fish.ts:46` (ROI math above). Buying Corn loses 2–17.7 coins/cast everywhere and is a literal no-op at Deep Dawn.
   - **Suggested fix:** Lower Corn to 15–20 coins/10 and wire the existing dead `baitCalm` stat (`barGear.ts:9`, `catchBar.ts:99`) so Corn calms big carp/bream/tench (or boosts gold odds). Strengthen Maggots' shallow wait cut (`0.6 → 0.45`).
   - **Effort:** S

7. **"Dawn Chorus" bundle asks for Day-only fish**
   - **Evidence:** `src/core/data/checklist.ts:28-29` (*"Dawn Chorus: Early fish for early birds."* → `roach, rudd, bleak`), while `src/core/data/fish.ts:45-58` restricts all three to `times: ['day']`. Players who nap to Dawn (`05:00–07:00`) cannot catch any of them.
   - **Suggested fix:** Add `'dawn'` to `roach`, `rudd`, and `bleak` `times` (as noted in `docs/GAME_DESIGN.md:624-625`), or rename the bundle.
   - **Effort:** S

8. **Asp's `difficulty: 0.5` is silently erased by `shallowCap = 0.4`**
   - **Evidence:** `src/core/data/fish.ts:82` (`asp`, `zone: 'shallow'`, `difficulty: 0.5`) vs `src/core/fish.ts:32,117` (`shallowCap: 0.4`). Every Asp fights at flat `0.40` with zero size scaling.
   - **Suggested fix:** Exempt `rare` species from `shallowCap` or raise `shallowCap` to `0.55`.
   - **Effort:** S

9. **Old Mossback fog rule contradicts visible weather after 10:00 AM**
   - **Evidence:** `src/core/data/weather.ts:46,53` fades fog out by 10:00 in-game, but `src/core/rare.ts:32` only checks `c.weather === 'fog'`. Old Mossback bites in bright sunny 15:00 afternoon during a Fog real hour.
   - **Suggested fix:** Either keep a light mist visual all hour whenever `weather === 'fog'`, or restrict Old Mossback to `minute < 600` with a higher spawn rate (`0.35`).
   - **Effort:** S

10. **River Bend current & Ferry Pike design contain mechanical contradictions**
    - **Evidence:** `docs/RIVER_BEND.md:45-56,84-85`. (a) Promises *"cast upstream (right) for a long seam run"* then cuts cast aiming — turning 20–30 s auto-reel-in into passive RNG annoyance. (b) Claims fight drift works *"like windy weather but stronger"*, but windy does not drift (`difficultyAdd: 0.05` only); unidirectional bar drift risks re-introducing the B3 sinker/overshoot bug. (c) Ferry Pike's `20–24 m` cast window on a 40 m Carbon rod (`CHARGE_HALF_CYCLE_MS = 900`) is a **90 ms** release window with no numeric meter.
    - **Suggested fix:** Raise auto-reel-in to 35–45 s (or make seam bonus purely distance-based until aimed casting exists); express river fight feel via pattern/speed rather than asymmetric gravity; widen Ferry Pike's rope band to `18–26 m` (180 ms) with the rope clearly drawn at that band.
    - **Effort:** M

### Minor

11. **`Sell all` does not protect Checklist or Gold-star fish** (`src/core/inventory.ts:221-224`). Add a bag Lock toggle or prompt/exclude checklist-fitting fish. (Effort: S)
12. **Flat Fish Knowledge tiers (`5/10/25`, `src/core/data/fishKnowledge.ts:2`) punish rare species:** 25 Catfish (~6.7% of deep night bites) requires ~375 deep night catches (~2.5 h) just to see `"Gold from 156 cm"`. Scale by rarity (e.g. common `5/10/25`, uncommon `3/7/15`, rare `1/3/8`). (Effort: S)
13. **Flat Daily Quest rewards (`src/core/data/quests.ts:43-50`) & late-game `beatRecord` wall:** `catchSpecies.rare` pays 55–60 coins (a quarter of one Catfish); `beatRecord` stalls once records are gold. Scale rewards by rod tier and replace/soften `beatRecord` once >50% of records are gold. (Effort: S)
14. **Hourly weather wait-time friction (`src/core/daily/weather.ts:40-45`):** A 15-min/day player waits a mean of 5 real days (90th percentile: 11 days) for a specific trophy weather with no countdown showing when the hour flips. Add a subtle forecast/timer. (Effort: S)
15. **Nibble-scumming exploit (`src/core/fishingSession.ts:154-159`):** Cancelling on nibble #2 costs 0 bait, letting players farm 0–1 nibble species (Pike, Pale One, Asp) for free. Low priority for single-player, important before tournaments. (Effort: S)
16. **Dead `baitCalm` tunable (`src/core/data/barGear.ts:9`, `src/core/catchBar.ts:99,171`):** Wire it to Corn or remove it. (Effort: S)

### Polish

17. **1.0 s bite window (`src/core/fishingSession.ts:77`)** is brisk for relaxed one-handed phone play (especially muted); consider `1200 ms`. (Effort: S)
18. **Camp items (`src/core/data/camp.ts`) lack the promised companion moments** from `GAME_DESIGN.md:991-994` (Pajkel warming hands, Bestia napping in bed, fire crackle). (Effort: M)
19. **Trophy 2.5 s `slipAfterMs` timer (`src/core/data/rare.ts:33`)** needs pulsing/warning bar feedback so losing a trophy at 85% progress feels fair, not buggy. (Effort: S)

---

## Missing Features

1. **Bag lock / Checklist protection on `Sell all`.**
2. **Weather countdown / forecast indicator** (critical now that weather is hourly and gates 3 trophies).
3. **Weekly Quests** (`docs/GAME_DESIGN.md:894-898`) for multi-day Quiet Lake retention alongside Camp.
4. **Tangible trophy payoff** (e.g., unlocking Alex's dinosaur hoodie from `GAME_DESIGN.md:58` at 3/3 Quiet Lake trophies).

---

## Open Questions for the Developer

1. **Intended total playtime for Quiet Lake:** `GAME_DESIGN.md:931` targets ~3–5 real days (~45–75 min total) before River Bend opens, while the shop holds 17,050 coins (~2.3 h normal play). Are Fluoro (2,000), Pro Reel (3,500), Night Kit (2,500), and Camp (5,500) meant to span Quiet Lake + River Bend?
2. **Quests per place in M2:** `docs/RIVER_BEND.md:124` says *"one set per real day per place"* (6 quests/day), contradicting `docs/GAME_DESIGN.md:560` (*"Shared day clock, daily quests and bait box across places"*). Which rule wins?
3. **Corn & `baitCalm`:** Should Corn stay a pure targeting bait (cheaper), or should we wire `baitCalm` so special baits actively calm the catch bar?
4. **Trophy timeline:** Are Quiet Lake's 3 rare trophies meant to be caught *before* driving to River Bend, or as long-tail return-visit goals?
