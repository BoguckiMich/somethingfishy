# 02 — UI/UX Design Review

**Reviewer:** UI/UX Designer  
**Scope:** Onboarding, readability at 360×640, tap targets, discoverability, panel flows, action feedback, accessibility, one-handed portrait play, and live 360×640 verification.

---

## Strengths (with evidence)

1. **Cohesive wooden 9-slice UI system:** `src/ui/frames.ts:24-51` and `src/ui/panel.ts:9-21` share a warm pixel-art frame spec with tactile pressed-state inversion (`:active:not(:disabled)`), making DOM overlays feel native to the Phaser canvas.
2. **Disciplined pixel-grid typography:** `src/font.ts:16-41` snaps VT323 to exact multiples of its 12.5 px stroke grid (`FS.body = 25`, `FS.heading = 37.5`, `FS.title = 50`, `LINE = 1.2`) with optical vertical centering (`textPad()`).
3. **Contextual, self-retiring onboarding hints & glints:** `src/core/tips.ts:75-100` prioritizes actionable hints (out of bait → first 3 casts → bag full → crate → quest → story → car), hides the frame when quiet, and staggers shore glints plus a bobbing car pin (`src/scenes/LakeScene.ts:2582-2595`).
4. **Thoughtful scroll cues & pinned chrome:** `src/ui/panel.ts:74-80,141-155` provides pinned headers/footers, custom wood scrollbars, and dynamic 20 px top/bottom scroll-fade gradients (`ResizeObserver`) so Android overlay scrollbars never hide scrollable content.
5. **Strong Shop, Bag, Log, and Checklist ergonomics:** Two-tab Shop (`Sell (n)` / `Buy`) with smart default tab (`src/ui/bagShop.ts:279-326`), Bag `"Go to Shop"` footer (`bagShop.ts:233-240`), accordion Checklist with gold/FOTD hand-in warnings (`src/ui/checklistPanel.ts:70-77,92-130`), and icon-based locked Log tiles (`src/ui/logPanel.ts:50-57,101-113`).
6. **Fight-time toast queueing & tall-phone letterbox painting:** `src/core/toastQueue.ts:8-20` defers toasts during fights so the catch bar stays clear; `paintBands()` (`src/scenes/LakeScene.ts:2797-2807`) matches page letterbox bands to sky/grass.
7. **Clear nibble vs. bite escalation:** Distinct visual, audio, and haptic cues (`src/scenes/LakeScene.ts:1683-1693,2373-2377,3044-3052`) plus automatic bait-exhaustion toasts (`LakeScene.ts:1481-1485`).

---

## Problems

### Blocker

1. **Red-on-green Catch Bar sweet spot fails red-green colorblind players (~8% of men)**
   - **Evidence:** `src/scenes/CatchBarView.ts:88-103` renders a flat red core (`PAL.red`/`PAL.redDark`) directly inside a flat green zone (`PAL.leafLight`/`PAL.leafHi`) with no shape, border pattern, or luminance break (confirmed in live fight screenshot `step_28_shot_1.png`). `progressColor()` (`CatchBarView.ts:30-32,120-124`) also relies on red→yellow→green.
   - **Suggested fix:** Add high-contrast inward white/gold chevron ticks or a dashed white border on the sweet spot + subtle flash when active, and offer a blue/gold colorblind toggle in Settings.
   - **Effort:** S–M

2. **Update toast directly overlaps top-right `BOARD_BTN` (and top HUD at 360 px)**
   - **Evidence:** `src/scenes/LakeScene.ts:222` places `BOARD_BTN` at `(308, 4, 44, 44)`. `src/ui/updateToast.ts:16-29,38-45` assumes top-right is empty and pins `"New version — tap to reload"` (~290 px wide at 25 px font) at `top: 8px; right: 8px; z-index: 20` with no dismiss `×`.
   - **Suggested fix:** Remove `BOARD_BTN` (per `docs/ui-review/UI_REVIEW.md:53-68`), or move the update toast centered below the top HUD (`top: ~76px`) with a dismiss button.
   - **Effort:** S

3. **Zero keyboard / Android Back / modal focus accessibility on DOM panels**
   - **Evidence:** `src/ui/panel.ts:92-207` creates panels as plain `<div>`s with no `role="dialog"`, `aria-modal="true"`, `Escape` handler, or `history.pushState`/`popstate` (or Capacitor `backButton`) hook. Pressing Android Back exits the PWA instead of closing the active panel.
   - **Suggested fix:** Add ARIA dialog attributes, `Escape` dismissal, focus restoration, and a modal stack hooked to `popstate` / Android Back.
   - **Effort:** M

### Major

4. **Tap-vs-hold on shore objects flicks Alex's rod and flashes the charge bar on every tap**
   - **Evidence:** `src/scenes/LakeScene.ts:756-766,1937-1944` and `src/core/tapHold.ts:13-16`. Pressing `car`, `crate`, `sign`, `board`, or `chair` enters `charging` immediately, flashing the power meter (`LakeScene.ts:2379`) and jerking the rod (`3090-3095`) before cancelling on release. A leisurely ≥180 ms mobile tap (`MIN_HOLD_MS`) casts instead of opening the object.
   - **Suggested fix:** Delay charge visuals/rod wind-up until `heldMs >= MIN_HOLD_MS` (or 120 ms when `holdOn !== null`) and consider ~220–250 ms threshold on shore objects.
   - **Effort:** S

5. **Two Notice Board entry points behave inconsistently**
   - **Evidence:** `BOARD_BTN` (`src/scenes/LakeScene.ts:1880-1883`) calls `openQuests()` directly, bypassing `signAction()` (won't open a floating story bottle or trigger a waiting chapter) and never calls `markHint('sign')` (shore sign glints forever). It also sits in the hardest-to-reach top-right corner and crowds the fight progress strip's fish icon by ~1–2 px (confirmed in `step_28_shot_1.png`).
   - **Suggested fix:** Remove `BOARD_BTN` (keeping the thumb-reachable shore sign) or route it through `tapSign()`.
   - **Effort:** S

6. **No live fight feedback for Perfect Catch streak or Sweet-Spot 1.5× bonus**
   - **Evidence:** `src/core/catchBar.ts:47,274-279` tracks `leftZone` and `coreFillMult = 1.5`, but `src/scenes/CatchBarView.ts:68-125` displays neither. Players never know mid-fight if their Perfect run is still alive or that the red box fills faster.
   - **Suggested fix:** Show a small gold star/crown above the bar that dims the instant `leftZone` flips `true`, and highlight/pulse the core border while the fish is inside it.
   - **Effort:** S–M

7. **Sub-44 px tap targets remain on Map pins and Bottom Bar gear; Trophy & Car hit boxes touch**
   - **Evidence:** `src/ui/mapPanel.ts:18,90,98-111` (`HIT = 32`, labels `pointer-events: none`); `src/scenes/BottomBar.ts:18,27-31` (`settings` hit box is `38×44` px); `src/core/data/locations.ts:20,23` (`trophy` `y: 446..494` touches `car` `y: 494..552` with 0 px gap).
   - **Suggested fix:** Raise map pin `HIT` to `44` (and make labels clickable); widen `settings` to `40` px (44 px with gap); nudge `trophy` up 4–6 px.
   - **Effort:** S

8. **WCAG contrast failure on `COLORS.dim` (`#8a7660`) over wood (`#3a2318`)**
   - **Evidence:** `src/ui/panel.ts:11,20,55` gives ~3.35:1 contrast (below WCAG AA 4.5:1), further degraded by `opacity: 0.8` on locked Shop cards (`src/ui/bagShop.ts:172-177`).
   - **Suggested fix:** Lighten `COLORS.dim` to `#b59f84` (~5.4:1) and remove the extra `opacity: 0.8` on `gateCard`.
   - **Effort:** S

9. **Checklist discoverability dead-end from Shop gear gates & no unlock notification**
   - **Evidence:** `src/ui/bagShop.ts:181` displays `"Unlocks after 1 checklist bundle (0/1)"` with no button to open the Checklist. Completing a bundle (`src/scenes/LakeScene.ts:1072-1082`) never tells the player that new gear just unlocked in the Shop.
   - **Suggested fix:** Add a wood `"Open Checklist"` button on `gateCard`, and append `"New gear in Shop!"` to the bundle completion toast when a gear gate opens.
   - **Effort:** S–M

10. **Catch screen & HUD visual collisions at 360×640 (live-verified)**
    - **Evidence:**
      - `step_33_shot_1.png` (`?debug=caught&species=eel&star=gold&perfect=1&fotd=eel&time=12`): Pajkel's speech bubble (`"Perfect catch! A medal!"`) overlaps Alex's hair and renders with low contrast while fading; `caughtSub` + `caughtStars` (`LakeScene.ts:2422-2428`) is visibly right-shifted instead of centered as a group.
      - `step_8_shot_1.png` / `final_step_92.png`: Wind icon in the top-left `Day 1 · 12:00` frame sits cramped against the right frame border with ~0 px padding.
      - `step_20_shot_1.png`: Floating `"Bestia"` name tag overlaps Pajkel's head and Alex's legs.
      - `step_20_shot_2.png`: Short-tapping water spawns a top toast `"Hold to charge, release to cast"` while the identical bottom hint bar is already visible.
    - **Suggested fix:** Center `caughtSub` + `caughtStars` as one combined width; clamp catch stack `lift` below `y = 84` and position Pajkel's bubble clear of Alex; add 6 px right padding to the clock plate; suppress the short-tap toast when the bottom hint already displays the same text.
    - **Effort:** S

11. **Viewport locks out zoom (`user-scalable=no`) and DOM panels ignore safe-area insets**
    - **Evidence:** `index.html:5` sets `maximum-scale=1.0, user-scalable=no`; `src/ui/panel.ts:109,121` uses fixed `padding: 12px; max-height: 92vh` without `env(safe-area-inset-*)`.
    - **Suggested fix:** Apply `env(safe-area-inset-*)` padding and `100dvh` max-height in `panel.ts`; rely on `touch-action: none` on `#game canvas` (`index.html:29`) instead of disabling zoom globally.
    - **Effort:** S

### Minor

12. **Trophy Board has no discoverability glint** (`src/core/tips.ts:8` omits `'board'`). Add `'board'` glint when first trophy mounts. (Effort: S)
13. **Double `rb-gold` violation on Road Map** (`src/ui/mapPanel.ts:138-151`): both `"Drive there"` and `"Quiet Lake checklist"` render gold simultaneously. Make Checklist `wood` when `"Drive there"` is shown. (Effort: S)
14. **Bait Box card still closes on backdrop tap** (`src/ui/baitBoxCard.ts:32-72`), contradicting `UI_REVIEW.md:454-455`. (Effort: S)
15. **Bait chip lacks tap affordance** (`src/scenes/BottomBar.ts:61-66`): looks like a static counter; add a tiny chevron when >1 bait is owned. (Effort: S)
16. **Scrollable panels put Back/Close inside `body` instead of pinned `footer`** (`checklistPanel.ts:174`, `questPanel.ts:147,206`, `logPanel.ts:109,148`, `trophyCard.ts:47`). (Effort: S)
17. **`prefers-reduced-motion` ignored outside Shop pop** (`bagShop.ts:91` only; shakes/springs/rain/roadCard ignore it). (Effort: S–M)
18. **ARIA & tab semantics gaps:** `Story` tab's `"new page"` dot overrides its accessible name (live QA confirmed `role=tab` reads `"new page"` instead of `"Story"`); `baitPicker.ts:28-40` uses `<div role="button">` without `tabindex`/`keydown`; tabs lack `role="tablist"`/`tabpanel`; Settings slider labels are `<div>` not `<label>`. (Effort: S)
19. **Quests header wraps & Road card banner tight at 360 px (live-verified):** `step_62_shot_3_quests_tab.png` shows `"Daily quests (0/3) Claim!"` wrapping onto 2 lines; `"Driving to River bend..."` nearly touches both screen edges. (Effort: S)

### Polish

20. **Italic flavour text in Checklist ignored** (`src/ui/checklistPanel.ts:121` lacks `font-synthesis: style`, overridden by `index.html:28`). (Effort: S)
21. **Dense rod upgrade copy in Shop** (`src/ui/bagShop.ts:204-205` wraps 4–5 lines beside the icon); split into stacked stat lines. (Effort: S)
22. **Settings unsaved Names wiped when toggling `"Save code..."`** (`src/ui/settingsPanel.ts:204,273-275` calls `panel.refresh()`). (Effort: S)
23. **Name overlay still has tight title & old copy** (`src/ui/nameOverlay.ts:90,93` vs `UI_REVIEW.md:444-445`). (Effort: S)

---

## Missing Features

1. **Haptics On/Off toggle in Settings** (`src/scenes/haptics.ts:2-8` vibrates unconditionally — critical for a cozy "play in bed" game).
2. **Interactive Weather / Clock tooltip** (tapping the clock/weather plate explains the active weather effect and time until next hour).
3. **Colorblind / High-Contrast Catch Bar mode** in Settings.
4. **Native tall-phone (20:9) vertical expansion** (M3: dock HUD and BottomBar to real screen edges with safe-area insets).

---

## Open Questions for the Developer

1. **Remove `BOARD_BTN`?** Since it collides with the update toast and fight strip and bypasses `signAction()`, can we remove it and rely on the shore sign (or move a shortcut to the bottom bar if testers still miss the sign)?
2. **Shore-object tap delay:** Are you comfortable delaying cast charge visuals by ~120–180 ms when pressing a shore object so taps never flick Alex's rod?
3. **Live Perfect/Sweet-spot cues:** Should the catch bar visibly show when a Perfect Catch is still alive and when the red core is boosting fill speed?
4. **Haptics & Colorblind settings:** Ship before M2 or defer to M3?
