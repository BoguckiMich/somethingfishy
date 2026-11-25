# 05 — Senior Software Engineer Review

**Reviewer:** Senior Software Engineer  
**Scope:** Core/art/scene architecture, `LakeScene.ts` (3,320 lines), save/load robustness & security, low-end Android performance & memory, test coverage gaps, dead code, and error handling.

---

## Strengths (with evidence)

1. **Impeccable `src/core/` purity & determinism:** Across all 62 source files in `src/core/`, there are **zero** imports of Phaser, DOM (`window`, `document`), `localStorage`, `Date.now()`, `new Date()`, `Math.random()`, `navigator`, or `requestAnimationFrame`. Storage (`src/core/save.ts:239-246`), RNG (`src/core/fishingSession.ts:51`), and real date/hour (`src/core/daily/weather.ts:40`) are cleanly injected.
2. **Strong automated coverage in `core/`, `art/`, and `companions/`:** `npx tsc --noEmit` exits 0; `npm test` passes 65 test files / 886 tests in ~10.7 s (`src/core/`: 41 test files; `src/art/`: 17 test files; `src/scenes/companions/`: 6 test files).
3. **XSS-safe DOM overlays & whitelist-based save normalisation:** Zero `innerHTML` / `outerHTML` / `eval` in production `src/ui/` and `src/scenes/` (`el()` uses `textContent`, `src/ui/panel.ts:23-28`). All save normalisers (`src/core/save.ts:68-183`, `src/core/story/story.ts:177-190`, `src/core/rare.ts:91-103`) whitelist known IDs/keys, blocking prototype pollution (`__proto__`/`constructor`).
4. **Correct UTF-8 / Polish diacritics in export codes:** `src/core/saveCode.ts:52-55,74` uses `TextEncoder` + custom base64url + `TextDecoder('utf-8', { fatal: true })` + FNV-1a checksum, verified with `'Żaneta'` / `'Paweł Ł.'` (`src/core/saveCode.test.ts:9,33-39`).
5. **Defensive `localStorage` & production flag guard:** All storage calls are wrapped in `try/catch` with graceful degradation (`src/main.ts:14-19`, `src/core/save.ts:248-289`, `src/ui/settingsPanel.ts:183`), and `src/urlParams.ts:5-7` strips all URL dev flags in `PROD` builds.

---

## Problems

### Blocker

1. **Root-absolute `/fonts/...` URLs break sub-path deployments (GitHub Pages)**
   - **Evidence:** `index.html:16,24` uses `url('/fonts/vt323-latin-ext.woff2')` and `url('/fonts/vt323-latin.woff2')`, contradicting `vite.config.ts:6` (`base: './'`) and `index.html:7-8` (`./icons/...`). On `/somethingfishy/`, both fonts 404 and `font-display: block` stalls boot before falling back to system `monospace`.
   - **Suggested fix:** Change lines 16 and 24 in `index.html` to `./fonts/vt323-latin-ext.woff2` and `./fonts/vt323-latin.woff2`.
   - **Effort:** S

2. **60 FPS CPU re-rasterisation of Sign & Trophy Board + full re-rasterisation on Travel**
   - **Evidence:** `src/scenes/LakeScene.ts:2535,2546` calls `ensureTrophyBoardTexture` and `ensureSignTexture` every frame; `src/art/textures.ts:104,111,123` executes `Raster.fromSprite(...)` *before* `addRaster` checks `if (scene.textures.exists(key)) return;`. Similarly, `createTextures` and `createRiverTextures` (`textures.ts:132-186,206-240`) re-allocate and paint 200+ `Raster`s on CPU on every travel remount before discarding them.
   - **Suggested fix:** Guard `if (scene.textures.exists(key)) return key;` *before* calling `Raster.fromSprite` in `ensureSignTexture`, `ensureTrophyBoardTexture`, `createTextures`, and `createRiverTextures`.
   - **Effort:** S

### Major

3. **`LakeScene.ts` God Object (3,320 lines / 163 KB)**
   - **Evidence:** `src/scenes/LakeScene.ts:1-3320` owns ~15 subsystems (dev URL flags, save/profile persistence, fishing loop, bedtime/nap/fade, travel handoff, weather transitions/VFX, sky/water/camp/lantern procedural drawing, story/moments, input routing, HUD/catch overlay, DOM panel lifecycle). Multiple bugs in `06-qa-bugs.md` stem directly from tangled state in this single file.
   - **Suggested fix:** Incremental strangler-fig extraction as M2 proceeds: start with `WeatherRenderer.ts`, `WorldRenderer.ts`, `TravelController.ts`, and `SceneSaveController.ts`, then `DevFlags.ts` and `CatchOverlayView.ts`.
   - **Effort:** L

4. **Over-supersampled backing store (`K=4` = `1440×2560`) + ~1,800 per-frame `Graphics.fillRect` calls**
   - **Evidence:**
     - `src/renderScale.ts:14-22` + `src/main.ts:30-31`: On a common 1080p Android phone (`412×915` CSS, DPR 3), `fit * dpr = 3.43` → `K = 4` (`1440×2560` = 14.7 MB RGBA framebuffer), supersampling 1.78× more pixels than the physical screen.
     - `src/scenes/LakeScene.ts:2651-2766,2890-2989,3000-3012,3134-3205`: Rebuilds ~1,500–2,000 `Graphics.fillRect` calls every frame (lantern ~350, campfire ~250, water glints/sparkles/ripples ~190, posts ~300, rain/fog ~165, rod/line ~260) + allocates string arrays in `drawCarCue` (`2588-2594`) and `drawBoardButton` (`3272-3274`).
     - `repaintSky()` (`LakeScene.ts:2812-2816`) allocates ~490 KB (`new Raster` + `Uint8ClampedArray`) ~41 times during a 10 s weather crossfade (~20 MB churn) and mutates DOM styles + `<meta name="theme-color">` each time.
     - `textures.ts:124` creates 200–300+ individual `<canvas>` WebGL textures instead of packed atlases.
   - **Suggested fix:** Cap `K` at `3` (`renderScale.ts:14`); reuse a single `Raster`/`ImageData` buffer in `repaintSky()`; pre-bake lantern/campfire radial glows, car pin, and wax seal into textures; pack small sprites into an atlas before Play Store release.
   - **Effort:** S (cap `K` + `repaintSky` reuse) / M (pre-baked glows + atlas)

5. **Companion behaviour & scene positions hardcoded to Quiet Lake**
   - **Evidence:** `src/scenes/companions/behaviour.ts:17-23,148,204-205,339` hardcodes `PAJ_SPOT`, `DOG_SPOT`, `PLAY_AREA`, `CAR_STAND`, etc. `src/core/data/locations.ts:48` comments that `RIVER_BEND.spots` must duplicate Quiet Lake's geometry; `LakeScene.ts:174-181,198-199` hardcodes `ALEX_POS` and `POST_BASES`.
   - **Suggested fix:** Pass `LocationSpots` into `CompanionState` and `LakeScene` rendering so M2+ locations can have distinct layouts.
   - **Effort:** M

6. **Save/Load security, bounds, and M2 migration gaps**
   - **Evidence:**
     - `src/core/saveCode.ts:61-74` has no max input length (DoS risk on huge paste); `src/core/save.ts:130,148,155` maps entire raw `bag`/`quests` arrays *before* slicing to max size.
     - `src/core/save.ts:63-65,73-79,96-97,150-151,188` leaves numeric fields (`coins`, `worms`, `lengthCm`, `weightG`, `clock.day`, etc.) unbounded (`1e300` passes `Number.isFinite`).
     - `src/core/save.ts:34` hardcodes `SAVE_KEY = 'rybki.save.v1'` while `CURRENT_VERSION = 1` (`save.ts:37`) — changing `SAVE_KEY` on a v2 bump would orphan existing saves unless fallback-read logic is added.
     - `src/core/profile.ts:25-31`: `String(raw?.player ?? '')` coerces malformed JSON objects `{}` into `"[object Object"`.
     - `src/core/save.ts:153-181` invokes 9 normalisers twice each per load.
   - **Suggested fix:** Cap save-code input at 64 KB; slice raw arrays before `.map()`; clamp numeric fields to sane ceilings; require `typeof raw?.player === 'string'` in `profile.ts`; keep `SAVE_KEY` stable across schema versions; bind normalised locals once.
   - **Effort:** S

7. **Fragile `remount()` via module-global handoff + `setTimeout(..., 0)`**
   - **Evidence:** `src/scenes/travelHandoff.ts:18-28`, `src/scenes/LakeScene.ts:558-567,1150-1159`. Old scene stays alive for a tick; new scene runs `setupSave()` (reading/writing storage) before `takeHandoff()` overwrites state and persists a second time.
   - **Suggested fix:** Pass handoff via Phaser `scene.init(data)` / `scene.restart(data)` and skip `loadSave()` when handoff data is present.
   - **Effort:** S

### Minor

8. **Dead code & doc drift:**
   - `baitCalm` (`src/core/data/barGear.ts:9`, `src/core/catchBar.ts:99,171`) is never set above 0.
   - Unused `@fontsource/*` packages in `package.json:19-22`.
   - `docs/HANDOFF.md` lists slices 23a–25a as unmerged branches and `riverArt.ts` as placeholder, whereas `main` already has 23a–25b merged.
   - **Effort:** S

9. **Zero automated tests outside `core/`, `art/`, and `companions/`:**
   - **Evidence:** `src/ui/` (21 files), `src/audio/` (5 files), `src/` root (6 files), and `LakeScene.ts` / `travelHandoff.ts` / `BottomBar.ts` / `CatchBarView.ts` / `MomentsView.ts` / `StoryView.ts` have **0 tests**. Bugs #2, #3, #4, #6 in `06-qa-bugs.md` all live in untested scene/UI glue.
   - **Suggested fix:** Add Vitest tests for `travelHandoff`, `SceneSaveController` (once extracted), and a Playwright production-build smoke test served from a sub-path (`/somethingfishy/`).
   - **Effort:** M

### Polish

10. **No top-level boot error boundary:** `src/main.ts:25` calls `void loadFonts().then(...)` with no `.catch()` and no `webglcontextlost` handler — if WebGL fails on an older Android WebView, the player sees an eternal blank `#1b2b3a` screen. (Effort: S)

---

## Missing Features (Engineering Foundations)

1. **Sub-path production smoke test** (catches `/fonts/` 404s, broken assets, and console errors automatically in CI).
2. **Dev-mode FPS / draw-call / texture-count HUD** to profile low-end Android before M2/M3.
3. **Global JS error/rejection ring buffer** (exportable from Settings) for closed-beta diagnostics without violating zero-data-collection privacy.
4. **Unit-tested `v1 -> v2` save migration** before M2 changes the save schema.

---

## Open Questions for the Developer

1. **Minimum Android target spec:** What is the lowest-end phone/WebView we need to hold 60 FPS on?
2. **M2 `SAVE_KEY` strategy:** Confirm `SAVE_KEY` stays `'rybki.save.v1'` permanently while `CURRENT_VERSION` increments internally (`1 -> 2`)?
3. **Companion layouts per place:** Will River Bend, Old Quarry, and Sea Pier have distinct dock/car/fetch coordinates (requiring `behaviour.ts` decoupling now)?
