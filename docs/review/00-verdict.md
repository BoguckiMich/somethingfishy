# Pre-Production Greenlight Verdict — Something Fishy (Rybki)

**Date:** 2026-11-25  
**Reviewer:** Studio Head (synthesizing Game Design, UI/UX, Narrative & Copy, Pixel Art, Audio, Engineering, QA, and Google Play Release reviews)  
**Build Audited:** `main` (`npx tsc --noEmit` clean; `npm test` 65 files / 886 tests passing; live 360×640 browser QA on `http://localhost:5179`)

---

## Overall Verdict: **CONDITIONAL GREENLIGHT (Gift / M2) · NO-GO (Google Play Today)**

*Something Fishy* already has **real heart, craft, and engineering discipline** that most indie prototypes never reach. As a personal gift for Alex, it is charming, playable, and close to something genuinely special. **However, it is NOT ready to greenlight straight into M2 content expansion or a public Play Store beta without a short, focused stabilisation pass first.**

Why? Our audit uncovered **real math bugs that silently nullify core mechanics** (Sunny weather does literally nothing; Perfect Catch medals on darting trophies are 0.0% impossible for humans; Corn loses coins on every cast), **a narrative soft-lock** (avoiding night or napping to 02:00 locks chapters Q5–Q7 forever, and Q4's iconic night blink almost never triggers), **a production deployment blocker** (`/fonts/...` 404s on GitHub Pages sub-paths), and **a 60 FPS CPU re-rasterisation bug** plus a 3,320-line `LakeScene.ts` that is starting to leak cross-system bugs (lost trophy medals, dropped imported names, stale reset state).

Fix the **M2-gate items** (roughly 2–3 days of focused work), then greenlight M2 River Bend. Google Play has a clean, predictable Capacitor path for M3/M5.

---

## Top 10 Issues Ranked by Impact

| # | Issue | Severity | Owner | Evidence |
|---|---|---|---|---|
| **1** | **Production font 404 breaks typography on GitHub Pages / sub-paths** | Blocker | Eng / Release | `index.html:16,24` uses root-absolute `url('/fonts/vt323-*.woff2')` despite `vite.config.ts:6` (`base: './'`). On `/somethingfishy/`, fonts 404 and fall back to `monospace`. |
| **2** | **Perfect Catch medals are physically impossible on darting fish/trophies** | Blocker | Game Design | `src/core/catchBar.ts:161,275` fails on a single 8.33 ms tick outside the zone while darting fish move 2.1 u/s vs max zone speed 0.71 u/s. Sim: **0.0%** human rate on Golden Tench & Silver Ghost, **0.3%** on Pike. |
| **3** | **Q4 night milestone soft-locks Q5–Q7 and makes Shiver 1 almost unreachable** | Blocker | Narrative / QA | `src/core/story/story.ts:89,100-112,165` (`nightFromMinute = 21*60` misses `00:00–05:00` naps; strict ordering blocks Q5–Q7 if night skipped; Q4 fires ~22:30 before Pajkel's `00:00` bedtime so players get the day bottle instead of the blink). |
| **4** | **60 FPS CPU sprite re-rasterisation + `K=4` (`1440×2560`) Android fill-rate risk** | Blocker / Major | Engineering | `src/art/textures.ts:104,111,123` rasterises Sign & Trophy Board every frame *before* checking `textures.exists()`; `src/renderScale.ts:14-22` pushes 1080p phones to `K=4` (14.7 MB framebuffer) with ~1,800 `Graphics.fillRect` calls/frame. |
| **5** | **Red-on-green Catch Bar sweet spot fails red-green colorblind players** | Blocker | UI/UX | `src/scenes/CatchBarView.ts:88-103` draws a flat red rectangle inside a flat green rectangle with zero shape/pattern/border distinction (confirmed in live 360×640 fight screenshot). |
| **6** | **Sunny weather is a mathematical no-op; Fog is invisible after 10:00 AM** | Blocker / Major | Game Design / Art | `src/core/data/weather.ts:42` + `src/core/fish.ts:36-38,56-67` (single-zone `zoneWeight` cancels on normalisation); `LakeScene.ts:2967-2970` hides fog after 10:00 while HUD/Pajkel/Old Mossback still say Fog. |
| **7** | **iOS / background audio resume causes a loud queued-SFX blast** | Blocker | Audio | `src/audio/AudioEngine.ts:53-55,102-110` checks `ctx.state !== 'closed'` instead of `=== 'running'`, queuing sounds on a suspended context until the next tap. |
| **8** | **Progression & economy leaks: bypassed gear gates, Corn trap, nap-spam** | Major | Game Design | `src/core/data/gearGates.ts:6-12` + `checklist.ts:26-57` (Duck Tax + Dawn Chorus = 2 bundles in 3 min → Carbon Rod before deep fishing); Corn is negative ROI everywhere; free unlimited naps enable a 200+ cpm night loop (entire 17,050-coin shop in ~85 min). |
| **9** | **River Bend `ZoneId` collapses Riffle & Seam + `behaviour.ts` hardcodes lake coords** | Blocker (M2) | Game Design / Eng | `src/core/data/locations.ts:42-44` gives both `riffle` and `seam` `fishZone: 'shallow'`; `src/scenes/companions/behaviour.ts:17-23` hardcodes Quiet Lake pixel spots. |
| **10** | **Cross-system state bugs in 3,320-line `LakeScene.ts` + zero UI/Scene tests** | Major | Engineering / QA | `LakeScene.ts:1449` drops trophy medals on non-record catches; `1574-1582` drops imported profile names across places; `1570-1600` skips `loadClock()` and leaves stale runtime state; 0 tests in `src/ui/` and `src/scenes/` (outside `companions`). |

---

## Top 5 Things Where the Game Already Shines (Protect These)

1. **Pure, deterministic `src/core/` architecture & bot-tested catch physics** — Zero Phaser/DOM/Date/Math.random imports across all 62 core files, 886 passing tests, and seeded bot benchmarks (`src/core/catchBar.test.ts`). *Never let Phaser or DOM leak into `src/core/`.*
2. **Cozy tone, character voices, and running gags** — W.'s dry epistolary voice, Pajkel's oblivious warmth, Bestia's "no take, only throw" fetch and physical comedy, and the 3-shiver whimsical-spooky arc (`docs/STORY.md`, `src/core/data/story.ts`, `src/core/data/pajkelLines.ts`).
3. **Atmospheric day/night palette & procedural pixel-art pipeline** — `src/art/dayCycle.ts` + `src/art/palette.ts` + `src/art/riverArt.ts` (Slice 25b River Bend already looks genuinely inviting at 360×640, and Quiet Lake at night with lantern + fireflies + campfire has real charm).
4. **Cozy-first retention ergonomics** — Zero soft-locks (`freeWormsIfStuck`), gentle streak decay (drops 1 tier, never to 0), auto-paying unclaimed quests at midnight, and gold/FOTD hand-in warnings on the Checklist.
5. **Tactile wooden 9-slice DOM UI & scroll ergonomics** — Unified `frameArt.ts` frames, pinned shop/bag strips, dynamic top/bottom scroll-fade gradients (`src/ui/panel.ts:141-155`), and zero `innerHTML` XSS exposure.

---

## Where It *Should* Shine — But Doesn't Yet

- **Soundscape & Atmosphere:** Rain, wind, campfire crackle, and the new River Bend current are **completely silent** (`src/audio/ambient.ts`), and Trophy/Perfect/Medal catches reuse the same generic fanfare (`LakeScene.ts:1707`). For a cozy game played in bed, audio atmosphere should be a crown jewel.
- **Camp & Trophy Payoff:** The 5,500-coin Camp sink (`src/core/data/camp.ts`) is mostly static sprites — Bestia never uses her bed (which looks like a flat blue puddle on the grass), the campfire burns through pouring rain, and Pajkel never warms his hands.
- **First-5-Minutes Polish & Clarity:** Tapping a shore object flicks Alex's rod and flashes the charge bar (`LakeScene.ts:756-766`); short-tapping water spawns a duplicate hint toast; `BOARD_BTN` collides with the update toast and fight strip; custom names are ignored in 10+ hardcoded lines.

---

## Specialist Disagreements & Studio Head Rulings

1. **Pixel-Art Purity vs. Text Crispness vs. Android GPU Budget** *(Art Director vs. UI/UX vs. Engineer)*
   - *Conflict:* Art Director wants `image-rendering: pixelated` always on; UI/UX relies on `main.ts:45` (`auto` blur) + `K=4` so VT323 stays even; Engineer warns `K=4` (`1440×2560`) melts budget Android GPUs.
   - *Ruling:* **Cap `K` at 3** (cuts 1080p fill-rate ~44%), keep `image-rendering: pixelated` on the canvas, and fix the 1.78× weather icon + DOM mixels to a clean 2× standard.
2. **Top-Right `BOARD_BTN` vs. Diegetic Shore Sign** *(UI/UX vs. QA / Tester History)*
   - *Conflict:* UI/UX wants `BOARD_BTN` deleted (collides with update toast + fight strip, unreachable by thumb, bypasses `signAction()`); QA notes testers missed the shore sign.
   - *Ruling:* **Delete `BOARD_BTN` from top-right.** Keep the shore sign as the primary entry, ensure its glint + bigger art + gold glow teach it, and if phone tests still show misses, add a badge inside the thumb-reachable bottom bar — never top-right.
3. **Free Unlimited Naps vs. Economy Balance** *(Game Designer vs. Cozy Ethos)*
   - *Conflict:* Game Designer wants 1 nap per in-game day to stop 200+ cpm Deep Night farming; Narrative/Cozy warns against anything feeling like an energy limit for a 15-minute lunch player.
   - *Ruling:* **Do not hard-cap naps to 1/day.** Keep naps free so short sessions can reach any time-of-day quest, but **compress Deep Night coin inflation** (rebalance Fish Strip / Catfish / Burbot) and add a tiny diegetic cooldown (e.g. can't nap twice within 2 real minutes).
4. **Full i18n Extraction Now vs. M3** *(Copywriter/Localization vs. Engineer/Release)*
   - *Conflict:* Copywriter wants all 46 files extracted to `src/i18n/` before M2; Engineer/Release warns a 46-file rewrite stalls M2.
   - *Ruling:* **Hybrid.** Add a tiny `src/i18n/en.ts` + `{player}/{companion}/{dog}` interpolator **now** so all new M2 River Bend copy lands cleanly in one place, and migrate legacy Quiet Lake strings in M3.
5. **Big-Bang `LakeScene.ts` Rewrite vs. Shipping M2** *(Engineer vs. Game Designer)*
   - *Conflict:* Engineer wants `LakeScene.ts` (3,320 lines) decomposed immediately; Game Designer wants M2 playable for Alex.
   - *Ruling:* **Strangler-fig extraction.** Fix the 5-line texture cache guards and bugs immediately, then extract only the slices M2 touches (`LocationSpots` for `behaviour.ts`, `WeatherRenderer`, `WorldRenderer`, `TravelController`) as M2 progresses.
