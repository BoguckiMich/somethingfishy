# Play-test harness

`scripts/playtest.mjs` lets an agent (Bash only) play the game in headless Edge as on a phone: 360x640 CSS px at 3x,
real touch events, screenshots. One Edge stays alive between commands. No npm packages (Node 24 `WebSocket`/`fetch`).

## Why stepping

Headless Edge draws ~1-2 fps (software GL), so the game never advances in real time. The dev-only hook
`src/devHarness.ts` (active only on the dev server with `?harness=1`) stops Phaser's loop and exposes
`window.__rybki = { game, scene, tick(ms), render() }`. `tick` runs `scene.sys.step` in 50 ms slices, which drives
LakeScene.update (fishing state, clock, companions, moments, travel) plus tweens and timers, then draws one frame.
`hold`/`swipe`/`tap` step game time between touch-down and touch-up, so the game measures real held time
(`state.heldMs` comes from the update deltas). **Nothing moves unless a command steps time.**

## Start

```sh
npx vite --port 4180 --strictPort < /dev/null &        # from the worktree under test (not 5173)
node scripts/playtest.mjs start "http://localhost:4180/?harness=1&skipnames&time=12"
```

Any URL param makes the game a sandbox (no save). Dev flags in HANDOFF.md work (`?coins=500`, `?debug=map`...).
Flag `--port 9333` (Edge debugging port, default 9333; also names the pid file in the OS temp dir).
Stop: `node scripts/playtest.mjs stop`, then kill the vite server
(`Get-NetTCPConnection -LocalPort 4180 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`).

## Commands (game coordinates, origin top-left)

`tap x y` · `hold x y ms` · `swipe x1 y1 x2 y2 ms` · `step ms` · `wait <kind> [maxMs]` (step until fishing kind, e.g. `bite`) ·
`fight [maxMs]` (bot for the fight, style-aware: the catch bar or, when the fight is a Line fight, the line bot) · `fight-line [maxMs] [--mode decent|hold|never] [--until warn|cut|surge|steady|red|caught]` (Line fights, below) · `state` · `text` · `click-text "<label>"` · `shot <png> [--scale 1]` ·
`eval "<js>"` · `url <url>` · `stop` · `help`. Action commands print the `state` JSON afterwards.

`state` keys: `fishing` (idle, charging, casting, waiting, bite, fighting, caught, lost, retrieving), `clock`, `coins`,
`worms`, `bag`, `bagFish`, `panel` (title of the open DOM panel or null), `toast`, `companions`, plus `heldMs`,
`distanceM`, `untilBiteMs`, `hookWindowLeftMs`, `bar {zone, fish, progress, holding}` (classic fights) or `line {distanceM, startM, tension, phase, strength, lateral, holding, redS, slackS}` (Line fights) and `fish` when relevant.

## A catch

```sh
P="node scripts/playtest.mjs"
$P hold 180 300 900        # charge ~0.9 s on the water, release = cast
$P wait bite               # steps until a bite (about 5-15 s of game time)
$P tap 180 300             # hook: the window is ~1 s of game time, so do it straight away
$P fight                   # or: hold 180 300 300 / step 200 by hand, hold while the fish is ABOVE the zone
$P tap 180 300             # dismiss the catch card; the fish goes in the bag
$P shot out.png --scale 1
```

## Line fights (slice 28)

The "feel the line" fight is a second catch style: add `&catch=line` to the url (or Settings -> Fishing -> "Catch style: Line"; `&catch=classic` forces the bar). The style is read when the fish is hooked.
Quick screenshots: `&debug=fight&species=perch&catch=line` starts in a fight at once (`&fish=darting&diff=0.6` forces the pattern and difficulty, `&rod=fiberglass` the rod).

```sh
P="node scripts/playtest.mjs --port 9347"      # (the flag can go anywhere)
$P fight-line --until warn                     # a surge is being telegraphed (splash + "!"); the thumb is up
$P shot warn.png --scale 3
$P fight-line --until cut                      # a sideways cut is telegraphed (side splash + arrow)
$P fight-line --until surge                    # the pull is on (chevrons show where it runs, the rod bends)
$P fight-line --mode hold --until red          # never let go: stops with the line in the red (needle in the red, line reddens)
$P fight-line --until steady                   # holding with the tension in the gold band
$P fight-line --mode never                     # never hold: the hook slips from slack ("It slipped the hook!")
$P fight-line --mode hold                      # never let go: "The line snapped!"
$P fight-line                                  # the decent player: hold below the middle of the gold band, let go on a surge; lands the fish
```

`fight` picks the bot by the fight's style, so the old catch recipe works for both. `fight-line` presses and releases once at the start so the thumb is in sync, then steps 50 ms at a time reading only what a
player sees (tension, whether a surge is showing). With `--until` it stops without lifting the thumb, so a following `shot` shows that moment. Sandbox: the Settings choice is not kept across reloads in the dev sandbox; the flag always wins.

## Where things are (game px)

| Thing | Tap at | Notes |
|---|---|---|
| Water / cast | (180, 300) | hold to charge, release to cast; longer hold = farther |
| Dock | x 116-244, y 358-470 | Alex sits at the end, ~ (207, 360) |
| Bottom bar, y 618 | Bag (53), Shop (132), Log (211), bait chip (291), gear/settings (339) | only while idle |
| Notice-board button (top right) | (338, 26) | same panel as the sign |
| Sign | (276, 472) | hit box x 248-304, y 444-500; a quick tap opens the Notice board, a hold casts |
| Car | (42, 523) | hit box x 0-84, y 494-552; opens the map |
| Bestia (dog) | (178, 418) | box ~ x 156-200, y 396-440; she wanders: `eval "__rybki.scene.companions.dogRect()"` |
| Pajkel | (150, 388) | box ~ x 130-170, y 364-412; moves too (`pajRect()`) |
| Crate (bait box) | (214, 446) | only when visible |
| Trophy board | (58, 470) | only once there is a trophy |
| Panel close | `click-text "X"` | tapping outside the card also closes it |

## Limits

- Dev server only. A production build has no hook and ignores URL params.
- Edge's emulation (3x, touch) is re-applied by every command connection; if a shot ever looks unscaled, run `url` again.
- `click-text` matches the smallest visible DOM element whose text equals (then contains) the label; Phaser-drawn UI (bottom bar, catch bar) is not DOM, use `tap`.
- `toast` is read from the scene text and can lag a moment behind what is on screen.
- `fight` is a simple bot (hold while the fish is above the zone centre; for Line fights the decent line bot); tough fish may still escape.
- Audio is muted; wall-clock timers in the game (story delay, date refresh) only advance by stepping, not by waiting.
- One game per Edge; use `--port` for a second one.
