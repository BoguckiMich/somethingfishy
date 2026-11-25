# 08 — Prioritised Roadmap Proposal

**Author:** Studio Head  
**Purpose:** Actionable fix order before finishing M2 (River Bend), before Google Play (M3 Closed Beta / M5 2.0), and nice-to-haves — explicitly marking every item that **conflicts with `docs/GAME_DESIGN.md` or `docs/RIVER_BEND.md`** and why we should overturn it.

---

## Phase A — Fix Before Finishing M2 ("River Bend")

*Target: ~2–3 days of focused stabilisation before building slices 25c–25g. Every item here is either a live blocker, a broken core mechanic, or a prerequisite that prevents M2 from inheriting Quiet Lake's bugs.*

### A1. Immediate Hotfixes (Half-day, all Effort S)
1. **Fix `/fonts/` 404 on sub-paths:** Change `index.html:16,24` from `/fonts/...` to `./fonts/...` *(Eng/Release Blocker)*.
2. **Guard texture cache before CPU rasterisation:** Add `if (scene.textures.exists(key)) return key;` before `Raster.fromSprite` in `src/art/textures.ts:104,111,132-240` *(Eng Blocker)*.
3. **Fix iOS / background audio resume burst:** Require `ctx.state === 'running'` in `src/audio/AudioEngine.ts:53-55` + add `DynamicsCompressorNode` and 15 ms pause fade *(Audio Blocker/Major)*.
4. **Fix Q4 soft-lock & Shiver 1 reachability:** Include `00:00–05:00` in `isNightVisit` (`story.ts:89`), add bundle fallback so day-only players don't lock Q5–Q7, hold Q4 during `21:00–23:59` until Pajkel enters the car at `00:00` so players actually see the blinking star, and prevent Q8 from firing ahead of Q7 *(Narrative Blocker/Major)*.
5. **Fix `LakeScene.ts` state bugs:** Save trophy medals on non-record catches (`1449`); persist imported `profile` before `remount()` (`1574-1582`); call `loadClock()` & clear transient state in `loadGame()`/`startNewGame()` (`1570-1600`); guard `applyProfile` with `!this.sandbox` (`2006`); stop `slipNoteAge` double `setText()` (`2485-2494`); register River hut with `img()` (`2097`) and patch missing River dock corner tile (`final_step_92.png`) *(Eng/QA Major)*.

### A2. Core Gameplay & Balance Fixes (1 day)
6. **Fix Sunny weather no-op & Fog visibility:** Change `sunny` (`weather.ts:42`) from cancelled `zoneWeight` to per-zone `waitFactor` or `likes: ['sunny']`; give `fog` a visible mist floor all hour (or restrict Old Mossback to `< 10:00` with higher odds); attenuate sun/moon/glitter in rain & overcast *(Game Design/Art Blocker & Major)*.
7. **Fix Perfect Catch impossibility on darting fish/trophies** *(CONFLICTS WITH `GAME_DESIGN.md:944,995` — see table below)*: Add a `300–350 ms` cumulative (or `150–200 ms` continuous) grace buffer to `CatchBarState.leftZone` (`catchBar.ts:161,275`), plus live Perfect star & sweet-spot pulse on `CatchBarView.ts` *(Game Design Blocker + UI/UX Major)*.
8. **Fix Gear Gates, Corn trap, Dawn Chorus, and Asp cap** *(Gear Gates CONFLICT WITH `GAME_DESIGN.md:986-988`)*:
   - Exclude `duck-tax` & `petrol` from gear-gate counts (or gate Carbon on `bottom-of-things`, Fluoro/Pro on `night-shift`).
   - Lower Corn to 15–20 coins/10 and wire dead `baitCalm` (`barGear.ts:9`) to Corn; strengthen Maggots (`0.6 → 0.45`).
   - Add `'dawn'` to `roach`, `rudd`, `bleak` so `"Dawn Chorus"` matches its name.
   - Exempt `rare` species from `shallowCap = 0.4` so Asp's `0.5` difficulty works.
   - Compress Deep Night coin inflation slightly + add a gentle 2-min real-time cooldown on consecutive naps *(CONFLICTS WITH `GAME_DESIGN.md:492-495` — see table below)*.
9. **Add `"Sell all"` protection** for Checklist-fitting and Gold/Medal fish (or a per-fish bag lock) + `"Open Checklist"` link on locked Shop gear cards *(Game Design/UI Major)*.

### A3. UI/UX, Copy & M2 Architecture Prerequisites (1–1.5 days)
10. **Fix Red-on-Green Catch Bar colorblind blocker:** Add high-contrast white/gold inward chevrons or dashed border on the red sweet-spot core (`CatchBarView.ts:88-103`) *(UI/UX Blocker)*.
11. **Remove top-right `BOARD_BTN`** *(CONFLICTS WITH `GAME_DESIGN.md:87-88,839-840` — see table below)*: Resolves the update-toast collision, fight progress-strip crowding, and `signAction()` bypass in one move. Also delay cast charge visuals by ~120 ms on shore objects so taps don't flick Alex's rod, fix clock wind-icon padding, center catch size+stars, and fix Pajkel bubble overlap *(UI/UX Blocker/Major)*.
12. **Fix VT323 missing glyphs, custom names, grammar & `"DS4"`:** Replace `★`/`✓`/`○` with pixel sprites/squares; add `{player}/{companion}/{dog}` interpolation for hardcoded names; fix `"Catch a eel"` (`quests.ts:323`); change `"The DS4"` → `"The car"` (`checklist.ts:53`); introduce a lightweight `src/i18n/en.ts` so all new M2 River Bend copy lands in one place *(Narrative/Copy Blocker/Major)*.
13. **M2 Data & Layout Prerequisites (before slices 25c–25g):**
    - Extend `ZoneId` / `FishPool` (`location.ts`, `fish.ts`) so River Bend's `riffle` and `seam` have distinct fish pools *(Game Design Blocker for M2)*.
    - Inject `LocationSpots` into `src/scenes/companions/behaviour.ts` so companions aren't hardcoded to Quiet Lake *(Eng Major)*.
    - Cap `scaleK` at `3` (`renderScale.ts:14`) and reuse `repaintSky()` buffer *(Eng Major)*.
    - **Revise River Bend current & Ferry Pike design before slice 25c** *(CONFLICTS WITH `docs/RIVER_BEND.md:45-56,84-85` — see table below)*: Drop forced 20–30 s auto-reel-in without cast aiming (or lengthen to 40 s), express river fight feel via pattern/speed rather than asymmetric bar gravity, widen Ferry Pike's rope band to `18–26 m`, and add a fallback milestone for R4 (*"first dusk"*).
    - Add **procedural River current + Rain + Wind ambience** (`src/audio/ambient.ts`) so M2 sounds as good as it looks *(Audio High-Impact Missing Feature)*.

---

## Phase B — Fix Before Google Play Release (M3 Closed Beta / M5 2.0)

*Target: Required to pass Play Console review, 12-tester 14-day closed beta, and Android Vitals.*

1. **Capacitor Android Packaging (Target API 36):** Add `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/splash-screen`; disable `VitePWA` & `updateToast` in native builds; lock `androidScheme: 'https'` + `hostname: 'localhost'`; configure Play App Signing keystore and 64-bit `.aab` build *(Release Blocker)*.
2. **Android 15/16 Edge-to-Edge & Hardware Back Button:** Add `env(safe-area-inset-*)` to `#game` and `openPanel()`; add ARIA dialog semantics, `Escape` key, and Capacitor `backButton` panel stack + double-back exit confirmation *(Release/UI Blocker & Major)*.
3. **Legal, Privacy & Licensing:** Host `privacy.html` (zero data collected), add in-app `"About & Licenses"` (VT323 OFL 1.1, Phaser 4 MIT, Capacitor MIT, app version, Privacy Policy link), submit Data Safety + IARC (not Under 13), confirm consent for Alex/Pajkel likenesses + ship M4.5 appearance customisation, add repo `LICENSE` *(Release Blocker/Major)*.
4. **Save Durability & Diagnostics:** Mirror saves to `@capacitor/preferences` (for Android Auto Backup) with `localStorage` fallback; cap save-code size (64 KB) + clamp numeric bounds + test `v1 -> v2` migration; add local JS error ring buffer + `"Copy diagnostic log"` in Settings; add `webglcontextlost` recovery and `appStateChange` pause/persist *(Release/Eng Major)*.
5. **Polish Localization & Full i18n Migration (M3):** Migrate remaining Quiet Lake strings into `src/i18n/`, implement Polish `one/few/many` plurals and species grammatical forms, and widen `BottomBar` / `TIP_MAX_CHARS` for longer Polish labels *(Copy/Localization Blocker for M3)*.
6. **Accessibility & Mobile Ergonomics:** Lighten `COLORS.dim` (`#8a7660 → #b59f84`) for WCAG AA contrast; raise map pins & gear button to ≥44×44 px; add Settings toggles for **Haptics** and **Colorblind Catch Bar**; honour `prefers-reduced-motion`; remove global `user-scalable=no` *(UI/UX Major)*.
7. **Low-End Android Performance & Play Store Assets:** Extract remaining `LakeScene.ts` subsystems (`WorldRenderer`, `WeatherRenderer`, `DevFlags`, `CatchOverlayView`); pre-bake glow sprites & pack small sprites into an atlas; gate silent audio subgraphs; generate RGBA Adaptive Icons + Android 12+ splash + 1024×500 Feature Graphic + phone screenshots; add CI Playwright sub-path smoke test; complete 12-tester / 14-day Closed Beta *(Eng/Release/QA Major)*.

---

## Phase C — Nice-to-Haves & High-Value Polish

- **Bring Camp to life:** Redraw Bestia's bed with cushion depth and let her sleep in it; add campfire crackle SFX + dampen fire in rain; add tent night glow; shift string lights clear of Trophy Board; add Pajkel warming hands animation.
- **Distinct audio celebrations & foley:** Separate stingers for Trophy, Perfect, and Medal catches; road/engine audio on `roadCard.ts`; wet footsteps on Q5; UI locked/error thud; Bestia petting foley.
- **Visual pixel-art polish:** Fix 1.78× weather icon (`logPanel.ts:122` → 18 px), standardize DOM frames/icons to 2×, add 1 px outline to `BOBBER`, remove stray pixel in `appIconArt.ts:47`, recolor `CAR_ICON` white in `journalIconArt.ts:19`, give the 3 trophy fish bespoke silhouettes, populate `FISH_OVERRIDES`.
- **Quality-of-life & retention depth:** Scale Fish Knowledge tiers by rarity (`5/10/25` → `1/3/8` for rares); interactive weather/clock tooltip with time-to-next-hour; Weekly Quests; unlockable dinosaur hoodie (`GAME_DESIGN.md:58`) for 3/3 Quiet Lake trophies; unlockable/rotating species facts for R5/O3/E1.

---

## Conflicts With Existing `GAME_DESIGN.md` / `RIVER_BEND.md` Decisions

| # | Existing Decision | Proposed Change | Why We Should Overturn It |
|---|---|---|---|
| **1** | **Zero-tolerance Perfect Catch:** *"never leaves the green zone for the whole fight"* (`GAME_DESIGN.md:944,995`) | Allow a **300–350 ms cumulative** (or 150–200 ms continuous) grace buffer outside the green zone | Proven mathematically **0.0% possible** for humans on Golden Tench & Silver Ghost (and 0.3% on Pike) because darting fish move 3× faster than max zone speed (`2.1` vs `0.71` u/s). Without grace, medals on darting trophies are unreachable RNG. |
| **2** | **All 6 bundles count equally for Gear Gates** (`GAME_DESIGN.md:986-988`) | Exclude `duck-tax` & `petrol` from gate counts, or gate Carbon on `bottom-of-things` & Fluoro/Pro on `night-shift` | `duck-tax` (1 bleak, 30 s) + `dawn-chorus` (3 shallow commons, 3 min) currently unlocks Carbon Rod before the player ever casts into deep water, defeating the entire purpose of slice 23a. |
| **3** | **Keep two Notice Board entry points (`BOARD_BTN` + shore sign)** (`GAME_DESIGN.md:87-88,839-840`) | **Delete `BOARD_BTN`** from top-right; keep shore sign (or add a bottom-bar badge only if phone tests still show misses) | Top-right `BOARD_BTN` collides with `updateToast`, crowds the fight progress strip by 1–2 px, bypasses `signAction()` (breaking story bottle taps), and sits in the worst thumb zone for one-handed portrait play. |
| **4** | **Unlimited free naps at any time** (`GAME_DESIGN.md:492-495,512`) | Keep naps free & cozy, but add a **2-minute real-time cooldown** + compress Deep Night coin inflation | Unlimited naps turn Deep Night + Fish Strip into a 200+ cpm loop that buys out the entire 17,050-coin shop in ~85 minutes and lets players spam dawn/dusk 30× per Rain hour. A short diegetic cooldown protects pacing without adding an energy bar. |
| **5** | **River Bend bobber drift without aimed casting + unidirectional fight drift + 20–24 m Ferry Pike band** (`docs/RIVER_BEND.md:45-56,84-85`) | Lengthen/drop auto-reel-in until aiming exists; use pattern/speed (not asymmetric gravity) for river fights; widen Ferry Pike band to **18–26 m** | Without cast aiming, auto-reel-in has no player agency; asymmetric bar gravity risks re-introducing the B3 overshoot/sinker bug; a 4 m band on a 40 m rod is a 90 ms blind release window. |
| **6** | **Canvas `imageRendering = 'auto'` blur on non-integer phones + `K` up to 4×** (`src/main.ts:43-46`, `renderScale.ts:14`) | Cap **`K <= 3`** and keep **`image-rendering: pixelated`** on the game canvas | `K=4` (`1440×2560`) oversamples 1080p Android phones by 1.78×, risking thermal/battery issues, while `auto` blurs hand-authored pixel art on most phones. |
