# Handoff — read this first in a new session

Rybki is a cozy pixel-art fishing game (PWA, portrait) made by the developer (Pajkel) as a gift
for his wife (Alex), a Stardew Valley / Terraria fan. **All design decisions live in
[GAME_DESIGN.md](GAME_DESIGN.md)**; this file is about *state and how we work*.

_Last updated: 2026-11-23._

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
| 10 | Sound + second art pass (UI panels, fish sprites, pixel font) | next |

Full plan: GAME_DESIGN.md → *Slice plan*. Ideas not yet scheduled (aimed casting, bedtime at
2 AM + night gear/tiredness, retention quests §5) are in GAME_DESIGN.md too.

### Known weak spots (candidates for polish, not blockers)
- Catch bar (slice 5) — user wants to perfect it later: show-off fish is tiny and sits under her chin;
  bar frame reads thin/dark; shallow fights are at the short end (~4.4 s median); zone drag and a
  difficulty^6 drain boost were added beyond spec to make tuning work (`CATCH_BAR_TUNING`);
  a passive player beats ~38% of mid fish (sinkers reach the resting zone, Stardew-like, accepted).
  Rod bend/bobber jerk were not seen in motion by the reviewer.
- Fish (slice 6): show-off fish is small at her chin (bleak = a few px); tuning margins thin
  (bream/tench ~8.3 s vs 8 s floor, pike 13.7 s vs 15 s ceiling); shallow is still ~100% for a
  sloppy bot despite drain 0.13/s, user may want shallow actually losable. Per-species fish art
  is procedural placeholder (`src/art/fishArt.ts`) until slice 10.
- Shop (slice 7): real catch→bag→bag-full flow and the "−1 worm" float were not exercised end to
  end by the reviewer; worm/coin icons are tiny; the bottom bar covers the dog's lowest 40 px;
  panels only checked at desktop width; bream needed difficulty 0.66 (sinker pattern barely
  responds to difficulty — fragile).
- Fish log (slice 8): panels/catch screen only seen at 560 px wide (headless limit), not at a
  real 360 px phone; real fight→log flow, bag-full release still counting, the 8 s new-species
  show-off and the bigger clap/hop not seen in motion (unit-tested); a long fact (eel) wraps to 3
  lines on the catch screen, unchecked; silhouettes are dark placeholder icons until slice 10.
- Saving (slice 9): only unit-tested against a fake storage plus a phone copy check; Import,
  Start over and reload-mid-game not exercised by the reviewer; broken-save toast and "can't save"
  note never seen live; the 13 px gear icon is a bit blobby (art pass); after an import the sky
  catches up on its next 2-game-minute repaint; a save without a stored profile re-shows the name
  card. Copy uses `execCommand` on plain http (LAN dev), `navigator.clipboard` on https.
- Alex's head turns (left/right) are subtle by design (user found big profiles "a monstrosity"). Right head is a mirror of left. Seated Pajkel still reads as a dark blob from behind.
- AFK fetch play was only seen as a single frame in a screenshot (logic is unit-tested).
- Walking Pajkel is a thin, simple side view. The sleep "z" stroke looks like a dark box.
- Name tags age per frame (~16 ms), not by real delta.
- Foreground grass is plain (user: "we can add something in the future").
- Shallow/deep water boundary is subtle at dusk; reel reads grey.
- Text uses default monospace (pixel font planned for slice 10).

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

## Running and verifying

```sh
npm run dev      # user usually has this running; LAN URL for the phone
npm test         # vitest
npx tsc --noEmit
npm run build
```

Dev URL flags (all dev-only): `?time=HH` start hour · `?debug=waiting` bobber in water at 10 m ·
`?debug=afk` companions play on the grass · `?debug=look=left|right` freeze Alex's gaze · `?reset=profile` show first-launch names · `?reset=save` wipe the saved game · `?debug=settings` open the settings (gear) panel · `?debug=sounds` open the dev sound board (a button per sound effect, solo switches for the ambient layers, a time-of-day slider for the crossfade) ·
`?skipnames` skip the name card · `?fish=smooth|darting|sinker|floater|erratic&diff=0..1` force the fish · `?debug=fight` start in the fight at 10 m · `?debug=caught` start in the show-off (timer frozen) · `?species=<id>` force the species that bites (roach, rudd, bleak, perch, crucian, eel, bream, tench, carp, pike, zander, catfish; `?debug=fight|caught` default to perch) · `?rod=bamboo|fiberglass|carbon` pick a rod (carbon reaches deep water) · `?fish=&diff=` only overrides the bar profile, the species still decides the art and size · `?coins=N` `?worms=N` start purse (`?rod=` is also the owned rod; sandboxed, never saved) · `?debug=shop|bag|bagfull` open the shop / bag / bag-full card with a pre-filled bag · `?debug=log` open the fish log with about half the species filled (add `&species=<id>` to open that species' detail card when it is filled) · `?log=all` mark every species caught (works with `?debug=caught` to see "New record!" or a normal catch; without it `?debug=caught` shows "New species!").

Any URL parameter except `?skipnames` / `?reset=` runs the game as a sandbox: the save is neither loaded nor written and a "DEV · not saving" tag shows, so the flags above never touch the real save.

Headless screenshots (Edge is installed, Chrome is not):

```sh
npx vite preview --port 4175 --strictPort < /dev/null      # run in background
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=360,640 \
  --virtual-time-budget=2000 --screenshot="<scratchpad>/shot.png" \
  "http://localhost:4175/?time=12&skipnames" < /dev/null
```
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
