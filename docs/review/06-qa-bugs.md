# 06 — QA Bug Reports

**Reviewer:** QA Lead (combining live 360×640 browser QA on `http://localhost:5179` and code-level verification)  
**Test Environment:** Portrait 360×640 viewport, Vite 8 dev server, `npx tsc --noEmit` (clean), `npm test` (65 files / 886 tests passing). Zero console errors or 404s observed on local dev root (`/`).

---

## Strengths (Verified Clean in Live 360×640 QA)

- **Zero console errors / zero runtime exceptions** across 15+ tested screens, modals, weather states, fights, and River Bend travel (`http://localhost:5179`).
- **Core panels render and scroll cleanly at 360×640:** Shop Buy/Sell tabs, Bag (`Go to Shop`), Fish Log (19/19 grid, caught detail, locked tile modal), Checklist accordion (gold-fish warning, Give, Pay), and Settings (sliders, Save code fold, Start over two-step confirm).
- **Catch bar responsiveness & River Bend travel flow** both work smoothly end-to-end without soft-locking.

---

## Bug Reports

### BLOCKER

#### BUG-01: Production font 404 on sub-path deployments (GitHub Pages)
- **Severity:** Blocker
- **Evidence:** `index.html:16,24` (`url('/fonts/vt323-latin-ext.woff2')`, `url('/fonts/vt323-latin.woff2')`) vs `vite.config.ts:6` (`base: './'`).
- **Steps to reproduce:** Run `npm run build` and serve `dist/` under a sub-path (e.g. `https://boguckimich.github.io/somethingfishy/`).
- **Expected:** Both VT323 `.woff2` files load relative to `index.html` (`./fonts/...`).
- **Actual:** Browser requests domain-root `/fonts/...` → HTTP 404. Text stalls (`font-display: block`) then falls back to system `monospace`, breaking layout and Polish diacritics.
- **Fix / Effort:** Change `/fonts/` → `./fonts/` in `index.html:16,24` (**S**).

#### BUG-02: Q4 night milestone soft-locks Q5–Q7 and fails on Deep Night naps
- **Severity:** Blocker
- **Evidence:** `src/core/story/story.ts:89,100-112,128-132`, `src/scenes/LakeScene.ts:1259`.
- **Steps to reproduce:** (a) On a fresh save, nap from Dusk to Dawn whenever evening arrives, then complete 5 checklist bundles and buy the Carbon Rod. Or (b) nap directly to `"Deep night (02:00)"` (`minute = 120`).
- **Expected:** `m.night` triggers during `00:00–05:00` as well as `21:00–23:59`, and day-only players can still advance past Q4 (day bottle) to Q5–Q7.
- **Actual:** `isNightVisit(120)` evaluates `120 >= 1260` (`false`). Because `todaysChapter` requires strict order, Q4 never unlocks and Q5, Q6, and Q7 are permanently blocked.
- **Fix / Effort:** Include `minute < 5 * 60` in `isNightVisit` and add a bundle fallback unlock for Q4 (**S**).

#### BUG-03: Sunny weather `zoneWeight` has zero effect on fish spawns
- **Severity:** Blocker
- **Evidence:** `src/core/data/weather.ts:42`, `src/core/fish.ts:36-38,56-67`.
- **Steps to reproduce:** Fish in shallow or deep water during `sunny` weather (`?weather=sunny`).
- **Expected:** Sunny weather boosts shallow bites and slows deep bites per `docs/GAME_DESIGN.md:956`.
- **Actual:** `candidates` filters to one `zone` before `pickSpecies` normalises weights, so multiplying every candidate by `1.4` or `0.75` cancels identically to `1.0`.
- **Fix / Effort:** Apply sunny effect via per-zone `waitFactor` or species `likes: ['sunny']` (**S**).

#### BUG-04: iOS / background resume queues SFX onto a suspended AudioContext and blasts on next tap
- **Severity:** Blocker
- **Evidence:** `src/audio/AudioEngine.ts:53-55,102-110`.
- **Steps to reproduce:** Background the PWA on iOS Safari (or receive a phone call), return to the app (where `ctx.resume()` outside a user gesture is rejected), trigger several sounds (nibbles/events), then tap the screen.
- **Expected:** Sounds are silently dropped while `ctx.state !== 'running'`.
- **Actual:** `ready` only checks `ctx.state !== 'closed'`, so all sounds queue at frozen `ctx.currentTime` and burst simultaneously on the next tap.
- **Fix / Effort:** Check `ctx.state === 'running'` in `ready` (**S**).

---

### MAJOR

#### BUG-05: Trophy medal silently discarded when a perfect gold-size trophy is not longer than the existing record
- **Severity:** Major
- **Evidence:** `src/scenes/LakeScene.ts:1447-1452` vs `src/core/rare.ts:81-84`.
- **Steps to reproduce:** Catch any rare trophy (e.g. 50 cm Golden Tench). Later, catch a 48 cm *perfect* gold-size Golden Tench.
- **Expected:** `addTrophy()` sets `medal: true` and `LakeScene` saves the updated trophy.
- **Actual:** `addTrophy()` returns `{ first: false, improved: false }`; `LakeScene.ts:1449` only saves `if (t.first || t.improved)`, silently dropping the medal.
- **Fix / Effort:** Save whenever `t.trophies !== this.player.trophies` (or return `changed: true` when `medal` upgrades) (**S**).

#### BUG-06: Importing a save code from a different location discards the imported player/companion/dog names
- **Severity:** Major
- **Evidence:** `src/scenes/LakeScene.ts:1570-1583`.
- **Steps to reproduce:** Stand at Quiet Lake, open Settings → Save code → Import a save whose `place` is `river-bend` and whose `profile` has custom names.
- **Expected:** Both save and imported profile names are saved and applied.
- **Actual:** `loadGame()` calls `this.remount(false); return;` at line 1575 *before* `this.profile = profile; saveProfile(...)` on lines 1581–1582. Imported names are lost.
- **Fix / Effort:** Apply and persist `profile` before checking for `remount()` (**S**).

#### BUG-07: `loadGame()` and `startNewGame()` skip `loadClock()` and leave stale runtime state
- **Severity:** Major
- **Evidence:** `src/scenes/LakeScene.ts:1570-1600,560-567`.
- **Steps to reproduce:** Import a save whose clock is `03:00` with no night kit, OR click "Start over" while a story chapter, lake moment, or bedtime/warning flag is active at the same location.
- **Expected:** `03:00` without kit wakes cleanly at `05:00` via `loadClock()`; all active moments/story/toasts/bedtime flags reset.
- **Actual:** `loadClock()` is skipped (immediately triggering an unexpected sleep fade), and `storyRun`, `paleCardPending`, `bedPending`, `warnPending`, `napTarget`, `moments`, and `pendingToasts` leak into the loaded/new game.
- **Fix / Effort:** Call `loadClock()` in `loadGame()` and `handoff`; reset all transient controllers or trigger a clean `remount()` (**S**).

#### BUG-08: Sign & Trophy Board re-rasterised on CPU at 60 FPS (and 200+ sprites re-rasterised on Travel)
- **Severity:** Major
- **Evidence:** `src/scenes/LakeScene.ts:2535,2546`, `src/art/textures.ts:104,111,123,132-240`.
- **Steps to reproduce:** Profile CPU during idle gameplay or when driving between Quiet Lake and River Bend.
- **Expected:** Cached texture keys short-circuit immediately without allocating rasters.
- **Actual:** `Raster.fromSprite(...)` executes every frame before `addRaster` checks `textures.exists(key)`.
- **Fix / Effort:** Check `if (scene.textures.exists(key)) return key;` before rasterising (**S**).

#### BUG-09: Update toast overlaps top-right Notice Board button & leaks duplicate resize listeners
- **Severity:** Major
- **Evidence:** `src/ui/updateToast.ts:16-29,73` vs `src/scenes/LakeScene.ts:222`.
- **Steps to reproduce:** Trigger a PWA update (`onNeedRefresh`) on a 360×640 phone.
- **Expected:** Toast sits unobstructed with a single resize listener.
- **Actual:** Toast covers `BOARD_BTN` (`308, 4, 44, 44`) and extends over the clock HUD; repeated `onNeedRefresh` calls attach duplicate `window` resize listeners.
- **Fix / Effort:** Remove `BOARD_BTN` or reposition toast with dismiss button + guard listener attachment (**S**).

#### BUG-10: Species quests produce ungrammatical English (`"Catch a eel"`, `"Catch a ide"`, `"Catch a asp"`, `"Catch 2 eel"`)
- **Severity:** Major
- **Evidence:** `src/core/quests/quests.ts:322-323`.
- **Steps to reproduce:** Roll daily quests until an `eel`, `ide`, or `asp` species quest appears.
- **Expected:** `"Catch an eel"` / `"Catch 2 eels"`.
- **Actual:** `"Catch a eel"` / `"Catch 2 eel"`.
- **Fix / Effort:** Add article/plural metadata on `Species` (**S**).

#### BUG-11: Pajkel speech bubble overlaps Alex's head and has low contrast on stacked catch screen (live-verified)
- **Severity:** Major
- **Evidence:** Live 360×640 QA screenshot `step_33_shot_1.png` (`http://localhost:5179/?debug=caught&species=eel&star=gold&perfect=1&fotd=eel&time=12&skipnames`).
- **Steps to reproduce:** Open the URL above at 360×640.
- **Expected:** Pajkel's speech bubble is legible and clear of Alex's sprite; `94 cm · 1.9 kg [medal]` is centered.
- **Actual:** `"Perfect catch! A medal!"` renders as faint semi-transparent grey over bright blue water and overlaps Alex's hair/left shoulder; the size+medal line is visibly right-shifted (`LakeScene.ts:2422-2428`).
- **Fix / Effort:** Position bubble clear of Alex, keep solid contrast until fast fade-out, and center text + stars/medal as one group (**S**).

#### BUG-12: River Bend dock has a missing bottom-right corner tile & hut lacks night tinting (live-verified)
- **Severity:** Major
- **Evidence:** Live 360×640 QA screenshot `final_step_92.png` (`?debug=map&travel=1&select=river-bend` → Drive there); `src/scenes/LakeScene.ts:2097`.
- **Steps to reproduce:** Travel to River Bend (daytime for dock tile; `?place=river-bend&time=23` for hut tint).
- **Expected:** Solid wooden landing planks; W.'s hut darkens at night with `worldTint`.
- **Actual:** Bottom-right corner of the dock below the bait crate has a missing rectangular notch exposing grass; `LakeScene.ts:2097` calls `this.add.image()` instead of `img()`, leaving W.'s hut full daytime brightness at midnight.
- **Fix / Effort:** Patch dock corner in `riverArt.ts` / scene mask and register hut with `img()` (**S**).

#### BUG-13: Tap-vs-hold on shore objects flicks Alex's rod and flashes charge bar on every tap
- **Severity:** Major
- **Evidence:** `src/scenes/LakeScene.ts:756-766,1937-1944,2379,3090-3095`.
- **Steps to reproduce:** While idle with bait, tap the car, sign, crate, or Pajkel's empty chair.
- **Expected:** Clean tap opens the panel with no casting animation.
- **Actual:** Pressing immediately enters `charging`, flashing the power meter and jerking Alex's rod back before cancelling on release.
- **Fix / Effort:** Delay charge visuals until `heldMs >= MIN_HOLD_MS` (or 120 ms on shore objects) (**S**).

---

### MINOR

#### BUG-14: Duplicate `"Hold to charge, release to cast"` toast on short water tap (live-verified)
- **Severity:** Minor
- **Evidence:** Live QA screenshot `step_20_shot_2.png` (`?debug=fresh&time=12&skipnames`, short tap `<150 ms` on water).
- **Actual:** Spawns a top toast reading `"Hold to charge, release to cast"` while the identical bottom hint bar is already on screen.
- **Fix / Effort:** Suppress the short-tap toast if the bottom hint already displays that line (**S**).

#### BUG-15: Floating `"Bestia"` name tag overlaps Pajkel's head and Alex's legs (live-verified)
- **Severity:** Minor
- **Evidence:** Live QA screenshot `step_20_shot_1.png` (`?debug=fresh&time=12&skipnames`, tap Bestia at `(180, 423)`).
- **Actual:** The floating name tag sits high above Bestia, overlapping Pajkel and Alex. Also `LakeScene.ts:3298-3302` ages tags by hardcoded `16 ms` instead of `deltaMs` (2× too fast on 120 Hz phones).
- **Fix / Effort:** Lower tag offset slightly and accumulate real `deltaMs` (**S**).

#### BUG-16: `applyProfile()` writes to `localStorage` even in Dev Sandbox mode
- **Severity:** Minor
- **Evidence:** `src/scenes/LakeScene.ts:2006-2009` vs `src/ui/settingsPanel.ts:182`.
- **Actual:** Saving names in Settings while sandboxed (`?coins=999`) overwrites the real `rybki.profile.v1` despite the `"DEV sandbox: changes here are not saved"` banner.
- **Fix / Effort:** Guard `saveProfile` with `if (!this.sandbox)` (**S**).

#### BUG-17: `hint.setText()` redraws twice per frame (120×/sec) during `slipNoteAge`
- **Severity:** Minor
- **Evidence:** `src/scenes/LakeScene.ts:2485-2494`.
- **Actual:** For 4.5 s after catching the Pale One, `hint.setText()` flips between `tipText()` and `SLIP_NOTE` twice every frame, triggering 120 `K×` canvas texture re-uploads per second.
- **Fix / Effort:** Compute the target string first and call `setText` once only when changed (**S**).

#### BUG-18: `normalizeProfile()` turns malformed JSON objects into `"[object Object"`
- **Severity:** Minor
- **Evidence:** `src/core/profile.ts:25-31`.
- **Actual:** `String(raw?.player ?? '')` coerces `{}` into `"[object Object"` instead of falling back to `DEFAULT_PROFILE`.
- **Fix / Effort:** Check `typeof v === 'string'` before trimming (**S**).

#### BUG-19: `Story` tab accessible name overridden by `"new page"` dot & `"Daily quests (0/3) Claim!"` wraps (live-verified)
- **Severity:** Minor
- **Evidence:** Live QA screenshot `step_62_shot_3_quests_tab.png` (`?debug=quests&qdone=1&journal=all&skipnames`).
- **Actual:** `"Daily quests (0/3) Claim!"` wraps onto 2 lines at 360 px; the yellow dot badge causes screen readers/accessibility tree to announce the Story tab as `"new page"` instead of `"Story"`.
- **Fix / Effort:** Compact quest header spacing and mark the dot `aria-hidden="true"` (**S**).

#### BUG-20: Night string lights cross over Trophy Board & campfire burns in rain (live-verified)
- **Severity:** Minor
- **Evidence:** Live QA screenshot `step_39_shot_1_night_rain_camp.png` (`?time=22&weather=rain&camp=all&trophies=all&kit=1&skipnames`).
- **Actual:** String lights pass directly across the top of the Trophy Board; full moon + glitter and full campfire flame render during pouring rain.
- **Fix / Effort:** Adjust string-light anchor, attenuate moon/glitter in rain, dampen campfire in rain (**S**).

#### BUG-21: `waterGlow` lags weather crossfade by up to 4 game minutes & `rare.ts` hours don't wrap midnight
- **Severity:** Minor
- **Evidence:** `src/scenes/LakeScene.ts:2818-2827` (`glowKey` omits `weatherBlend`); `src/core/rare.ts:35` (`from > to` always false for future M2 midnight-spanning rare fish).
- **Fix / Effort:** Include `weatherBlend` in `glowKey`; reuse `inHourWindow` logic in `rare.ts` (**S**).

---

### POLISH

#### BUG-22: Top-left HUD wind icon cramped, fight strip fish icon 1–2 px below `BOARD_BTN`, and Road card banner tight at 360 px (live-verified)
- **Severity:** Polish
- **Evidence:** Live QA screenshots `step_8_shot_1.png` (wind icon touching clock right border), `step_28_shot_1.png` (progress strip fish icon ~1–2 px under `BOARD_BTN`), and `?debug=map&travel=1&select=river-bend` (`"Driving to River bend..."` nearly touching both edges).
- **Fix / Effort:** Add 6 px right padding to clock plate, remove `BOARD_BTN` (or nudge strip down 6 px), add horizontal padding/wrapping to `roadCard.ts` (**S**).

#### BUG-23: Settings Import confirm shows imported stats as if they were the current save
- **Severity:** Polish
- **Evidence:** `src/ui/settingsPanel.ts:156-157` prints `"This replaces your current game (7/12 species, 340 coins). Continue?"` using `p.save` (the *imported* save) instead of the current game.
- **Fix / Effort:** Clarify wording (`"Load imported save (7/12 species, 340 coins) and replace your current game?"`) (**S**).

---

## Missing QA Infrastructure

1. **Automated Playwright 360×640 smoke test against `vite preview`** (sub-path `/somethingfishy/`) to catch 404s, console errors, and panel regressions on every PR.
2. **Real-device Android & iOS Safari test pass:** `docs/HANDOFF.md` notes slices 15b–25b have never been play-tested on a real phone (touchcancel, Firefox Android, iOS AudioContext resume, overlay scrollbars, 20:9 safe areas, thermal/battery).

---

## Open Questions for the Developer

1. **Real-device test matrix:** Which physical Android phones (and iOS devices, if any) can we run a 15-minute play-test on before calling M1/M2 done?
2. **Headless CI smoke test:** Should we add a lightweight Playwright smoke test to `.github/workflows/deploy.yml` alongside `npm test`?
