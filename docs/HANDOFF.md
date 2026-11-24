# Handoff — read this first in a new session

Something Fishy (working title Rybki, still used in code) is a cozy pixel-art fishing game (PWA, portrait) made by the developer (Pajkel) as a gift
for his wife (Alex), a Stardew Valley / Terraria fan. **All design decisions live in
[GAME_DESIGN.md](GAME_DESIGN.md)**, milestones in [ROADMAP.md](ROADMAP.md), the story in [STORY.md](STORY.md); this file is about *state and how we work*.

_Last updated: 2026-11-24. Slices 15a-20 and the fixes are merged and pushed (18-20 not phone-tested); slice 21 (story chapters) is on branch `slice/21-story-chapters`, not merged. Milestones are in `docs/ROADMAP.md`: we are in M1 "Quiet Lake, complete". Next in M1: phone-test fixes, then the story-chapters engine with the Quiet Lake chapters Q1-Q8 (`docs/STORY.md` §3), then Grzesiu's fish knowledge._

## Current state

| Slice | What | Status |
|---|---|---|
| 1 | Lake scene, hold-to-charge casting, bobber, distance zones | merged |
| 2 | Game clock, day/night, bites (nibbles, 1 s hook window), GameEvents | merged |
| 3 | Art pass: hand-authored pixel art, day/night palettes, rod animations | merged |
| 4 | Characters: Alex + Pajkel + Bestia (dog), AFK play, petting, name entry | merged |
| 4b | Standing Alex: slimmer, clearer hair, glances around (GAME_DESIGN §2b) | merged |
| 5 | Catch bar fight + show-off pose (GAME_DESIGN §3); user: "ok for now, perfect later" | merged |
| 6 | Fish data (12 species), spawn rules, sizes, catch result | merged |
| 7 | Bag, shop, coins, worms, rod upgrades | merged |
| 8 | Fish log + personal bests, "New species!" / record moments | merged |
| 9 | Saving: autosave, export code, ⚙ settings panel (GAME_DESIGN §3 item 8) | merged |
| 10a | Sound: synthesised SFX + ambient by time of day, volume sliders in ⚙, `?debug=sounds` | merged |
| 10b | Art pass: Tiny5 font, code-drawn pixel frames, icons, 12 fish sprites, show-off at chest, Pajkel, dog spin (GAME_DESIGN §3 item 9) | merged |
| 11 | PWA (offline precache, update toast), app icon, GitHub Pages deploy via Actions, renamed Something Fishy (GAME_DESIGN §3 item 10) | merged |
| 11b | Readability: whole canvas renders at device resolution (K×, `src/renderScale.ts`), font → VT323 on its 12.5 px grid, update toast above the bar, `/dev/font-sheet.html` | merged |
| 12 | Legendary: The Pale One (≥30 m, 02–04 h, 25%), abyssal fight, eerie window (still lake, murky tint, drone), hug show-off, log tile 13 | merged |
| 13a | Daily bait box: crate on the dock, real-date day, streak tiers (GAME_DESIGN §3 → Slice 13) | merged |
| 13b | Daily quests: 3/day, notice-board button, claim, reroll | merged (user skipped the phone play-test) |
| 13c | Catch-bar fish marker 2x bigger (75% of the large sprite, 18-34 px), bar 36 px wide (playtesters: too small) | merged |
| 14 | Lake moments: duck, frog, jumping fish, shooting star, bottle note, uncanny bubbles / dark shape (GAME_DESIGN §3 → Slice 14) | merged before the phone play-test (user may want fixes after testing) |
| 16 | The car, bedtime at 02:00, naps, night kit "Lantern & blanket" (GAME_DESIGN §3 → Slice 16) | merged overnight by the main session (user authorised merges up to 16); not phone-tested. Main session fixed the wake day (Day N skipped). Car likeness, carry walk in motion, sounds by ear and the kit-owner 05:00 wake not seen |
| 17 | "No take, only throw" fetch: keep-away, chase, give-up lines, spare stick, old sticks on the grass, rare give-back (GAME_DESIGN §3 → Slice 17) | merged on the user's word (2026-11-24), before the phone test — (531 tests pass; seen only as stills) |
| 18 | Road map: a car tap opens a map panel (four pins, work-in-progress barriers on the "coming soon" places, "Take a nap..." button) (GAME_DESIGN §3 → Slice 18) | merged and pushed 2026-11-24, not phone-tested |
| 19 | Size stars (bronze/silver/gold by length) and fish of the day (bites more, sells x2) (GAME_DESIGN §3 → Slice 19) | merged and pushed 2026-11-24, not phone-tested |
| 20 | Quiet Lake checklist "The Doorstep": 6 bundles of fish/gold/coin slots fix the road to the River bend (GAME_DESIGN §3 → Slice 20; bundles changed by the main session, see docs/STORY.md) | merged and pushed 2026-11-24, not phone-tested |
| 21 | Story chapters for Quiet Lake: Q1-Q7 (sealed bottle, duck and the sandwich, night blink, wet footprints), Pajkel line queue, Pale One bonus card (GAME_DESIGN §3 → Slice 21; texts in docs/STORY.md) | **on branch `slice/21-story-chapters`, not merged**; not phone-tested, motion seen only by stepping the scene by hand |
| 15a | Prices by rarity, braided/fluoro lines + smooth/pro reels, time-of-day in the clock label, Pajkel's speech bubble (GAME_DESIGN §3 → Slice 15a) | merged before the phone play-test (reels help little in the bot sim: sloppy bot 85% → 87% with the Pro reel vs 97% with fluoro line; may raise the reel numbers) |
| 15b | Shop icons: 16x16 icons for worm pack, rods, lines, reels; item cards, "Your tackle" strip, fish sprites + coin icon in sell lists, buy pop (GAME_DESIGN §3 → Slice 15b) | merged overnight by the main session (user authorised merges up to 16); not phone-tested. Rod icons are the weakest (reel reads as a grey blob on bamboo/fiberglass), pro reel looks a bit like a coin |
| 15c | Baits: corn, maggots, fish strip, glow bait; bait chip + picker, shop Bait section, box/quest bait rewards (GAME_DESIGN §3 → Slice 15c) | merged overnight by the main session (user authorised merges up to 16); not phone-tested |
| fix | No "New record!" while Pajkel is going to bed or asleep; asleep, the car puffs a Zzz instead (GAME_DESIGN §3 → Fix: no "New record!" from bed) | merged and pushed 2026-11-24, not seen live |
| fix | Update toast: reload ~1.5 s after the tap if the service-worker hand-over never fires (GAME_DESIGN §3 → Fix: update toast) | merged, not seen on a phone |

Full plan: GAME_DESIGN.md → *Slice plan*. Ideas not yet scheduled (aimed casting, retention quests §5) are in GAME_DESIGN.md too.

### Known weak spots (candidates for polish, not blockers)
- Catch bar (slice 5) — user wants to perfect it later: shallow fights are at the short end (~4.4 s median); zone drag and a
  difficulty^6 drain boost were added beyond spec to make tuning work (`CATCH_BAR_TUNING`);
  a passive player beats ~38% of mid fish (sinkers reach the resting zone, Stardew-like, accepted).
  Rod bend/bobber jerk were not seen in motion by the reviewer.
- Fish (slice 6): tuning margins thin
  (bream/tench ~8.3 s vs 8 s floor, pike 13.7 s vs 15 s ceiling); shallow is still ~100% for a
  sloppy bot despite drain 0.13/s, user may want shallow actually losable.
- Shop (slice 7): real catch→bag→bag-full flow and the "−1 worm" float were not exercised end to
  end by the reviewer; the bottom bar covers the dog's lowest 40 px;
  panels only checked at desktop width; bream needed difficulty 0.66 (sinker pattern barely
  responds to difficulty — fragile).
- Fish log (slice 8): panels/catch screen only seen at 560 px wide (headless limit), not at a
  real 360 px phone; real fight→log flow, bag-full release still counting, the 8 s new-species
  show-off and the bigger clap/hop not seen in motion (unit-tested); a long fact (eel) wraps to 3
  lines on the catch screen, unchecked.
- Saving (slice 9): only unit-tested against a fake storage plus a phone copy check; Import,
  Start over and reload-mid-game not exercised by the reviewer; broken-save toast and "can't save"
  note never seen live; after an import the sky
  catches up on its next 2-game-minute repaint; a save without a stored profile re-shows the name
  card. Copy uses `execCommand` on plain http (LAN dev), `navigator.clipboard` on https.
- Alex's head turns (left/right) are subtle by design (user found big profiles "a monstrosity"). Right head is a mirror of left.
- Art pass (slice 10b): Pajkel now wears a slate-blue jacket in every view (was a black tee; user
  may want the tee back when walking); the dog carries the stick pointing forward from the snout,
  not crosswise; the dog's nose is clipped at its sprite edge; tall fish (bream) cover Alex's chin
  in the show-off; medium-class pike looks small; catfish whiskers a bit dotty. The spin, the
  4-frame walk and the carry trot were only seen as single frames (unit-tested). Zoomed sprite
  sheets: `/dev/fish-sheet.html`, `/dev/char-sheet.html` on the dev server.
- PWA (slice 11): SW registration, offline load and the update toast were checked in headless Edge
  under a `/somethingfishy/` sub-path, not on the phone. The toast sits over the middle of the top
  HUD row. Icon (`src/art/appIconArt.ts`, `npm run icons`) is chunky with a stray pixel under the
  belly. `npm audit` flags dev-only build deps (untouched). Phone test needs the Pages site: the
  LAN dev server is plain http, so no install/offline there, and PWA is off in dev.
- The Pale One (slice 12): tunables in `src/core/data/legendary.ts` (spawn + `EERIE_TUNING`); pure rules
  in `core/legendary.ts`, `core/eerie.ts`; drone is a 5th ambient layer. Seen only as stills: dives in
  motion, the drone and cricket dip (never heard by a reviewer), the full cast→fight→release flow and
  the "slips back" line. Hug pose covers Alex from the chin down (may read as a fish standing in front
  of her). Window tint is very subtle. Extra eye only on the large sprite. `?debug=fight` uses 25 m.
- Daily bait box (slice 13a): pure rules in `src/core/daily/` (`dates.ts`, `daily.ts`), tunables `src/core/data/daily.ts`; the tier that fills a box is the *new* tier (day-after = +1). Reviewer clicked through it in the in-app browser at phone size (crate tap opens the card without casting, Take it adds worms, crate disappears). Not seen live: the "Lucky box!" card, the sparkle, a real midnight rollover, a streak across real days (unit-tested). User OK with the crate size. Bestia does not sniff at the crate (skipped: the dog is pinned to its dock spot in `tickDock`, a walk-and-sniff activity would need new movement). The crate is small (16x12 px) with a 40 px tap area; the date is re-read every 5 s and on tab focus. Sandbox flags never save, so the streak can only be tested live with a real save and the device clock.
- Daily quests (slice 13b): pure rules in `src/core/quests/quests.ts` (roll, sync/auto-pay, progress, claim, reroll, text), tunables + pacing reasoning in `src/core/data/quests.ts`, panel `src/ui/questPanel.ts`, button/badge/cue in `LakeScene`. Reviewer clicked Claim and Reroll in the in-app browser at phone size (paid, badge cleared, reroll swapped kinds). Not seen live: a real catch advancing a quest, the "Quest done!" float, a midnight rollover with auto-pay, sale progress through the real shop; merged without a phone play-test. Targets (catch-any lowered to 8-15 by the reviewer, 3-5 common, 60-300 coins...) are estimates from ~40 s per catch, never play-tested; a rare/night species quest can take more than a day (reroll exists). The quest roll uses the gear at roll time, so the first day on a new save is bamboo-only. Sale progress lives in `sellOne`/`sellAll` (inventory), catch progress in `LakeScene.noteCatch` (time of day from the game clock, record from `recordCatch`). The Pale One counts for any/deep/time quests, not species or records. The notice-board icon is a first pass. A bad saved quest list is dropped and re-rolled the same day.
- Lake moments (slice 14): pure rules in `src/core/moments/moments.ts` (scheduler, pick by clock window + weight, note shuffle, star/bottle rewards, cricket dip), tunables + the 12 note texts in `src/core/data/moments.ts`, sprites in `src/art/momentArt.ts` (contact sheet: `/dev/moment-sheet.html`), picture + taps in `src/scenes/MomentsView.ts`, note card `src/ui/bottleCard.ts`, 4 new synth effects (`quack`, `sparkle`, `clink`, `bubbles`; the frog and the jump reuse `plop`) on the `?debug=sounds` board. `PlayerState.notes` (read ids, optional, normalised, no version bump). The uncanny pair is tuned for ~1 night in 3 (the maths is in the comment of `pickMoment`, a test simulates 3000 nights). Seen only as stills (headless Edge, game steps driven by hand): not in motion at a real frame rate, no sound heard by a reviewer, no real fight/panel interplay on a phone. A moment on screen when a fight or the show-off starts fades out in 0.4 s; a moment keeps running (but the gap stops) while a panel is open. Bottle is only tappable while idle (it opens a card); the other moments also while the bobber waits. Bestia only boofs at the duck (no head turn). Sprites: duck 21x11, frog 20x8 on a 20x6 pad, bottle 19x9, fish 21x9, shape 40x9 (enlarged after the first phone-size review); bubbles are white foam, the shape has a lighter rim and a slow ripple.
- Prices, tackle, bubble (slice 15a): prices in `priceFor` (`src/core/inventory.ts`) with `RARITY_PRICE_MULT`/`priceMin` in `data/shop.ts`; lines/reels in `data/tackle.ts`, combined with the rod by `effectiveBarGear` (LakeScene `syncRod` is the only reader); shop rows in `ui/bagShop.ts` (`tackleRow`); bubble state in `companions/behaviour.ts` (`pajSay`, `bubbleAlpha`, `pickLine`), drawn in `CompanionView.drawBubble`, lines in `data/pajkelLines.ts`. The clock label says `Day 3  06:40 · Dawn` (`TIME_OF_DAY_NAMES` in `core/clock.ts`; the fish log still writes the periods in lower case). Not verified: the bots say the reel helps only a little (deep fish, carbon rod: sloppy bot 85 -> 87 % with the smooth reel, good bot 8.2 -> 7.8 s with the pro reel; lines are clearer: 85 -> 93 -> 97 %), so a human may not feel a reel step; nobody has played with the new gear or felt the higher prices over a real session; the sell-coin quest targets were raised ~1.3x by estimate; the bubble was only seen as stills in headless Edge (not in motion, not while Pajkel walks, not at a real phone); the shop panel with the new rows was only checked at the headless width; a record on the very first catch of a species is "New species!", so Pajkel only speaks from the second catch on.
- Shop icons (slice 15b): art in `src/art/shopIconArt.ts` (`shopIconSprite(id)`, ids = `worms` + RODS/LINES/REELS ids; add bait/lantern ids to `BUILDERS` there), contact sheet `/dev/icon-sheet.html` (x1/x3/x6, light and dark), DOM in `src/ui/bagShop.ts` (`itemCard`, `tackleEntry`, `coinAmount`, `popIcon`) and `src/ui/spriteCanvas.ts`. Checked only in headless Edge inside a 360 px iframe, never on a phone or in motion. Weak spots: the rod icons are small, thin and mostly dark outline at 48 px (reel under the rod is a grey blob on bamboo/fiberglass); the pro reel is gold and round, so it looks a bit like the coin at small size; worms in the can are a pink checker blob; the buy pop shows on the new item in "Your tackle" (the card then shows the next upgrade) and on the worm card, and was never seen running (CSS/WAAPI, skipped for reduced motion); fish sprites in the sell list are the catch-bar icons at 1x (bream/tench look tiny); the bag-full card still says "coins" in words; the strip rows stack vertically (3 columns did not fit names at 360 px).
- Baits (slice 15c): data + effects in `src/core/data/baits.ts` (price reasoning in its comment), spawn weights in `fish.ts` (`spawnWeight`), maggot wait in `fishingSession.ts` (`firstWaitFactor`, first wait only, shallow only), inventory helpers (`chosenBait`, `baitCount`, `buyBait`, `chooseBait`, `addBait`) in `inventory.ts`, chip in `BottomBar.ts`, picker `src/ui/baitPicker.ts`. The chip took a slot in the bottom bar (buttons narrowed, Bag 98 px fits "Bag 10/10"); the top HUD worm counter still shows worms only. Seen only as stills in headless Edge in a 360 px iframe: no real tap on the chip, no real catch consuming bait, no "Out of corn, back to worms" toast, no "-1 corn" cue in motion. Maggots shorten only the first wait (nibble gaps unchanged). The effective bait (`chosenBait`) is her choice while it has any left, else worms, else the special bait she has most of (ties: data order); chip, `canCast` and `applyEvent` all use it, so she can cast with any bait. Prices (corn 30, maggots 20, strip 40 per 10) are untested guesses against slice 15a income. Quest bait part is rolled from its own seed so existing quest rolls did not shift; the quest panel reward line may wrap to 2 lines at 360 px.
- Bedtime change after the phone test (branch `fix/bedtime-midnight`): Pajkel and Bestia go to the car at 00:00 for everyone (`crossedCompanionBedtime`, `inCarWindow`), the 01:00 warning toast (no kit; `warnText` above the hint line, 5 s, waits for a calm moment, second line only when `nightKitForSale`), Alex's 02:00 fade only without the kit (`updateBedtime`; fades anyway if they are not in the car), load rules in `loadClock`, a nap ending in 00:00-05:00 leaves them in the car (bed kind turned to `night`), the shop shows the kit card always (locked until the fiberglass rod; `itemCard` `locked`). Seen only as stills. The `skipBedWindow` rule is gone.
- Car, bedtime, naps, night kit (slice 16): pure rules in `src/core/bedtime.ts` (02:00/05:00 window, crossing, `nextOccurrence`, nap options, lantern glow), `src/core/sleepFade.ts` (the fade machine), kit in `core/inventory.ts` (`buyNightKit`, `PlayerState.nightKit?`, data `core/data/nightKit.ts`), choreography in `companions/behaviour.ts` (`mode 'bed'`, phases say/call/chase/catch/carry/doorOpen/enter/doorShut/light/asleep/exitOpen/exitShut/return/stretch, unit-tested in `bedtime.test.ts`), glue in `LakeScene` (`updateBedtime`, fade, `tapCar`, `drawCar`, `drawLantern`), car art `src/art/carArt.ts` (`/dev/car-sheet.html`), carry/stretch frames in `characters.ts`, nap card `src/ui/napCard.ts`, sounds `thunk` and `sleepyBoof`. Seen only as stills (headless Edge, scene stepped by hand): never in motion at a real frame rate, no sound heard. The car likeness (white Citroen DS4, 76x46 px, side view of the front quarter) is a reading at that size: a sleek white hatchback with a slim LED headlight, not a portrait; the carried-dog frames show Bestia small and partly under Pajkel's beard. The car sits at the LEFT edge on the grass (y 500-546), clear of the hint line, bar, crate and fetch area; the fetch area is right of it. Day counter: bedtime wakes at 05:00 with `day + 1` as the spec says, so the label advances twice in a night (midnight and waking); cosmetic, one line in `morningClock`. Deviation: the nap card also opens at night (spec says daytime), whenever they are on the dock and she is idle. A kit-owner nap to "Deep night (02:00)" leaves them in the car until 05:00. If a fish is on (waiting) at the fade, the line is reeled in quietly. Bedtime waits only while a fight, bite, cast, show-off, panel or card is up; once started it runs on whatever she does. Chase uses the shared RNG (zigzag points); Pajkel gives up and scoops her after 14 s at most.
- "No take, only throw" (slice 17): state and tunables in `companions/behaviour.ts` (`PLAY_TUNING`, `STICK_TUNING`, `PLAY_AREA`; phases `throw`, `bring`, `tease`, `dodge`, `keepAway`, `giveUp`, `toStick`, `bend`, `drop`, `spin`, `rest`), tests in `companions/fetch.test.ts`, lines `GIVE_UP_LINES` / `GIVE_BACK_LINE` in `data/pajkelLines.ts`, new art: dog `bow` frame, Pajkel `bend` pose, `stickGroundSprite` (contact sheet `/dev/char-sheet.html`), drawing in `CompanionView` (`sticks` pool, depth by y). Seen only as stills (headless Edge, scene stepped by hand), never in motion at a real frame rate. The bend is only an arm reaching to the grass (the body stays upright), the play-bow is a first-pass 32x24 frame, and the chase feel (speeds, near misses, 7-11 s) is tuned by reasoning, not play-tested. Rounds are slow now (~15-25 s each, 2-3 rounds before the happy spin), so the spin comes less often than before. Old sticks are only cleared when they go back to the dock (instant, no fade); the 4th old stick makes the oldest fade over 1.5 s. A stick may land close to an old one when the grass is crowded (fallback in `pickTarget`). Sticks sit at y 508-558 so the lowest ones are just above the hint line. `?debug=afk&giveback=1` is the only way to see the give-back quickly (otherwise 1 in 6, `giveBackChance`). The dog "boofs" when she starts to trot back, when she dodges and at the spin. Bedtime/naps from play: bedtime clears the sticks and starts as before from any phase (unit-tested for every phase); naps still only start from the dock.
- Road map (slice 18): data `MAP_PLACES`/`MAP_SIZE` in `src/core/data/locations.ts`, art `src/art/mapArt.ts` (contact sheet `/dev/map-sheet.html`), panel `src/ui/mapPanel.ts`, glue `LakeScene.openMap`/`tapCar`. Seen only as stills in headless Edge inside a 360 px iframe (default view and a tap on Old quarry via script); never tapped on a phone, no real tap sound heard. The map is a first-pass picture (the quarry is a grey ellipse, the pier a plain plank, grass noise a bit speckled); the selected-pin gold ring is small, the gold label does most of the work. The map opens only from the dock with Alex idle (same as the nap card), "Take a nap..." closes it and opens the nap card. The agent's branch predated the spec commit, so it built from the brief; the sea-pier gull blurb is its own. The nap button's width changes with the selected place (the panel shifts a little).
- Size stars + fish of the day (slice 19): thresholds and pure `starFor` in `src/core/data/stars.ts` (`lengthForStar` is for the dev flag), art `src/art/starArt.ts` (contact sheet `/dev/star-sheet.html`; one 9x9 star per tier, rows of 1-3), DOM `src/ui/starRow.ts`, best star per species `bestStar`/`goldCount` in `fishLog.ts` (derived from `bestLengthCm`, no save change). Fish of the day: pure `fishOfTheDay(today, player)` in `src/core/daily/fotd.ts` (seeded from the date over ALL non-legendary species in data order; if her rod cannot reach the pick, a deterministic fallback among reachable ones, so only the carbon rod can change it mid-day), effects in `FOTD_TUNING` (`data/fotd.ts`): weight x2 via the optional `fotdId` threaded through `rollHookedFish`/`pickSpecies`/`spawnWeight` (from `SessionContext.fotdId`), price x2 in `toBagFish(hooked, fotdId)` / `addCatch`. Glue in `LakeScene` (`fotdId()`, `catchStar`, `catchFotd`, stars image and "Fish of the day! x2" line on the catch screen, gold line from `GOLD_LINES`). Seen only as stills in headless Edge inside a 360 px iframe: never in motion, no sound heard (a gold catch plays the existing fanfare), never on a phone. Not seen: a gold catch that is neither a new species nor a record (the Pajkel gold line; the dev catch always starts as new species or record), the fish-of-the-day weight in real play (only unit-tested: ~2x in a 20000-roll simulation), and the quest panel row with a long species name. Weak spots: stars in the bag/log are 2x pixel art (18 px tall) and a gold row on a fish with a long weight text wraps to a second line; the catch-screen stars sit right of the length and the whole length line is no longer centred; "Fish of the day! x2" sits above the species name and was not checked against the longest fact text (the stack lifts as one, so it should still clear her head); the price doubles at catch time, so a fish caught yesterday keeps its price (intended). The dev catch (`?debug=caught`) now notes the catch after `buildUi` because Pajkel's speech needs `companions`; before, a dev record would have crashed (it never did, because `?log=all` bests could not be beaten).
- Checklist (slice 20): data `src/core/data/checklist.ts` (6 bundles, slot kinds species/star/coins), pure rules `src/core/checklist/checklist.ts` (`giveFish` takes the cheapest fitting fish, `payCoins`, `fittingSlots`, normalising; rewards reuse `payReward`), `PlayerState.checklist?` (filled flags per bundle id, normalised, stored only when something is filled, no version bump), panel `src/ui/checklistPanel.ts`, buttons in `mapPanel.ts` and `questPanel.ts`, glue `LakeScene.openChecklist`. Seen only as stills in headless Edge in a 360 px iframe, never tapped for real, no sound heard. Weak spots: the title "Quiet Lake: The Doorstep" wraps to two lines at 360 px; the whole panel is a long scroll (6 bundles) with only a count at the top; "Give" always takes the CHEAPEST fitting fish, so a gold slot may eat a gold fish she would rather keep, with no confirmation; a fish of the day (sells x2) is not spared either; the catch-screen line "Fits the checklist!" is computed when the fish is caught (open slot and room in the bag) and sits small above the title; the all-done card text is fixed and shows only once (re-opening shows nothing special, the River bend pin says "Road fixed! Opening soon"); `MAP_PLACES` stays static, the River bend blurb is swapped in `mapPanel.ts`. Built as: the star slot kind supports `silver` (unused by the current data); `?cl=` flags live in the general flag block, not only in the checklist flag.
- Story chapters (slice 21): pure rules in `src/core/story/story.ts` (`todaysChapter`, `markSeen`, `queueLines`/`nextLine`, `normalizeStory`, Pale beat flag), data + texts in `src/core/data/story.ts` (chapter list keyed by place id, ids and line ids are saved), `PlayerState.story?` (normalised, stored only when something happened, no version bump), pictures in `src/scenes/StoryView.ts` (sealed bottle, duck + sandwich, blink, footprints), glue in `LakeScene` (`updateStory`, `beginChapter`, `completeChapter`, seal badge in `drawHud`). Sprites `storyBottle`, `sandwich`, `footprint`, `blinkOpen/Half/Shut` on `/dev/moment-sheet.html`. Seen only as stills (headless Edge at 360 px, scene stepped by hand), never in real time, no sound heard (reuses quack/boof/plop/clink). Weak spots: the sealed bottle is the same size as the random one and its glass is pale, so on daytime water mostly the red seal reads; the footprints are dark blue on the planks and read fine but hug the dock's left edge and Pajkel covers a few; the blink is a small 9 px star (27 px on a phone) and its water-stilling reuses the eerie calm (subtle); the seal badge on the notice board shows as soon as a chapter is due (before it plays), and the board itself does not open to a chapter, it is only a hint; random moments are held for the whole time a chapter is due or running, which includes a sealed bottle left unread; Q4's night version needs Pajkel asleep in the car **and** a dark sky (a daytime nap gives the bottle version); Q3's line is queued, and the bottle appears at once, when Pajkel is asleep; if a fight cuts a chapter short it retries 20 s later in the same visit; queued lines wait for idle/waiting, no panel, no open bubble. The Pale One card shows when she is back at idle after it slips away (dev: `?story=pale`).
- Name tags age per frame (~16 ms), not by real delta.
- Foreground grass is plain (user: "we can add something in the future").
- Shallow/deep water boundary is subtle at dusk; reel reads grey.
- Readability (slice 11b): font is now VT323 (`FS` = 12.5/25/25/37.5/50 px = 1/2/2/3/4 px strokes,
  `LINE` 1.2, `textPad()` nudges Phaser text up ~0.08 em). The canvas backing store is K× (1..4,
  picked once at start; rotation needs a reload for crisp text); the camera zooms by K and taps use
  `pointer.worldX/Y`. Unverified on a real phone: K on device, fill-rate/battery at 1080×1920+,
  moving sprites may now land between art pixels. Log tile hints are 12.5 px (dim, 1 px strokes);
  "★ New record!" star falls back to a system font; record screen and update toast not seen;
  name-card title is tight at 360 px. "Caught ×N" became "Caught xN" (VT323's × is tiny).
- Sound (slice 10a): all synthesised in `src/audio/` (facade `sound.ts`; pure parts in `src/core/`
  soundSettings/ambientMix/variation/callSchedule/reelClicks). User: frog "ribbit is better but not
  perfect", polish later; crickets were lowered to ~2 kHz after "too high". Birds, cast whoosh and
  slack tone are plain. Hidden-page silence and the first-tap unlock on Android were reasoned, not
  exercised. Settings are volumes 0–100 under `rybki.settings.v1` (old booleans read as 100/0).
  Opening any panel plays a tap; the dog "boofs" on petting and fetch bring/zoomies.

## Phone-test checklist (slices 15a-17, pushed 2026-11-24)

15b, 15c and 16 were merged overnight (user authorised it once) and 17 on the user's word, each
reviewed by the main session (tsc, tests, build, screenshots) but none play-tested on a phone yet.
- **15b shop icons** — item cards, icons, "Your tackle", fish sprites in the sell list. Check: rod
  icons (weakest), the buy pop (never seen running).
- **15c baits** — corn / maggots / fish strip in the shop, glow bait from box and quests, bait chip
  in the bottom bar, picker. Check: chip tap, "-1 corn" cue and "Out of corn, using ..." toast (never
  seen live), prices 30/20/40 per 10 (guesses).
- **16 car + bedtime** — DS4 at the left edge of the grass; at 02:00 Pajkel's line, Bestia runs,
  he carries her to the car; "Time for bed..." fade to 05:00 without the kit; nap card on a car tap;
  Lantern & blanket 2500 in the shop. Check: car likeness, carry walk in motion, thunk/sleepy boof by
  ear, kit-owner wake at 05:00. Main session fixed: waking kept the day counter from skipping.
  Agent deviations (in GAME_DESIGN under slice 16): the nap card opens any time she is idle, not
  only by day; a kit owner's "Deep night" nap leaves them awake until 05:00.
- **Bedtime change (2026-11-24)** — companions go to the car at 00:00, warning toast at 01:00 (no kit),
  Alex's fade at 02:00 (no kit); kit card always shown, locked before the fiberglass rod. Check: the
  warning while a fight/panel is open, a nap ending in the night (both unseen).
- **17 fetch** — try it with `?debug=afk` (`&giveback=1` forces the rare round). Weak: the bend pose, the play-bow frame, chase speeds untested.

### Next candidates (nothing decided)
- Fixes from the phone test of 15a-17 come first.
- Reels barely help in the bot sim (15a): maybe raise the reel multipliers.
- Rod shop icons are weak (15b).
- Ideas in GAME_DESIGN → Ideas: achievements + total weight per species, personal bottle notes
  from Pajkel to Alex (far future, user: leave it for now), catch-bar polish + treasure chest, character choice for friends, NPC
  tournaments (far future), aimed casting + lake features.

## How we work (user preferences — follow these)

- **The user is a software developer and wants to be in the loop.** One branch per slice
  (`slice/NN-name`). Stop after each slice for the user's play-test on the phone. Merge only
  when the user says so (`git merge --no-ff`, then delete the branch).
- **Sonnet subagents write the code; the main (Opus) session plans, grills, writes the spec and
  the slice brief, and reviews.** Spawn a `general-purpose` agent with `model: "sonnet"` and a
  self-contained brief. Then review it yourself: diff stat, `src/core` purity, tsc, tests,
  screenshots. Report to the user in plain language with weak spots stated honestly.
- **Design changes go into GAME_DESIGN.md** (the user often adds ideas "for the future" —
  record them under *Ideas* with open questions, don't build them unasked).
- Grilling format for design questions: numbered ❓ questions, each with a ➡️ recommendation.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Architecture in one breath

- `src/core/` — pure game rules, no Phaser, unit-tested (state machine `fishingSession.ts`,
  `clock.ts`, `casting.ts`, `events.ts`, `random.ts` with injectable/seeded RNG,
  `profile.ts` with injected storage). Data in `src/core/data/`.
- `src/art/` — pure pixel-art pipeline: `palette.ts`, `pixelGrid.ts` (string grids → RGBA),
  `sprites.ts`, `characters.ts`, `scenery.ts`, `dayCycle.ts` (`dayLook(minute)` keyframes),
  `layout.ts` (`distanceToY`, perspective mapping, 0 m = dock end). `textures.ts` is the only
  Phaser-touching file there (bakes textures once).
- `src/scenes/LakeScene.ts` — rendering + input only. `src/scenes/companions/` — pure
  `behaviour.ts` (companions + dog state machine) and `CompanionView.ts`.
- `src/ui/nameOverlay.ts` — DOM overlay for first-launch names (localStorage `rybki.profile.v1`).
- The core's `step()` returns `{ state, events }`; GameEvents feed the scene now and quests later.

## Deploy

Repo `github.com/BoguckiMich/somethingfishy` (remote `origin`). Every push to `main` runs
`.github/workflows/deploy.yml` (tsc, tests, build) and publishes `dist/` to
`https://boguckimich.github.io/somethingfishy/` (Pages source must be "GitHub Actions").
Push only when the user says so. URL dev flags are ignored in production (`src/urlParams.ts`).

## Running and verifying

```sh
npm run dev      # user usually has this running; LAN URL for the phone
npm test         # vitest
npx tsc --noEmit
npm run build
```

Dev URL flags (all dev-only): `?time=HH` start hour · `?debug=waiting` bobber in water at 10 m ·
`?debug=afk` companions play on the grass (add `&giveback=1` to make every round end with her giving the stick back) · `?debug=look=left|right` freeze Alex's gaze · `?reset=profile` show first-launch names · `?reset=save` wipe the saved game · `?debug=settings` open the settings (gear) panel · `?debug=sounds` open the dev sound board (a button per sound effect, solo switches for the ambient layers, a time-of-day slider for the crossfade) ·
`?kit=1` own the night kit (lantern, no 02:00 bedtime) · `?debug=bedtime` clock to 23:59:30 so the companions' midnight sequence starts at once · `?debug=warn` clock to 00:59:50 (the 01:00 warning toast, no kit) · `?debug=sleep` clock to 01:59:30 (Alex's 02:00 "Time for bed..." fade, no kit; she must have the companions in the car or it just fades) · `?debug=nap` open the nap card · `?debug=map` open the road map · `?debug=checklist` open the Quiet Lake checklist with a bag that fits a few slots and 600+ coins (`&cl=done` fills every slot but the petrol payment, `&cl=all` fills all so the road is fixed; both also work with `?debug=map`) · `?fotd=<speciesId>` force today's fish (sandboxed) · `?debug=caught&star=gold|silver|bronze|none` make the show-off fish that star (combine with `&species=` and `&log=all`/`&fotd=`) · `?debug=incar` start with Pajkel and Bestia asleep in the car (03:00 and the kit unless `?time=` is given) · `?story=Q1..Q7` make that chapter today's and start it in ~3 s (ignores the date rule, sandboxed; with `&debug=incar` for the night Q4, `&time=` to choose the hour) · `?story=pale` show the Pale One card · `?skipnames` skip the name card · `?fish=smooth|darting|sinker|floater|erratic&diff=0..1` force the fish · `?debug=fight` start in the fight at 10 m · `?debug=caught` start in the show-off (timer frozen) · `?species=<id>` force the species that bites (roach, rudd, bleak, perch, crucian, eel, bream, tench, carp, pike, zander, catfish; `?debug=fight|caught` default to perch) · `?rod=bamboo|fiberglass|carbon` pick a rod (carbon reaches deep water) · `?fish=&diff=` only overrides the bar profile, the species still decides the art and size · `?line=braided|fluoro` `?reel=smooth|pro` own that line / reel (sandboxed, never saved; the id is the best one owned, so `fluoro` implies braided) · `?debug=bubble` Pajkel says a line about 1 s after load · `?coins=N` `?worms=N` start purse (`?rod=` is also the owned rod; sandboxed, never saved) · `?debug=shop|bag|bagfull` open the shop / bag / bag-full card with a pre-filled bag · `?debug=log` open the fish log with about half the species filled (add `&species=<id>` to open that species' detail card when it is filled) · `?debug=box` open the daily bait-box card (box available) · `?date=YYYY-MM-DD` fake the device's real date for the daily box (e.g. two dates in a row for the streak; sandboxed, so it never saves) · `?debug=moment=duck|frog|jump|star|bottle|bubbles|shape` spawn that lake moment about 1 s after load, whatever the time of day (random moments are off until it has appeared; sandboxed) · `?debug=quests` open the daily-quests panel (add `&qdone=1` to mark the first quest done so the Claim button shows; `&rod=carbon&log=all` for deep/record quests) · `?bait=<id>` (corn, maggots, strip, glow) choose that bait and give 10 · `?baits=all` give 10 of every special bait · `?debug=baits` open the bait picker · `?debug=box&boxbait=glow` forces 2 glow bait into the box you take · `?log=all` mark every species caught (works with `?debug=caught` to see "New record!" or a normal catch; without it `?debug=caught` shows "New species!").

Any URL parameter except `?skipnames` / `?reset=` runs the game as a sandbox: the save is neither loaded nor written and a "DEV · not saving" tag shows, so the flags above never touch the real save.

Headless screenshots (Edge is installed, Chrome is not):

```sh
npx vite preview --port 4175 --strictPort < /dev/null      # run in background
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=360,640 \
  --virtual-time-budget=2000 --screenshot="<scratchpad>/shot.png" \
  "http://localhost:4175/?time=12&skipnames" < /dev/null
```
Headless Edge renders at ~1-2 fps (software GL), so the game barely advances in real time and `--virtual-time-budget` does not help; to see a moment in motion, drive the scene by hand over the DevTools protocol (set a device scale of 3, expose the scene on `window` temporarily, call `scene.update(0, 50)` in a loop, then `Page.captureScreenshot`).
Headless window is ~492 px wide, so the game is centred with dark side bars — expected.
Stop the server afterwards (PowerShell:
`Get-NetTCPConnection -LocalPort 4175 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).

## Gotchas

- **Private photos:** `me.png` and `wife.png` in the repo root are reference photos for the
  characters. Git-ignored (also `/reference/`). Never commit, copy, upload or describe them in
  commits. Look at them only for likeness.
- **Don't switch branches while the user's dev server runs** on the working tree — it once broke
  their running game. For spec-only edits, commit on the current branch or use a worktree.
- In Bash, add `< /dev/null` to `npx`/`node` commands; a stray stdin read hung a command once.
- Windows + Git Bash: LF→CRLF warnings on commit are harmless.
- Sonnet agents run with `isolation: "worktree"` (under `.claude/worktrees/`), so the user's dev
  server on `main` is never disturbed. Merge from the main checkout (`git merge --no-ff`, no branch
  switch), then `git worktree remove --force` + delete both the slice branch and the agent's
  `worktree-agent-*` branch. Removal fails with "Permission denied" while a shell's cwd is inside the
  worktree; leftover folders under `.claude/worktrees/` are untracked and harmless.
- PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM: edit docs with the Edit tool or Python instead.
- `gh` is not installed: deploy status is only visible on the GitHub Actions tab.
- Phaser 4.2.1, TypeScript 7, Vite 8, Vitest 5 — check `node_modules/phaser/types/phaser.d.ts`
  before using an API you're unsure exists in Phaser 4.
