# 03 — Narrative, Copywriting & Localization Review

**Reviewer:** Narrative Lead / Storyteller & Copywriter / Localization Lead  
**Scope:** `docs/STORY.md`, `docs/RIVER_BEND.md`, `docs/GAME_DESIGN.md`, and all user-facing strings across `src/core/`, `src/ui/`, `src/scenes/`, and `index.html`.

---

## Strengths (with evidence)

1. **Disciplined "cozy first, whimsical-spooky second" arc:** Restricting the entire 4-location storyline to three shivers (`Q4`, `O5`, `S5`) and following each with warmth or comedy (`docs/STORY.md:16-36`) makes the Sleeper memorable and genuinely affectionate rather than generic horror.
2. **Sharp, distinct character voices:**
   - **W.:** Dry, concise, reassuring (`src/core/data/story.ts:55`: `"My line went down 40 metres last night. The map says 9. One of us is lying. — W."`).
   - **Pajkel:** Consistently warm, snack-driven, and blissfully oblivious (`story.ts:35`: `"A pen pal! Ask if they have snacks."`, `story.ts:44`: `"You caught WHAT? I was asleep?!"`, `pajkelLines.ts:11`: `"No take, only throw?"`).
   - **Alex:** Quietly observant in the Story journal (`story.ts:96`: `"Forty metres down in a nine-metre lake?"`, `story.ts:113`: `"I caught it. I think. Why is it so hard to remember?"`).
   - **Bestia:** Pure physical comedy (stick hoarding, dry fur in Q5, boofing at the duck).
3. **Cohesive environmental foreshadowing:** Random bottle notes (`src/core/data/moments.ts:56-68`: `"— The Lake"`, warm water, extra star) pay off directly in `docs/STORY.md:50-52`.
4. **Playful, diegetic micro-copy:** Bundle flavours (`src/core/data/checklist.ts:28-53`: `"For the duck. You know why."`) and rare fish rumours (`src/core/data/fish.ts:135,141,148`) read effortlessly.
5. **Spoiler-free Story Journal with profile signatures:** `src/core/story/story.ts:208-224` hides unseen chapters, and `src/ui/questPanel.ts:94-107` signs thoughts using `names.alex` / `names.paj`.

---

## Problems

### Blocker

1. **Q4 night milestone can permanently soft-lock chapters Q5–Q7 (and fails on Deep Night naps)**
   - **Evidence:** `src/core/story/story.ts:89,100-112,128-132`, `src/scenes/LakeScene.ts:1259`. `isNightVisit = (minute) => minute >= 21 * 60` (`1260`), and `todaysChapter` enforces strict sequential order (`chaptersOf(place).find((c) => !has(s.done, c.id))`).
   - **Impact:** (a) A player who always naps from Dusk to Dawn never sets `m.night`, permanently locking **Q5, Q6, and Q7** even after finishing the lake. (b) Even napping to `"Deep night (02:00)"` (`minute = 120`) fails `120 >= 1260`, so `m.night` still never sets!
   - **Suggested fix:** Change `isNightVisit` to `minute >= 21 * 60 || minute < 5 * 60`, and add a fallback unlock for Q4 (e.g. `m.night || bundles >= 1`, delivering the day bottle if she hasn't visited at night).
   - **Effort:** S

2. **Missing glyphs (`★`, `✓`, `○`) in VT323 fall back to system `monospace`**
   - **Evidence:** `index.html:17,25` (VT323 `unicode-range`) excludes `★` (U+2605), `✓` (U+2713), and `○` (U+25CB), yet `src/scenes/LakeScene.ts:2390` renders `'★ New record!'` and `src/ui/checklistPanel.ts:25,28` renders `'✓'` / `'○'`.
   - **Suggested fix:** Replace `★` with the existing pixel-art star sprite (`starArt.ts`) or `*`, and replace `✓`/`○` with pixel icons or styled CSS squares (like `slotDots` in `checklistPanel.ts:83-89`).
   - **Effort:** S

3. **Localization readiness violates `GAME_DESIGN.md §1` — text is scattered across 46+ files with Polish-breaking concatenation**
   - **Evidence:** `docs/GAME_DESIGN.md:20` (*"text kept in one place so translations (e.g. Polish) are easy to add"*) vs strings spread across 46+ files. Polish-breaking patterns include:
     - `src/core/quests/quests.ts:323`: ``n === 1 ? `Catch a ${name}` : `Catch ${n} ${name}` `` (Polish needs accusative/genitive cases + 3 plural forms: 1 / 2–4 / 5+).
     - `src/core/checklist/checklist.ts:150`: `` `Gives your ${fish.lengthCm} cm ${sp.name.toLowerCase()}, ${what}` `` (case/gender agreement).
     - `src/ui/bagShop.ts:181`: binary plural `${gate.need === 1 ? 'bundle' : 'bundles'}`.
     - `src/ui/trophyCard.ts:16`: hardcoded English month array `['Jan', 'Feb', ...]`.
     - Tight English pixel widths in `src/scenes/BottomBar.ts:14-18` and `src/core/tips.ts:72` (`TIP_MAX_CHARS = 33`), where Polish runs ~20–30% longer.
   - **Suggested fix:** Introduce a lightweight `src/i18n/en.ts` + `t(key, params)` with Polish-ready `one/few/many` plural rules before River Bend adds 150+ new strings, then migrate legacy Quiet Lake strings in M3.
   - **Effort:** M (scaffold now) / L (full migration)

### Major

4. **Q4's iconic "Shiver 1" night blink is almost unreachable in natural play**
   - **Evidence:** `src/core/data/story.ts:122` (`nightFromMinute: 21 * 60`), `src/core/story/story.ts:165` (`blinkIsNight = (pajkelAsleepInCar, nightSky) => pajkelAsleepInCar && nightSky`), `src/core/bedtime.ts:13` (Pajkel goes to the car at `00:00`).
   - **Impact:** `m.night` unlocks at `21:00`, and `storyTimerMs` fires 60–90 s later (~`22:15–22:45` in-game) while Pajkel is still awake on the dock. Almost every natural player gets the day bottle instead of the blinking star!
   - **Suggested fix:** If `timeOfDay === 'night'` and Pajkel is still awake (21:00–23:59), hold Q4's delivery until `00:00` when he enters the car (or allow the blink at any night hour with Pajkel briefly dozing).
   - **Effort:** S

5. **Hardcoded `Alex`, `Pajkel`, and `Bestia` ignore custom player-edited names**
   - **Evidence:** `src/core/data/pajkelLines.ts:8,11,17,20` (`"Bestia, come!"`, `"Bestia, give!"`, `"Gold star, Alex!"`, `"A MEDAL! Perfect, Alex!"`); `src/core/data/rare.ts:75` (`"Unreal, Alex."`); `src/core/data/story.ts:40-41,97`; `src/core/data/camp.ts:16-17`; `src/core/carMap.ts:44` (`"Pajkel is busy playing"`); `src/ui/checklistPanel.ts:137` (`"Pajkel packs the car."`, `"Bestia packs a stick."`).
   - **Suggested fix:** Replace literals with `{player}`, `{companion}`, `{dog}` tokens interpolated from `Profile` at display time.
   - **Effort:** M

6. **English grammar bugs in species quests (`"Catch a eel"`, `"Catch a ide"`, `"Catch a asp"`, `"Catch 2 eel"`)**
   - **Evidence:** `src/core/quests/quests.ts:322-323` (`n === 1 ? \`Catch a ${name}\` : \`Catch ${n} ${name}\``). Fails vowel article (`a` vs `an`) for 3 of 15 species and omits plural `eels`.
   - **Suggested fix:** Add article/plural metadata on `Species` (or handle in `i18n`).
   - **Effort:** S

7. **Q8 ("Road fixed!") fires out of order before Q6/Q7**
   - **Evidence:** `src/core/story/story.ts:100-111,208-224`, `src/ui/checklistPanel.ts:133-146`. Because `Q1–Q7` cap at 2/real day (min 4 days to reach Q7), a player who finishes all 6 bundles on Day 2 sees Q8 (`"The road to the river is fixed."`) and drives to River Bend, then days later receives Q7 where Pajkel says `"Road trip? I'll fix the road!"`.
   - **Suggested fix:** Bypass the daily cap for Q7 when 5/6 bundles finish (or deliver Q7 right before Q8 on bundle 6), and suppress the `"I'll fix the road!"` bubble if `roadFixed` is already true.
   - **Effort:** S

8. **Personal/trademarked `"DS4"` in public copy**
   - **Evidence:** `src/core/data/checklist.ts:53` (`flavour: "The DS4 won't drive on vibes."`). Contradicts `GAME_DESIGN.md §2b:73-74` (*"nothing more personal than the defaults is in the public repo"*), carries Citroën trademark risk, and reads as "DualShock 4" to strangers.
   - **Suggested fix:** Change to `"The car won't drive on vibes."`
   - **Effort:** S

### Minor

9. **UK vs. US spelling mix:** Copy is 90% UK (`cosy`, `metres`, `kilometres`, `Coloured`, `rumour`, `Rumours`, `armour`, `honour`), except `Fiberglass Rod` (`src/core/data/rods.ts:8`, `bagShop.ts:432`) and `cozy` in docs. Standardize on UK (`Fibreglass Rod`, keeping `id: 'fiberglass'`). (Effort: S)
10. **Capitalization & naming drift:** `Quiet Lake` (Title Case) vs `River bend`, `Old quarry`, `Sea pier` (Sentence case, `src/core/data/locations.ts:39,76-79`); `Bamboo Rod` (`rods.ts:7`) vs `Braided line` (`tackle.ts:13`); `'visit the Shop'` (`tips.ts:77`) vs `'visit the shop'` (`LakeScene.ts:1609`); Q8 `'is fixed.'` (`checklistPanel.ts:137`) vs `'is open.'` (`story.ts:100`). (Effort: S)
11. **Hardcoded `"the lake"` / `"Quiet Lake checklist"` at River Bend:** `LakeScene.ts:1525` (`'Released it back into the lake'`), `questPanel.ts:142` (`'Watch the lake...'`), `questPanel.ts:162` & `mapPanel.ts:148` (`Quiet Lake checklist`). Make location-aware. (Effort: S)
12. **Stale weather copy:** `src/core/data/camp.ts:20` says `"Shows today's wind"` (weather is now hourly); `src/core/data/pajkelLines.ts:27` says `'The bobber will drift.'` (true at River Bend, misleading at Quiet Lake). (Effort: S)
13. **Pajkel bubble length overrun:** `src/core/data/rare.ts:60` is 65 chars (`'They say an old carp, green as the shore, comes out of the fog...'`), wrapping to 3 lines vs `LakeScene.ts:2405`'s 2-line assumption. Trim to ≤45 chars. (Effort: S)

### Polish

14. **Punctuation & icon consistency:** Mixed `...` vs `…` (both in `settingsPanel.ts:273,283`); `${f.weightG}g` (`bagShop.ts:78`) vs `${weight} g` (`fish.ts:125`); `"coins"` text still used in `baitBoxCard.ts:55`, `checklistPanel.ts:45`, `MomentsView.ts:275`, `LakeScene.ts:1786`; inconsistent trailing periods on toasts. (Effort: S)

---

## Missing Features

1. **River Bend narrative engine (R1–R6 + Ferryman bonus beat):** `src/core/data/locations.ts:50-52` has `storyPlaceId: null`. Needs `CHAPTERS['river-bend']`, multi-place Story Journal structure (`Chapter n of 7` is hardcoded to Quiet Lake in `story.ts:116`), new `StoryView.ts` kinds (card-only, upstream stick, returning duck), and a **fallback milestone for R4** (*"first dusk at the river"*, `docs/RIVER_BEND.md:115`) so dusk-skippers don't repeat Q4's soft-lock.
2. **Unlockable / rotating species facts:** `docs/STORY.md:117,134,163` adds R5 chub fact, O3 Pale One fact, and E1 Pale One fact replacement (`"{player} caught it twice. It remembers her."`), but `Species.fact` (`fish.ts:31`) is currently a single static string.
3. **Centralized `src/i18n/` dictionary** with Polish-capable pluralization and `{player}/{companion}/{dog}` interpolation.

---

## Open Questions for the Developer

1. **Q4 Night Blink:** Should Q4 wait until `00:00` when the player is already playing at night (21:00–23:59) so they actually experience Shiver 1, and add a bundle fallback so day-only players can't soft-lock Q5–Q7?
2. **English dialect:** Confirm **UK English** (`Fibreglass`, `cosy`, `metres`, `rumour`) across all in-game strings?
3. **Custom names:** Should `{player}/{companion}/{dog}` interpolate everywhere, including Camp items and E1's epilogue fact?
4. **Multi-place Story Journal:** Should M2 display collapsible place sections (`Quiet Lake 7/7`, `River Bend 2/6`) or one chronological road-trip feed?
