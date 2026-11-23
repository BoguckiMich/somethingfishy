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
| *Legendary* | deep | ? | | | | | slice 12 |

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

Tuning (prices, spawn weights, difficulty) lives in data files under `src/core/data/` so it can
be tweaked without touching logic.

---

## 4. Roadmap

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

- **Bedtime at 2 AM & night gear** — the angler has to sleep: at 02:00 the day ends and she wakes
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

- **More gear** — other bobbers, line types, reels and so on, each tweaking the catch bar
  (line → drain, reel → zone responsiveness, bobber → bite readability?). v1 has only the two
  rod upgrades.

- **Fun facts on catch** — a short real fact about the species when caught (or in the fish log).
  Each species already has one `fact` in the data (slice 6). Slice 8 shows it on the first catch
  and in the log. Polish pass: a rotating pool per species, then maybe a fact on every catch.

- **Livelier companion reactions in the fight** — Pajkel leans in or cheers during the fight,
  Bestia watches the line. Slice 5 only adds small reactions on a catch or loss.

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
11. PWA + GitHub Pages deploy (details in §3 item 10) ← *in progress*
12. Legendary fish
13. Daily bait box + daily quests (§5)
