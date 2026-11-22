# Handoff — read this first in a new session

Rybki is a cozy pixel-art fishing game (PWA, portrait) made by the developer (Pajkel) as a gift
for his wife (Alex), a Stardew Valley / Terraria fan. **All design decisions live in
[GAME_DESIGN.md](GAME_DESIGN.md)**; this file is about *state and how we work*.

_Last updated: 2026-11-22._

## Current state

| Slice | What | Status |
|---|---|---|
| 1 | Lake scene, hold-to-charge casting, bobber, distance zones | merged |
| 2 | Game clock, day/night, bites (nibbles, 1 s hook window), GameEvents | merged |
| 3 | Art pass: hand-authored pixel art, day/night palettes, rod animations | merged |
| 4 | Characters: Alex + Pajkel + Bestia (dog), AFK play, petting, name entry | merged |
| 4b | Standing Alex: slimmer, clearer hair, glances around (GAME_DESIGN §2b) | merged |
| 5 | Catch bar fight + show-off pose (all details decided, GAME_DESIGN §3) | next |

Full plan: GAME_DESIGN.md → *Slice plan*. Ideas not yet scheduled (aimed casting, bedtime at
2 AM + night gear/tiredness, retention quests §5) are in GAME_DESIGN.md too.

### Known weak spots (candidates for polish, not blockers)
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
`?debug=afk` companions play on the grass · `?debug=look=left|right` freeze Alex's gaze · `?reset=profile` show first-launch names ·
`?skipnames` skip the name card.

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
