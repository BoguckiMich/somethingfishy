# 04 — Pixel Art & Audio Review

**Reviewers:** Pixel Art Director & Audio Lead  
**Scope:** All procedural pixel art (`src/art/`), scene rendering & weather VFX (`src/scenes/`), and Web Audio synthesis/ambient/SFX (`src/audio/`, `src/core/*Sound/Mix*`).

---

## Strengths (with evidence)

### Pixel Art
1. **Pure, deterministic, testable pixel-art pipeline:** `src/art/pixelGrid.ts:1-81` and `src/art/raster.ts:1-103` author every sprite and scenery layer in pure TS with seeded PRNG (`mulberry32`) and 4×4 Bayer dithering, covered by 17 unit test files.
2. **Warm Stardew-adjacent palette & 24h day/night lighting:** `PAL` (`src/art/palette.ts:6-138`) and `KEYFRAMES` (`src/art/dayCycle.ts:31-41`) create genuinely cozy transitions across dawn, day, dusk, and night (confirmed in live night screenshot `step_39_shot_1_night_rain_camp.png`).
3. **Smart fish downscaling & show-off staging:** `shrinkSprite` (`src/art/fishScale.ts:20-104`) protects eyes and re-applies a closed 1 px outline; hand-over-fish layering (`LakeScene.ts:2151-2159`) and hugged boss poses (`fishArt.ts:32-35`) sell catch scale cleanly.
4. **Expressive companion animation & River Bend scenery (Slice 25b):** Bestia's 4-frame gallop (`src/art/characters.ts:1016-1065`), Pajkel's seated/pour/walk frames (`characters.ts:530-872`), and the newly landed River Bend scenery + current streaks (`src/art/riverArt.ts`, `src/art/riverFx.ts`, confirmed in `final_step_92.png`) show strong craft.

### Audio
5. **Zero-dependency procedural Web Audio with pure testable rules:** `src/audio/sound.ts:19-128`, `src/core/ambientMix.ts`, `src/core/callSchedule.ts`, `src/core/reelClicks.ts`, `src/core/variation.ts`, and squared perceptual volume curves (`src/core/soundSettings.ts:31-34`).
6. **Mobile-speaker-aware synthesis:** ±5% pitch/volume jitter (`variation.ts:11-15`), lowered phone-friendly cricket frequencies (`1.88/2.15 kHz`, `ambient.ts:145-147`), sawtooth harmonics in the Pale One's drone (`ambient.ts:151-190`), and click-free ≥4 ms attacks with `onended` node cleanup (`synth.ts:23-80`).

---

## Problems

### Blocker

1. **[Audio] iOS Safari / background resume bug causes a loud queued-SFX blast**
   - **Evidence:** `src/audio/AudioEngine.ts:53-55` checks `this.graph.ctx.state !== 'closed'` instead of `=== 'running'`. On returning from background or a phone call (`'interrupted'`/`'suspended'`), `visibilitychange` calls `ctx.resume()` (`AudioEngine.ts:102-110`), which iOS rejects outside a user gesture. Every `sound.play()` until the next tap schedules oscillators onto a frozen `ctx.currentTime` — then fires them all simultaneously on the next tap.
   - **Suggested fix:** Require `this.graph.ctx.state === 'running'` in `ready`. Only ramp `master.gain` inside `ctx.resume().then(...)` once `'running'`, and re-trigger the ramp inside `unlock()`.
   - **Effort:** S

2. **[Art] Non-integer pixel scaling (1.78×) and rampant mixels across HUD & DOM panels**
   - **Evidence:**
     - `src/ui/logPanel.ts:122`: `spriteCanvas(weatherSprite(id), 16)` renders a **9×9** sprite at **16 px** (`1.778×` visibly warped pixels).
     - `src/scenes/LakeScene.ts:206,2250-2254`: `clockIcon`/`weatherIcon` (9×9) draw at **2×** directly above `coinIcon` (16×16) at **1×**.
     - `src/scenes/LakeScene.ts:2582-2595`: `drawCarCue` draws a 9×11 pin at **2×** inside the **1×** world.
     - `src/scenes/LakeScene.ts:2470`: `caughtStars.setScale(2 * popScale)` applies continuous non-integer scaling.
     - `src/ui/frames.ts:11,39-43` + `bagShop.ts` + `logPanel.ts`: single DOM screens mix **1×, 2×, 3×, 4×, and 6×** pixel scales.
   - **Suggested fix:** Never draw 9×9 at 16 px (use 18 px = 2×). Standardize DOM UI frames/icons to 2× (32 px for 16×16, 18 px for 9×9), draw `drawCarCue` at 1×, and animate `caughtStars` via Y-bounce rather than fractional scale.
   - **Effort:** M

### Major

3. **[Art] Canvas bilinear blur on non-integer phones + rotated sprites at K× zoom**
   - **Evidence:** `src/main.ts:43-46` switches the entire game canvas to `imageRendering = 'auto'` (bilinear blur) whenever device scale isn't within 0.02 of integer `k` (most phones). `MomentsView.ts:477-479,533` and `StoryView.ts:319` use `setAngle()` on pixel sprites at K× zoom, causing stair-stepping; odd-sized centered sprites (`CompanionView.ts:161,263,272`, `MomentsView.ts:118-119`) land on `.5` art pixels.
   - **Suggested fix:** Keep `image-rendering: pixelated` on the canvas; replace `setAngle()` with 2–3 baked frames; snap `hearts` Y and odd-sprite origins to integer art pixels.
   - **Effort:** M

4. **[Art] Sun, moon, and water sun-glitter stay at 100% brightness during pouring rain & overcast**
   - **Evidence:** `src/scenes/LakeScene.ts:2838-2845,2899-2907` (visually confirmed in `step_39_shot_1_night_rain_camp.png`: bright full moon and moon-glitter reflection shining cleanly through pouring rain).
   - **Suggested fix:** Attenuate `sunAlpha`, `moonAlpha`, `starAlpha`, and water glitter by `(1 - cloudCover)` from `weatherVis('overcast')` and `weatherVis('rain')`.
   - **Effort:** S

5. **[Art] Fog weather is completely invisible after 10:00 AM and at night**
   - **Evidence:** `src/scenes/LakeScene.ts:2967-2970` multiplies `fogVis` by `fogStrength(minute) * daylight(minute)` — zero fog renders at 14:00 or 21:00 even while the HUD icon, Pajkel, and Old Mossback say Fog.
   - **Suggested fix:** Apply a baseline mist floor (e.g. `Math.max(0.45, fogStrength(...))` with dark night-mist tint) whenever `fogVis > 0`, or restrict fog rolls to morning.
   - **Effort:** S

6. **[Art] Static/unused camp items, rain-proof campfire, and string-light / trophy-board overlap**
   - **Evidence:** `src/scenes/LakeScene.ts:2677-2732` + live screenshot `step_39_shot_1_night_rain_camp.png`: Bestia's bed (`campArt.ts:123-138`) looks like a flat blue puddle and Bestia never uses it; tent is static with no night glow; campfire burns at full flame in pouring rain; string lights cut directly across the top of the Trophy Board.
   - **Suggested fix:** Redraw Bestia's bed with raised cushion depth and let her rest in it; add tent interior glow at night; dampen campfire in rain; raise/shift string-light anchor clear of the Trophy Board.
   - **Effort:** M

7. **[Art] Outline inconsistency — `BOBBER` lacks an outline**
   - **Evidence:** `src/art/sprites.ts:6-19` (`BOBBER`), `sprites.ts:291-330` (lilies/reeds), and `characters.ts:112-192` (sticks) have no `PAL.outline`, while every other interactive object does. The bobber is the primary gameplay focal point and can blend into bright water glints/foam.
   - **Suggested fix:** Add a dark 1 px outline (or `PAL.outlineSoft`) to `BOBBER`, and codify the outline rule (interactive/characters = outlined; terrain/foliage = un-outlined).
   - **Effort:** S

8. **[Art] River Bend dock has a missing bottom-right corner tile (live-verified)**
   - **Evidence:** Live screenshot `final_step_92.png` (`?place=river-bend`): directly below the bait crate on the bottom-right corner of the wooden dock, a rectangular notch exposes grass underneath.
   - **Suggested fix:** Audit dock/landing masking in `src/art/riverArt.ts` / `LakeScene.ts` background layering and patch the missing corner.
   - **Effort:** S

9. **[Audio] No master limiter/compressor (clipping risk) + tab-hide pop/click**
   - **Evidence:** `src/audio/AudioEngine.ts:70-78` sums `sfxBus` + `ambBus` directly into `master` (`0.8`) with no `DynamicsCompressorNode` — overlapping `fanfare` (8 oscillators, `sfx.ts:96-108`) + `coin` + `boof` + `water` + `drone` can clip phone speakers. `AudioEngine.ts:95` sets `master.gain` instantaneously to `0` on `pause()`, causing an audible click.
   - **Suggested fix:** Insert a gentle `DynamicsCompressorNode` (`threshold: -6`, `ratio: 4`) before `destination`, and ramp `master.gain` to `0` over `15 ms` before `ctx.suspend()`.
   - **Effort:** S

10. **[Audio] 19 always-on ambient nodes burn CPU when muted/silent + 52 nodes per frog ribbit**
    - **Evidence:** `src/audio/ambient.ts:78-203` keeps `water` (6 nodes), `crickets` (6 nodes), and `drone` (7 nodes) running continuously even at `ambience === 0%` or daytime; `ambient.ts:237-239` spawns up to 52 nodes per double frog call via `setTimeout`; `ambient.ts:114-116` has `washGain` LFO underflow (`0.12 - 0.15 = -0.03`).
    - **Suggested fix:** Gate/stop silent subgraphs (or suspend `AudioContext` when both buses are 0) and replace the 13-oscillator frog loop with one AM-modulated oscillator.
    - **Effort:** M

### Minor

11. **[Art] Recycled silhouettes, stray app-icon pixel, wrong car color in journal:**
    - `src/art/appIconArt.ts:45-47`: stray dangling `o` pixel under pelvic fin.
    - `src/art/journalIconArt.ts:7-20`: `CAR_ICON` is red (`PAL.red`), contradicting the white DS4 (`carArt.ts`, `mapArt.ts:185-199`).
    - `src/art/fishSprites.ts:315-373`: `goldenTench`, `mossback`, and `silverGhost` are exact/widened recolors of `tench`, `carp`, and `bleak`.
    - `src/art/fishVariants.ts:26`: `FISH_OVERRIDES = {}` (no hand-tuned overrides for 15 px trophy minis).
    - `src/art/shopIconArt.ts:73-107,140-162`: all 3 rods and both reels share identical silhouettes.
    - **Effort:** S–M
12. **[Art] Off-palette hex constants & minor tint bugs:** Hardcoded hex outside `PAL` (`shopIconArt.ts:12-13`, `iconArt.ts:8-9`, `starArt.ts:10-12`, `frameArt.ts:33-37`); `CompanionView.ts:272` `puff` dust never tinted at night; `LakeScene.ts:230` hardcodes `GLOW_CENTER` instead of reading `spots.lantern`. (Effort: S)
13. **[Audio] Fragile noise-burst offset math (`src/audio/synth.ts:74`):** `g.noise.duration - s.dur - 0.1` throws `RangeError` if any future SFX has `dur >= 1.9 s`. Clamp with `Math.max(0, ...)`. (Effort: S)

---

## Missing Features (High-Impact Audio & Art Gaps)

1. **Weather ambience (HIGH):** Zero **rain** audio bed and zero **wind** audio bed (`src/audio/ambient.ts`), despite full rain/wind visuals.
2. **River Bend water ambience (HIGH):** River Bend plays the still-lake lapping bed (`ambient.ts:78-118`) instead of a faster, brighter **river current / riffle** bed.
3. **Campfire crackle (MEDIUM):** Flickering campfire with sparks (`LakeScene.ts:2697-2728`) is completely silent.
4. **Distinct catch stingers (MEDIUM):** `LakeScene.ts:1707` uses the same `fanfare` for New Species, Record, Gold, Medal, Perfect Catch, and Trophy Catch.
5. **Car / Road travel audio (MEDIUM):** Driving to River Bend (`roadCard.ts`) has no engine/gravel sound.
6. **Story, Moment & UI foley (LOW-MEDIUM):** Silent wet footsteps after step 1 (`StoryView.ts:410-441`), silent blinking star (`StoryView.ts:382-408`), silent eerie moment taps (`MomentsView.ts:282-288`), silent UI locked/error taps, and silent Bestia petting/tea pour.

---

## Open Questions for the Developer

1. **Pixelated vs. blurred canvas:** Are you willing to keep `image-rendering: pixelated` always on (accepting slightly uneven VT323 strokes on fractional DPRs, or moving HUD text to DOM), instead of blurring the entire pixel-art scene via `imageRendering = 'auto'`?
2. **Audio scope before M2 finishes:** Which procedural audio additions are must-haves now — **rain + wind + river current + campfire crackle + Perfect/Trophy stingers**?
3. **Fog outside morning hours:** Should Fog weather render visibly all day/night whenever rolled, or only roll during morning real/game hours?
4. **Camp life:** Should Bestia actually sleep in `campBed` and the tent glow warmly at night?
