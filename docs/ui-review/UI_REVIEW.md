# UI and character review (M1 polish pass)

_Written 2026-11-24 from `main` (36534b3). Sources: the 20 screenshots in this folder (360x640 at 2x),
`/dev/char-sheet.html`, and the code in `src/ui/`, `src/scenes/` and `src/art/characters.ts`. No code was changed.
Sizes are **game pixels** (the 360x640 world, about 1 CSS px on a 360 px phone) unless they say otherwise.
Colours are names from `PAL` (`src/art/palette.ts`) or `COLORS` (`src/ui/panel.ts`)._

**Decisions taken from the first round of questions** (2026-11-24). Pajkel answered Q4 and said nothing about the
other four, so the review goes with the recommendations. Any of them can still be overruled:

| # | Decision |
|---|---|
| 1 | Pajkel sits on a **low folding camp chair**, in the same spot, ¾ back view as now |
| 2 | He drinks from the **thermos lid cup**: a 3-frame sip, sometimes a pour first, a wisp of steam |
| 3 | M1 gets **gentle hints only** (a hint line that knows what you need, first-time glints). The real tutorial stays in M3 |
| 4 | Pajkel's idea: the quests open from a **notice-board sign on the shore**, not a HUD button. The worm counter leaves the top HUD, and the pencil (rename) moves into ⚙ Settings |
| 5 | At most **2 old sticks**, inside a smaller play area. Each one fades after 30 s. Bestia herself is not touched |

Why the sign is better than a "Quests" button: it is part of the world, like Stardew's board by the shop or the
crate and the car here. It frees the whole top-right corner. It can be a big tap target without cluttering the HUD.
The planned story chapters (ROADMAP M1: "wax-seal badge on the notice board") also need a place to pin a sealed
letter, and a real board gives them one. The downside is that a new player may not know it can be tapped. The
first-time glint (fix #1) covers that, the same way it covers the car and the crate.

---

## 1. Top 10 fixes, ranked by how much they help a new player

### 1. A hint line that knows what you need, and first-time glints · M
- **What's wrong:** "Hold to charge, release to cast" sits there for ever whenever she is idle (`01`, `02`, `03`,
  `13`, `18`, `21`). After the first minute it is noise. Meanwhile nothing tells a new player that the car, the
  crate, the notice board and Bestia can be tapped. The crate has a tiny sparkle (`01`), the others have nothing.
- **Why it matters:** this is the first-time player's only teacher until the M3 tutorial. A message that never
  changes is ignored, so the one time it says something new ("Out of worms, visit the shop") nobody reads it.
- **Fix:**
  - The idle hint picks **one line by priority** and is hidden when nothing applies (the frame goes too):
    1. no bait at all → "Out of worms, visit the Shop" (as now)
    2. fewer than 3 casts ever → "Hold to charge, release to cast"
    3. bag full → "Bag is full: sell at the Shop"
    4. bait box waiting and never opened → "A package on the dock! Tap the crate"
    5. a quest ready to claim → "A quest is done: check the notice board"
    6. otherwise nothing.

    Lines 3-5 show for 6 s once per occasion, then go quiet. The non-idle lines stay as they are (charging,
    waiting, TAP NOW!, fight, catch).
  - **First-time glints:** the crate's sparkle (the existing `+` twinkle) is reused on the **car, the notice
    board, Bestia and the crate**. Each one twinkles every ~4 s until it has been tapped once. No arrows, no
    text bubbles.
  - The "seen" flags live in `PlayerState.seen?: string[]` (optional, normalised, no version bump, the same
    pattern as `notes`). A pure `core/tips.ts` picks the line and the glints and is unit-tested.
- **Wording rule:** say "Tap the crate", never "Click". Keep the full stop out of one-line hints (as now).

### 2. Notice-board sign on the shore; empty the top-right corner · M
- **What's wrong (`01`, `07`):** two 30x26 buttons top right. The notice-board icon is a brown square with
  white dots that reads as "dice" or "window". The pencil says nothing about names. The red "!" badge (`07`) is
  the only red in the game and it nags. Both are below thumb size.
- **Fix:**
  - **A sign** on the grass right of the dock: two posts and a small plank board, about 24x26 px with feet at
    about (276, 498). That is above the play area (y ≥ 508) and right of the dock's edge (x 240). The tap
    area is **48x48**.
  - Use the wood colours (`woodDark` posts, `wood`/`woodLight` board, outline) with **cream paper notes**
    (`cream`, 4x5 px each): one note per unfinished quest.
  - A quest that can be claimed shows as a note with a **gold pin** (`gold`) and a slow 2-frame flutter. That
    replaces the red "!". Story chapters can pin their wax seal there later (`redDark` blob on a cream note).
  - Tapping the sign while idle opens the existing quest panel. While she isn't idle, the tap does nothing and
    no glint shows.
  - **The pencil** moves into ⚙ Settings as a "Names" section ("You / Your fishing buddy / The dog" plus a
    "Save names" button, reusing `nameOverlay`'s fields).
  - The catch bar can then move up into the freed corner if the fight needs room (not required).

### 3. One worm counter, and a calmer clock · S
- **What's wrong (`01`):** worms show twice (top-left "🪱 10" and the bait chip "🪱 10"). They can disagree:
  the chip shows the bait on the hook (corn 10) while the top still says worms. The clock reads
  "Day 1  12:00 · Day": the word "Day" twice, and the top-left block is 3 frames wide.
- **Fix:**
  - Remove the top worm counter. The bait chip is the one source, and the "-1 worm" cue already floats from the
    chip (`cueAtChip`).
  - The clock becomes **"Day 1 · 12:00"** with a 9x9 sun / half-sun / moon icon in front of it (sun
    `sun`/`sunEdge`, dawn and dusk half sun, night `moon`/`moonShade`). That drops the word and saves about
    50 px.
  - The coins stay under the clock in their own frame.
  - Keep `TIME_OF_DAY_NAMES` for the fish log and the nap card.

### 4. Touch targets of at least 44 px · S
- **What's wrong:** bottom-bar buttons are **30 px** tall (`BottomBar.ts` `BTN.h`), the gear is 30x30, the
  panel X is 34x34, the top buttons are 30x26. A thumb in bed misses them, and a miss on the bar must not cast
  (it doesn't, `covers()` guards that).
- **Fix:**
  - The bottom bar draws at **34 px** (y 600-634) but **hits on 44 px** (y 596-640). Each gap belongs to the
    nearer button.
  - The panel X stays 34x34 visually inside a 44x44 hit box (transparent padding, `margin:-5px`).
  - All panel buttons are already ≥ 40 px tall (`8px` padding + 25 px text). Raise the small ones (`small: true`,
    4px padding = 38 px) to `6px` padding.
  - The car, crate, sign and dog: hit boxes ≥ 44x44 (the crate is 40x40 now, make it 44x44).

### 5. Panels: show that there is more below, and keep titles on one line · S
- **What's wrong:**
  - Every panel shows the **browser's own white and grey scrollbar** (`08`, `09`, `10`, `12`, `14`, `15`, `16`,
    `17`), which breaks the wooden look. Note: the screenshots come from desktop Edge. Android Chrome uses thin
    overlay scrollbars that hide themselves, so **on a phone there is no "more below" cue at all**, which is
    worse.
  - Long titles wrap and push the X down out of line: "Quiet Lake: The Doorstep" (`17`), "Take a nap until..."
    (`18`).
- **Fix (all in `panel.ts`, so every panel gets it):**
  - Scrollbar `scrollbar-width:thin; scrollbar-color:#cb9c5a #3a2318` (border on wood), and
    `::-webkit-scrollbar` 6 px with the same colours.
  - A **"more below" fade**: a 20 px gradient from transparent to `#3a2318` pinned to the bottom of the
    body, shown only while `scrollTop + clientHeight < scrollHeight - 4`. A matching one at the top once she
    has scrolled.
  - Titles are **one line**: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` at `FS.heading`.
    Long titles get shorter and an optional **subtitle** (`openPanel(title, build, onClose, dismissable,
    subtitle?)`) in `FS.small`, `cream`:
    - Checklist: title **"The Doorstep"**, subtitle "Quiet Lake checklist · 0/6"
    - Nap card: title **"Nap until..."**, subtitle "Pajkel and Bestia rest in the car"

### 6. Shop: two tabs, Sell and Buy · M
- **What's wrong (`09`):** the shop opens on a list of every fish in the bag with a Sell button each. A new
  player who came for worms must scroll past the whole bag. "Sell all" sits at the bottom, half off screen.
- **Fix:**
  - Two tabs under the title, each 44 px tall, wood style: **"Sell (7)"** and **"Buy"**. The active tab uses
    `woodLight` with a `gold` underline 3 px, the other `wood` and `cream` text.
  - The shop opens on **Sell when the bag has fish, Buy when it is empty**.
  - Sell tab: a **"Sell all · 🪙 141" gold button pinned at the top**, then the list.
  - Buy tab: worms first, then bait, then tackle, then the night kit (current order minus the sell part).

### 7. One gold button per card · S
- **What's wrong:** gold means "the thing to press", but almost every button is gold.
  - Quests (`12`): three gold **Reroll** buttons outshine the quest itself.
  - Bag full (`21`): Release and Swap are both gold.
  - Nap (`18`): four gold buttons.
  - Checklist (`17`): Give buttons are gold and the off one is near-invisible.
- **Fix:** a rule in `panel.ts` and `HANDOFF`: **at most one `rb-gold` per card or row, for the main action.**
  Secondary actions use `rb-wood` (wood fill, `cream` text), already used by the X.
  - Quests: Reroll becomes a small wood button with a ↻ glyph; Claim stays gold.
  - Bag full: **Swap** is gold (keeps the better fish), Release is wood.
  - Nap: all four are wood, with the next sensible one ("Dawn" at night, "Dusk" by day) gold.
  - Checklist: Give stays gold; a disabled Give says why ("Give · not in bag") in `dim`.

### 8. Checklist: one line per bundle until opened · M
- **What's wrong (`17`):** 6 bundles fully expanded = the longest scroll in the game. You can only see
  "0/6 bundles", not which bundles are close to done.
- **Fix:**
  - Each bundle is a **48 px row**: name, slot dots (● filled `gold`, ○ open `dim`) and the reward icons
    (corn / glow / coin sprites at 16 px).
  - A tap expands that one row (accordion, one open at a time).
  - Open first: the first bundle that has something she can give now, else the first unfinished one.
    Finished bundles sink to the bottom with a gold tick.
  - The flavour line ("Early fish for early birds.") stays inside the open row only.

### 9. Fish log: readable "where to find it" hints · S-M
- **What's wrong (`10`):** locked tiles say "Shallow water / day" at **12.5 px in dim text**. `font.ts` itself
  says 12.5 is for the dev tag only. This is the most useful hint in the log and it is the hardest text to read.
- **Fix:** replace the words with **two 9x9 icons** under the "???": depth (a 1-wave mark for shallow, a
  3-wave mark for deep, `shallow2` / `deep1`) and time (the same sun / half-sun / moon as the clock, fix #3).
  Both icons are drawn at 2x = 18 px. Tapping a locked tile opens a small card that spells it out at `FS.body`:
  "Shallow water · by day".

### 10. Catch screen and stars: contrast on bright water · S
- **What's wrong:**
  - "Fits the checklist!" (`07`) is pale green on the treeline and horizon, the weakest text on the screen. It
    also sits *above* the species name, so it is read first.
  - Silver stars (`whiteShade`-ish) melt into bright midday water (`shallow3` #7bbcd6). Not in the screenshots
    (the catch is gold in `07`): check with `?debug=caught&star=silver&time=12`.
  - In the bag and shop the stars are fine (dark wood behind them).
- **Fix:**
  - Move "Fits the checklist!" **below** the star line as a small wood tag (the hint-line frame, `FS.small`,
    `cream` text). Then the order is: name → size + stars → record → fits.
  - Give the catch-screen star row the same 2 px dark backing the text uses (`outline` #241a2e,
    `strokeThickness 4` equivalent: a 1 px outline plus a 1 px soft shadow under each star).
  - Silver: `stoneLight` body, `white` highlight, `stoneDark` edge, so it is a grey star, not a white one.

### Also important, not ranked (reasoned, never seen on a phone): tall phones · S now, L later
`main.ts` uses `Scale.FIT` with 360x640. Most Android phones are ~20:9 (360x800 CSS px), so the game gets **dark
navy bands (`#1b2b3a`) about 80 px tall above and below**. A daytime sky then ends in a navy strip, and the bottom
bar floats above a dead band where the thumb rests.
- **Now (S):** paint the bands. The top follows the day-cycle sky's top colour and the bottom follows `grass0`
  (set `body` background from `dayLook` on each sky repaint).
- **Later (L, M3):** let the world grow taller (more sky and grass) and pin the HUD and bar to the real edges
  with `env(safe-area-inset-*)`.

Ask a friend with a tall phone for one screenshot before choosing.

---

## 2. Pajkel sitting + thermos: spec for the new frames

### What is wrong now (`19-pajkel-sitting.png`, char sheet `sit0` `sit1` `sip0` `sip1`)
The sprite is 40x44 (`pajkelSittingSprite`); on screen he is ~30x42.

1. **Nothing says "sitting".** The jacket is a rectangle from row 22 to row 41 that ends in a flat, outlined
   bottom edge. There are no hips, no legs, no seat and no shadow. He reads as a **bust placed on the planks**,
   or a man standing waist-deep in the dock.
2. **The head is ~40 % of his height.** The hair ellipse is 19x17 (rows 1-18) plus the shoulder lobes (rows
   14-23). On the warm dock the blond noise turns into a straw-coloured bush with no edge between hair, cheek
   and beard.
3. **The beard hangs on the right shoulder** (cols 22-31, rows 15-27) as a dark brown block. Right next to it
   the thermos (`mug` teal, 4x8) leans on his hip. The right half of the sprite is a pile of three dark shapes.
4. **The sip is one frame held for 1.5 s** (`behaviour.ts`: `reactMs > 1500`). The thermos jumps from the hip
   (rows 29-38) to the face (rows 11-19), sitting **on top of** the nose and moustache. The arm is a straight
   3 px skin stick with no elbow, and the head doesn't move. It reads as a teal brick teleporting onto his face.
   The 4x2 `stoneLight` cap reads as a can, not a thermos.
5. **The rod** is a 1 px line from the left fist straight up the left edge (cols 4-8). It is fine, but it
   stretches the bounding box and adds a second vertical next to the hair.

### The new pose
**Size:** 40x48 (4 rows added at the bottom for the chair legs and shadow). Same anchor, feet = bottom row, so
he sits in the same spot. His total height is unchanged (~32 px of person, head ~11 px tall = 1/3, not 2/5).

**The chair:** a low camp chair seen from behind and a little to the left.
- Canvas back: `shirtDark` with a `shirt` top hem. It is warm, separates his slate jacket from the brown
  planks, and nothing else on the dock is red.
- Frame: `stoneDark` X-legs, 1 px.
- The backrest covers his lower back (rows 33-40). Below the seat the two crossed legs show (rows 41-45), then a
  1 px `woodDeep` shadow ellipse on the planks (rows 46-47).

**His legs:** seen from behind you mostly can't see legs. What sells "sitting" is the **knees and one shoe
peeking out on the right** (the side he faces): a `jeans` knee block 5x3 at about cols 29-33, rows 36-38, and
a `shoe` toe 3x2 below it, cols 32-34, rows 43-44.

**Head:** the hair ellipse shrinks to 15x13.
- Use a darker under-layer (`pajHairDark`) on the bottom 2 rows of the hair, so a dark line separates hair from
  collar and beard.
- Cheek and ear: 3 px of `skin` with a `skinShade` jaw line. Sunglasses (2x1 `outline` + 1 px `tee` arm) at the
  eye. GAME_DESIGN §2b lists sunglasses and the sprite has none.
- Beard: narrower (cols 24-30) and shorter (ends at row 26). Its last row is `beardGrey` noise so it fades
  instead of ending in a block.

**Rod and thermos:**
- The rod **leans against the left chair arm** (no fist needed): a 1 px `woodHi`/`woodDark` line from the
  chair arm (col 9, row 34) to col 5, row 4.
- His **left hand rests on his knee** (hidden).
- The thermos **stands on the planks** right of the chair: `mug` 3x7 body, `mugDark` left edge, `stoneLight`
  1-row cap. Its cup (the lid) is in his right hand at chest height in `sit`, as a 3x3 `stoneLight` cup with a
  `whiteShade` rim pixel.

ASCII mock-up of the lower half, 1 char = 1 px, cols 2-37 and rows 24-47 of the 40x48 sprite. It shows the
shapes, not a final grid:

```
legend  o outline  J jacket  L jacketLight  j jacketDark  R shirt (hem)  r shirtDark (canvas)
        k stoneDark (chair frame)  n jeans  s shoe  h skin  c stoneLight (cup)  T mug  t mugDark
        W rod  - woodDeep shadow  . transparent

        cols 2.........................................37
row 24  ...W....oooLJJJJJJJJJJJJJJJjooo..............
row 26  ...W...oLLJJJJJJJjJJJJJJJJJJjjo..............
row 28  ...W..oLLJJJJJJJJjJJJJJJJJJJjjjo.............
row 30  ....W.oLJJJJJJJJJjJJJJJJJJJJjjhho....ooo......
row 32  ....W.oLJJJJJJJJJjJJJJJJJJJJjjhcco...oTo......
row 33  ....WoRRRRRRRRRRRRRRRRRRRRRRRRo.cco...tTo......
row 35  ....Wkrrrrrrrrrrrrrrrrrrrrrrrrrkoonnno.tTo......
row 37  .....krrrrrrrrrrrrrrrrrrrrrrrrrkonnnnno.tTo.....
row 39  .....krrrrrrrrrrrrrrrrrrrrrrrrrk.onnno.tTo.....
row 40  .....kkkkkkkkkkkkkkkkkkkkkkkkkkk..onno.ooo.....
row 42  ........k.......k.....k.......k...onso.........
row 44  .........k.....k.......k.....k....osso........
row 45  ..........k...k.........k...k.......oo........
row 46  ......----------------------------------......
row 47  ........------------------------------........
```

### Frames and timings
All frames are 40x48 and keep the `breath` 0/1 offset on the head and shoulders (1 px, as now).

| Frame | What changes | Used for |
|---|---|---|
| `sit0`, `sit1` | the base pose above; cup at chest; breath 0/1 | idle, ~1.6 s per breath (as now) |
| `sipLift` | right forearm up 45°: elbow at col 30 row 30, cup at cols 30-32 rows 24-26, **beside** the beard, not on it | 1st and 3rd frame of a sip |
| `sipDrink` | cup tipped to the moustache line (cols 28-30, rows 17-19), **head back 1 px** (the whole head block shifts up 1 and the beard tip swings 1 px right), the cup's rim pixel turns `skinShade` | the drink |
| `pourReach` | body leans 1 px right, right arm down to the thermos, cup moves to his left hand (in his lap, 2 px of `stoneLight` visible left of the beard) | rare pour, 1st frame |
| `pour` | thermos lifted and tilted 45° over the lap cup, a 1 px `mugDark` stream for 2 rows | rare pour |
| `cheer0`, `cheer1` | the existing cheer, but the raised object is **the cup**, not the whole thermos (smaller and clearer) | catch reactions, clap |
| `look` | unchanged idea (back of the head), redrawn on the chair base | as now |

**Sip timeline** (replaces the single 1.5 s `sip`):

```
sipLift 200 ms → sipDrink 900 ms → sipLift 200 ms → sit
```
- Every 8-14 s as now (`nextSipIn`).
- **Every 4th sip** starts with a pour: `pourReach 300 ms → pour 800 ms → pourReach 300 ms`, then the sip.
- **Steam:** while the cup is at chest or mouth, a 1x2 `whiteShade` wisp rises 4 px over 1.2 s and fades
  (alpha 0.7 → 0), drawn by `CompanionView` and not baked into the sprite. One wisp every 1.5 s. It shows only
  at dawn, dusk and night (`dayLook` period ≠ day), so by day the cup is just a cup.
- `behaviour.ts`: `PajShape` gains `sipLift | sipDrink | pourReach | pour` (or `sip` gets a `sipFrame` field;
  the sub-phase stays inside the pure state machine and the tests check the order and the total time).
- Reactions interrupt a sip at once (as now): a bite snaps him to `look`, a catch to `cheer`.

**Walk / stand / carry frames:** not part of this pass. They stand on their own and read fine (char sheet).
The chair stays on the dock when he walks off to play, so it **needs its own small sprite** (the empty chair,
about 26x16) drawn at his dock spot while he is away, and in the car scenes. That is a nice touch: an empty camp
chair with the thermos beside it.

---

## 3. Fetch sticks: spec

### What is wrong now (`20-fetch-start.png`, `stickGroundSprite`, `STICK_TUNING`, `PLAY_AREA`)
- **Colour:** `woodLight` #ab7842 / `woodHi` #cb9c5a is the **same orange-tan family as Bestia** (`ginger`
  #c2693a, `gingerLight` #e08c52). Next to her (`20`, right of her snout) the stick reads as part of the dog, a
  second tail or a toy, not a stick.
- **Shape:** 11x5 with a full 1 px `outline` ring. On grass the purple-black outline makes it look like a UI
  glyph ("~") stamped on the scene. Nothing else on the grass has an outline, not even the flowers.
- **In the air:** `STICK` is a 7x1 line. It reads as a dash and never turns.
- **Placement:** `PLAY_AREA` y 508-558. A 5 px sprite at y 558 ends 3-4 px above the hint frame (top ≈ 566). The
  lowest sticks look like they lie on the hint line.
- **Pile:** up to 3 old sticks plus the spare plus the one in play make 5 sticks on a small lawn. Old ones are
  cleared instantly when the companions go back to the dock, so they pop away.

### New sprite
- **Size 13x4** (bigger than now, so it reads at 1x next to a ~26 px dog), **3 variants** picked by a seeded
  index per stick: straight, forked (a 2 px twig up at col 9), bent (a 1 px kink at col 6).
- **Colours, no outline:**
  - body `wood` #84582f, underside row `woodDark` #5c3a22
  - a 4-6 px `woodLight` highlight on the top row only
  - one `woodDeep` knot pixel
  - the ends 1 px darker (`woodDark`), like broken wood
- **Shadow:** a 1 px `grass0` #3a7436 line under the stick, offset +1 y, 11 px long, drawn as part of the
  sprite. That is what grounds it, not an outline.

```
straight (13x4)          forked                 bent
.LLLLLL......            .LLLLL...L...          .LLLL........
dwwwwwkwwwwwd            dwwwwwwwwkwd.          dwwwwwL......
.ddddddddddd.            .dddddddddd..          .ddddddwwwwwd
..ggggggggggg            ..gggggggggg.          ..gggggddddd.
L woodLight  w wood  d woodDark  k woodDeep knot  g grass0 shadow
```

- **In the air:** the thrown stick uses the straight variant and **turns** through 4 frames (0°, 45°, 90°,
  135°, rotated copies baked at startup) at 80 ms each, with no shadow. On landing it shows a 2-frame `grass2`
  puff (3 dust pixels).
- **Carried:** `stickCarrySprite` gets the same colours (`wood` body, `woodLight` top, no outline). It already
  has the right shape.

### Landing area and pile
- **`PLAY_AREA` = x 100-322, y 508-546** (bottom pulled up 12 px, so the lowest stick still clears the hint
  frame by ~16 px even when a hint shows).
- Keep out of a 26 px circle around the car's front (x < 100 already does this) and of the sign's tap box
  (fix #2, above y 508, so already clear).
- **Max old sticks: 2** (`STICK_TUNING.maxOld = 2`). The spare stick counts separately, so the lawn holds at
  most **4**: 2 old, the spare and the one in play.
- **Life:** an old stick lies for **30 s**, then fades over **2 s** (`oldLifeMs: 30000`, `fadeOutMs: 2000`).
  When a 3rd would land, the oldest starts its 2 s fade at once (as now, 1.5 → 2 s).
- **Return to the dock:** all ground sticks fade over 2 s instead of vanishing. Bedtime may still clear them at
  once, because the screen fades anyway.
- **Gap:** sticks land at least 18 px apart and ≥ 14 px from Bestia (`stickGap`). If nothing fits, the stick
  lands where it would and the **oldest old stick starts fading** (instead of the current "roomier side"
  fallback that piles them up).
- **Depth:** by y, as now. A stick never draws over Pajkel's or Bestia's feet when they stand on it.

---

## 4. Everything else, by screen

**Lake, HUD and bar (`01`, `02`, `03`)**
- At night (`03`) the HUD frames are the brightest thing on screen. That's fine, but the dimmed bottom-bar
  labels while disabled (`05`, `06`) drop to 60 %, and over dark grass at night they will be hard to read. Use
  85 % and just shade the frame.
- The bar's "Bag 0/10" turns amber when full. Good. Also turn it amber at 8/10 with no text, so the warning
  comes before the bag-full card.
- The gear is the only icon-only button in the bar. That's fine (universal), but its hit box is 30 px (fix #4).
- "Log" could be "Fish" or "Log 6/13". The current word is unclear to someone who has never fished. A count
  makes it inviting. (Width: "Log 6/13" fits in 70 px at the body size.)
- The bottom bar covers Bestia's lowest 40 px when she plays low (HANDOFF). The new `PLAY_AREA` bottom (546)
  helps.
- The update toast sits over the middle of the top HUD row (HANDOFF). Once the top-right icons are gone, put it
  top right, below the clock row.

**Fight (`05`)**
- "Hold to raise the bar" is good. The bar and strip sit top right under the pencil and board. Once those move
  (fix #2), the bar can start at y 40 and gain ~20 px.
- The orange progress strip next to the bar has no label. A new player doesn't know it is "how close you are".
  Use a tiny fish icon at its top (the catch target) and a net icon at its bottom, 9x9 each.

**Catch screens (`06`, `07`)**
- The speech bubble (`07`, "Look at the size of it!") covers the "was 26 cm" line's lower half and part of the
  lake. Raise the stack by the bubble height when Pajkel speaks, or put the bubble below his head (right of it)
  during the catch screen.
- The length line with stars is no longer centred (HANDOFF slice 19). Centre the group (text + stars) as one.
- The fact text (`06`) is good. Long facts (eel) wrap to 3 lines, unchecked: test `?debug=caught&species=eel`.

**Bag (`08`)**
- Prices touch the scrollbar (the "6" of roach is clipped by it). Add `padding-right:8px` to the list.
- The bag has no actions. A new player wonders how to sell. Add a footer line "Sell fish at the Shop" with a
  "Go to Shop" wood button (opens the Sell tab, fix #6).
- Bream and tench sprites are tiny (1x catch-bar icons, HANDOFF). Use the 2x log sprites scaled to a 32 px box.

**Shop (`09`)**
- The "🪙 0 🪱 10" purse line under the title is good. Keep it pinned above the tabs.
- Rod and reel icons are weak (HANDOFF 15b). Out of scope here, but they are the most visible shop art.

**Fish log (`10`)**
- "6/13 species" as the title is fine. "Gold ⭐ 0/12" is good.
- Silhouettes on locked tiles are good. Keep them.
- Long names ("Crucian carp") break into 2 lines inside the tile, which is fine. Check "Catfish" / "Zander".

**Quests (`12`)**
- "Fish of the day" block: the fish icon is vertically centred against 3 lines and floats. Put it left of
  "Bleak" only.
- Progress bars are `outline` on wood (very dark) with the count outside the bar, crowding the scrollbar. Put
  the count **inside** the bar on the right (`cream`, `FS.small`) and fill with `gold`.
- "Sell 90 coins' worth of fish" → "Sell fish for 90 coins".

**Bait box (`13`)**
- "Day-in-a-row: 1" → **"Days in a row: 1"**. The five squares are good; add the reward tier under them in
  `FS.small` ("5 days: Lucky box chance").
- This card dims the whole scene much more than other panels (it looks like night). Use the same `backdrop` as
  the panels.
- The card has both an X and "Take it". Keep the X (she may want to leave it for later), but "Take it" should be
  the only gold button (it already is).

**Bait picker (`14`)**
- Good: the current bait is framed in gold. Effects wrap to 3 lines. Shorten them:
  - "Carp, tench, bream, crucian ×3"
  - "Faster bites in shallow water"
  - "Pike, zander, eel, catfish ×3"
  - (the glow bait one similarly)
- The big count numbers on the right have no unit. Fine for a picker.

**Settings (`15`)**
- Order for a player: **Sound → Names (new, fix #2) → Save code (Export / Import) → Start over**. The export code
  box with its own inner scrollbar is the scariest thing in the game. Fold Export / Import behind a wood button
  "Save code…" that expands.
- Sliders: gold thumb on a pale track. Good, but the thumb is ~20 px. Make the hit height 44 px (`height` on the
  input, the visual stays).

**Road map (`16`)**
- "Take a nap..." inside the map is a surprise (a nap is not a place). Keep it, but make it wood (secondary) and
  label it "Nap in the car...". The checklist button stays gold.
- "New places are on the way. Check back soon!" is in `dim` at the bottom, below the fold. Fine.
- The selected-pin ring is small (HANDOFF). The gold label carries it, which is OK.

**Checklist (`17`)**: see fix #8 and fix #5 (title). "Give" taking the cheapest fish without asking
(HANDOFF) can eat a gold-star fish. Add a one-line note under the slot when the fish that would be given has a
gold star or is the fish of the day: "Gives your 33 cm perch ⭐⭐⭐". No pop-up.

**Nap (`18`)**: fix #5 (title) and fix #7 (button colours). Show the current time in the subtitle
("It's 12:00").

**Bag full (`21`)**: good, clear card. "You caught a Catfish, 120 cm (240 coins)" → "**Catfish, 120 cm ·
🪙 240.** No room in the bag." Use the coin icon, not the word (HANDOFF 15b). Swap gold, Release wood (fix #7).

**Name card (`04`)**: good and friendly. "(stored on this device only)" → its own line in `FS.small` `dim`:
"Names stay on this phone." The title fits at 360 px but is tight (HANDOFF); "Welcome!" alone would be safer.

**Consistency summary (all panels)**
- Header: the title at `FS.heading` `gold`, the X right, one line, optional subtitle (fix #5).
- Buttons: one gold primary, wood secondary, a disabled one says why in `dim` (fix #7).
- Spacing: rows separated by the 1 px `woodLight` rule already used in the bag. Use it in the bait picker too,
  instead of boxed rows (the picker is the only boxed list).
- Icons: coin and worm sprites instead of the words "coins" / "worms" in reward lines (quests, checklist,
  bag full).
- Tap outside closes every dismissable card. Keep it, but **not** for the bait box (an accidental tap would lose
  nothing, but it feels like losing the gift).

---

## 5. Proposed slices (one at a time, each on its own branch)

Order: the **companions first** (isolated files, no clash with the story-chapters work), then **panels** (all
DOM), then **the lake HUD and sign** last. The sign shares the notice board with the story chapters' wax seal,
so build it after (or together with) that engine.

### Slice 21a · "A chair for Pajkel" (Pajkel sit/sip + fetch sticks) · M
- **Files:**
  - `src/art/characters.ts` (`pajkelSittingSprite` 40x48 + new frames, `emptyChairSprite`,
    `stickGroundSprite` variants, thrown-stick frames, `stickCarrySprite` colours)
  - `src/art/textures.ts` (bake the new keys)
  - `src/scenes/companions/behaviour.ts` (sip sub-phases, pour every 4th, `STICK_TUNING` / `PLAY_AREA`, stick
    life and fade, the new fallback)
  - `src/scenes/companions/CompanionView.ts` (steam wisp, empty chair while away, stick spin and puff)
  - tests in `behaviour.test.ts` / `fetch.test.ts`
  - `dev/charSheet` entries
- **Does not touch:** any dog frame or dog behaviour.
- **Verify:**
  - `/dev/char-sheet.html` at x6: sit0/1, sipLift, sipDrink, pourReach, pour, cheer, look, empty chair, the 3
    stick variants.
  - 360 px screenshots: `?time=12` (day), `?time=21` (night, steam), `?debug=afk` stepped by hand to show 2 old
    sticks, the spare and one in the air, none touching the hint frame.
  - Tests: the sip order and total time, max 2 old sticks, fade after 30 s, sticks inside the new area.

### Slice 21b · "Friendlier panels" · M
- **Files:**
  - `src/ui/panel.ts` (scrollbar style, more-below fades, one-line title + subtitle, 44 px X hit, `rb-wood`
    secondary)
  - `src/ui/frames.ts`
  - `src/ui/bagShop.ts` (Sell/Buy tabs, Sell all on top, bag footer, padding)
  - `src/ui/checklistPanel.ts` (accordion rows, gold-fish note)
  - `src/ui/questPanel.ts` (wood Reroll, bar with the count inside, wording)
  - `src/ui/napCard.ts`, `src/ui/bagFullCard.ts`, `src/ui/baitBoxCard.ts`, `src/ui/baitPicker.ts` (wording,
    button roles)
  - `src/ui/logPanel.ts` (depth and time icons on locked tiles)
  - `src/ui/settingsPanel.ts` (order, Save code fold)
  - `src/art/` for the 9x9 sun/moon/wave icons (shared with 21c)
- **Verify:** at 360 px with `?debug=shop|bag|bagfull|log|quests&qdone=1|checklist|nap|box|baits|settings|map`
  (one screenshot each, then one scrolled to the bottom); the "more below" fade shows only when there is more;
  no title wraps; count the gold buttons per card (≤ 1).

### Slice 21c · "The lake teaches itself" (HUD, sign, hints, targets) · M-L
- **Files:**
  - `src/scenes/LakeScene.ts` (remove the top worms, clock text + icon, remove the board and pencil buttons,
    the sign drawing and tap, hint-line priority, glints, the update-toast spot)
  - `src/scenes/BottomBar.ts` (34 px draw, 44 px hit, "Log n/13", 85 % disabled labels)
  - new `src/core/tips.ts` + tests (pure: which hint line, which glints)
  - `PlayerState.seen?` in the profile/save types (normalised)
  - new `src/art/signArt.ts` (sign, notes, gold pin, flutter)
  - `src/ui/settingsPanel.ts` (Names section)
  - `src/ui/nameOverlay.ts` (reuse its fields)
  - `src/ui/updateToast.ts` (position)
  - optional `index.html` / scene for the coloured tall-phone bands
- **Verify:**
  - `?reset=save` on a fresh sandbox-like run (or a new dev flag `?debug=fresh` that pretends nothing is seen):
    glints on the car, crate, sign and dog; the hint says "Hold to charge..." for 3 casts, then goes away.
  - `?debug=quests&qdone=1` shows the gold-pinned note on the sign.
  - `?worms=0` shows the out-of-bait hint.
  - A 360x800 window for the bands.
  - Tests for the tips priority.

(A 4th slice is not needed. If 21c is too big for one agent, split off the "sign + Names in Settings" part.)

---

## 6. Open questions

❓1. **The sign vs the story chapters:** the other session is building the story-chapters engine with "a wax-seal
badge on the notice board" (ROADMAP M1). Should the sign (21c) be built *inside* that work, so the wax seal is
pinned to the sign from day one?
➡️ Yes: hand the sign spec (fix #2) to the story-chapters session, or build 21c right after it lands. Building
the sign first and then re-wiring the seal is double work.

❓2. **Chair colour:** red canvas (`shirtDark`/`shirt`) or green (`leafDark`/`leaf`)?
➡️ Red. Nothing else red is on the dock, it is warm and cozy, and it frames the slate jacket. Green would blend
with the thermos teal.

❓3. **Should the idle hint line disappear completely** after the first 3 casts (only coming back for the
priority tips), or stay as a quiet one-liner?
➡️ Disappear. The lake is prettier without it, and a line that only appears when something matters gets read.

❓4. **Tall phones:** paint the bands now (sky on top, grass at the bottom), or wait and grow the world taller
in M3?
➡️ Paint them now (an hour of work), and grow the world in M3 with the Play Store build. First get one
screenshot from a tester with a 20:9 phone to confirm.

❓5. **"Log" label:** "Log 6/13", "Fish 6/13" or keep "Log"?
➡️ "Log 6/13". It keeps the name and the count invites her to fill it.

❓6. **Checklist "Give":** add the one-line warning when the fish it would take has a gold star or is the fish
of the day, or let her choose which fish to give?
➡️ The warning line now (S). A choice list is a small panel of its own; leave it unless testers complain.
