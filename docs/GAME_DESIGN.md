# Something Fishy (Rybki) — Game Design

A cozy, fishing-only game in the spirit of Stardew Valley / Terraria. Made as a gift.
Title: **Something Fishy** (working title was Rybki, still used in code and storage keys).

This doc records decisions. When a decision changes, update it here.

---

## 1. Platform & tech

| Decision | Choice |
|---|---|
| Delivery | Web game as a PWA (installable to phone home screen), playable in desktop browser |
| Engine | Phaser 4 + TypeScript, bundled with Vite |
| Tests | Vitest, for pure game logic |
| PWA | `vite-plugin-pwa` (added in the deploy slice) |
| Hosting | GitHub Pages: `BoguckiMich/somethingfishy`, deployed by GitHub Actions (§3 item 10) |
| Orientation | Portrait for now (base resolution 360×640, scaled to fit) |
| Language | English first; text kept in one place so translations (e.g. Polish) are easy to add |
| Saving | Local (localStorage) + export/import save code. Cloud sync later, maybe. |

### Architecture rule

`src/core/` is **pure TypeScript with no Phaser imports**: fish data, spawn rules, economy,
catch-bar physics, clock, state machines. It is unit-tested.

`src/scenes/` is the Phaser layer: rendering, input, animation, sound. It reads core state
and sends events to it. It contains no game rules.

Why: the long-term direction is a Stardew-like walkable world. With rules separated from
rendering, the portrait lake screen becomes one scene of a bigger world instead of a rewrite.

**Location is a first-class concept** in the data model from day one, even with one lake.

---

## 2. Look & feel

- Pixel art with real detail (Stardew-like) at 360×640. Sprites are **hand-authored in code** as
  palette grids (`src/art/`), turned into textures at startup: no downloads, no licences, version-
  controlled. Pack art or custom art can replace individual sprites later.
- Cozy: no energy, no stress. Losing a fish costs only the bait.
- Accelerated day/night clock: ~20 real minutes = one in-game day; paused when the game is closed.
- Ambient sound (water, birds, crickets at night) + SFX in v1. Music later.
- Haptics (`navigator.vibrate`) on bites and key moments where supported.

---

## 2b. Characters (personal touches)

The game stars the two of them and their dog. Reference photos live untracked in the repo root
(`me.png`, `wife.png`, git-ignored) — never commit them.

- **Alex** (default name) — the player character. Shoulder-length light-brown hair with bangs,
  smartwatch, black capri pants. Default top: black metal-band t-shirt with a jagged white logo
  (a nod to her favourite band, Trivium — inspired by, not a copy of, their logo). Alternate outfit
  later: black hoodie with a blue dinosaur patch (cosmetic unlock).
- **Pajkel** (default name) — companion. Messy dirty-blonde hair, long full brown beard, dark
  sunglasses, black t-shirt, broad build. Sits next to Alex on the dock, reacts to her catches.
- **Bestia** (default name), the dog — small, ginger, short-haired, folded ears, yellow harness. Lies on the dock; ears
  perk on a nibble, jumps up on a bite, happy spin when hooked, sleeps at night. Tap to pet (heart).
- **Idle / AFK** — after a while without input, Pajkel and the dog get up and play on the grass
  (fetch, running around); they come back when she starts fishing again.
- **View** — ¾ back view on the dock, so profiles show (beard, sunglasses, bangs).
  A front-facing "show off the catch" pose comes with the catch bar.
- **Alex's stance** (slice 4b) — she **stands** at the dock edge in every phase, mostly back to
  the camera, facing the lake; Pajkel stays seated beside her, Bestia lies nearby. Slim build
  (she is very slim in real life). Hair must read clearly against the planks (lighter tones,
  strands, visible bangs). During idle/waiting she occasionally glances left (toward Pajkel and
  the dog) or right (along the shore) for ~1–2 s every 6–15 s at random; a nibble snaps her
  head back to the bobber; no glances during the fight.
- **Names** — editable on first launch, stored on the device only. Defaults live in code; nothing
  more personal than the defaults is in the public repo.

---

## 3. v1 gameplay loop

1. **Cast** — hold to charge a power meter, release to cast. Distance decides the zone:
   *shallow* (near shore) or *deep* (far). The starter rod only reaches shallow water.
   *Future:* dragging the thumb left/right while charging aims the cast (see Ideas below).
   **Fix (tester input, 2026-11-24):** a hold shorter than `MIN_HOLD_MS` (180 ms, `core/casting.ts`) casts nothing and spends no
   bait (the line "Hold to charge, release to cast" shows); a `cancel` input (touch taken away by the browser, or a finger leaving
   the canvas on a phone) ends a charge with no cast, and the context menu is off. Shore objects (sign, car, crate, Pajkel's empty
   chair) work as **tap = open, hold = cast** (`core/tapHold.ts`). The empty chair swallows taps. Toasts said during the fight wait
   (`core/toastQueue.ts`) and the zone label hides, so nothing covers the bar. A second notice-board button sits top right (44x44,
   gold badge when a quest can be claimed, red seal when a chapter waits) and the car shows a bobbing map pin plus a one-off hint
   until it is tapped once.
2. **Wait / bite** — the bobber gives a few small *nibbles* (fake-outs), then a big dip with
   a "!" and a ~1 s window to tap. Tapping on a nibble scares the fish away. Shy species nibble more.
3. **Fight** — Stardew-style vertical catch bar:
   - Hold to raise the catch zone, release and it falls (gravity).
   - Progress fills while the fish is inside the zone, drains while outside. Full = caught, empty = lost.
   - Each species has a movement pattern (smooth, darting, sinker, floater, erratic) + difficulty.
   - **Gear modifies the bar:** rod → zone size; reel → zone responsiveness/weight;
     line → progress drain rate; bait/lure → calms fish / shrinks its movements.
   - **Details (decided for slice 5):**
     - *Layout:* the bar is on the right side of the portrait screen, ~55% of the screen height.
       The lake stays visible and isn't dimmed.
     - *Look:* pixel-art wooden frame, translucent green zone band, a small fish icon, and a
       progress strip that goes red → yellow → green. Slightly dimmed at night.
     - *Input:* hold anywhere on the screen.
     - *Progress:* starts at 30%. No extra grace period. Drains whenever the fish is outside the zone.
     - *Difficulty:* with starter gear, shallow fish are *forgiving* (revised after play-testing:
       "nearly impossible to lose" was too easy). A sloppy player still lands ≥85%. The real
       difficulty starts in deep water. Base drain ~0.13/s vs fill 0.16/s.
     - *Target fight length:* shallow ~4–8 s, deep ~8–15 s, legendary 20 s or more.
     - *Loss:* "it got away…", the line goes slack, then reel in. A `fishLost` event is emitted;
       losing the bait hooks onto that event in slice 7.
     - *Placeholder fish until slice 6:* all 5 patterns plus a difficulty setting live in core,
       picked by zone. Dev flag `?fish=<pattern>&diff=<0..1>` forces one.
     - *Gear:* a `gear` input to the bar, hardwired to starter values until slice 7.
     - *Fight feedback:* the rod bends more while holding, the line is taut, and the bobber jerks
       with the fish.
     - *Catch:* front-facing "show off the catch" pose with a placeholder fish and "Caught!";
       a tap (after 0.4 s) or 4 s dismisses it. Pajkel claps and Bestia hops on a catch; small reactions on a loss.
     - *Vibration:* short buzz on hook and on catch, where the browser supports it.
     - *Not in v1:* treasure chests, line snap, tension.
4. **Result** — each catch rolls a size/weight. The fish log keeps personal bests per species
   (a star when a record is beaten).
   - **Details (decided for slice 8):**
     - *What counts:* every won fight, on `fishCaught`, before the bag decision (so a fish released
       at bag-full or sold later still counts). Lost fights, nibbles and missed bites don't.
     - *Record:* the longest fish per species, shown as "54 cm · 1.9 kg" (weight follows length,
       so longest = heaviest). Only strictly longer beats it; a tie doesn't.
     - *Log panel:* DOM wood panel like Bag/Shop, opened from the bottom-bar "Log" button, only
       while idle. Header "7/12 species". A 3×4 grid of tiles in roster order (shallow, then deep).
       Caught: fish art + name. Not caught: dark silhouette, "???" and a where/when hint
       (e.g. "Deep water · night"). Tapping a caught tile opens a detail card: art, name, record,
       "Caught ×N", the fun fact, where/when it bites. The legendary tile joins in slice 12 (/13).
     - *Catch screen:* first of a species → **"New species!"** (no star; a first catch is
       trivially a record) plus the species' fun fact; that screen stays up longer (tap after
       0.4 s, auto-dismiss ~8 s). Beating the best → **"★ New record!"** with "was 41 cm".
       Ordinary catches unchanged. Pajkel and Bestia react a bit bigger on both moments.
     - *Facts:* v1 shows the fact on the first catch and in the log. Rotating facts (and maybe a
       fact on every catch) wait for the polish pass.
     - *Data:* `PlayerState.log` inside the single serialisable player object; saved from slice 9.
       Dev flags `?debug=log` (log open, ~half the species filled) and `?log=all`.
5. **Bag & shop** — caught fish go into a 10-slot bag. Shop: sell fish (sell all / keep),
   buy worms, buy 2 rod upgrades (each: more cast distance + bigger catch zone).
   - **Details (decided for slice 7):**
     - *Start:* 10 worms, 0 coins.
     - *Worms:* a caught fish always uses the worm; a fish lost in the fight uses it 50% of the
       time; a nibble scare or missed bite never costs one. A small "−1 worm" cue shows when one is
       used.
     - *Out of worms:* casting is blocked ("Out of worms, visit the shop"). Soft-lock guard: with
       0 worms, too few coins for a pack and an empty bag, the shop gives 5 free worms.
     - *Worm price:* a pack of 10 for 10 coins.
     - *Sell price:* `basePrice × (0.5 + size position in the species range)`, so 0.5×–1.5×;
       fixed at catch time and shown in the bag.
     - *Bag full (10/10):* the catch is still shown off, then a choice: "Release" or
       "Swap for your cheapest" (named). The bag counter turns amber at 10/10.
     - *Rods:* Fiberglass 250 coins (26 m, reaches deep, zone 0.34), Carbon 1200 coins (40 m,
       zone 0.38); bought in order, equipped at once. Starter Bamboo: 14 m, zone 0.30.
     - *Tuning:* deep fights hit 8–15 s with **fiberglass**; carbon makes them a bit easier.
     - *Screens:* a bottom bar with Bag (count, e.g. 7/10), Shop and Log (greyed out until
       slice 8). Panels are DOM overlays styled as pixel-art wood, like the name card. The hint
       sits just above the bar; coins and worms show next to the clock.
     - *When:* panels open only while idle; the clock and companions keep running.
     - *Shop:* Sell (tap a fish or "Sell all"; keeping = not selling), Worms (10-pack),
       Rods (the next upgrade). No lock/favourite yet.
     - *Dev flags:* `?coins=N`, `?worms=N`;
       `?rod=` also counts as the owned rod.
6. **Screens** — the lake is always the main screen; Bag / Shop / Fish log open as overlay panels
   from a bottom bar.
7. **Which fish bites** — v1: time of day + depth zone. (Bait type in v2; weather/seasons later.)
8. **Saving** — local autosave + an export code to move a game between devices.
   - **Details (decided for slice 9):**
     - *What:* `{ version, player, clock }` under localStorage `rybki.save.v1`: the whole
       `PlayerState` (coins, worms, bag, rod, log) and the clock (day + minute; she comes back at
       the same time of day). Names stay under `rybki.profile.v1` but travel in the export code.
       Not saved: the fishing session, companions, RNG.
     - *When:* right after every `PlayerState` change (catch logged, worm used, bag, sell, buy,
       free worms), the clock every ~10 s of play, and on `visibilitychange→hidden` / `pagehide`.
       Silent, no "Saving…" indicator.
     - *Reload mid-action:* always resumes idle with the line reeled in. A fight in progress just
       vanishes (no worm cost); a catch waiting on the bag-full choice counts as released (it is
       already in the log).
     - *Versions:* `version: 1`; core has a chain of `migrate[n]` (vN → vN+1), empty for now.
       Loading normalises: coins/worms integers ≥ 0, unknown rod → bamboo, unknown species dropped
       from bag and log, bag capped at 10, clock clamped. Unreadable JSON or a newer version than
       the code → raw text copied to `rybki.save.broken`, then a fresh game (never silently lost).
     - *Export code:* `RYBKI1-` + base64url of the JSON `{ save, profile }` + a short checksum, so a
       truncated paste says "That code looks incomplete". No compression, no encryption (~1–2 KB).
       Imports go through the same migrate + normalise path.
     - *UI:* a square ⚙ button (pixel-art gear) at the end of the bottom bar opens a wood panel
       (idle only, like the others): **Export** (read-only code + Copy, text pre-selected as
       fallback), **Import** (paste box + Load, then "This replaces your current game (7/12
       species, 340 coins). Continue?"), **Change names** (reopens the name card), **Start over**.
     - *Safety:* import and start over first copy the current save to `rybki.save.backup` (no UI;
       a devtools rescue). Start over has a two-step confirm, keeps the names, resets everything
       else incl. the clock (Day 1, 06:00).
     - *Dev flags:* any URL parameter except `?skipnames` = sandbox: the save is neither loaded nor
       written, and a small "DEV · not saving" tag shows. `?reset=save` wipes the save.
     - *Storage trouble:* `navigator.storage.persist()` on start. If writing fails the game keeps
       working and the ⚙ panel says "Can't save on this device; use Export to keep your
       progress." No other nag. (She plays on Android.)
9. **Sound & second art pass** — decided for slice 10, split into 10a (sound) and 10b (art).
   - **10a Sound:**
     - *Source:* all sound is synthesised in code with Web Audio: no files, no licences, works
       offline. A single sound that disappoints can be swapped for a CC0 file later.
     - *SFX:* cast whoosh (pitch follows the charge), bobber plop, soft nibble tick, bite "!"
       alert, hook strike, reel clicks while reeling in the fight, line slack (fish lost), short
       catch jingle, longer jingle for "New species!" / "New record!", coin clink (sell/buy),
       soft UI tap (buttons, panel open/close), dog "boof" (petting, AFK fetch). No footsteps.
       Every SFX gets ~±5% random pitch/volume so repeats don't sound robotic.
     - *Ambient:* water lapping always; birds by day, frogs at dusk, crickets at night, crossfaded
       on the game clock like `dayLook`. Birds/frogs are randomly spaced calls, not a fixed loop.
       Quiet under the SFX, no ducking during a fight.
     - *Settings:* two volume sliders in the ⚙ panel, **Sounds** and **Ambience** (0–100 %, steps
       of 5, 0 = "Off", default 100, squared gain curve), changed from on/off toggles after the
       play-test. Stored under their own key `rybki.settings.v1` (device preference; old boolean
       values read as 100 / 0): not in `SaveData`, not in the export code.
     - *Play-test tuning:* crickets lowered from ~4 kHz to ~2 kHz (too high); frogs remade as a
       raspy two-syllable "rib-bit" pulse train (the first version was a "boing").
     - *Playback:* audio unlocks on the first tap; everything is silent while the page is hidden.
     - *Dev:* `?debug=sounds` opens a sound board (a button per SFX and ambient layer + a time
       slider for the ambient crossfade). Sandboxed like the other flags.
   - **10b Art pass:**
     - *Font:* a bundled OFL pixel font (self-hosted woff2, Latin Extended for Polish names),
       replacing `monospace` everywhere (Phaser text and DOM), sizes snapped to its pixel grid.
       Chosen by eye from sample screens of Pixelify Sans, Silkscreen and VT323: first Pixelify Sans,
       then switched to **Tiny5** because Pixelify's "5" reads as S/8 and "B" as G ("15 coins" looked
       like "18"). Tiny5 has one weight (no bold anywhere; emphasis by colour/size). Sizes: 15 px for
       all real text (off-grid but clean on phones), 20 headings, 30 title, 10 only for log-tile hints
       and the dev tag.
     - *Fish:* one hand-authored grid per species (12) at its large size, realistic enough that a
       Polish angler recognises it; medium/small via a code shrink, hand-touched if mushy. Feeds
       the bar icon, catch screen, show-off and log; log silhouettes are the sprite in flat
       shadow. A contact sheet of all 12 is approved before wiring.
     - *Panels:* all DOM panels and the canvas bottom bar get a pixel frame drawn in code
       (canvas 9-slice as `border-image`, stepped corners, subtle wood grain, 2 px bevel buttons).
     - *Polish folded in:* show-off fish bigger and held at her chest; catch bar frame thicker and
       lighter; gear, worm and coin icons redrawn at a proper size; the sleep "z" redrawn;
       Pajkel: readable seated back view (lighter jacket/hair, separate shoulders, visible rod
       arm), fuller walking side view with a 2–3 frame walk, and **no glasses** in any view.
     - *Dog fetch (from the 10a play-test):* the "bringing the stick back" graphics need polish,
       and the zoomies running in circles look weird. Decided: **zoomies are dropped**; after the
       last fetch the dog does a happy in-place spin and tail wag, then rests. The bring-back
       graphics get polished (stick clearly in the mouth, proud trot).

10. **PWA + deploy** — decided for slice 11 (2026-11-23).
    - *Name:* the game is now **Something Fishy** (manifest `name`; `short_name` "Fishy" so the
      Android home-screen label isn't cut off). User-visible text and `<title>` say Something Fishy.
      Code, storage keys (`rybki.*`) and the save-code format keep "rybki" so existing saves
      still load.
    - *Repo + hosting:* `github.com/BoguckiMich/somethingfishy` (public), served by GitHub Pages
      at `/somethingfishy/`. Vite `base: './'`, manifest `scope`/`start_url` relative.
    - *Deploy:* GitHub Actions workflow on push to `main`: install, tsc, tests, build, deploy to
      Pages. A failing test means nothing goes live. The user sets Pages source to "GitHub Actions".
    - *Offline:* `vite-plugin-pwa` (Workbox `generateSW`) precaches the whole build (JS, HTML,
      fonts, `OFL.txt`, icons). Art and sound are code, so the game is fully offline after the
      first visit. `dev/*.html` sheets are not in the build.
    - *Updates:* `registerType: 'prompt'`. The app checks for an update at launch (and when it
      comes back to the foreground); when one is waiting, a small pixel-framed toast says
      "New version — tap to reload". It never reloads on its own (no fight gets cut off).
    - *Manifest:* portrait, `display: standalone`, theme and background `#1b2b3a`.
      Icon: a pixel-art fish on the night-lake blue, drawn in code like everything else, rendered
      by a script to committed PNGs (192, 512, maskable 512, 180 apple-touch-icon).
    - *Install:* no in-game install button; target phone is Android, where Chrome offers install
      on its own.
    - *Moving a save:* the LAN dev save does not carry over (different origin); use the slice 9
      export/import code. No new code.
    - *Dev flags:* the URL flags (`?debug=`, `?coins=`, `?time=`…) were live in production builds.
      In a production build all URL parameters are ignored (no sandbox, no flags); they keep
      working on the dev server.

### v1 fish roster (decided for slice 6)

| Fish | Zone | Time | Rarity | Pattern | Difficulty | Length | Nibbles |
|---|---|---|---|---|---|---|---|
| Roach | shallow | day | common | smooth | 0.10 | 12–30 cm | 0–1 |
| Rudd | shallow | day | common | floater | 0.15 | 12–30 cm | 0–3 |
| Bleak | shallow | day | common | darting | 0.20 | 8–18 cm | 0–1 |
| Perch | shallow | day | uncommon | darting | 0.25 | 10–35 cm | 2–4 |
| Crucian carp | shallow | any | common | sinker | 0.12 | 10–30 cm | 0–3 |
| Eel | shallow | night | uncommon | erratic | 0.30 | 40–100 cm | 0–3 |
| Bream | deep | any | common | sinker | 0.66 | 25–60 cm | 2–4 |
| Tench | deep | dawn/dusk | uncommon | smooth | 0.55 | 25–55 cm | 2–4 |
| Carp | deep | any | uncommon | smooth | 0.70 | 35–90 cm | 2–4 |
| Pike | deep | day | uncommon | darting | 0.75 | 40–110 cm | 0–1 |
| Zander | deep | dusk/night | uncommon | erratic | 0.70 | 35–80 cm | 0–3 |
| Catfish | deep | night | rare | sinker | 0.85 | 60–180 cm | 0–3 |
| *The Pale One* (legendary) | deep ≥30 m | 02:00–04:00 | 25% in window | abyssal (new) | ~0.95 | 150–220 cm | 0–1 |

**Slice 6 details (decided):**
- *Data* in `src/core/data/fish.ts`; tunable. Each species also has `basePrice` (used from slice 7)
  and one short real `fact` (displayed later, see Ideas).
- *Spawn:* candidates = species matching the bobber's zone and the current time of day
  (dawn/day/dusk/night); weighted pick common 60 / uncommon 30 / rare 10. Every zone has an
  "any time" species, so there is always a candidate. Bait joins the rules in v2.
- *When:* the species is picked when the bobber lands, so it shapes the wait (nibble range per
  species; shy fish nibble more). The hook window stays 1 s for everyone in v1.
- *Size:* length rolled in the species range, skewed so most are small/medium and the top ~10% is
  rare. Weight = a·L³ with a per-species body-shape factor (eel light, bream heavy). Metric units.
- *Size → fight:* up to +0.10 difficulty at the top of the size range; shallow fish capped at 0.3.
- *Catch screen:* show-off pose with species name and "24 cm · 210 g". `fishCaught` carries
  `speciesId`, `lengthCm`, `weightG`. "New species!" and record stars wait for the fish log (slice 8).
- *Art:* recoloured placeholder fish per species in 2–3 sizes by length (also the bar icon);
  real fish sprites in slice 10.
- *Where it goes:* catch and release until the bag (slice 7).
- *Dev flags:* `?species=<id>` forces a species; `?rod=<id>` picks a rod (deep water for testing);
  `?fish=<pattern>&diff=` stays for raw bar tuning.

**Legendaries** are brutally hard and gear-dependent. Caught once for the log; afterwards
rematches are possible for personal-best size records.

**Slice 12: The Pale One (decided 2026-11-23)** — the first, quiet eldritch hint (see Ideas → Eldritch thread).
- *Look:* huge, pale, very old fish that is slightly *wrong*: one eye too many, scales like old coins.
  Its name shows as "???" in the log until the first catch.
- *Where/when:* only when the bobber lands at **≥ 30 m** (in practice only the carbon rod) and the
  clock is **02:00–04:00** (~100 real s per in-game day). Then a **25 %** chance per landed cast that
  it replaces the normal spawn pick. Outside that, it never appears.
- *The window shows itself:* while it's 02:00–04:00 the lake goes still (ripples/sparkles calm), the water
  gets a slight green tint and the crickets go quiet — even with no bite. That's the hint that
  something is down there.
- *Log:* a 13th tile, "???", hint text *"Deep, far water. When the clock shows 3."*; once caught,
  the tile gets a special gold frame.
- *Fight:* new bar pattern **abyssal**: long calm drifts broken by sudden hard dives; difficulty ~0.95;
  progress fills slowly so a fight lasts **≥ 20 s**. Losing costs only the worm, like any fish; she can
  retry the same night.
- *During the fight:* stronger green tint over the lake, all ambient fades out, a low synthesised drone
  fades in. All of it clears on catch or loss.
- *Catch:* too big for the chest pose: Alex hugs its head end, the tail drags down onto the dock;
  longer show-off. Fact: *"No one has caught it twice. No one remembers why."*
- *Afterwards:* it always slips away — "it slips back into the dark water…". No bag slot, no coins
  (a trophy, not loot). Rematches only count for size records (log best size, "★ New record!").
- *Dev flags:* `?species=legendary` (id `pale`; both accepted), `?debug=fight&species=pale`,
  `?debug=caught&species=pale`, `?time=3`.

Tuning (prices, spawn weights, difficulty) lives in data files under `src/core/data/` so it can
be tweaked without touching logic.

**Slice 13: daily bait box + daily quests (decided 2026-11-23)** — split into 13a (box) and 13b
(quests); each gets its own play-test.

*Shared (built in 13a):*
- The day is the **real local date** of the device (`YYYY-MM-DD`), not the game clock. Changes at
  local midnight.
- Clock-change guard: the save keeps the last date a box was opened. A box opens only when today is
  *later* than that date; setting the clock back never grants twice. Setting it forward does grant
  (harmless).
- Stored inside the save (`PlayerState.daily`, optional, normalised to defaults when missing; no
  save version bump).
- Pure logic in `src/core/daily/`, tunables in `src/core/data/daily.ts`. The real date is injected
  (`today: string`), never read inside core.
- Dev flag `?date=YYYY-MM-DD` fakes the real date (sandbox, like every flag).

*13a Daily bait box:*
- Whenever today's box is unopened, a small wooden **crate sprite sits on the dock**. Tapping it
  while idle opens a wood card: "The bait shop left a package on the dock", the contents, the
  streak, and an "Open"/"Take it" button. Taking it adds the contents to the purse and the crate
  disappears until tomorrow. The very first box is available on the first day.
- Bestia sniffs at the crate now and then while it is unopened (small touch, can be cut).
- Contents (only worms and coins until v2): always worms (5–10), usually coins (15–40), and a ~5%
  **lucky box** with ~3× everything and a sparkle.
- **Streak:** 5 tiers. Each consecutive day moves up one tier (max 5); higher tiers fill the box
  more (×1 at tier 1 up to ×2 at tier 5). A missed day (or more) drops **one** tier, never to zero.
  The card shows "Day-in-a-row: N" with 5 pips.
- Dev flag `?debug=box` opens the card.

*13b Daily quests:*
- **3 quests a day**, rolled from a pool with a seed made from the date. Kinds: catch N of a species ·
  catch N fish of any kind · catch a fish at dawn / dusk / night (game clock) · catch something in
  deep water · sell N coins' worth of fish · beat a personal best.
- Only quests she can do with her current gear: no deep-water quests (or deep species) with the
  bamboo rod. Targets sized so all 3 take ~20–40 min of play (one game day = 20 real min, so every
  time of day comes round).
- Progress comes from game events (`fishCaught`, a sale event, records).
- **Rewards:** coins + worms per quest. On completion: a small "Quest done!" toast and a "!" badge.
  She taps **Claim** in the quest panel. Done-but-unclaimed rewards are paid automatically at the
  next day change, so nothing earned is ever lost. No all-3 bonus for now.
- **UI:** a small notice-board button at the top right, beside the pencil, carrying the "!" badge;
  it opens a wood panel with the 3 quests, progress bars and Claim buttons.
- **One free reroll per day** for one unfinished quest; it swaps in a quest of a different kind.
- The Pale One never appears in quests.
- Dev flag `?debug=quests` opens the panel.

**Slice 14: lake moments (decided 2026-11-23)** — small random ambient scenes on the lake. Art,
timing and taps only; no log and no quests tied to them.

- **Moments** (game-clock windows):
  - *duck* paddles across the far water (06–19). Bestia boofs at it once.
  - *frog* on a lily pad, sits a while (18–23).
  - *fish jump*: a fish leaps and leaves a ring of ripples (any time).
  - *shooting star* streaks across the night sky (21–04).
  - *bottle* drifts to the dock and bobs there until tapped, or drifts off after ~60 s (any time).
  - *uncanny*, only 01–05, rare (about 1 night in 3): *bubbles* rising where nobody cast; a dark
    *shape* under the water. The crickets dip while one is on screen.
- **Timing:** on average one moment every ~3 real minutes (random 90–270 s gap), one at a time. The
  gap only counts down while she is idle or the bobber waits: never during a fight, the show-off,
  an open panel or card, or the Pale One's fight.
- **Taps** (tap areas ≥ 40 px; a tap on a moment never casts):
  - duck quacks and paddles off faster
  - frog plops into the water
  - fish jump: no tap
  - shooting star: "Make a wish!" float, a sparkle and 5–15 coins
  - bottle: opens a wood note card; ~1 in 4 also has 2–5 worms inside
  - bubbles stop / the shape sinks, with a quiet "…" float; no reward
- **Bottle notes:** a pool of short notes (lake lore and whimsy, plus 2 eerie ones that only come at
  night 22–05). Shuffled, no repeats until every note was read (`PlayerState.notes`, optional,
  normalised when missing; no save version bump). Personal notes from Pajkel to Alex: later.
- **Sound:** a small synthesised effect each (quack, plop, sparkle, glass clink, bubbles).
- Pure rules in `src/core/moments/`, tunables + note texts in `src/core/data/moments.ts`.
- Dev flag `?debug=moment=<name>` spawns that moment right away.

**Playtester feedback (2026-11-23, a friend, 4 days of play).** He had the carbon rod and every
species in 4 days. Loved: Bestia hopping on a bite, fetch, the Pale One. Asked for: Pajkel praising
a record, the time of day next to the clock, total weight per species in the log (deferred to an
achievements system), a way to skip hours while waiting for a time of day (→ naps in the car), and
"tap to update" did nothing (→ fix below). Takeaway: coins need more to buy, and new items should
not be cheap. Slices 15a, 15c and 16 answer this.

**Fix: moments wait for the fight (fix/moments-wait-for-fight; the player's wife: events showed while reeling and ended too fast).** A lake moment on screen when a bite, fight or the show-off starts no longer fades out in 0.4 s: it pauses (animation and lifetime frozen, dimmed to 0.6, not tappable) and resumes with the lifetime it had left, at full alpha, when the fish is landed or gets away. New moments already only start while idle or waiting. Rule in `momentClockRunning` (core/moments).

**Fix: update toast (fix/update-toast).** Tapping "New version — tap to reload" did nothing on the
playtester's phone. The reload waits for workbox-window's `controlling` event with `isUpdate`, which
never fires when the tab was first opened uncontrolled (first visit, no `clientsClaim`) and kept
open. Fix: after `updateSW(true)`, reload anyway if the page is still there ~1.5 s later.

**Slice 15a: prices, gear, clock label, Pajkel's speech bubble (decided 2026-11-23).**
- **Prices by rarity:** sell price = `basePrice × rarityMult × (0.7 + size position)`; rarity
  multiplier common ×1, uncommon ×1.3, rare ×2 (the Pale One is never sold). `priceMin` 0.5 → 0.7,
  so a bleak sells for about 3–7. Prices are fixed at catch time, so fish already in the bag keep
  theirs. Rod prices (250 / 1200) stay.
- **Lines and reels:** two upgrade tracks in the shop, bought in order like rods, always on once
  owned, and combined with the rod's catch-bar values (the rod still gives the zone size):

  | Item | Price | Effect |
  |---|---|---|
  | Braided line | 600 | progress drains ×0.85 |
  | Fluoro line | 2000 | progress drains ×0.7 |
  | Smooth reel | 1000 | zone follows the thumb ×1.2 (`reelResponse`) |
  | Pro reel | 3500 | ×1.4 |

  Each upgrade must make fights easier (check `reelResponse` with the catch-bar sim; if a higher
  value does not help, pick the knob that does). `PlayerState.lineId?` / `reelId?`, optional and
  normalised, no save version bump.
- **Clock label:** `Day 3  06:40 · Dawn` (Dawn / Day / Dusk / Night, the same names as the log).
- **Pajkel's speech bubble:** a small pixel-framed bubble over his head for ~3 s, one at a time,
  plain ASCII text (VT323 has no emoji). First use: on a new record he says one of
  "That's a beast... hehe", "New record!", "Look at the size of it!". Slice 16 reuses the bubble.

**Slice 15b: shop icons (decided 2026-11-23).** The shop was all text; make it lively.
- **Item cards:** each shop item (worm pack, rod, line, reel) is a small card: a framed wood icon
  slot on the left, then name, price and effect, the Buy button underneath (side by side is too
  tight at 360 px).
- **Icons:** 16x16 code-drawn art in the `iconArt.ts` style (1 px outline), shown at 3x (48 px), crisp.
  - worm pack: a little tin can with worms peeking out
  - rods: a diagonal rod with a reel; bamboo tan with joints, fiberglass yellow, carbon dark with a red stripe
  - lines: a spool; braided green, fluoro pale blue and see-through
  - reels: smooth silver, pro gold
- **Prices** use the coin icon + number instead of the word "coins"; an item she can't afford has
  its icon dimmed a little.
- **Sell list:** each bag fish shows its small sprite (reuse the fish-log sprites).
- **"Your tackle" strip** at the top of the gear part: the owned rod, line and reel as icons with
  names; replaces the "You have: ..." lines.
- **Buying:** the icon does a small pop + sparkle. Effect texts start with a capital letter.
- Later slices (baits, lantern) draw their icons in the same style.

**Slice 15c: baits (decided 2026-11-23).**
- **Kinds:** worms stay the default and catch everything as now. Special baits:
  - *Corn* — carp, tench, bream, crucian ×3 spawn weight.
  - *Maggots* — in shallow water the wait for a bite is ×0.6.
  - *Fish strip* — pike, zander, eel, catfish ×3 spawn weight.
  - *Glow bait* — rare species ×3 spawn weight. Not sold.
  A bait only shifts weights among the species that can bite there and then (zone + time).
- **Use:** like worms, one per caught fish and 50% when a fish gets away. When the chosen bait runs
  out she falls back to worms; she can cast while she has any bait. The soft-lock guard counts all baits.
- **Where from:** the shop sells corn, maggots and fish strip in packs of 10 (prices tuned against
  slice 15a income). Glow bait comes only from the daily box (tier 2 and up, a chance) and
  sometimes as a quest reward.
- **Choosing:** a bait chip in the bottom bar shows the current bait and how many are left; a tap
  opens a picker card. The choice is saved. `PlayerState.baits?` (counts) and `baitId?`, optional.
- No new quest kinds.

**Slice 16: the car, bedtime, naps and the night kit (decided 2026-11-23).**
- **The car:** a white Citroën DS4 parked at the edge of the grass, always there. Only its front
  quarter shows (headlight, part of the bonnet, the front door), peeking in from a screen edge. It
  must not cover the HUD, the bottom bar, the bait crate or other tap areas.
- **02:00, every night:** Pajkel says one line in his speech bubble ("I'm off to nap in the car.
  Bestia, come!", "Too late for me... Bestia! Car!", "I need to change my socks" — an inside joke),
  and calls Bestia. She boofs and runs away (a playful zigzag), Pajkel catches her, picks her up
  and carries her to the car. Door sound, the interior light goes on, then off.
  - *Without the night kit:* after they are in the car, a gentle "Time for bed..." fade, then
    "Good morning!" and the clock jumps to **05:00 the next day** (keeps the whole dawn window).
    If a fight, the show-off or a panel is open at 02:00, everything waits until it ends. Bag,
    coins, quests and the daily box (real date) are untouched. A save loaded between 02:00 and
    05:00 without the kit wakes at 05:00.
  - *With the night kit:* Alex stays and fishes alone by lantern light; Pajkel and Bestia stay
    asleep in the car until morning.
- **05:00:** Pajkel and Bestia walk back to their spots; Pajkel stretches once.
- **Tapping the car:** at night (they are inside) a "Zzz..." float, sometimes a sleepy boof. In the
  daytime (she is idle, no line out) it opens a nap card: "Take a nap until... Dawn (05:00) / Day
  (07:00) / Dusk (18:00) / Night (20:00)", plus "Deep night (02:00)" with the night kit. Pajkel and
  Bestia walk to the car, fade, the clock jumps to the next such time, they walk back. Free.
- **Night kit: "Lantern & blanket", 2500 coins,** in the shop once the fiberglass rod is owned. It
  removes the bedtime, and from 20:00 a warm lantern glow sits around Alex and the dock end.
  No tent (the car is where they sleep).
- **Change after the phone test (user, 2026-11-24): bedtime was too sudden.**
  - Pajkel and Bestia go to the car at **00:00** (same sequence: his line, the chase, the carry),
    with or without the night kit. Alex keeps fishing alone after that.
  - At **01:00**, without the kit, a gentle warning: "Bedtime at 02:00 - one more hour" (a toast
    above the bar, ~5 s; if a fight/panel is up, it shows when it ends). If the shop sells the kit
    to her, a second line hints at it ("A lantern would let you stay up").
  - At **02:00** without the kit: the "Time for bed..." fade to 05:00 as before (no companion
    sequence then; they are already in the car).
  - A save loaded between 00:00 and 05:00 starts with them in the car (and without the kit,
    02:00-05:00 still wakes at 05:00).
  - The shop always shows the Lantern & blanket card; before the fiberglass rod it is locked with
    "Needs the Fiberglass Rod" (the user didn't find it while it was hidden).
- **No tiredness:** the "no energy" rule stays; staying up costs nothing.
- Deviation (built): the nap card opens whenever they are on the dock and she is idle, also at night (not only by day); a kit owner's nap to "Deep night (02:00)" leaves Pajkel and Bestia in the car until 05:00 (Alex fishes on). Bedtime sets the clock to 05:00 with `day + 1` literally, so the day label advances twice in a night.
- **Consequence (intended):** the Pale One (02–04) and most uncanny moments (01–05) now need the
  night kit; it is the kit's payoff.

**Slice 17: "no take, only throw" fetch (user, 2026-11-23; details picked by Claude overnight, to
review).** The real Bestia never gives the stick back: they chase her until bored, find another
stick and throw that one. The fetch game (companions `play` mode) becomes that:
- Pajkel throws, Bestia runs for the stick as now, trots back proudly, but stops just out of reach.
- Pajkel steps towards her; she dodges (a hop sideways, play-bow) and trots off with the stick.
  He chases her around the grass for a while (zigzag, she always a little ahead), sometimes nearly
  catching her.
- He gives up: his bubble says a line ("Bestia, give!", "No take, only throw?", "Fine. Keep it."),
  he picks a new stick from the grass and throws it. She drops the old stick (it stays lying on the
  grass) and races for the new one. Repeat.
- Old sticks lie on the grass (at most ~3; the oldest fades out) until the companions return to the
  dock, then they are cleared.
- Rarely (about 1 round in 6) she does bring it back and drops it at his feet; he is so surprised
  he says "...thank you?" Keeps it from being fully predictable.
- The round count and the happy spin at the end stay; a bite still sends them back to the dock.
- Pure state in `companions/behaviour.ts`, unit-tested; uses the slice-15a speech bubble.
- Built as: she stops ~52 px from him, he steps up (~22 px), she play-bows (new dog frame) and hops away, the chase runs 7-11 s inside the grass (x 100-322, y 508-558, clear of the car, dock, crate and hint line) with a near miss every 2-4 s, then he says one of the three lines, walks to a spare stick that appears on the grass, bends (new Pajkel pose) and throws; she drops the old stick where she stands. At most 3 old sticks (a 4th makes the oldest fade over 1.5 s); a bite, a press or bedtime clears them. Give-back chance 1/6, "...thank you?", he picks that stick up and throws it. Dev: `?debug=afk&giveback=1`.

**Fix: no "New record!" from bed (user, 2026-11-24).** Pajkel praised records even while walking
to the car or asleep in it. Now he speaks only outside bed mode; asleep in the car, a record just
puffs a big Zzz from the car window.

**Fix: catch math (2026-11-24).** Follows `docs/CATCH_MATH_AUDIT.md` (a player who never pressed won
80-99% of catfish and bream). Tunables: `CATCH_BAR_TUNING.sinkerStray` {base 0.28, perDifficulty
0.65}: a sinker's stray chance is now 0.28 + 0.65 * d (about 0.85 for catfish, 0.7 for bream;
floaters keep `strayChance` 0.28); `sinkerFloor` 0.15 (a sinker's favourite band starts 0.15 * d above
the bottom, out of a resting zone's reach); sinker pattern `fill` 1.25 (keeps good-bot fights inside
8-15 s). Reel: `reelResponse` still scales lift and gravity, but drag now scales by its square root,
so a faster zone does not overshoot more (lift-only, and lift+gravity with fixed drag, both made bream
and catfish harder; measured). Sizes: `FISH_TUNING.bigSpeciesCm` 80 and `bigLengthSkew` 1.5 (u^1.5)
for non-legendary species with max length 80 cm or more (catfish, pike, carp, eel, zander); the rest
keep u^2. Median catfish 103 cm / 8.1 kg, P(under 3 kg) 24%; gold odds of those species rise from
11% to 14% (all species: 50/21/18/11 becomes about 45/22/20/12.5 % none/bronze/silver/gold).
`FISH_TUNING.shallowCap` 0.3 to 0.4 (big eel and perch fight a bit harder; shallow stays easy to
land). Catfish difficulty (0.85) unchanged. `baitCalm` is dead code (no bait sets it); left alone.

### Progression plan: road trips (decided with the user, 2026-11-24)
Goal: a long-term reason to come back daily for ~15 minutes (one in-game day is 20 real minutes).
- **Places**, travelled to by the car: Quiet Lake → **River bend** (first new place: current,
  trout, grayling, chub, asp) → **Old quarry** (very deep, clear water, odd catches, the eerie
  thread continues) → **Sea pier** (later). Each place: its own fish-log page, moments and legendary.
- **Unlock by a lake checklist**, not a plain species count (Stardew bundles): e.g. a dawn bundle
  (roach, rudd, bleak caught at dawn), a night bundle (eel, zander, catfish), "3 gold-star fish",
  "500 coins for petrol". Handing in a fish means not selling it.
- **Shared** day clock, daily quests and bait box across places; quests may name a place.
- **Size stars** (bronze / silver / gold per species, by length) come before the road trips; the
  checklist can ask for them. **Fish of the day** (one species pays double or bites more) with them.
- Later: a weekly quest, daily story chapters (storyline written separately, `docs/STORY.md`),
  a trophy wall / aquarium.
- Order (user): fix above → **slice 18 road map (WIP)** first, so she can see new places are
  coming → size stars + fish of the day → checklist board on Quiet Lake → River bend (art, fish,
  travel) → weekly quest + story chapters.

**Slice 18: the road map, places "coming soon" (decided 2026-11-24).** The user wants the map in
early so Alex sees new places are on the way while we build them. No travel yet.
- A tap on the car (when Pajkel and Bestia are **not** asleep in it) opens a **Road map** panel
  instead of the nap card. Asleep in the car: the tap stays as now (Zzz, sometimes a sleepy boof).
- The panel shows a small code-drawn pixel-art map: a winding road linking four pins.
  **Quiet Lake** is open, marked "You are here" (the car icon or a highlight on the pin).
  **River bend**, **Old quarry** and **Sea pier** are greyed out, each with a small
  **work-in-progress sign** (a red-white striped road barrier or a traffic cone) and "Coming soon".
- Tapping a pin shows its name and a one-line blurb under the map. Locked places get a playful
  line, e.g. "Pajkel is still fixing the road to the river." Quiet Lake: "Home. The fish know you here."
- Below the map, a wood button **"Take a nap..."** opens the existing nap card, so naps keep working.
- Data: the places list (id, name, blurb, `open` or `soon`) in `src/core/data/locations.ts`
  next to `QUIET_LAKE`; pure and unit-tested (one open place, ids unique). No save change.
- Art in `src/art/mapArt.ts` (pins, barrier, tiny map scenery: lake, river line, grey quarry
  cliffs, sea strip at the top), shown on a dev contact sheet; panel in `src/ui/mapPanel.ts`.
- Dev flag `?debug=map` opens the map at load.

**Slice 19: size stars + fish of the day (details picked by Claude 2026-11-24, user may adjust).**
Every catch gets a little more exciting, and each real day has one special species.
- **Size stars.** A fish's star comes from where its length sits in its species range
  (`sizeShare` in `core/fish.ts`, 0 = smallest, 1 = biggest): below 0.25 no star, 0.25 bronze,
  0.5 silver, 0.8 gold. With the length skew (u², `FISH_TUNING.lengthSkew`; u^1.5 for species of 80 cm and over, see Fix: catch math) that is about
  45% none, 22% bronze, 20% silver, 12.5% gold. Thresholds in data (`core/data/stars.ts`), pure
  `starFor(species, lengthCm)`; the Pale One has no stars.
  - Shown: on the catch screen next to the length (1-3 small pixel stars in bronze/silver/gold,
    plus "Gold!" text for gold), on each fish in the bag/sell list, and in the fish log: each
    filled tile shows the species' best star (derived from `bestLengthCm`, so **no save change**
    and old saves get their stars at once), and the log header gets a "Gold ★ x/12" counter.
  - A gold catch plays the record jingle if it is not already a new species / record, and
    Pajkel may say a gold line (only when not in bed, like the record line).
  - Price unchanged (size already sets the price).
- **Fish of the day.** One species a day, seeded from the real date like the quests (same day,
  same fish), chosen among non-legendary species she can reach with her rod (shallow only before
  the carbon rod), any time of day. Today's fish:
  - bites more: spawn weight ×2 (stacks with bait boosts);
  - sells for ×2: doubled when it goes into the bag (`toBagFish`), so the bag price shows it;
  - is shown at the top of the quest (notice-board) panel with its sprite: "Fish of the day:
    Tench · bites more, sells ×2", and a "Fish of the day! ×2" float/line on the catch screen.
  - Pure `fishOfTheDay(today, player)` in `core/daily/` or `core/quests/`; nothing saved (it is
    recomputed from the date and the gear; changing rod mid-day may change it, acceptable, or seed
    from the date only and fall back to a reachable species if the pick is unreachable: builder's call, keep it stable within a day if cheap).
- Dev flags: `?fotd=<speciesId>` forces today's fish; `?debug=caught&star=gold|silver|bronze|none`
  shows the show-off with a fish of that star.
- Built as: the fish of the day is seeded from the date only (`hash('fotd:' + date)` over all non-legendary species in data order); if her rod cannot reach it, a deterministic fallback among the reachable species (so it is stable within a day unless she buys the carbon rod). Stars are 9x9 pixel art shown at 2x (bag rows, log tiles, catch screen right of the length). The log's "Gold [star] x/12" counter is a line at the top of the grid (the panel title keeps "n/13 species"). A gold catch that is also a record or new species only gets the "Gold!" word on the badge and the record line; the gold line and the fanfare cover the plain gold catch. Dev: `?debug=caught&star=` and `?fotd=`.
- Later (not in this slice): quests and lake checklists asking for stars ("Catch a silver-star
  perch"), Grzesiu's log knowledge (size ranges revealed after N catches).

**Slice 20: the Quiet Lake checklist (details picked by Claude 2026-11-24, user may adjust).**
Stardew-style bundles: hand in fish (and coins) to fix the road to the River bend. The storyline
for all places (chapters, legendaries, bundles) is in `docs/STORY.md`. The river
itself is slice 21, so finishing the checklist now marks the road as fixed ("opening soon").
- **Six bundles, "The Doorstep"** (names and lines from `docs/STORY.md` §5, changed 2026-11-24
  after the storyline). A fish slot takes one fish from the bag (the fish is gone, not sold, no
  coins, no quest sale progress). The Pale One never fits. Each bundle shows its flavour line.
  1. *Dawn Chorus*: roach, rudd, bleak. "Early fish for early birds." Reward 10 corn + 60 coins.
     (The story asks for them *caught at dawn*, but these three bite only by day in the data, so
     no time rule; revisit if they get a dawn window.)
  2. *Night Shift*: eel, zander, catfish. "Things that bite after bedtime." Reward 3 glow bait + 200 coins.
  3. *The Bottom of Things*: bream, tench, crucian carp, carp. "Ask the ones who live down there."
     Reward 10 fish strip + 150 coins.
  4. *Shiny Ones*: any 3 gold-star fish. "Show the lake you're serious." Reward 300 coins.
  5. *Duck Tax*: 1 bleak. "For the duck. You know why." Reward 5 worms.
  6. *Petrol Money*: pay 500 coins. "The DS4 won't drive on vibes." No reward besides the road.
- **Hand-in:** each open slot shows what it wants (fish sprite or star row) and a "Give"
  button, enabled when a fitting fish is in the bag; it gives the cheapest fitting fish. A
  finished bundle shows its reward being paid ("+10 corn · +60 coins" toast) and a tick.
- **All six done:** a card "The road to the river is fixed." / "Pajkel packs the car." /
  "Bestia packs a stick." (story Q8) with a jingle; the road map's River bend pin changes from the barrier to "Road fixed! Opening soon".
- **Where:** the road map gets a "Quiet Lake checklist n/6" button; the River bend pin's line
  becomes "Finish the Quiet Lake checklist to fix the road (n/6)" until done. The notice-board
  panel gets the same button at the bottom. Catch screen: a small line "Fits the checklist!" when
  the caught fish fits an open slot (and it went into the bag).
- **Save:** `PlayerState.checklist?` (filled slots per bundle id; missing = nothing filled),
  normalised on load, no version bump. Pure rules in `core/checklist/` (fits, give, pay, bundle
  done, all done), data in `core/data/checklist.ts`, unit-tested.
- Dev: `?debug=checklist` opens it with a bag that fits a few slots; `&cl=done` marks all but the
  last slot filled.

**Slice 21: story chapters, Quiet Lake (details picked by Claude 2026-11-24 from `docs/STORY.md`).**
The chapter engine plus Quiet Lake chapters Q1-Q7 and the Pale One bonus beat. All texts are in
STORY.md §3 *Quiet Lake*; copy them exactly (they respect the length limits).
- **Engine (pure, `core/story/`, data `core/data/story.ts`):** an ordered chapter list per place
  (only Quiet Lake now). At most one chapter per **real local date** (same date source and
  clock-change guard as the bait box, `core/daily/dates.ts`). Today's chapter = the next undelivered
  one, if no chapter was delivered today. A chapter counts as delivered only when she has **seen**
  it (bottle read, moment tapped or played to its end); closing the game before that replays it on
  the next visit. Missing days never pile up and skip nothing.
- **Delivery:** today's chapter starts ~60-90 s of real play after the visit starts (the scene
  loads), only while she is idle or waiting and no panel is open, and not during another lake
  moment (random moments pause while a chapter is due or running).
- **Pajkel's lines** from chapters go into a queue. A line plays only when Pajkel can speak (not in
  bed mode), ~3-4 s apart, after the chapter's own beat (e.g. after the bottle card closes). Lines
  waiting while he sleeps in the car play after he wakes, which is the running gag. The queue is
  saved, so a line is not lost if she closes the game.
- **Sealed story bottle:** a new sprite (the bottle with a red wax seal), floating still near the
  dock end, gently bobbing, never drifting away. Tap opens the existing bottle card with the
  chapter text (a "W." note). A small wax-seal badge on the notice-board button while today's
  chapter is waiting and not seen.
- **Chapters:**
  - Q1 bottle + bubble. Q3 bubble ("Map says...") *before* the bottle appears, then the bottle.
    Q6 and Q7 bottle + bubble.
  - Q2 *duck's sandwich*: a sandwich appears on the dock planks next to Pajkel; the duck (existing
    sprite) paddles to the dock edge, grabs it, paddles away quacking; then the two bubbles.
    Plays to its end on its own (no tap needed); seen = played.
  - Q4 *the blink* has two versions, picked when it starts: **night** when Pajkel and Bestia are
    asleep in the car (so he misses it, the gag), else **day** (the bottle). Night: the water
    goes still (reuse the eerie calm), one star reflection with no star above it, it blinks
    once slowly; tap (or ~20 s) and it sinks; float "...it blinked."; queued line "Did I miss
    something? Again?" plays after he wakes.
  - Q5 *wet footprints*: dark wet footprints appear one by one on the dock planks from the water
    edge towards the car and back, then dry (fade) in a few seconds; then the two bubbles. Plays
    on its own.
  - Q8 is the existing "Road fixed!" card of slice 20 (no daily slot needed).
  - **Pale One bonus beat** (no daily slot): the first time the Pale One slips back, a card with the
    3 lines; Pajkel's "You caught WHAT? I was asleep?!" is queued for his next wake (or plays in a few
    seconds if he is awake on the dock).
- **Save:** `PlayerState.story?` (delivered chapter ids with dates, last date, queued lines, pale
  beat seen), normalised on load, no version bump.
- **Dev:** `?story=Q4` makes that chapter today's (ignores the date rule, starts in ~3 s; with
  `&debug=incar` for the night version), `?story=pale` shows the bonus card.
- Built as: pure engine in `core/story/story.ts` (data `core/data/story.ts`); `PlayerState.story = { done: {chapterId: date}, queue: [lineId], pale }`, "last date" is derived (the latest `done` date), stored only when non-empty. Pictures in `scenes/StoryView.ts`, glue in `LakeScene`. Deviations and choices: (1) the **seal badge** shows from the moment a chapter is due (not only once it is on the water) until it is seen, a 5x5 red wax seal on the notice-board button's top-left corner; the board itself still just opens the quests. (2) **Random moments are held** while a chapter is due or running, including a sealed bottle left unread; no chapter starts while another moment is on screen. (3) The **night Q4** needs Pajkel asleep in the car *and* `timeOfDay === 'night'` (a daytime nap gives the bottle version); the water stills by raising the eerie calm target, the crickets dip like for the uncanny moments, one 9 px star glint fades in, blinks once (open, half, shut, half, open over ~2 s) and sinks on a tap or after 20 s with the float "...it blinked." (4) **Q3**: if Pajkel can speak he says the line and the bottle arrives ~3.6 s later; if he sleeps, the line is queued and the bottle appears at once. (5) **Q2**: the sandwich lies at the dock's left edge by Pajkel's seat, the duck swims in over ~4.5 s, lunges, leaves quacking with the sandwich in its beak. (6) **Q5**: about 15 wet prints per way (7x10, dark blue with a pale edge, 11 px apart) walk from the dock end down the planks and across the grass towards the car, then a second line walks back, hold ~2 s and fade over ~3 s. (7) A chapter cut short by a fight is not seen and retries 20 s later; a bottle is seen when its card opens (the lines are queued at once but wait for the card to close). (8) The line queue plays one line at a time, 3-4 s apart, only when Pajkel is not in bed mode, she is idle or waiting, no panel is open and no bubble is showing; lines after a chapter start ~0.7 s after it ends, after a card ~1 s after it closes. (9) Pale One card title "The Pale One", shown when she is back at idle after the first slip-away (not at the hint). (10) Sandboxed dev runs (any URL flag) have the story off unless `?story=` is given, so other dev flags are never interrupted. Chapter ids and line ids are saved and must not be renamed.

**Polish pass, slices 22a-22c (user accepted `docs/ui-review/UI_REVIEW.md` on 2026-11-24).** The review
is the spec; its slices "21a/b/c" are renamed **22a/b/c** (21 is the story chapters). Decided with it:
red camp chair; the idle hint disappears after the first 3 casts; paint the tall-phone bands now;
the log button says "Log n/13"; the checklist gets a one-line warning when Give would take a
gold-star fish or the fish of the day. Changes since the review (slice 21 merged after it): 22c
moves the wax seal from the HUD board button onto the new shore sign, and a tap on the sign opens
today's chapter when one is waiting (else the quests).
- **22a "A chair for Pajkel":** UI_REVIEW §2 (camp chair, new sit/sip/pour/cheer/look frames, steam,
  empty chair while he is away) and §3 (fetch sticks: sprite, spin, puff, play area, max 2 old,
  30 s life, fades) and §5 "Slice 21a". Bestia's frames and behaviour are not touched.
- Built as (22a, art tweak pass on top: cup 3x4 with white rim and dark edge, pour redrawn with a 3x6 thermos tipped over a lap cup, lighter chair frame and legs with a shorter canvas and a 1 px shadow, slimmer torso (16 px shoulders tapering to 12) with a 18 px canvas, steam wisp 2x3 rising 7 px with a wiggle, three staggered, dust puff of 5-6 sandLight pixels over 0.45 s): the seated sprite is 40x48 and keeps the person's rows, so the anchor row is 42 (`PAJ_ORIGIN_Y`) and the chair legs and shadow hang below it; the speech bubble now points at the hair top (`PAJ_HEAD_TOP` = 7). New frames `sit`, `sipLift`, `sipDrink`, `pourReach`, `pour`, `cheer` (its `breath` argument is its second frame, flipped every 180 ms while clapping), `look`; `PajShape` replaces `sip` by the four sip/pour shapes (`isSipShape`, `isSeatedShape`). Sip timeline in `behaviour.ts` (`SIP_FRAMES`, `POUR_FRAMES`, `sipFrameAt`): lift 200, drink 900, lift 200 ms; every 4th sip (`POUR_EVERY`) starts with reach 300, pour 800, reach 300 (1.3 s and 2.7 s in all). `nextSipIn` is now re-drawn (8-14 s) when a sip starts, so a sip cut short by a bite does not restart at once. The head is 15x11 (hair darker on its underside, a fringe over the sunglasses), the knee and shoe stick out to the right of the chair, the rod leans on its left arm and the thermos stands on the planks right of it (it is in his hand, so absent, in `pour`). Steam: a 1x2 `whiteShade` wisp from the cup (sit, sipLift, sipDrink) every 1.5 s, rising 4 px over 1.2 s, alpha 0.7 to 0, dawn, dusk and night only (`steamShows`); drawn untinted so it still shows on the dark dock. The empty chair is its own 37x17 sprite with the thermos beside it, drawn at his spot whenever he is not seated there (`chairEmpty`: away, walking back, in the car); a bedtime that starts while he sits keeps it taken until he walks off. Sticks: `stickGroundSprite(variant)` 13x4 in three shapes (the shape is chosen by `stickVariantAt` from the stick's spot, and a stick keeps it when dropped), wood colours with no outline and a `grass0` shadow row; the thrown stick uses four baked rotations (0, 45, 90, 135 degrees, 80 ms each) with a 2-frame `grass3` dust puff on landing (spec said `grass2`, which vanished on the lawn); the carried stick and the one in his fist use the wood colours. `PLAY_AREA` y 508-546 (Bestia's start spot moved up to y 544), `maxOld` 2, an old stick lies 30 s then fades over 2 s, `stickGap` 18 and `dogGap` 14; when nothing fits, the stick lands where it would and the oldest old stick starts fading. Going back to the dock fades every stick over 2 s (the one Bestia holds is dropped first); bedtime still clears them at once. The thrown stick that lies where it landed is now drawn under the characters. Dev: `/dev/char-sheet.html?mode=paj` shows every frame, the empty chair and the sticks.
- **22b "Friendlier panels":** UI_REVIEW §1 fixes 5-10 and §4, §5 "Slice 21b".
- Built as (22b): `openPanel(title, build(body, pinned, footer), onClose, dismissable, subtitle?)`: the subtitle (string or function) is its own line under the title row, the pinned strip holds the shop purse, tabs and Sell all, the footer the bag's "Go to Shop"; thin wood scrollbar, 20 px fades only when there is more. `woodButton` has `variant: 'gold'|'wood'` and the one-gold rule (comment in `panel.ts`); small buttons 6 px padding; X hit box 44x44. Shop tabs Sell (n) / Buy (`shopStartTab`), Sell rows are wood, Sell all gold. Checklist: title "The Doorstep", subtitle "Quiet Lake checklist · n/6", rows of name + slot squares (under the name) + reward icons, `checklistOrder`, `firstOpenBundle`, `giveWarning` (cheapest fitting fish is gold or the fish of the day), `slotBlockReason` shown as a dim line (the button stays "Give", greyed). Quests: gold bar with the count inside, `rewardLine` icons, "Sell fish for N coins". Nap: `napPrimaryId` (next part of the day) is the gold button. Bait box: `tierHint` line. Bait picker: `short` effect lines. Settings order Sound, Names, Save code (folded), Start over; sliders 44 px. Log: locked tiles show `lockedHint` icons (new `src/art/clockIconArt.ts`: sun, half sun, moon, 1 or 3 waves, 9x9, for 22c's clock too) and a tap opens a card at body size. Stars: silver is stone grey with a dark stone edge. Catch screen: the checklist tag is a wood tag directly under the size/stars line (record and fact move down 26 px), stars have a dark backing. Deviations: the bait box keeps tap-outside-to-close; Shop Buy cards stay gold per card; the bag-full text reads "Catfish, 120 cm · coin 240 / No room in the bag."
- **22c "The lake teaches itself":** UI_REVIEW §1 fixes 1-4 and the tall-phone bands, §5 "Slice 21c".
- Built as (22c): the sign (24x26, feet (276, 498), 48x48 tap area y 452-500, so it never overlaps the fetch lawn; PLAY_AREA unchanged) shows a cream note per unfinished quest, a done one with a rim, a gold pin and a 2-frame flutter, and a wax seal on a cream note while today's chapter is waiting or out on the water. A tap while idle: the sealed bottle's card if it floats, else today's chapter starts (same `beginChapter` as the delivery) when it waits and the lake is calm, else the quests. The top-right board and pencil buttons and the HUD worm counter are gone; the clock reads "Day 1 · 12:00" with the 9x9 sun / half sun / moon icon (drawn 2x), coins stay under it. The hint line (`core/tips.ts`) is, by priority: out of bait ("Out of worms, visit the Shop"), fewer than 3 casts ("Hold to charge, release to cast"), bag full, a crate never tapped, a finished quest, a waiting chapter; none and no frame otherwise; one-off lines show 6 s once per occasion; texts are short enough for 360 px. Glints (the crate's `+`, every 4 s, staggered) on the car, sign and Bestia until each is tapped once; the crate keeps its own twinkle. `PlayerState.seen?: string[]` holds the tapped ids and `cast1..3`. Bottom bar 34 px drawn, 44 px hit (gaps go to the nearer button), 85 % labels when disabled, "Bag" amber from 8/10, "Log n/13"; gear, crate (44x44), dog (44x44 at least) and sign are finger-sized. Names are three fields plus "Save names" in ⚙ Settings (shared `nameFields` with the first-launch card). The catch bar starts at y 50, and the progress strip has a fish icon above and a net icon below. The update toast sits top right. Tall phones: the page background is a gradient from the sky's top colour (upper half) to the lawn colour (lower half), and the theme-color meta follows the sky.

**Slices 22d + 22e (user, 2026-11-24; details picked by Claude, user may edit the texts).**
- **22d "Bigger sign + story journal".**
  - *Sign:* about 1.5x bigger (~36x38 px), notes ~6x7 px and readable, the claimable-quest note
    gets a 3x3 gold pin plus a soft gold glow/twinkle, the wax-seal note bigger and red; tap area
    ≥ 56x56. Keep it clear of the fetch lawn (y ≥ 500), the dock and the crate; Bestia must not
    steal its taps (sign wins over a pet tap inside its box).
  - *Story journal:* the notice-board panel gets two tabs, **Quests** and **Story**. Story lists
    every chapter she has seen, oldest first: a small icon (sealed bottle / duck / star / footprints
    / car / pale fish), the chapter's text (the W. note for bottles, a one-line description for
    moments) and one **thought** from Alex or Pajkel in italics. Unseen chapters are not shown (no
    spoilers); the header says "Chapter n of 7". A dot on the Story tab when a new page was added
    since she last looked. Thoughts (≤ 60 chars, the user may rewrite them later), in `core/data/story.ts`:
    - Q1 Alex: "A pen pal who signs with one letter. Who are you, W.?"
    - Q2 Pajkel: "Note to self: never trust a duck."
    - Q3 Alex: "Forty metres down in a nine-metre lake?"
    - Q4 night Alex: "A star in the water with no star above it. It blinked."
      / Q4 day Alex: "Count the stars tonight. Maybe. Probably."
    - Q5 Pajkel: "Wet footprints. Not mine, not Bestia's. Hm."
    - Q6 Alex: "How do you forget catching something like that?"
    - Q7 Pajkel: "A doorstep to what? I'm fixing the road anyway."
    - Q8 Pajkel: "Car packed. Stick packed. Duck not invited."
    - Pale One beat Alex: "I caught it. I think. Why is it so hard to remember?"
    Pure: `journalEntries(story)` in `core/story/`, unit-tested; no save change (the seen chapters and
    the Q4 version are already saved; if the Q4 version is not, store it).
- Built as (22d): sign 36x38 (feet (276, 498)), notes 6x7 at x 5/15/25 with dark writing lines, the claimable note has a gold rim, a 3x3 gold pin and a breathing gold glow (two translucent rectangles, drawn by the scene), the waiting chapter is a 12x8 cream letter with a 6x6 red wax seal; tap area 56x56 (x 248-304, y 444-500), checked before the dog and Pajkel. The notice board ("Notice board") has Quests and Story tabs (the shop's tab style); Story shows the seen pages oldest first (by the date seen, chapter order within a day; Q8 last once the checklist is done; the Pale One by `paleOn`, or after the dated pages when an older save has none), each with an icon (story bottle, duck, blink star, footprints, car, pale fish), the bottle's note or a one-line description, and the thought in italics signed with the player's or companion's profile name; subtitle "Chapter n of 7" (the Pale One page is a bonus and not counted); an empty journal says "No pages yet"; a gold square on the Story tab while a page is new (opening the tab marks it read). `StoryState` gained `blinkNight`, `paleOn`, `looked`. Dev: `?journal=all`, `?debug=quests&tab=story`.
- **22e "Fish knowledge" (tester Grzesiu's idea).** A species' log card reveals more the more she
  catches it; old saves unlock at once from their counts. Tiers (pure `core/fishKnowledge.ts`, data
  in `core/data/`):
  - 1 catch: name, fact, where/when (as now), her best size.
  - **5 catches:** size range "12-30 cm · 20-300 g" (from the species data).
  - **10 catches:** favourite bait ("Bites best on: corn" from `baits.ts` speciesBoost; species with
    no favourite bait: "Not fussy: worms are fine").
  - **25 catches:** "Gold from N cm" (the gold-star threshold) and the times caught.
  - A locked tier shows as a dim line "??? · catch 5 to learn" so she knows what's next.
  - The Pale One: no tiers (it slips away; keep its card as is).
- Built as (22e): `core/fishKnowledge.ts` `knowledgeRows` gives three rows (range, bait, gold) per species, unlocked by the saved `count` (no save change); tiers in `core/data/fishKnowledge.ts`. Gold from N = the shortest whole cm where `starFor` is gold; weights are rounded (two figures, kg from 1000 g, "1.6-43 kg" when both are kg). Bait line shows the bait icon and name(s) from `speciesBoost`. Deviation: "Caught xN" stays visible at every tier instead of waiting for 25. Dev flag `?logcount=N`.


## 4. Roadmap

> Milestones (M1-M5, Google Play) are now in [ROADMAP.md](ROADMAP.md) (2026-11-24). The list below is
> the older idea pool; v2a-v2d come after M5.

- **v1** — one lake, float fishing, worms only, ~12 fish + 1 legendary, log, bag, shop, 2 rod upgrades.
- **v1.5 Daily habit** — daily bait box + daily quests (rewards: worms + coins), right after saving lands.
  See §5.
- **v2a Worm farm** — soil plots near the lake; feed them (leaves, scraps, compost); worms multiply
  over in-game days; feed type decides worm type (earthworm, red wiggler, nightcrawler).
- **v2b Fields & bait crafting** — grow crops (corn, wheat, hemp…); craft two layers of bait:
  *hook bait* (decides which fish bite) and *groundbait / zanęta* (attracts fish, raises bite rate).
  Recipes are unlockables.
- **v2c Spinning** — lures/wobblers, active cast-and-retrieve; retrieve speed + lure depth decide
  what attacks. Predators: pike, perch, zander.
- **v2d Feeder / bottom fishing** — heavy cast, bite alarm, patient; maybe 2 rods. Carp, bream, catfish.
- **After v2** — weekly quests (once bait/lure systems give interesting rewards). See §5.
- **Later** — more locations (river, pond, sea, ice fishing), fly fishing, weather & seasons,
  walkable Stardew-like world (landscape), music, personal touches (her own legendary fish), cloud sync.

### Catch mechanic v2: "feel the line" (grilled with the user 2026-11-26; slice 28)

Alex: the catch "looks almost exactly the same as Stardew Valley and the mechanics are the same". Before Google
Play the fight becomes our own. Decisions (all of the main session's recommendations accepted, with one change: the
old bar STAYS behind a toggle so testers can compare):
- **Core:** the fight happens on the lake, not in a side panel. The fish is a splash/swirl at the end of a taut
  line, cutting left/right and surging away. Hold anywhere = reel (the fish comes closer, the line tightens);
  when it surges the rod bends hard and the line goes red, so let go and let it run; wait too long and the line
  goes slack. A small curved tension gauge by the reel: slack (grey) · steady (gold band) · red. The fight ends
  when the fish reaches the dock. One thumb, hold/release.
- **Fail:** too long in the red snaps the line (fish gone, a bit of bait, never gear); slack for more than ~2 s
  lets the hook slip. Both forgive short mistakes.
- **Gear:** rod = flex (how long you may stay in the red), line = snap limit, reel = reel-in speed, bait as today.
- **Fish personalities** from today's data: smooth = long steady pulls, darting = quick sideways cuts + short
  surges, sinker = heavy and deep (patience), erratic = random surges; trophies get one signature move each.
- **Perfect catch:** (tuning round) at most a tiny grace in the red and the needle inside the gold for at least 90 % of the fight time after the first second, 70 % to 62 % on the hardest fish (slack counts against it). The star above the gauge shows it live: bright gold while the share is comfortable, dimmer as it falls toward the limit, grey and cracked once it cannot be reached. Downstream rules (+1 star tier, medals) unchanged.
- **Control, not reaction (tuning round):** the telegraphs stay fair (0.35 s+), the skill is feathering. While the thumb is down the tension climbs steadily, faster the heavier the fish and the pull (never faster than the gold can be crossed in about 0.3 s, 0.18 s in a surge, so a real thumb can feather; hold on and it snaps), and a hard surge props the needle up even with the thumb off; letting go makes it fall at a steady rate, so control means rhythm: hold, release, hold. The gold band is drawn exactly where the rules count it: 0.24 for easy fish down to 0.12 for hard fish, at most 0.15 for trophies; a cut's jerk is spread over half a second and nothing else lifts the needle fast; never pressing slips the hook in about 4-7 s, a touch wider with a better rod. Reeling works only with the tension right: full speed in the gold, slowly while slack, fading to nothing toward the red. A tiny phone tick (Android) marks the needle entering or leaving the gold.
- **Reeling:** hold anywhere (no crank gesture).
- **Haptics:** short pulses on a surge, a buzz near the red (Android only; the screen shows everything without it).
- **Toggle (user, 2026-11-26):** Settings "Catch style: Classic / Line", saved on the device, default Classic
  until testers have compared; dev flag `?catch=line|classic`. Both styles feed the same catch result (size,
  stars, perfect, trophies, quests).
- **Order:** slice 28 builds it behind the toggle with tuning in data and a bot sim (aim: catch rates close to
  classic for a decent player); then testers and Alex compare; then it becomes the default; the economy and
  perfect-catch sims are re-run. River bend content (25c onwards) waits for it: the river current and the
  spinning rod build on the line fight.
- **New rod types later, one at a time:** spinning (lure, active retrieve before the bite; River bend gear,
  slice 25g), then feeder (heavy fish, long patient fights), fly last if ever.

### Shop per location (decided with the user 2026-11-26)
The whole Quiet Lake shop takes ~4.2 h of play (ECONOMY_SIM.md, ~day 7 at 40 min a day). Proposal: not a
rotating shop but stock per place. Worms and basic baits everywhere; each place sells its own gear and camp
things (Quiet Lake as today; River bend the spinning rod and river gear, slice 25g). Buying out Quiet Lake in
~4 h then fits the first chapter (it ends near the road fix), and River bend opens a fresh shop. Later idea: a
"travelling merchant" with one rotating daily special (retention).

### Feeding Bestia (slice 30; testers asked, rules set by the main session 2026-11-26 while the user was away, user may veto)
- A small blue food bowl stands on the grass by the car from the start (free). Dog treats are sold everywhere in
  the shop, basics section: "Dog treats x5", 25 coins.
- Tap the bowl with treats: one treat goes in, she trots over (from play, the dock or her bed; not from the car or
  while asleep at night), eats (2-frame munch), wags, a heart pops. Without treats: a kind line "Out of treats.
  The shop has some." Panels, fights and bedtime block it like other shore taps (the tap never moves the rod).
- No hunger, no stats, she is never sad or hungry. The first feed of a real day gives a small cozy bonus: her next
  finished fetch round counts as a stick round for the Stick Museum (still capped at 2 new sticks a day), and
  Pajkel says a line ("Spoiled. Good."). Later feeds the same day: she eats happily, no bonus; at most 3 a day
  (then "She's full. Look at that belly.").
- Saved: treats count in the inventory, the last feed date and today's count in PlayerState (optional fields).

### Bestia's bed on the dock (Alex's idea, 2026-11-26; slice 31)
- Once bought, the dog bed lies ON THE DOCK, exactly where Bestia lies by Pajkel's chair (not on the grass by the
  car). Her dock rest becomes lying in her bed: lying or curled in it, breathing, the rising z at night.
- Her naps (slice 27) happen there: no walk to the grass. After fetch, the pebble outing or feeding she comes back to
  the dock and settles into the bed. Night and the car rules stay as they are.
- A tap on her pets her (as now); a tap on the bed when she is not in it opens the Stick Museum (as now).
- Works at every place where she rests on the dock or landing (the same companion spot data).

### Ideas (not scheduled)
- **Our own catch mechanic:** decided, see "Catch mechanic v2" above (slice 28).
- **Feed Bestia (testers, 2026-11-26):** players want to feed the dog. Open questions: what (treats from the
  shop? a small fish from the bag?), how often (once per real day, like the bait box?), what it gives (a happy
  animation + a bowl by the bed, maybe she fetches longer or finds sticks more often; no stats or hunger,
  she never gets sad or hungry). Small slice, fits next to the camp bed.
- **Aimed casting** — while holding to charge, sliding the thumb left/right changes the cast
  direction (the landing marker follows). It only matters once the lake has *features* worth
  aiming at: reeds, lily pads, a sunken log, a drop-off, each holding different fish or better
  bite rates. Build the two together, otherwise aiming is cosmetic.
  Core impact: cast result becomes distance + angle (a 2D point), and "zone" lookup becomes a
  point-in-area check; keep that in mind when extending `Location`.

- **Bedtime at 2 AM & night gear** — scheduled as slice 16 (see §3 → Slice 16; decided: no tiredness,
  Pajkel and Bestia sleep in the car). Original notes: the angler has to sleep: at 02:00 the day ends and she wakes
  up the next morning (Stardew-style). With *night equipment* bought in the shop (tent, lantern,
  headlamp…) she can stay out and fish all night, but the angler gets *tired*.
  Open questions (to grill before building):
  - What does "tired" do? Ideas: harder catch bar (smaller zone), slower reel, shorter hook window,
    more nibble fake-outs. Must stay cozy: no lost coins or items.
  - What happens at 02:00 without gear: a gentle "you head home to sleep" fade, and she wakes at 06:00?
  - How does she recover: sleeping in the tent, coffee/food from the shop?
  - Conflicts with the v1 decision "no energy". Proposal: tiredness exists *only* past bedtime with
    night gear, so normal play stays energy-free.
  - Night fish (eel, catfish, zander) are still catchable 20:00–02:00 without gear; deep-night
    species (02:00–05:00) could be the reward for owning night gear.

- **Treasure in the catch bar** (Stardew-style) — sometimes a chest icon appears in the bar.
  Keeping it in the zone long enough grabs it as a bonus (coins, bait, cosmetics).
  Open questions: what can a chest hold, how often does one appear, and does missing it cost anything (it shouldn't)?

- **More gear** — lines and reels scheduled in slice 15a. Still open: other bobbers, line types, reels and so on, each tweaking the catch bar
  (line → drain, reel → zone responsiveness, bobber → bite readability?). v1 has only the two
  rod upgrades.

- **Fun facts on catch** — a short real fact about the species when caught (or in the fish log).
  Each species already has one `fact` in the data (slice 6). Slice 8 shows it on the first catch
  and in the log. Polish pass: a rotating pool per species, then maybe a fact on every catch.

- **Livelier companion reactions in the fight** — Pajkel leans in or cheers during the fight,
  Bestia watches the line. Slice 5 only adds small reactions on a catch or loss.

- **Lake moments** — scheduled as slice 14 (see §3 → Slice 14). Far future (user, 2026-11-24: leave
  it for now): personal bottle notes from Pajkel to Alex, and maybe a "Notes" page in the fish log to reread them.

- **Eldritch thread (Cthulhu-like events)** — far future. A slow, cozy-creepy mystery under the
  lake, told through rare events and eventually a quest line. Seeds can be planted early:
  - *Slice 12 legendary* can be the first hint: bites only deep at ~03:00–04:00, the lake goes still
    and slightly green during the fight, and its fact is a little wrong ("No one has caught it
    twice. No one remembers why.").
  - *Lake moments* (above) carry the uncanny ones.
  - Later: a quest chain (strange notes in bottles, odd catches, a final encounter), maybe tied to
    bedtime / night gear (02:00–05:00 is when things happen).
  Open questions: tone (whimsical-spooky vs actually unsettling — must stay cozy, no fail state or
  loss), is there a "sanity"-like mechanic (probably not; conflicts with "no energy"), does it end
  in a special catch, a cosmetic, a new location?

- **More lakes / locations & fishing methods** — far future, already sketched in the roadmap
  (river, pond, sea, ice fishing; spinning, feeder, fly fishing). Open questions: how she travels
  between locations (map screen vs walking), whether each location has its own fish log page,
  and whether rods/gear are per method.

- **Fish prices by rarity** (user, 2026-11-23) — scheduled in slice 15a. small fish like bleak sell for almost nothing
  (price = `basePrice` × size position, bleak `basePrice` 4 → 2–6 coins). Proposal: rarity adds to
  the price (e.g. a multiplier per rarity tier), so an uncommon or rare catch always feels worth it.
  Open questions: multiplier values, does it re-balance the rod prices (250 / 1200), and does size
  still matter as much?

- **Baits that raise the chance of rare fish** (user, 2026-11-23) — scheduled as slice 15c. ties into v2b hook bait: special
  baits shift the spawn weights toward rarer species (or one species). Open questions: per-species or
  per-rarity boost, how strong, and do baits come from the shop, the daily box, or crafting?

- **Fish knowledge unlocked in the log** (tester Grzesiu, 2026-11-24) — each species' log card
  reveals more as she catches more of it, e.g. after 10 catches she learns its weight and length
  range (later tiers: best time of day, favourite bait, depth). Fits the size stars (slice 19): the
  range tells her what a gold fish is. Open questions: the tiers and their counts (3 / 10 / 25?),
  what is hidden before (shown as "???"), and whether old saves (counts only) unlock at once
  (probably yes, counts are kept).

- **Two ways into the notice board, for now** (user, 2026-11-24, after tester feedback): the shore sign and the
  top-right button both open it; decide from more feedback which one stays.

- **A red "sweet spot" inside the green zone on better rods** (friend's feedback, 2026-11-24) — the green catch
  zone gets a smaller red core; while the fish is in the red part the progress fills faster. Better rods
  (or a new gear stat) make the red core bigger, which gives rods a new, visible parameter.
  Open questions: size and speed-up of the core, is it on every rod (small on bamboo) or unlocked, does it
  replace part of what the rods do today.
- **Switch between owned rods** (friend's feedback, 2026-11-24) — today she always fishes with the best rod she
  owns. Let her pick any owned rod (and line/reel?), e.g. a light rod for shallow fun or quests. Needs the
  rod to matter beyond "bigger is better" (ties to the sweet spot above and to cast distance).
- **Catch math and weights to check** (friend's feedback, 2026-11-24) — "some fish are strangely easy, maybe a
  formula got tangled" and "weights look odd: I caught a tiny catfish". Audit requested.

- **Species that need a special bait** (user, 2026-11-24, still thinking; no change to bites for now) — some
  fish (maybe new ones at the River bend, or a rare Quiet Lake variant) bite *only* on a given bait,
  e.g. glow bait at night, fish strip for a predator. Would give baits a stronger purpose and the
  log a "needs ..." hint. Open questions: which species, is it a hard gate or a big boost, and how
  the log/knowledge tells her (ties into Grzesiu's fish knowledge).

- **Achievements + total weight per species** (playtester, 2026-11-23) — the log could show the
  total weight caught per species; the user wants it with an achievements system, not on its own.
  Open questions: what achievements, rewards or just badges, and how to count weight for catches
  made before it existed (saves only keep counts and records).

- **Tournaments and leaderboards** (user, 2026-11-23; *far* future) — friends of the user want to
  play too. Two steps:
  - *NPC tournaments* (offline): a timed event (e.g. "biggest bream before 18:00", "most fish in
    one in-game day") against a few named NPC anglers with scripted results; a cup or a cosmetic
    for winning. Grows from the "weekly tournament vs her own records" idea in §5.
  - *Online leaderboards* between players: needs a backend, accounts or nicknames, and cheat
    resistance (the game is fully client-side today, so any score can be faked). Ties into cloud
    sync (parked).
  Decided (user, 2026-11-23): no separate friends build. Later, a "choose your character" step at
  the start lets friends play as someone else; for now the game stays Alex only.
  Open questions: which
  records are fair to compare (biggest fish per species? weekly totals?), and where it would be
  hosted (GitHub Pages is static only).

### Parked on purpose
Weather & seasons · cloud sync · landscape/walkable world · music.

---

## 5. Retention: daily & weekly content (future)

Goal: a gentle reason to open the game every day. It should feel cozy and never punishing.

**Daily quests**
- 3 small quests per day, e.g. "Catch 5 roach", "Catch a fish at dawn",
  "Catch something in deep water", "Sell 200 coins' worth of fish".
- Rolled from a quest pool, weighted toward what she has unlocked (no deep-water quests before the rod upgrade).
- Reset at local midnight (real time, not the in-game clock).
- One free reroll per day.

**Weekly quests**
- 1–3 bigger goals, e.g. "Catch 3 different deep-water species",
  "Beat 2 personal-best sizes", "Catch a zander at night".
- Reset on Monday.
- Better rewards: rare bait, groundbait recipes, cosmetics, lure blueprints (once spinning exists).

**Daily bait box**
- One free box per day ("The bait shop left a package on the dock").
- Contents are rolled from a loot table: worms (common), special baits, groundbait ingredients,
  seeds for the bait fields, and a small chance of a rare item.
- A streak bonus makes the box contents better over consecutive days.
- No punishment for missing a day: the streak pauses or drops a tier instead of resetting to zero.
  It's cozy, not a guilt trip.

**Possible extras**
- "Fish of the day": one species gives bonus coins or bonus quest progress today.
- Weekly "tournament" vs her own records (biggest fish of a chosen species this week).
- Seasonal/holiday events later (ties into weather & seasons).

**Tech notes**
- Pure logic in `src/core/quests/`: quest definitions, a seeded daily roll (seed = date),
  progress tracking driven by game events (`fishCaught`, `fishSold`, ...).
- Reward tables in `src/core/data/`, so they're tunable.
- Use device time for resets, but guard against clock changes (store the last claim date
  and never grant twice for the same date).
- Depends on: saving (slice 9), and ideally the bait systems (v2), so rewards have variety.

**Roadmap decision:** build the daily box and daily quests soon after v1 saving lands, even with
only worms and coins as rewards. They're cheap and create the daily habit early. Weekly quests
come once the v2 bait and lure systems provide more interesting rewards.

**Design implication for earlier slices:** the core should emit game events (`fishCaught`,
`fishSold`, …) from the start, so quests can subscribe to them later without refactoring.

### Pacing rework (decided 2026-11-24, after friends' play)

Friends bought the whole shop within a few in-game days and had nothing to do daily. Decisions:
1. **Quiet Lake lasts ~3-5 real days**, not 2 weeks; then River bend opens. New places carry retention.
2. **Goals gate progress, coins second**: gear (e.g. the carbon rod) appears in the shop only after a
   checklist bundle or story chapter; coins still pay for it.
3. **Prices**: light rebalance only, after the catch-math sim. No grind.
4. **Daily pull** (user's pick):
   - **Daily conditions** seeded by the real date (weather / wind / etc.) that change which fish bite and where,
     so each day plays differently.
   - **A few rare fish** per lake, catchable only under a special condition (night, a bait, a weather),
     each with a **special reward**.
5. **Coin sink once the shop is done**: upgradeable camp (tent, fire, Pajkel's chair, Bestia's kennel), cosmetic.
6. **M1 "done when"** rewritten: a fresh save has a goal every visit for ~4 days, then the road opens.

Also from play (user, 2026-11-24):
7. **Perfect catch**: the fish never leaves the green zone for the whole fight -> +1 star tier on that catch,
   and a **medal** (a tier above 3 stars) is possible ONLY with a perfect catch. Open: does a no-star fish get
   bronze, medal look in log/bag, does a medal fill checklist star slots; grill together with the red sweet spot.
8. **Max-distance cast is too hard**: the charge meter pauses briefly at full power (~150-300 ms). Small tweak.

**Grill round 1 (decided 2026-11-24, user accepted all recommendations):**
- **Weather per real hour, decided 2026-11-24** (was once per real date): the weather is keyed by the real date + hour
  (one real hour = 3 in-game days, a day being 20 real minutes), so it changes while she plays. The previous hour's
  weather counts for 1/3 in the next pick (repeats are rare but possible). A flip waits until Alex is idle or waiting
  (never mid-fight, bite, cast or show-off, or with a panel open), then crossfades over ~10 s; Pajkel says one line per
  change. Fog stays "until 10:00 in-game each morning" (the look and the rare-fish weight); Old Mossback's fog
  condition holds the whole fog hour. Fish of the day stays daily. One per hour, from 5 conditions:
  - Sunny & calm: shallow fish bite more, deep ones slower.
  - Overcast: even mix; time-of-day fish (tench, zander) bite all day.
  - Light rain: faster bites, carp/bream more; rain sound + drops on the water.
  - Windy: bobber drifts a little, predators (perch, pike, zander) more, fights a bit harder.
  - Morning fog: fog until ~10:00 in-game, rare fish more, eerie mood.
  Each = a few species weights up + one visible lake effect + a Pajkel line. Shown as an icon next to the
  clock and a Pajkel line on the day's first visit; Grzesiu's log card says which weather a fish likes
  (knowledge tier). Light visual effects (rain drops, fog, overcast tint, wind ripples).
- **Rare fish on Quiet Lake: 3 + the Pale One**, each = weather + time window + one more condition:
  - Golden tench: rain, dawn/dusk, deep.
  - Old Mossback (huge carp): fog, corn bait, 30 m+.
  - Silver ghost (white bleak): sunny, 11-13, shallow, maggots.
  Found through half-hints (bottle note, Pajkel, a notice-board note); unknown ones show as a "?"
  silhouette with the hint in the log. Reward: a **trophy at the camp** (mounted fish by the car), a
  gold-framed log entry, a special Pajkel/Bestia moment; no extra coins. Harder fight: a new pattern and
  it escapes if it stays out of the green too long (perfect catch of a rare fish = top achievement).
- **3 new normal species** (user: uncommon/rare, not legendary). Confirmed by the user 2026-11-24:
  - Ide: shallow, dawn/dusk, uncommon, smooth-darting; likes overcast.
  - Asp: shallow surface predator, day, rare, darting (fast); likes windy.
  - Burbot: deep, night, rare, erratic/sinker; likes rain and fog.
  Log goes 13 -> 16 (+3 rare = 19); checklist/quests/knowledge data need entries.

**Slice 23d built (rare fish):** rarity `trophy`, rules in `core/data/rare.ts` + `core/rare.ts`, ~0.2 per landed cast when all
conditions hold (fog = the whole fog day, any hour). The fight is a hard darting/sinker (0.8-0.9) and the fish slips away after
2.5 s outside the green. Trophies skip the bag (no coins), go on a trophy board by the car, and show a gold frame in the log; the
three hints come through a bottle note, a Pajkel line and a notice-board "Rumours" block. See HANDOFF for numbers and weak spots.

**Slice 23e built (camp items):** six buyable camp things in a "Camp" shop section (campfire 800, deck chair 600, Bestia's bed 1000, tent 1500, string lights 1200, windsock 400); the trophy board stays free. Cosmetic only; the campfire flickers and glows at night, the string lights glow at night, the windsock follows the day's weather, the deck chair replaces Pajkel's red chair. Not built: Pajkel warming his hands, a crackle sound, Bestia napping in the bed (she stays on the dock). See HANDOFF for spots and weak spots.
**Slice 23f built (perfect catch + sweet spot):** a red core inside the green zone on every rod (bamboo 20 %, fiberglass 30 %, carbon 40 % of the zone, progress x1.5 inside it; base fill 0.16 -> 0.135 to keep fight lengths). A fish that never leaves the green zone is a perfect catch: +1 star tier, a perfect gold-size fish is a medal (the tier above gold, a gold medal picture instead of the star row; counts as gold for checklist star slots; the price stays by size). Stored without a version bump (`BagFish.perfect`, `LogEntry.bestTier`, `Trophy.medal`). See HANDOFF for numbers and weak spots.
**Grill round 2 (decided 2026-11-24, user accepted all recommendations):**
- **Gear gated by finished checklist bundles** (coins still pay): start = fiberglass, worms, baits;
  1 bundle = braided line + smooth reel; 2 bundles = carbon rod (deep 30 m+: Pale One, Old Mossback);
  4 bundles = fluoro line + pro reel; Lantern & blanket unchanged (after fiberglass). Locked shop card:
  greyed with a lock and "Unlocks after 2 checklist bundles (1/2)". No price change now; rebalance after a
  pacing sim.
- **Camp** on the grass by the car (left), small fixed spots clear of the fetch area; for sale from the
  start, mostly cosmetic, each with one small Pajkel/Bestia moment: campfire 800 (night glow, he warms his
  hands), deck chair for Pajkel 600, Bestia's bed 1000 (she naps there), tent 1500, string lights 1200
  (night), windsock 400 (shows the day's wind), trophy board free with the first rare fish (~5500 total).
- **Perfect catch**: the fish never leaves the green zone the whole fight -> +1 star (none->bronze,
  bronze->silver, silver->gold). **Medal** only for a gold-size fish caught perfectly; shown as a gold
  medal instead of the star row in log/bag; counts as gold for checklist star slots.
- **Sweet spot**: a red core inside the green zone on every rod (bamboo 20 % of the zone, fiberglass 30 %,
  carbon 40 %); while the fish is in the core progress fills x1.5.
- **Switching owned rods**: postponed until rods differ by more than "better".

**Slices (in order):** 23a gear gates in the shop -> 23b weather (picked by real date + hour since 2026-11-24, icon by the
clock, Pajkel line, species weights, lake visuals) -> 23c new species ide/asp/burbot (data, art, log,
knowledge, quests) -> 23d rare fish (3, conditions, half-hints, "?" silhouettes in the log, harder fight,
trophy board) -> 23e camp items -> 23f perfect catch + medal + sweet spot -> pacing sim + price rebalance.

---

**Story pacing (decided 2026-11-24): chapters follow milestones, not the calendar.** Each chapter Q1-Q7 comes
only when its milestone is met, strictly in order (never before the previous one is seen), and at most 2
chapters are seen per real day (the rest wait for the next date). Old saves keep their seen chapters; the next
one waits for its milestone. Slice 24; the journal counts seven chapters ("Chapter n of 7").

| Chapter | Milestone | Source |
|---|---|---|
| Q1 | first catch | fish log |
| Q2 | first daily quest claimed | flag `milestones.quest` (also derived from a claimed quest in today's list) |
| Q3 | first catch in deep water | flag `milestones.deep` (also derived: a deep species in the log) |
| Q4 | first night visit (game clock 21:00 or later while playing; day/night versions unchanged) | flag `milestones.night` |
| Q5 | first finished checklist bundle | checklist state |
| Q6 | carbon rod owned | `rodId` |
| Q7 | 5 of 6 checklist bundles done | checklist state |

### Week of 2026-11-26: decisions (grill with the user)

Order of work: shore fiddles + Stick Museum → A2 balance + economy sim → A3 words → A3 fight/screen
feedback + sign/tap fixes → camp life and sound → M2 groundwork. Each item gets a casual-mobile-gamer
tester agent before it is merged.

**Shore fiddles + Stick Museum (pitch #1, `docs/review/11-new-features-story-pitch.md`)**
- Pebble skipping: a 3-stone cluster on the near shore left of the dock. A swipe that starts on the stones
  throws a pebble, a plain tap throws a medium one; flick speed gives 1-5 skips (rings on the water,
  "4 skips!"). Works while idle or waiting, never in a fight; a bite always wins; a press on the stones never
  charges a cast and never scares fish.
- Reward: only a best-skips record, and a Pajkel line the first time the record is beaten on a real day. No coins.
- Fetch on demand: petting stays on Bestia; a tap on the stick lying on the grass starts a fetch round at once.
- Stick Museum: the first fetch round brings a named stick, then one every 3rd round, at most 2 per real
  day; 10 sticks at Quiet Lake (a few more kept for River bend). Deadpan one-line reviews. A "Sticks" tab in
  the Log; with Bestia's bed owned, a bed tap opens it too. `PlayerState.sticks?: string[]`.

**Slice 26b: Pajkel skips the pebbles (user, after playing 26 on the phone: "just stones and numbers")**
- Pajkel throws, not Alex (she can't leave her rod). A tap on the stones: he gets up from his chair, walks to
  the stones, picks one up, crouches and flicks it sideways, watches it skip, reacts ("Five! Did you see
  that?"), and walks back after ~5 s without another tap. While he stands at the stones another tap = another
  throw. Bestia trots after him and sits by him.
- The pebble flies out over the LEFT part of the water, away from the dock, Alex and the bobber; rings and
  the "1, 2, 3…" pops sit along that stretch.
- Tap = ordinary throw (2-3 skips); a fast swipe from the stones = he really goes for it (up to 5), with a
  bigger wind-up.
- Busy (fetch, mid-walk): he finishes and comes over, bubble "One sec!". In the car or asleep: the stones do nothing.
- 5 skips: Pajkel cheers, Bestia barks once, Alex glances over. Still no coins.
- Casting no longer breaks up fetch (user, 2026-11-26): today any press (`companionPress`) sends everyone
  back to the dock at once. Instead the round in progress finishes (she brings the stick back or keeps it,
  a stick from the Museum can still drop), then they walk back; no new round starts while she fishes. A hook
  or catch during the round: Pajkel cheers from where he stands. Bedtime and the car still interrupt at once.

  *Built (2026-11-26, branch `slice/26b-pajkel-pebbles`, not merged):*
  - Fix (phone feedback: "long arm when picking up", he stood on the trophy board): new `crouch0`/`crouch1` frames (knees bent, short arm to the stones, then a stone lifted) replace `bend` for pebbles; he now stands at (122, 479) right of the stones, clear of the board and fire, and Bestia sits at (150, 484) facing left toward him (the stand/sit numbers below are the old ones).
  - New `Mode` `'shore'` with a pure `ShoreState` in `behaviour.ts` (phases `walk` -> `pick` -> `windUp` -> `flick` -> `watch` -> `react` -> `idle`, `SHORE_TUNING`). He stands at (80, 479) left of the stones facing the water, Bestia sits at (54, 485). `pebbleRequest(s, throw, fishing)` answers `started` / `queued` / `no`; the scene takes the pebble when it leaves his hand (`takePebbleRelease`) and reports where it sank (`pebbleLanded`). After 5 s with no tap he walks back (`returning`).
  - New frames: `flick0` (arm back, a stone pinched in the fingers) and `flick1` (arm swung forward); a big wind-up is the `bend` lean for 0.6 s and then the arm back (1.1 s in all, a tap is 0.38 s). The standing cheer reuses `stretch0` / `stretch1` (no new art), shape `rejoice`.
  - Tap = 2 or 3 skips (coin flip), a swipe by its speed 1-5; a swipe of 3+ skips is the big wind-up (`Throw.big`). Pure route in `src/scenes/pebbleRoute.ts`: every touch-down is left of the dock (x 14-100), rising towards the far water; the swipe's sideways part moves it by up to 20 px. The "1, 2, 3" pops and rings are unchanged, only the points moved. Alex no longer flicks (her arm flick is gone).
  - Busy: mid-round or mid-walk (`leaving` / `returning`) the request is kept (`pebbleWant`), he says "One sec!" and goes to the stones as soon as the round is counted (or the walk is done, with no round started). In the car, asleep, on the way to bed: nothing. While fighting, a show-off, charging or casting: nothing; a throw queued before the fish was hooked is dropped.
  - 5 skips: `rejoice` cheer for 2.4 s with one of three lines ("Five! Did you see that?"), Bestia's one "Woof!" pop (and the `boof` sound), Alex glances left for ~1.8 s. The record rules are unchanged; a five that is also a record keeps its own line and the toast still says "New best!". Lesser throws: a short cheer for 3-4, now and then a small word (`SKIP_MID_LINES`, `SKIP_LOW_LINES`).
  - Casting no longer breaks up fetch: `companionPress` mid-round sets `PlayState.after = 'dock'`; the round plays to its end (counted, a Museum stick can still drop), then they walk back, and no new round starts (the round-end check runs before the next phase). Between rounds they still go at once. A bite no longer sends them back at all; a hook or catch during fetch or at the stones is cheered from where he stands (`rejoiceMs`). At the stones a press lets him finish the throw in hand (from `pick` on), then he walks back. Bedtime and the car still interrupt at once.
  - Bubble: out on the left shore it wraps to 140 px so it stays clear of Alex.
  - Deviations / choices: "no new round while she fishes" is read as "the round in progress is the last one"; after the walk back the old rule stays (25 s of idle or waiting and they may go out to the grass again). A cast does not cancel a throw already in his hand. The stones now stay tappable in a bite window too (it only asks Pajkel; he keeps throwing while the fish is not hooked). The pebble thrown by `?debug=pebbles` has no Pajkel behind it (the flag only draws the flight).

**Balance (review A2, all accepted)**
- Economy: a bot sim first (is the "whole shop in ~85 min" real?), target the whole shop at no less than
  ~6 h of play over ~5 real days. Levers in order: a 2-minute cooldown between naps (never an energy bar),
  deep-night prices ~15 % lower, then camp prices x1.5 if still fast. The sim also measures fresh save → all
  six bundles (a tester did every quest in one day); M1's goal is ~4 real days.
- Perfect catch: ~300 ms total grace outside the green zone; aim 15-25 % perfect for a skilled player on top gear.
- Gear gates by bundle: carbon rod after "The Bottom of Things", fluoro line + pro reel after "Night Shift".
- Corn 15-20 coins per 10 with the unused calm effect; maggots 0.6 → 0.45; dawn added to the Dawn Chorus
  fish; asp exempt from the shallow difficulty cap; sunny weather really changes bites; fog visible all hour.

**A3 + M2 (accepted)**
- Remove the top-right notice-board button; the shore sign must then be reliable: it works while the bobber
  is out (today `tapSign` silently ignores anything but idle), its tap box is generous, and a mouse click
  never turns into a cast.
- Rod flick on shore taps: a press on a shore object (car, sign, crate, chair, board, stones) does not start
  the charge at once; the charge starts only if the press is held past a delay (~350 ms) or the finger leaves
  the object, so a tap never moves the rod.
- Render scale capped at 3x. River current: no forced auto reel-in, fights get a pattern instead of one-sided
  drift, Ferry Pike band 18-26 m (design docs only this week).
- Later: "DS4" stays, Bag into Shop, bedtime dim mode, the "— P." personal notes.


## 6. Workflow

- Work in small vertical slices, one branch per slice (`slice/NN-name`).
- Each slice: core logic + tests, then the scene layer. Reviewed (diff) and play-tested before merge.
- Run locally: `npm run dev` (exposed on the LAN, so a phone on the same Wi-Fi can open it).

### Slice plan

1. Lake scene, hold-to-charge casting, bobber, distance zones ✅
2. Game clock (day/night) + bite system (nibbles, hook window) ✅
3. Art pass: hand-authored pixel-art sprites, day/night palettes ✅
4. Characters: Alex + Pajkel (¾ back view), the dog, idle play, petting, name entry (§2b) ✅
4b. Standing Alex: slimmer, clearer hair, facing the lake with occasional glances (§2b) ✅
5. Catch bar fight + front-facing "show off the catch" pose (details in §3) ✅
6. Fish data, spawn rules, sizes, catch result ✅
7. Bag, shop, coins, rod upgrades ✅
8. Fish log + personal bests ✅
9. Saving (local + export code, ⚙ panel; details in §3 item 8) ✅
10. Sound + second art pass (details in §3 item 9)
    - 10a. Sound ✅
    - 10b. Art pass (pixel font, panels, fish sprites, polish, Pajkel, dog fetch) ✅
11. PWA + GitHub Pages deploy (details in §3 item 10) ✅
11b. Readability polish (device-resolution canvas, VT323 font, update-toast position) ✅
12. Legendary fish: The Pale One (details in §3 → Slice 12) ✅
13. Daily bait box + daily quests (§5; details in §3 → Slice 13) ✅
    - 13a. Daily bait box ✅
    - 13b. Daily quests ✅
14. Lake moments (details in §3 → Slice 14) ✅
15. Progression (details in §3 → Slice 15a / 15b / 15c)
    - 15a. Prices by rarity, lines and reels, clock label, Pajkel's speech bubble ✅
    - 15b. Shop icons
    - 15c. Baits
16. The car, bedtime, naps and the night kit (details in §3 → Slice 16)
17. "No take, only throw" fetch (details in §3 → Slice 17)
18. Road map on a car tap, new places "coming soon" (details in §3 → Slice 18)
19. Size stars + fish of the day (details in §3 → Slice 19)
20. Lake checklist on Quiet Lake (details in §3 → Slice 20)
21. Story chapters, Quiet Lake (details in §3 → Slice 21)
22. Polish pass (M1): 22a Pajkel's chair + sticks, 22b friendlier panels, 22c hints + shore sign (§3 → Polish pass; `docs/ui-review/UI_REVIEW.md`), 22d bigger sign + story journal, 22e fish knowledge (§3 → Slices 22d + 22e)
23. River bend: art, fish, travel (planned, M2 in ROADMAP.md)
    - **Slice 25d "River fish"** (built on `slice/25d-river-fish`, RIVER_BEND.md section 5 and section 9 item 4): six new normal species with pixel art and facts: brown trout (riffle, dawn+dusk, uncommon, darting, rain/overcast), grayling (riffle, day, uncommon, floater, sunny), nase (riffle, day, common, smooth, sunny), chub (any hour, common, smooth, not fussy), barbel (seam+pool, dusk+night, uncommon, sinker, rain), vimba (seam, dawn+day, uncommon, smooth, overcast). River pools replace the stand-ins: riffle = nase, trout, grayling, small chub; seam = chub, asp (weight 5, common here), barbel, vimba; bend pool = barbel, big chub, plus perch and pike as visitors. The lake pool no longer includes the six, so no river species bites at Quiet Lake and no lake species (bar asp, perch, pike) bites at the river. One fish log: "Log n/25"; each card has a "where" line (Quiet Lake, River bend, or both) and a river species names its bands ("Riffle, Seam, Bend pool"). Daily quests and the fish of the day only pick a species that can bite where her rod reaches at the place she is at. The chub's fact is the story R5 wink, used as its fact from the start.
24. A3 words pass (docs/review/08 item 12): custom names everywhere as `{player}/{companion}/{dog}` placeholders (plus `{place}`, `{water}`) filled by `src/i18n/en.ts`, quest grammar (a/an, eel/ide plurals), no non-VT323 glyphs, location-aware and time-aware lines. Built on `copy/a3-words`, not merged. Open for later: moving the remaining scattered strings into `src/i18n/`, Polish plurals.
26. Shore fiddles + Stick Museum (built on `slice/26-shore-fiddles`, from "Week of 2026-11-26: decisions"):
    - Pebble skipping: three flat stones on the near shore left of the dock (Quiet Lake only, `Spots.stones`, x 93 y 460). A press on them (idle or waiting, never in a bite/fight/show-off/panel) never starts the cast charge, never reels in and never reaches the state machine; on release a tap throws a medium pebble (3 skips), a swipe by its flick speed (speed over the last 110 ms: 0.3 / 0.7 / 1.2 / 1.9 px per ms for 2-5 skips, slower 1) and drifts sideways with the swipe. Alex flicks her free hand, a 2 px pebble arcs out, a ring and a plop at every touch-down (n + 1: the last one is where it sinks), then the line "4 skips!". Reward: only `skipsBest` and one Pajkel line (`SKIP_RECORD_LINES`) the first time a record is beaten on a real date (`skipsLineDay`; not for a lone skip). No coins.
    - Fetch on demand: a tap on a stick lying on the grass makes Pajkel take that stick as his next one and throw it at once (`fetchStickNow`). Only while they play on the grass, between two rounds (rest, giveUp, toStick); with no stick on the grass, or asleep, in the car, on the dock or mid-chase, nothing changes (the press goes on as usual). Petting stays on Bestia.
    - Stick Museum: `core/sticks.ts`: the first finished fetch round brings a stick, then rounds 4, 7, 10, ... (every 3rd after the first), at most 2 new sticks per real day (`stickDay`/`stickDayN`; a capped stick round is not made up), the next unfound stick of the place in data order. 10 Quiet Lake sticks plus 3 for the River bend in `core/data/sticks.ts`, each with a deadpan review. Toast "Bestia found: The Crooked Fork". Log panel: a Fish | Sticks tab bar, found sticks with picture, name and review, the rest a dim "???", "Sticks n/10" on the tab; with Bestia's bed owned, a tap on the bed opens it (a hold still casts).
    - Deviations / choices: "every 3rd round" is read as rounds 1, 4, 7 (not 3, 6, 9); the round counter is global, not per place; the stick is shown on the sprite variants unchanged (tilted, grass shadow row removed), no tint; the bed tap is a new `ShoreObject` so it follows the tap-opens / hold-casts rule of the other shore things.
    - Dev flags: `?sticks=all` / `?sticks=N`, `?debug=sticks`, `?debug=pebbles&pebbleAt=ms`, `?debug=fetchround` (all sandboxed like every flag).
A3. A3 feedback (built on `feel/a3-feedback`, from "A3 + M2"):
    - Shore taps never move the rod: a press on the car, sign, crate, chair, board or bed sends nothing; released within `OBJECT_HOLD_MS` (350 ms) on the object it is the object's action; held longer, or slid off, the charge starts then from zero (`objectPressOutcome` in `core/tapHold.ts`). The stones keep their own press handling.
    - The top-right notice-board button is gone; the sign is the way in and now also works while the bobber is out (quests and story tab; the line stays in the water). A chapter or the bottle while waiting shows "Reel in first to read the story". Sign tap box is 60 x 62 (x 248-308, y 438-500), still clear of the dock end.
    - Fight: a gold star above the bar while the run is still perfect, greying and cracking when she leaves the green; the red sweet-spot core has a white edge (solid top and bottom, dashed sides) for red-green colour blindness.
    - Catch card: size text and stars centred as one group; Pajkel's praise line waits until the card is dismissed so it never covers Alex; the clock's weather icon has more right padding.
    - A checklist bundle hand-in that opens shop gear toasts "New gear in the shop!" and puts a gold dot on Shop until it is opened (session only, not saved).
    - Settings: a Vibration On/Off switch (`haptics` in the device settings, default on); every `vibrate` respects it.
- **M2 groundwork A** (merged 2026-11-26, from "Week of 2026-11-26: decisions" and review item 13):
    - Per-zone fish pools: `Zone.fishPool?` (species id to weight multiplier) replaces the location pool for casts landing in that band; `poolAt(location, distanceM)` in `core/location.ts`, used by `fishingSession` when the bobber lands. Quiet Lake has none, so its candidates, weights and picks are unchanged (test in `zonePools.test.ts`). River bend placeholders: riffle roach+perch, seam asp-heavy, pool pike+bream, TODO for the real river species (slice 25d).
    - Render scale cap 3 (`MAX_RENDER_SCALE`, pure `renderScaleFor`, tested); `repaintSky` reuses one buffer.
    - Docs only: RIVER_BEND.md and ROADMAP M2 revised (no forced auto reel-in, river fights surge instead of one-sided drift, Ferry pike band 18-26 m, R4 fallback trigger), each marked "(decided 2026-11-26)".
- **M2 groundwork B** (branch `m2/groundwork-b`, not merged; review item 13, the rest of it):
    - Companion spots per place: `Spots.companions: CompanionSpots` (`core/location.ts`, data in `core/data/locations.ts`) holds the chair and the dog's lying spot, the two waypoints down from the landing, the landing/grass line (`grassY`), where play starts, the car spots, the fire keep-off zone, the bedtime zigzag ranges and `shore` (the pebble outing: stand, dog spot, waypoints; `null` = no stones). The lawn is `Spots.playArea`, the fire and the dog bed come from `Spots.camp`. `createCompanions(rng, spots)` stores `spots` on the state, every function in `behaviour.ts` reads `s.spots`, `setCompanionSpots` re-homes a live family; `CompanionView` takes the spots and `LakeScene` passes its own (two lines).
    - Quiet Lake is unchanged: the data is the old constants and `spots.test.ts` pins them literally; the exported names (`PAJ_SPOT`, `PLAY_AREA`, `DOG_BED_SPOT`...) stay as the Quiet Lake defaults, so every old behaviour test passes untouched.
    - River bend: the river art (25b) kept the lake's near shore, so landing, car, camp and the grass lawn are the same points; only `shore: null` differs (no stones, `pebbleRequest` answers 'no'). A test checks every point and a 90 s fetch and the nap walk are on the landing or dry bank (`riverWaterline`, `HUT_BOX`), never in the river.
    - River current ambience (`audio/ambient.ts` layer `current`, levels by the pure `riverMix` in `core/ambientMix.ts`): three band-passed noises (a dark body with a very slow swell, a wandering mid babble, a thin gurgle), no rain-like hiss. Plays only where the background is the river (`Sound.setRiver`, called with the place), steady 0.75, 0.82 under overcast, full in rain (high water); the lake's lapping ducks to 0.35 there; the Pale One's fight silences it. It follows the existing mix, the ambience volume and the pause fade. On the `?debug=sounds` board as the solo layer `current`. The levels are unit-tested; the sound itself has NOT been heard (no ears here): tune by listening.
    - Not done: Pajkel warming his hands, aimed casting, place-specific chair art (the landing is still the dock art).
A2. **Balance A2 (2026-11-26, built on `balance/a2`, not merged)**, numbers in `docs/ECONOMY_SIM.md`: bot sim of the economy (`src/sim`, `SIM=1`); gear gates by bundle (carbon after The Bottom of Things, fluoro + pro after Night Shift, braided + smooth after one main bundle, Duck Tax and Petrol Money never count; lock text names the bundle); perfect catch forgives 300 ms in total outside the green zone; corn 18 coins per 10 and calms the fight (`Bait.calm`, `fightGear`), maggots wait x0.45; roach, rudd and bleak also bite at dawn; the asp is exempt from the shallow cap; sunny now speeds shallow bites x0.8 and slows deep ones x1.25 (a per-zone weight cancelled out); fog (look and rare-fish weight) lasts the whole fog hour, never thinner than a 0.5 mist; economy levers in order: 2-minute nap cooldown with a kind countdown on the nap card (no effect on the farm, see sim), deep-night catches (02:00-05:00) sell x0.85, camp prices x1.5 (campfire 1200, deck chair 900, bed 1500, tent 2250, lights 1800, windsock 600); story catch-up capped at 3 chapters a real date. The 6 h shop target is NOT met (4.2 h normal, 3.4 h abuser); proposal in ECONOMY_SIM.md.
27. **Camp life and sound (2026-11-26, built on `slice/27-camp-life`, not merged)** — pays off the 5,500-coin camp; the user picked the "Camp life and sound" option:
    - Bestia sleeps in her bed (only with the bed owned): after a play-session's happy spin she naps (always at night, 50% by day, `napDue`): trots to the bed (`napGo`), circles once (`napCircle`, 1.4 s), lies curled for 20-34 s (`napCurl`, new `curl` dog shape, two breath frames: chest up 1 px, 2.2 s a breath), gets up (`napWake`) and the play goes on (`rest`). A tap on her wakes her at once, head up and wagging, with the petting heart; a stick tap, a cast (press) or the 02:00 bedtime also end it. Pajkel just stands on the lawn meanwhile. Pure and tested (`behaviour.ts`, `nap.test.ts`).
    - The bed is redrawn 28x12: raised bolster rim lit along its top edge, a dark front wall, a darker hollow with a warm cushion, and its front rim is drawn again over her while she sleeps, so she lies IN it.
    - Campfire: in rain it dims to about 45% light, the flame stays low (the small frame), the logs go grey, sparks nearly stop and smoke rises; a dry dusk/night flickers livelier (a slow swell plus now-and-then brighter lick) and casts the warm light as before. Pajkel warming his hands: NOT built (the fire stands 90 px from his chair and the nap leaves him standing; it would need a new pose in the walk-size frame set).
    - Tent: a soft warm glow from inside at dusk and night (lit cloth, amber doorway, faint halo on the grass), a little softer in rain.
    - Sound beds (procedural Web Audio, no samples; `audio/ambient.ts`, levels by `core/ambientMix.ts` `weatherMix`): rain (hiss, shimmer, patter and scheduled soft droplets) when raining; wind (two drifting band-passed noises with gusts) full when windy, a hint under rain and overcast; campfire (soft roar and scheduled crackles) when owned and dusk to dawn (17:30 up to 20:00, gone by 06:00), 55% in rain. Rain and wind duck the birds. They follow the same bus mixing, volume settings and pause fade; silenced in the Pale One's fight. All on the `?debug=sounds` board (solo switches, a weather row, the time slider; the board plays the fire whatever you own).
    - Stingers: `trophy` (a rare fish on the trophy board; slow warm call and a held C major chord with a shimmer) and `medal` (perfect gold; a quick bright ding-ding-DING struck like metal); `core/catchSound.ts` `catchJingle` decides (trophy before medal; the Pale One keeps the fanfare). Everyday catch and fanfare unchanged.
    - Dev flags: `?debug=bedrest` (owns the camp, Bestia asleep in her bed; add `&time=23`); `?camp=all`, `?weather=rain` and `?time=` already existed.
28. **Line fight "feel the line" (2026-11-26, built on `slice/28-line-fight`, not merged)**: the second catch style behind a Classic / Line toggle, from "Catch mechanic v2" above.
    - **Core** (`core/lineFight.ts`, tunables in `core/data/lineFight.ts`, pure, seeded RNG, fixed 120 Hz substeps like the bar): the state holds the fish's distance from the dock (starts at the hook distance), tension 0..1, the
      lateral offset, the surge phase (calm, telegraph `warn`, `hush` for a feint, `run`), the slack and red timers and the totals for the perfect catch. Holding reels the fish in (speed = a share of the starting distance
      per second, slower the harder the fish, and braked by a surge) and pulls the tension toward `0.45 + 1.6 x pull`; letting go eases it toward `0.02 + 0.35 x pull`; a surge takes line (`surgeRun`) and makes the tension climb faster.
      A cut (sideways dart) jerks a taut line by `cutKick`. Caught at distance 0. Slack (tension < 0.12) for 2 s in one go (1.3 s for a trophy) = the hook slips; time at or above the line's snap limit builds against the rod's flex
      budget and drains slowly (3 %/s: a short mistake is forgiven, a long fight is not) = the line snaps. Perfect = won with at most 40 ms in the red and 500 ms in slack in total.
    - **Personalities** from the existing pattern + difficulty (every range blends easy to hard by difficulty^0.75): `smooth` long steady surges (2-3.4 s), `darting` short sharp surges and big sideways cuts that yank the line,
      `sinker` a heavy steady pull and slow-to-fall tension, `erratic` surges out of the blue with uneven strength, `floater` mild, `abyssal` (the Pale One) a calm drift then a very hard dive. Difficulty shortens the telegraph
      (0.5-0.85 s on easy fish, 0.1-0.2 s on the hardest), strengthens and quickens the surges and speeds up how fast the tension climbs. Trophies keep one signature move each (`SIGNATURE_MOVES`, one surge in three):
      golden tench `flash` (two strong surges back to back), silver ghost `feint` (the splash, then it goes limp and the line sags, then it bolts), Old Mossback `dive` (a very long heavy pull, long warning). A lost trophy keeps the
      `slipped` flag ("It slipped the hook!").
    - **Gear:** rod -> flex budget in seconds in the red (`0.95 + 10 x (zoneSize - 0.3)`: bamboo 0.95, fiberglass 1.35, carbon 1.75; trophies x0.85); line -> snap limit (`0.76 + 0.35 x (1 - lineDrain)`: plain 0.76, braided 0.81,
      fluoro 0.86; shown on the gauge); reel -> reel speed (`reelResponse`); bait -> corn's calm weakens surges by up to 15 % and stretches the calm gaps by 1.33x.
    - **Same outputs:** `core/fight.ts` is the one seam (`beginFight`, `holdFight`, `tickFight`, `CatchStyle`); the session calls only those three and builds the same `fishCaught` (size, perfect, fight time) and `fishLost` events
      (`slipped` for a slipped hook or a trophy, new `snapped` for a snapped line) whichever style; quests, stars, medals, the log and the trophy board are untouched. The style is read when the fish is hooked (`ctx.catchStyle`);
      in the line style the state's `bar` is an inert placeholder (only `holding`/`elapsedMs` are kept in step) and `line` carries the fight, so every old `state.bar` reader (sound, tests) still works.
    - **View** (`scenes/LineFightView.ts` + LakeScene glue): the fish is a dark fish shape in a swirl at the end of the taut line, on the water at `distanceToY(distance)` (it comes closer as it is reeled in) and sideways by the
      lateral offset; the line runs from Alex's rod tip to it (sags when slack, straight when steady, trembles and reddens near the snap), the rod bends with the tension. The telegraph is a swelling splash, rings, spray and a bold "!" over
      the fish plus a short haptic pulse and the nibble sound; the pull is a big churn, a wake, and chevrons pointing where it runs plus a heavier pulse; near the red a buzz. A half-round gauge by the reel (slack grey and dotted ·
      steady thick gold · amber · red with teeth, a needle, tick marks) says the rest by position and shape, with the distance in m under it, a red "snap" bar and a grey "slip" bar that appear when either danger builds, and the perfect star
      above it (gold while clean, grey and cracked after). No vertical bar. The hint "Hold to reel · let go when it pulls" shows for the first three line fights of a session.
    - **Toggle:** Settings -> Fishing -> "Catch style: Classic / Line" (`catchStyle` in the device settings, `core/soundSettings.ts`, default Classic); dev flag `?catch=line|classic` (sandboxed; wins over the setting, and the
      Settings panel says so).
    - **Tuning sim** (`src/sim/lineFight.sim.test.ts`, `SIM=1`; numbers in `docs/ECONOMY_SIM.md` -> "Line fight"): the decent bot's catch rates are within 10 points of the classic bar's decent bot in every species / rod cell except the golden
      tench (+14 / +20); the skilled bot's perfect rate on darting fish at top gear is 19 % (classic 11 %). Easy fish are always perfect for a skilled player (weak spot).
    - **Harness:** `fight-line [--mode decent|hold|never] [--until warn|surge|steady|red|caught]`, and `fight` is style-aware (docs/PLAYTEST_HARNESS.md).
    - **Deviations:** (1) the reel speed is a share of the starting distance per second (not metres per second) so a 25 m fight is not twice as long as an 8 m one. (2) "Snap loses the bait in use": the worm is already spent on the cast
      (as in every lost fish), so a snap takes nothing extra; gear is never touched. (3) Slack for a non-trophy fish reports `slipped` too (a new toast, "It slipped the hook!"), a snap "The line snapped!". (4) The perfect rule is
      40 ms red / 500 ms slack in total (the classic grace is 300 ms outside the zone). (5) Trophies slip after 1.3 s of slack instead of the classic 2.5 s outside the zone, and have x0.85 of the rod's flex.
    - **Not done / weak spots:** the line fight has not been played on a phone, only through the harness bot (which sees the telegraph perfectly), so how the real thumb copes with 0.1-0.2 s telegraphs on hard fish is untested; the haptics
      and the nibble cue are unfelt/unheard; the tension gauge is small (a 26 px radius) and sits on the water left of Alex, it can be covered by Pajkel's speech bubble; a fish far away is a small shadow; easy fish are
      always perfect and the roach can be landed by holding forever; golden tench is easier than classic; fights on the hard deep fish are 30-40 s (classic 20-30 s).
    - **Tester fixes (same slice, 2026-11-26):** every surge and every sideways cut is telegraphed for at least 0.35 s (a side splash + arrow for a cut; hard fish 0.35-0.45 s, easy fish keep 0.5-0.85 s); a passive player loses the fish after 4 s of calm
      with the thumb up at any depth (`releasedSlipS`) and a 60 s safety net now says "It got away" (new result `escaped`, no slip flag); the fish tires over the last 3 m (surge strength falls to 20 %) so the end is a short pull; the gauge draws gold
      exactly up to the snap limit and the red from there (the amber band is gone), red time drains 4x faster inside the gold, and in the red the red zone flashes, the rod tip shakes and the perfect star greys at once; `?debug=fight` starts with the thumb up.
      Sim: see ECONOMY_SIM "Line fight" (golden tench still +20..+26; skilled perfect rate on darting fish is now 77 %, far above the aim).
29. **Shop per place (2026-11-26, built on `slice/29-shop-per-place`, not merged)**: what the shop sells depends on where she stands, per "Shop per location" above. Each `Location` has a `shop: ShopStock` (`core/data/shopStock.ts`): item ids by section (`bait`, `gear` = rods, lines, reels and the night kit, `camp`) plus an optional `gearEmpty` line. Worms and the basic packs (corn, maggots, strip) are sold everywhere; Quiet Lake sells exactly what it sold before (pinned by a test with the old item list); River bend has the basics, an empty "River gear" section saying "W.'s river tackle comes later" and no camp items (the camp is at the lake). The pure buy functions (`buyWorms`, `buyBait`, `buyRod`, `buyLine`, `buyReel`, `buyNightKit`, `buyCampItem`) take the stock as a last argument (default Quiet Lake) and refuse an item not sold there with the new error `notSoldHere`; owned gear stays owned and usable everywhere, and the checklist gates still decide when lake gear can be bought. The shop panel is titled "Shop · Quiet Lake" / "Shop · River bend" and simply leaves out what the place does not sell; selling fish works everywhere. Tests: `core/shopStock.test.ts`.
30. **Feeding Bestia (2026-11-26, built on `slice/30-feed-bestia`, not merged)**: the rules of "Feeding Bestia" above. **Bowl:** a small blue bowl (`art/bowlArt.ts`, 20 x 11, empty and with kibble) stands free on the grass by the car from the start, `Spots.bowl` (Quiet Lake x 22, y 572 top-left; the River bend inherits the same ground, so it is there too), a generous tap box (a thumb of room all round, clear of the car's box and the bottom bar). It is a shore object like the sign (`ShoreObject 'bowl'`): a quick tap acts, a hold still casts, the tap never moves the rod, it works while idle or waiting (not in panels, fights, the show-off, the sleep fade); petting Bestia wins where she stands at it. **Treats:** "Dog treats x5", 25 coins (`core/data/treats.ts`), in `BASIC_BAIT` so every place sells them, a bone-biscuit icon (`shopIconSprite('treats')`), a card in the Bait section with "(have N)"; `buyTreats` in `core/inventory.ts`. **Rules (pure, `core/feeding.ts`):** `checkFeed` ('ok' | 'noTreats' | 'full'), `feedDog` (the treat leaves the bag, today's count +1, the first feed of a real day sets `cozy`), `spendCozy`, `normalizeFeeding`; `finishFetchRound` counts a round as a stick round when `cozy` is set (the bonus is spent by that round whatever comes of it; the 2-new-sticks-a-day cap and the full museum still apply). Saved in PlayerState, each key only when set: `treats`, `fedDay` + `fedDayN` (clamped to 3), `cozy`. No hunger and no stats. **Scene flow:** a tap with treats asks the companions (`feedRequest`); the treat only leaves the bag when she has finished eating (`Companions.fedCount` rises, the scene's `updateFeeding` applies `feedDog`, floats the heart and, on the first feed of the day, has Pajkel say "Spoiled. Good." through `tr`), so an interrupted meal costs nothing. Lines (`EN` in `i18n/en.ts`): "Out of treats. The shop has some.", "She's full. Look at that belly.", "{dog} is asleep." (car, asleep at night), "Bedtime first." (bedtime). **Behaviour (`scenes/companions/behaviour.ts`):** an overlay on the mode, `Companions.feed` (`go` -> `eat` 2 s, a 2-frame munch (dog shape `eat`, `art/characters.ts`) -> `wag` 1.3 s -> `back`), driven from its own position because the dock and the lawn reset hers every tick; the lawn and stones modes are paused while she eats (he waits where he stands). She starts at once from the dock (the idle walk to the lawn waits), the lawn between rounds (`rest`, `spin`, `drop`, her nap phases: she leaves her bed and the game restarts with a `rest`) and the stones (`idle`, `react`); mid-round, mid-throw or on the walk the treat waits (`feedWant`, the bowl already shows kibble) and she goes as soon as it is calm; a fetch round in progress is played to its end and the game ends there. Never from the car, never asleep at night (dock sleep or curled in the bed), not during bedtime (the start of bedtime clears a waiting treat); bedtime and the sleep fade wait for a meal in progress (`calmForBed`). A cast mid-meal lets her finish, then `companionPress` is replayed; a pebble tap mid-meal is refused. Tests: `core/feeding.test.ts`, `scenes/companions/feed.test.ts`, `art/bowlArt.test.ts`.
