# Handoff — read this first in a new session

Something Fishy (working title Rybki, still used in code) is a cozy pixel-art fishing game (PWA, portrait) made by the developer (Pajkel) as a gift
for his wife (Alex), a Stardew Valley / Terraria fan. **All design decisions live in
[GAME_DESIGN.md](GAME_DESIGN.md)**; this file is about *state and how we work*.

_Last updated: 2026-11-23 (slice 14 lake moments + bigger catch-bar fish merged, not pushed; user will phone-test and may want fixes)._

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

Full plan: GAME_DESIGN.md → *Slice plan*. Ideas not yet scheduled (aimed casting, bedtime at
2 AM + night gear/tiredness, retention quests §5) are in GAME_DESIGN.md too.

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
`?debug=afk` companions play on the grass · `?debug=look=left|right` freeze Alex's gaze · `?reset=profile` show first-launch names · `?reset=save` wipe the saved game · `?debug=settings` open the settings (gear) panel · `?debug=sounds` open the dev sound board (a button per sound effect, solo switches for the ambient layers, a time-of-day slider for the crossfade) ·
`?skipnames` skip the name card · `?fish=smooth|darting|sinker|floater|erratic&diff=0..1` force the fish · `?debug=fight` start in the fight at 10 m · `?debug=caught` start in the show-off (timer frozen) · `?species=<id>` force the species that bites (roach, rudd, bleak, perch, crucian, eel, bream, tench, carp, pike, zander, catfish; `?debug=fight|caught` default to perch) · `?rod=bamboo|fiberglass|carbon` pick a rod (carbon reaches deep water) · `?fish=&diff=` only overrides the bar profile, the species still decides the art and size · `?coins=N` `?worms=N` start purse (`?rod=` is also the owned rod; sandboxed, never saved) · `?debug=shop|bag|bagfull` open the shop / bag / bag-full card with a pre-filled bag · `?debug=log` open the fish log with about half the species filled (add `&species=<id>` to open that species' detail card when it is filled) · `?debug=box` open the daily bait-box card (box available) · `?date=YYYY-MM-DD` fake the device's real date for the daily box (e.g. two dates in a row for the streak; sandboxed, so it never saves) · `?debug=moment=duck|frog|jump|star|bottle|bubbles|shape` spawn that lake moment about 1 s after load, whatever the time of day (random moments are off until it has appeared; sandboxed) · `?debug=quests` open the daily-quests panel (add `&qdone=1` to mark the first quest done so the Claim button shows; `&rod=carbon&log=all` for deep/record quests) · `?log=all` mark every species caught (works with `?debug=caught` to see "New record!" or a normal catch; without it `?debug=caught` shows "New species!").

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
- Phaser 4.2.1, TypeScript 7, Vite 8, Vitest 5 — check `node_modules/phaser/types/phaser.d.ts`
  before using an API you're unsure exists in Phaser 4.
