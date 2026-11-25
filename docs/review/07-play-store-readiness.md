# 07 — Google Play Release Readiness Review

**Reviewer:** Release Manager (Google Play)  
**Verdict:** **NO-GO today** (expected at M1; clean, predictable **Capacitor** path for M3 closed beta / M5 2.0 public release).

---

## Strengths (with evidence)

1. **Zero-network, zero-SDK runtime (cleanest possible Data Safety form):** All art (`src/art/`), audio (`src/audio/AudioEngine.ts:1-129`, Phaser audio disabled at `src/main.ts:33`), and fonts (`public/fonts/vt323-*.woff2`) are local/procedural. Zero analytics, ads, or third-party trackers → Play Console Data Safety declares **"No data collected or shared"**.
2. **Right packaging choice already documented:** `docs/ROADMAP.md:93-101` selects **Capacitor** over TWA, avoiding GitHub Pages subpath `/.well-known/assetlinks.json` limitations and giving true offline bundling.
3. **Production URL dev-flag stripping:** `src/urlParams.ts:5-7` returns empty `URLSearchParams()` in `PROD` builds, preventing cheat/sandbox URLs from leaking.
4. **Versioned save structure + manual rescue codes:** `src/core/save.ts:28-40,192-262` (`CURRENT_VERSION = 1`, `MIGRATIONS`, `SAVE_BROKEN_KEY`, `SAVE_BACKUP_KEY`) + `src/core/saveCode.ts:8-83` (`RYBKI1-` FNV-1a checksummed export codes) + `navigator.storage.persist()` & `pagehide` flush (`LakeScene.ts:820,831-836`).
5. **CI test gate & layered icon source:** `.github/workflows/deploy.yml:26-29` gates deploys on `tsc` + `vitest` + `vite build`; `src/art/appIconArt.ts:56-73` already separates transparent `fishSprite()` from `ICON_BG` (`#1b2b3a`), easing Android Adaptive Icon generation.

---

## Problems (Google Play Blockers & Requirements)

### Blocker

1. **Root-absolute `/fonts/...` URLs break relative WebView & sub-path builds**
   - **Evidence:** `index.html:16,24` (`url('/fonts/vt323-*.woff2')`) vs `vite.config.ts:6` (`base: './'`).
   - **Suggested fix:** Change to `./fonts/vt323-latin-ext.woff2` and `./fonts/vt323-latin.woff2`.
   - **Effort:** S

2. **Service Worker (`vite-plugin-pwa`) conflicts with Capacitor native builds**
   - **Evidence:** `vite.config.ts:9-33` unconditionally injects `VitePWA`, and `src/ui/updateToast.ts:58-82` unconditionally registers the SW in `PROD`. Inside Capacitor's bundled `https://localhost`, a Service Worker can trap users on stale cached builds after a Google Play update and show a broken `"New version — tap to reload"` toast.
   - **Suggested fix:** Add an Android/Capacitor build mode (e.g. `CAPACITOR=1`) that disables `VitePWA` and no-ops `setupUpdateToast()`.
   - **Effort:** S

3. **Edge-to-Edge display enforcement on Android 15/16 (API 35/36) — missing safe-area insets**
   - **Evidence:** `index.html:5` sets `viewport-fit=cover`, but `index.html:27-30` (`#game`) and `src/ui/panel.ts:109,121` (`padding: 12px; max-height: 92vh`) apply no `env(safe-area-inset-*)` padding (only `updateToast.ts:27-28` does). Targeting API 35/36 enforces edge-to-edge, causing top HUD/modals/bottom bar to collide with status bars, camera cutouts, and gesture nav bars.
   - **Suggested fix:** Apply `env(safe-area-inset-*)` padding on `#game` and `openPanel()`, and verify Capacitor status/nav bar config on Android 15/16.
   - **Effort:** S–M

4. **No Android Capacitor project / Target API 36 `.aab` pipeline**
   - **Evidence:** `package.json:1-29` has no `@capacitor/core`, `@capacitor/cli`, or `@capacitor/android`. Google Play requires 64-bit `.aab` targeting **API 36 (Android 16)** as of Aug 2026.
   - **Suggested fix:** Initialize Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/splash-screen`), lock `androidScheme: 'https'` and `hostname: 'localhost'` permanently, set `compileSdk`/`targetSdk = 36`, `minSdk >= 24`, configure Play App Signing upload keystore, and verify no `AD_ID` permission is merged.
   - **Effort:** M

5. **Trademarked brand name (`"DS4"`) in player-facing copy**
   - **Evidence:** `src/core/data/checklist.ts:53` (`flavour: "The DS4 won't drive on vibes."`). Stellantis/DS Automobiles trademark risk on Play Store.
   - **Suggested fix:** Change to `"The car won't drive on vibes."` (or player-chosen car name in M4.5).
   - **Effort:** S

6. **Missing in-app License / Attribution screen (SIL OFL 1.1 & MIT compliance)**
   - **Evidence:** `public/fonts/vt323-OFL.txt:56-61` (OFL 1.1 Condition 2) and `package.json:16` (Phaser 4 MIT) require user-viewable copyright/license notices. `src/ui/settingsPanel.ts:181-289` has no About/Licenses screen; users cannot inspect `assets/public/fonts/vt323-OFL.txt` inside an `.aab`.
   - **Suggested fix:** Add an `"About & Licenses"` card in Settings showing app version, VT323 OFL 1.1, Phaser 4 MIT, Capacitor MIT, and Privacy Policy link.
   - **Effort:** S

7. **Missing Privacy Policy URL, Data Safety submission, and IARC age rating**
   - **Evidence:** No privacy policy page exists in the repo or `public/`, and no link in Settings. Play Console blocks publishing without a hosted Privacy Policy URL.
   - **Suggested fix:** Host a plain `privacy.html` (e.g. on GitHub Pages) declaring zero collection/local-only storage, link it in Settings and Play Console, submit Data Safety + IARC (expected PEGI 3 / Everyone; do **not** check "Under 13" unless opting into Families Policy).
   - **Effort:** S

### Major

8. **No Android hardware/gesture Back button handling**
   - **Evidence:** Zero `backButton` (`@capacitor/app`) or `popstate` listeners in `src/`. Pressing Back on Android exits the app instead of closing open panels (`panel.ts:159-184`).
   - **Suggested fix:** Wire a panel stack to Capacitor `backButton` (close top panel; on lake screen, prompt `"Tap back again to exit"` and flush `persist()`).
   - **Effort:** S–M

9. **Save loss risk on uninstall / phone switch (`localStorage` vs. Android Auto Backup)**
   - **Evidence:** `src/core/save.ts:34`, `src/scenes/LakeScene.ts:2018` store exclusively in WebView `localStorage`. Android Auto Backup does not reliably back up Chromium LevelDB `localStorage`, and changing Capacitor's origin post-launch orphans all saves.
   - **Suggested fix:** Mirror/migrate saves to `@capacitor/preferences` (Android `SharedPreferences`, cleanly backed up by Auto Backup) with `localStorage` fallback, and lock Capacitor `androidScheme`/`hostname` from day 1.
   - **Effort:** M

10. **Android Vitals battery / frame-rate risk (`K=4` = `1440×2560`) & no WebGL context-loss recovery**
    - **Evidence:** `src/renderScale.ts:14-22` pushes 1080p Android WebViews to `K=4` (3.68M px/frame at 60 FPS) with no `webglcontextlost` listener or `appStateChange` pause hook.
    - **Suggested fix:** Cap `K` at 3 (or 2 on low-end GPUs), handle `webglcontextlost`/`webglcontextrestored`, and pause Phaser + flush `persist()` on Capacitor `appStateChange`.
    - **Effort:** M

11. **Zero JS crash / error diagnostics for the 12-tester closed beta**
    - **Evidence:** No `window.onerror` or `unhandledrejection` handler in `src/`. Play Vitals only logs native crashes/ANRs, not silent WebView JS exceptions.
    - **Suggested fix:** Ring-buffer the last ~20 JS errors locally and add `"Copy diagnostic log"` in Settings (keeps Data Safety at zero data collected).
    - **Effort:** S

12. **Real-person likeness & default names for a public release**
    - **Evidence:** `src/core/profile.ts:14` (`Alex`, `Pajkel`, `Bestia`), `docs/GAME_DESIGN.md:50-75`, `docs/ROADMAP.md:73-79`.
    - **Suggested fix:** Obtain explicit consent from the real individuals before public release and ship M4.5 appearance/name customisation before Production.
    - **Effort:** S (consent) / L (M4.5)

### Minor

13. **Unused `@fontsource/*` devDependencies (`package.json:19-22`):** Remove all 4 unused packages. (Effort: S)
14. **Version display & `v1 -> v2` save migration tests:** Inject `__APP_VERSION__` from `package.json` (`0.1.0`) into Settings, keep `SAVE_KEY = 'rybki.save.v1'` stable, and test `MIGRATIONS` before first schema bump. (Effort: S)
15. **Adaptive icon & Android 12+ splash assets not yet generated:** `scripts/make-icons.mjs:31-66` only writes opaque RGB PNGs; extend to output RGBA foreground (`fishSprite()` in 108 dp safe zone), `#1b2b3a` background, monochrome silhouette, and splash icon. (Effort: S)

### Polish

16. **Band nods (`"Trivium"` / `"In Waves"`, `docs/STORY.md:34-35,158`):** Titles without lyrics and abstract pixel art are low-risk; verify no copyrighted band logo or lyrics ever enter `src/` or store copy. (Effort: S)
17. **No `LICENSE` file in public repo root:** Add an explicit `LICENSE` (or All Rights Reserved notice) before public Play launch. (Effort: S)

---

## Missing Release Artifacts

- **Android project & signing:** `capacitor.config.ts`, `android/` project, upload keystore (backed up), `versionCode`/`versionName` workflow, Target API 36 `.aab`.
- **Play Store visuals:** Adaptive icon (RGBA foreground + background + monochrome), Android 12+ splash screen, **1024×500 Feature Graphic**, 2–8 phone screenshots (9:16), tablet screenshots (if supported).
- **Play Console compliance:** Hosted Privacy Policy URL, Data Safety form, IARC questionnaire, Target Audience (not Under 13), Ads = No, Advertising ID = No, in-app About & Licenses.
- **Closed Testing Gate:** New personal Play accounts require **≥12 opted-in testers for 14 continuous days** on Closed Testing before Production access.

---

## Open Questions for the Developer

1. **Account type:** Publishing under a new personal Play Console account (requiring 12 testers × 14 days) or an existing/org account?
2. **Tablet support:** Restrict Play Store manifest/listing to phones, or verify letterboxed layout and provide tablet screenshots?
3. **Save persistence on reinstall:** Is manual Export/Import enough, or should we add `@capacitor/preferences` for Android Auto Backup?
4. **Polish i18n for Closed Beta:** Since testers are Polish (`ROADMAP.md:62`), is Polish localization a hard gate for the 12-tester beta or can closed beta run in English first?
