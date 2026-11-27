# Roadmap

_Rewritten 2026-11-27 (was drafted 2026-11-24). Sources: the external adversarial review in
[review/](review/) (00 verdict, 08 fix order, 10 consultants, 11 pitches), [HANDOFF.md](HANDOFF.md),
the sims in [ECONOMY_SIM.md](ECONOMY_SIM.md) and [CATCH_MATH_AUDIT.md](CATCH_MATH_AUDIT.md), and git
history on `main`. Design details live in [GAME_DESIGN.md](GAME_DESIGN.md), the story in
[STORY.md](STORY.md). The older interactive page [roadmap-review.html](roadmap-review.html) is kept
as a record of the 2026-11-25 decisions._

Rule of thumb (unchanged): every milestone ends in something Alex can play on her phone and enjoy for
weeks, even if we stopped there.

---

## 1. Where we are (2026-11-27)

| Milestone | State |
|---|---|
| **M1 · Quiet Lake, complete** | **Done and played.** Story Q1-Q8, checklist, pacing rework, A1-A3 review fixes, camp life, shore fiddles. |
| **M2 · Road trip: River Bend** | **Playable end to end.** Travel, art, current, 6 river fish, checklist + R1-R6, 3 trophies + the Ferryman, river gear. Left: spinning rod (32), weekly quest, Line difficulty revisit. |
| M3 · Ready for strangers | Not started (only the `src/i18n/en.ts` seed from A3 exists). |
| M4 · Old quarry | Not started. |
| M4.5 · Make it yours | Not started. |
| M5 · Sea pier, v2.0 public | Not started. |

`main` is pushed and deployed; ~386 commits, 94 test files. Everything pushed has been played on the phone.

---

## 2. Done since the review (2026-11-25 → 2026-11-27)

**Review fixes (phase A of `review/08`)**
- A1 hotfixes: lazy texture cache, audio only when the context runs + limiter + pause fade, Q4/Q7 story
  soft-lock fixed, trophy medal saved, load / start-over remount cleanly.
- Shiver 1: Q4's day fallback needs 3 bundles, second-chance night blink.
- A2 balance (`balance/a2`): economy + perfect-catch bot sim, 300 ms perfect grace, sunny and fog fixed,
  corn/maggots retuned, Dawn Chorus fish at dawn, asp off the shallow cap, nap cooldown, deep night x0.85,
  camp x1.5, story catch-up cap 3/day.
- A3 feedback: shore taps never move the rod, top-right board button removed (sign only), live perfect star,
  colourblind sweet-spot edge, "new gear" cue, vibration switch.
- A3 words: `{player} {companion} {dog} {place} {water}` placeholders, quest grammar ("Catch an eel"),
  pixel-safe glyphs, place- and time-aware lines, `src/i18n/en.ts`.
- M2 groundwork A+B: per-zone fish pools, render scale capped at 3, companion spots per place, river ambience.
- Reviewer was wrong on two "blockers": fonts load fine on Pages (Vite rewrites the path) and the hut darkens at night.

**New features**
- 26 / 26b shore fiddles: pebble skipping (Alex and Pajkel), fetch on demand, Bestia's Stick Museum.
- 27 camp life and sound: Bestia naps, rain-damped campfire, tent glow, rain/wind/fire beds, trophy + medal stingers.
- 28 Line fight "feel the line", tuned twice, then per-species trophy tuning; **default since 2026-11-27**.
- 29 shop per place · 30 feeding Bestia · 31 Bestia's bed on the dock (Alex's idea) · Bestia night look.
- Moments pause through a fight.

**M2 River Bend content**
- 25d river fish (trout, grayling, nase, chub, barbel, vimba), per-band pools, "where" line in the log.
- 25e "Against the Current" checklist, chapters R1-R6, five river moments.
- 25f Lantern, Barbel King, Ferry pike, river trophy board, the Ferryman and its rope-creak window.
- 25c river current (drift to the eddy, seam bites, river surges in Line).
- 25g trotting float + heavy lead in the river shop.
- Spinning rod designed (GAME_DESIGN → "Spinning rod", slice 32), not built.

---

## 3. What should be fixed

Ordered by how much Alex (or a tester) would notice. **Checked** = confirmed in code today.

### 3a. Feel and balance (play first, then tune)
1. **Line is too easy** (user: the Ferryman took 3-5 s). Wait for Alex's play, then raise difficulty on hard
   fish and legendaries: `src/core/data/lineFight.ts` (`rise`, `goldWidth`, `surgeHold`, `trophyFlex`,
   `reelBase`), Ferryman signature in `src/core/data/rare.ts`. Re-run the Line sim and the economy sim after.
   Aim: legendaries 15-30 s, trophies clearly harder than their species.
2. **Shop pace misses its target**: whole Quiet Lake shop in 4.2 h vs the 6 h aim (ECONOMY_SIM "Proposal to reach
   ~6 h": camp x2, pro reel 5000, fluoro 3000, kit 3500). Shop per place softened it; decide after the river
   shop + spinning prices are in, then re-sim both places together.
3. **Classic catch bar B1/B2 leftovers** (CATCH_MATH_AUDIT): catfish still easier than pike for a sloppy player,
   difficulty across pattern families not comparable. Lower priority now that Line is the default; fix only
   if Classic stays as a public option.
4. Shallow fish unlosable in Classic (T1, accepted) — re-check in Line (decent bot loses ~3-10 %, fine).
5. Reels help little in Classic (15a note); in Line the reel is reel speed — check it is felt.

### 3b. Bugs and rough edges still open from the review
6. **"Sell all" sells checklist-fitting and gold/medal fish** with no warning (**checked**: `sellAll` in
   `core/inventory.ts` empties the bag). Review and consultants both rank it the most regrettable mistake in the
   game. Fix: skip or confirm checklist/gold fish, a pip on those rows.
7. **Catch screen skipped by an excited thumb** (consultants: 400 ms guard after a fight). Lengthen for new
   species / trophies.
8. ~~**Three stale local branches**: `feat/line-default`, `slice/25c-river-current`, `slice/25g-river-gear` are
   merged but not deleted.~~ Done 2026-11-27.
9. ~~**HANDOFF table is stale**: rows 25d, 25e, 25f, 26-31, A3, balance still say "not merged / awaiting review".
   Tidy into one "merged" table so a new session is not misled.~~ Done 2026-11-27.
10. Small slips from the consultants still unverified: first-catch trophy line dropped at night, catch screen
    crowding at 360 px (bubble over Alex, size line off-centre), campfire/string lights vs the trophy board,
    moon glitter at full brightness in rain, River Bend dock corner tile. One tester-agent pass to confirm or close.

### 3c. Known weak spots we left ourselves (HANDOFF)
11. **Sound never heard on a phone**: rain, wind, fire, river beds, stingers, creak. Levels are guesses; a
    listening pass on the `?debug=sounds` board with the phone speaker.
12. Bestia: curled in the 12 px bed reads as a ginger blob at night; the bed edge touches the crate's tap box;
    a napDue spin ends the play session early.
13. Pebbles: flick thresholds never felt on a phone; 2 px pebble hard to see; stones merge with the shore.
14. Trophy art: lake trophies are recolours (silver ghost reads as a pale bleak), board minis are 15 px.
15. Rod shop icons weak (bamboo/fiberglass reel reads as a grey blob).

### 3d. Engineering debt (do it as we touch things, strangler-fig)
16. **`LakeScene.ts` is 4,283 lines** (3,320 at the review; it grew by a third). Extract what the next slices
    touch: rig/bait chip + spinning retrieve view (slice 32), `WeatherRenderer`, `CampRenderer`, `DevFlags`.
17. Almost no scene/UI tests (`anglerLook`, companions only). Add a test per extracted piece.
18. No boot error screen, no local error log, save numbers unbounded, no `webglcontextlost` recovery (**checked**:
    none in `src/`). Needed before M3 testers anyway.

---

## 4. What we should do next (in order)

1. **Alex plays the river** (25c current, 25g gear, Line default). Collect her notes; nothing big lands before.
2. ~~**Housekeeping**: delete merged branches, tidy the HANDOFF table (items 8-9).~~ Done 2026-11-27.
3. **Slice 32 · Spinning rod** (spec ready in GAME_DESIGN). Branch `slice/32-spinning`, Sonnet builds, Opus
   reviews, stop for phone play. Pull the rig chip and retrieve view out of `LakeScene` while building it.
4. **Line difficulty revisit** (item 1) once Alex has played, together with the spinning sim numbers.
5. **Small comfort batch, ~1 day** (consultants' top picks not built yet):
   - Sell-all protection + checklist pip (item 6), longer catch-screen guard (item 7).
   - **Tap Pajkel to chat**: short weather/bag/Bestia lines, reactions to a big loss or a hard perfect catch.
   - **Bites readable with the sound off**: droplets on a nibble, gold splash on a bite, bright bobber tip at night.
   - Gentle welcome-back line from Pajkel on the first visit of a day.
6. **Sound listening pass** (item 11) on the phone, then fix levels.
7. **Weekly quest** (M2 leftover): one bigger relaxed goal, Monday reset, cosmetic or bait reward, not a grind.
8. **Close M2**: fish log pages per place, "Done when" check (≈2 weeks of river goals for a normal player in the
   economy sim), shop pace decision (item 2).
9. Then choose between **M3 groundwork** (Capacitor build, error log, i18n migration) and **M4 Old quarry**.
   Recommendation: M3 groundwork first (it is boring but does not age), M4 content after.

---

## 5. Milestones ahead

### M2 · "Road trip: River bend" — finish
- [x] Travel by car, location as data, render scale ≤3, companion spots per place
- [x] River current (drift, seam, surges; no forced reel-in)
- [x] River art, 6 river fish, Lantern / Barbel King / Ferry pike, the Ferryman
- [x] River checklist "Against the Current", chapters R1-R6, river moments, river shop + gear
- [ ] Slice 32 spinning rod (river shop, lures, follow-and-strike retrieve)
- [ ] Fish log pages per place (today one log with a "where" line)
- [ ] Weekly quest (Monday reset)
- [ ] Line difficulty revisit after Alex plays

**Done when:** she can drive there and back, the river has ~2 weeks of its own goals, and spinning has been played.

### M3 · "Ready for strangers" (closed test)
Review phase B folded in.
- [ ] Onboarding: a short first-time tutorial (cast, hook, Line fight, bag, shop)
- [ ] Choose your character (Alex the default); decide personal vs public content (Pajkel, Bestia, "DS4", band nods)
- [ ] Polish translation with real plurals; migrate remaining strings into `src/i18n/`
- [ ] Capacitor Android build (target API 36), edge-to-edge safe areas, Android Back closes panels
- [ ] Save durability (Capacitor Preferences mirror, bounded numbers, migration test), local error log + "Copy
      diagnostic log", `webglcontextlost` recovery, pause/persist on app state change
- [ ] Performance + battery on a mid-range Android (FPS overlay, atlas, pre-baked glows)
- [ ] Accessibility: dim text contrast, ≥44 px map pins, reduced motion
- [ ] Privacy page, About & licences (VT323 OFL, Phaser MIT), Data safety, store art and screenshots
- [ ] Google Play closed test: 12+ testers for 14 days

**Done when:** the game is in a Play closed test with 12+ friends and the crash/feedback list is short.

### M4 · "Old quarry"
Deep clear water, odd fish, the Ironjaw (noon legendary), chapters O1-O7, quarry checklist, fossils (STORY §4).
Candidate new rod here: feeder (heavy fish, patient fights). Aimed casting + features would fit the quarry's ledges.

### M4.5 · "Make it yours" (just before public release)
Alex and Pajkel looks (hair, outfit, colours), rename/recolour the car, the wardrobe card (holds the Pale Scale
pendant). Pitch #2 (wardrobe + bobber box + "Trail of the Lost Red Bobber") lives here.

### M5 · "Sea pier: In Waves" = v2.0, public Google Play release
Dunwater, gulls, the Other Angler, the finale at dawn, the Pale Scale pendant, the epilogue at Quiet Lake.

---

## 6. Idea pool (not scheduled; pick by mood)

**Most liked / cheapest first**
- Tap Pajkel to chat (scheduled in step 5 above).
- "Pajkel's Version": trophy board captions that grow taller with the days since the catch (pitch #4, S).
- Pajkel's glovebox Polaroids on trip milestones, album in the car (pitch #3, M).
- Personal "— P." bottle notes on real-day milestones (day 3, 7, 14, 30) — the strongest gift moment; user said "later".
- Spin-only trophy, right after spinning is tested (user: "for now" none).
- Campfire kettle: one free cozy brew per in-game day with a small perk (pitch #6).

**Fishing depth**
- Aimed casting + lake/river features (reeds, lilies, sunken log, drop-off) — build both together.
- Switch between owned rods (more meaningful now with float vs spin).
- Species that need a special bait; treasure in the fight (Line version: a glint on the line).
- Feeder rod (M4), fly rod (if ever).

**Retention**
- Morning forecast + daily lake quirk; weather tooltip on the clock.
- Pajkel's request as quest #3; weekend bait boat / travelling merchant with one rotating item.
- Mastery crowns (knowledge tiers 1/3/8 for rares); pick-your-trophy wall; achievements + total weight.
- Dinosaur hoodie for 3/3 lake trophies.

**World and look**
- Drive and foley sounds (road card engine, wet footsteps in Q5, petting).
- Bespoke trophy silhouettes; better rod icons.
- Bedtime dim mode (only if Alex plays in the dark a lot).
- Later places from STORY §7 (Lock No. 4 canal), seasonal events, trophy wall / aquarium on the dock, cloud sync,
  NPC tournaments (offline first).

**Parked on purpose:** seasons, landscape/walkable world, music, online leaderboards.

---

## 7. Open decisions for the user

1. **Line difficulty**: how hard should the Ferryman be? (recommend 15-30 s for a decent player, ~50 % land rate first try)
2. **Shop pace**: accept 4.2 h for Quiet Lake (shop per place makes each place its own arc) or apply the ~6 h price bump?
3. **Classic in the public build**: keep it as an option (then fix B1/B2) or hide it after testers compare?
4. **After M2**: M3 groundwork or M4 Old quarry first?
5. **Personal notes ("— P." bottles)**: now, later, or only for the gift build?
6. Still open from 2026-11-25: fold Bag into "Shop · n/10"; inside jokes in Pajkel's tap lines.

---

## Google Play: how it would work
The game is a PWA, so no rewrite is needed. Two ways to wrap it:

1. **Capacitor** (recommended): bundles the built `dist/` inside a real Android app. Works fully offline, no
   domain setup, saves stay in the app's WebView storage. One more build step (`npx cap sync android`, then build
   in Android Studio). Disable the PWA service worker and update toast in the native build.
2. **Trusted Web Activity** (Bubblewrap / PWABuilder): a thin shell that opens the website. Needs
   `/.well-known/assetlinks.json` at the *domain root*, which a GitHub Pages project site
   (`boguckimich.github.io/somethingfishy/`) can't serve without a user-site repo or a custom domain.

What Google asks for (check the current rules when we get there, they change):
- a developer account (one-time fee, identity check);
- for new personal accounts: a **closed test with at least 12 testers for 14 days** before production;
- a privacy policy URL, the Data safety form (we collect nothing), a content rating questionnaire, store listing
  text, icon and screenshots;
- target a recent Android API level (Capacitor handles it).

Things to settle before going public: real car brand names in text ("DS4"), the likeness of real people (fine for
a gift, a choice for a public game), and the band nods (titles only, never lyrics; already the rule in STORY.md).
