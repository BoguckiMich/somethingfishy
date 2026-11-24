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
  0.5 silver, 0.8 gold. With the length skew (u², `FISH_TUNING.lengthSkew`) that is about
  50% none, 21% bronze, 18% silver, 11% gold. Thresholds in data (`core/data/stars.ts`), pure
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
    spoilers); the header says "Chapter n of 8". A dot on the Story tab when a new page was added
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
- Built as (22d): sign 36x38 (feet (276, 498)), notes 6x7 at x 5/15/25 with dark writing lines, the claimable note has a gold rim, a 3x3 gold pin and a breathing gold glow (two translucent rectangles, drawn by the scene), the waiting chapter is a 12x8 cream letter with a 6x6 red wax seal; tap area 56x56 (x 248-304, y 444-500), checked before the dog and Pajkel. The notice board ("Notice board") has Quests and Story tabs (the shop's tab style); Story shows the seen pages oldest first (by the date seen, chapter order within a day; Q8 last once the checklist is done; the Pale One by `paleOn`, or after the dated pages when an older save has none), each with an icon (story bottle, duck, blink star, footprints, car, pale fish), the bottle's note or a one-line description, and the thought in italics signed with the player's or companion's profile name; subtitle "Chapter n of 8" (the Pale One page is a bonus and not counted); an empty journal says "No pages yet"; a gold square on the Story tab while a page is new (opening the tab marks it read). `StoryState` gained `blinkNight`, `paleOn`, `looked`. Dev: `?journal=all`, `?debug=quests&tab=story`.
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

### Ideas (not scheduled)
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

---

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
