# 11 — New Features & Story Pitches (Storyteller + UI/UX + Casual Mobile Gamer)

**Date:** 2026-11-25  
**Authors:** Storyteller · Senior Mobile UI/UX Designer · Casual Mobile Gamer Playtester · **Reviewed & Edited by CEO / Creative Director**  
**Scope:** Genuinely **new** features and story arcs beyond `docs/STORY.md` and the polish pass in `docs/review/10-ceo-story-ux-proposals.md`. Zero code edits; all code hooks and hard rules verified against `main`.

---

## 1. Executive Summary — How the Casual Mobile Gamer Changed Our Rankings

Both **Storyteller** and **UI/UX** pitched 6 strong ideas each (12 total), and independently converged on two natural pairings (Polaroids and Bobber Skins). Bringing in a **Casual Mobile Gamer** (plays one-handed in bed/on the couch, muted, hates homework) produced **three crucial CEO pivots**:

1. **Auto-snap beat manual camera:** The playtester warned they would muscle-memory tap past a manual catch-screen camera button and rarely use a Share sheet in bed. We merged UI/UX's PNG export into Storyteller's **auto-snapping Glovebox Polaroids** instead.
2. **Killed the mastery grind, kept the dock souvenirs:** UI/UX's `Lunker Lore` (5× + Gold + Perfect Medal per species) was roasted as sweaty completionist homework — especially while darting-fish medals are still brutally hard. We cut the grind and kept the **living dock souvenirs** tied to chill milestones.
3. **Killed Weather+Time double-gated bottles:** Storyteller's `Weather Postcards` (e.g. *Rain + Dusk* or *Fog + Dawn*) accidentally re-introduced FOMO for 10-minute session players. Cut.

---

## 2. CEO-Greenlit Top 6 New Features & Story Pitches

### #1. Waiting-for-a-Bite Shore Fiddles + Bestia's Stick Museum
- **Origin:** UI/UX (U3) + Storyteller (S4), merged · **Casual Gamer Verdict:** **#1 & #3 favorites**
- **The Hook:** Turns the 3–8 second bobber wait into pure one-thumb cozy fidget joy, and pays off the `"Bestia keeps every stick"` gag (`docs/STORY.md:32-33`).
- **How it works (one thumb, 360×640):**
  - **Pebble Skipping:** A tiny 3-stone cluster sits on the near shore left of the dock. Flicking up from those stones skips a 2 px pebble across the water (`1–5` skips by flick speed, tiny rings + `"4 skips!"`, never scares fish).
  - **Fetch-on-Demand:** Tapping Bestia on the grass while idle or waiting kicks off a fetch round immediately (reusing `CompanionView`'s `"no take, only throw"` animations). A real bite always interrupts cleanly — fiddles never steal a hook.
  - **Bestia's Stick Museum:** Every few fetch rounds (or at a new location), Bestia discovers one of 8–10 absurdly named sticks (*The Crooked Fork*, *The Upstream Twig*, *The Suspiciously Heavy Oak*) with deadpan 1-line reviews (`"10/10. Will not give back."`, `"Too wet. Kept anyway."`, `"Floated upstream. Haunted? Still mine."`), viewable from a paw tab in the Log or Bestia's camp bed.
- **Architecture & Feasibility (Verified):** Pure `src/core/pebble.ts` + `sticks?: string[]` on `PlayerState`, triggering in `endRound()` (`src/scenes/companions/behaviour.ts`) and reusing the 3 existing `stickGroundKey` sprites. Zero new HUD buttons.
- **Effort:** **S–M** · **Risk:** Low (keep the pebble-stone hit box strictly on shore so players never accidentally reel in).

---

### #2. Cozy Angler Wardrobe & Bobber Box + "The Trail of the Lost Red Bobber"
- **Origin:** UI/UX (U4) + Storyteller (S1), merged · **Casual Gamer Verdict:** **#2 favorite + Keep**
- **The Hook:** Tap Alex on the dock to swap milestone-unlocked hats, bobber skins, and Bestia's bandana — anchored by a hilarious 4-place comic side story spun straight out of an existing bottle note!
- **How it works (one thumb, 360×640):**
  - **Zero new HUD buttons:** Tapping Alex (currently unhandled in `LakeScene.ts:1895-1932`) opens a compact **"Coat & Bobber"** drawer with a 3× preview and chunky `56×56` tiles.
  - **Milestone unlocks (zero FOMO, zero stats):** Yellow Rain Hat *(5 rain catches)*, Knit Night Beanie *(first night catch)*, Rubber-Duck Bobber *(after Q2)*, Star Bobber *(tap a shooting star)*, Lantern Bobber *(own Night Kit)*, Bestia's Red Bandana *(pet Bestia 10×)*, plus the planned Dino Hoodie (`GAME_DESIGN.md:58`).
  - **Side Story — *The Trail of the Lost Red Bobber*:** Expands `src/core/data/moments.ts:64` (`"Lost: one red bobber. Sentimental value. Reward: a nod."`) into 4 side bottles across Quiet Lake → River Bend → Old Quarry → Sea Pier from clumsy unseen angler **M.** chasing the duck, ending with Alex unlocking **M.'s Vintage Red Bobber** (`"Keep the red one. Looks luckier on your line anyway. *nods* — M."`).
- **Architecture & Feasibility (Verified):** Pure `src/core/wardrobe.ts` + `src/core/data/sideStories.ts` (piggybacks on `StoryState.done` without consuming the daily main-chapter slot). Hats draw as a small 10×8 head overlay (no full-sprite redraws).
- **Effort:** **M** · **Risk:** Low.

---

### #3. Pajkel's Glovebox Polaroids (Auto-Snapped + Optional PNG Save)
- **Origin:** Storyteller (S3) + UI/UX's PNG export (U2), merged · **Casual Gamer Verdict:** **Keep (with auto-snap, no manual catch button)**
- **The Hook:** Pajkel keeps a battered instant camera in the car's glovebox and **automatically** snaps a pixel-art Polaroid at 8–10 real trip milestones — turning Alex's actual save history into a warm, funny couple's photo album.
- **How it works (one thumb, 360×640):**
  - **No catch-screen button to miss:** Milestones auto-capture quietly (First Catch, First Rainy Session, First 3 AM Night, First Trophy, First Pale One, 10th Fetch Round, Road to River Bend) with a gentle toast (`"Pajkel snapped a photo!"`).
  - **Glovebox Album:** Opened from the Car / Road Map panel, flipping one-handed (`< Prev · Save photo · Next >`) through Polaroids with Pajkel's terrible-photographer captions (`"Proof! (My thumb's on the lens.)"`, `"3 AM. {player} won't leave. Send snacks."`, `"{dog} refused to look at the lens."`, `"Blurred. Wait, what was that?!"`).
  - **Optional PNG Save:** One quiet `"Save photo"` button inside the album renders the Polaroid onto an offscreen canvas (`canvas.toBlob`) so Alex can save or text her favorite pixel memories over breakfast.
- **Architecture & Feasibility (Verified):** Tiny metadata-only `photos?: Record<string, { date: string; meta?: string }>` on `PlayerState` (keeps save codes small); Polaroids composite existing sprites + `dayLook` on demand.
- **Effort:** **M** · **Risk:** Low.

---

### #4. "Pajkel's Version" — Aging Trophy-Board Tall Tales
- **Origin:** Storyteller (S6) · **Casual Gamer Verdict:** **Keep ("will genuinely make me laugh out loud")**
- **The Hook:** On the Trophy Board card, beneath each mounted fish's real length and catch date, Pajkel's 1-line comment gets **quietly more exaggerated** the more real days pass since Alex caught it.
- **Sample lines (using `daysBetween(trophy.date, today)`):**
  - *Days 0–2:* `"{companion}: Saw it with my own eyes!"`
  - *Days 3–13:* `"{companion}: Easily two metres. Ask {dog}."`
  - *Days 14+:* `"{companion}: Pulled the dock three inches."`
  - *The Pale One (always hushed):* `"{companion}: ...Wait, when did we mount this?"`
- **Architecture & Feasibility (Verified):** **Zero save-schema changes.** `daysBetween` already exists in `src/core/daily/dates.ts:31` and `trophies[id].date` is already displayed in `src/ui/trophyCard.ts:31`. Literally 1 pure helper + 1 line of DOM.
- **Effort:** **S** (tiny) · **Risk:** Zero.

---

### #5. Thumb-Arc Aiming & Rippling Hotspots ("Read the Water")
- **Origin:** UI/UX (U1) · **Casual Gamer Verdict:** **#4 favorite (with strict deadzone caveat)**
- **The Hook:** Slide your thumb left or right *while charging a cast* to aim your bobber into live shimmering rise-rings, lily-pad edges, or River Bend rock eddies for a faster bite and slightly better star odds.
- **How it works (one thumb, 360×640):**
  - **Sleepy-thumb safe:** Holding still (within a generous **±16 px** horizontal deadzone — widened from UI/UX's ±12 px per Casual Gamer feedback) casts straight center exactly as today.
  - Sliding `±60 px` glides the landing ring across open water (`x = 76..284`). Every ~25–45 s, a gentle rise-ring shimmers for ~18 s; landing inside triggers a soft golden splash ring + faster bite + small star-odds nudge.
- **Architecture & Feasibility (Verified):** Already listed on `GAME_DESIGN.md`'s Ideas list (`aimed casting`). Pure `src/core/hotspots.ts` + `castX` on `FishingState` clamped to `onOpenWater()`. Pairs beautifully with River Bend's boulders and current.
- **Effort:** **M** · **Risk:** Low–Medium (deadzone tuning on a real phone is essential so casual straight casts never drift).

---

### #6. Campfire Kettle & Cozy Brews (1-Tap Bedtime Ritual)
- **Origin:** UI/UX (U5) · **Casual Gamer Verdict:** **Tweak ("keep it 1-tap, never a mandatory buff checklist")**
- **The Hook:** Tap Pajkel's Thermos or the 800-coin Campfire once per in-game day to pour a free warm cup with a gentle 1-day fishing perk — making the Campfire feel alive.
- **How it works (one thumb, 360×640):**
  - Single-screen **"Pour a cup"** card with 3 chunky buttons, closes automatically on tap with a steam puff:
    - **Wild Mint Tea** *(always open)* — 1 fewer nibble before biting.
    - **Campfire Cocoa** *(requires Campfire)* — +5% wider sweet-spot core.
    - **Midnight Espresso** *(requires Night Kit)* — +200 ms hook window & brighter night bobber from 21:00–05:00.
  - **Zero buff-bar clutter:** Shows only as a tiny 9×9 steaming-cup pip on the clock plate until `05:00`. Completely optional.
- **Architecture & Feasibility (Verified):** Pure `src/core/brews.ts` feeding existing `SessionContext` / `effectiveBarGear` / `BITE_TUNING`.
- **Effort:** **S–M** · **Risk:** Low (ensure effects feel like cozy comfort, not required min-maxing).

---

## 3. Future Expansion Greenlights (Post-M2 / M3)

1. **New Future Location — "Lock No. 4" (The Overgrown Canal)** *(Storyteller S2)*
   - A mossy 19th-century brick canal lock between the river and the sea, distinct from all 7 future places in `docs/STORY.md §7`.
   - **Signature gag — *The Bridge Echo*:** Per Casual Gamer's feedback, make the echo **visual as well as audio** — a tiny faded ghost-bubble (`"...duck!"`) drifting out from under the stone arch when Pajkel speaks or Bestia boofs, so muted-in-bed players still laugh at it.
   - **Legendary:** *The Lockmaster* — an ancient dusk mirror carp (`"It has outlived three lock-keepers, two bridges, and every rod that ever tried."`).
   - **Effort:** **L** (full location slice).

2. **Chill Living Dock Souvenirs** *(Salvaged from UI/UX U6)*
   - Keep UI/UX's wonderful visual payoff — tiny permanent handmade souvenirs appearing on the dock/shore (sea-glass jar, swaying wooden fish wind-chime, brass pocket compass, golden weathervane) — but **ditch the sweaty 5× Gold + Perfect Medal mastery grind**. Unlock them instead at relaxed, joyful milestones (e.g., 5 species caught, 10 species caught, first trophy, Quiet Lake checklist complete).
   - **Effort:** **S**.

3. **Swirlable Fireflies & Persistent Visit Critters** *(Casual Gamer Wildcard, CEO-refined)*
   - *Code check:* Quiet Lake already has a lily-pad frog, duck, jumping fish, and shooting star as transient 90–270 s moments (`src/core/data/moments.ts:21-33`), plus passive night fireflies (`LakeScene.ts:3138-3153`).
   - *What's genuinely missing:* Letting Alex **swirl the existing night fireflies around her thumb** while idle/waiting, plus an occasional **persistent-for-the-visit** cozy visitor (e.g. a sleepy turtle on a shore log by day, or the duck wearing a tiny leaf hat on rainy days) that reacts with a 1-second pixel animation when tapped — zero quest, zero timer, pure *"aww, the turtle's here tonight!"* warmth.
   - **Effort:** **S**.

---

## 4. Full Disposition of All 12 Pitches + Wildcard

| ID | Pitch | Owner | Casual Gamer | CEO Ruling |
|---|---|---|---|---|
| **U3** | Waiting-for-a-Bite Shore Fiddles | UI/UX | #1 Favorite | **GREENLIT (#1)** — Merged with S4; bite-priority strict. |
| **S4** | Bestia's Stick Museum | Storyteller | #3 Favorite | **GREENLIT (#1)** — Natural payoff for U3 fetch-on-demand. |
| **U4** | Cozy Angler Wardrobe & Bobber Box | UI/UX | #2 Favorite | **GREENLIT (#2)** — Tap Alex; zero HUD clutter. |
| **S1** | Trail of the Lost Red Bobber | Storyteller | Keep | **GREENLIT (#2)** — Feeds Vintage Red Bobber into U4. |
| **S3** | Glovebox Polaroids (Auto-Snapped) | Storyteller | Keep | **GREENLIT (#3)** — Absorbs U2's optional PNG export. |
| **S6** | Pajkel's Version (Aging Trophy Tales) | Storyteller | Keep | **GREENLIT (#4)** — Zero save changes, pure comedy gold. |
| **U1** | Thumb-Arc Aiming & Hotspots | UI/UX | #4 Favorite | **GREENLIT (#5)** — Widen straight-cast deadzone to ±16 px. |
| **U5** | Campfire Kettle & Cozy Brews | UI/UX | Tweak | **GREENLIT (#6)** — Strictly 1-tap free ritual, no buff bar. |
| **S2** | Lock No. 4 (Overgrown Canal) | Storyteller | Tweak (later) | **FUTURE EXPANSION** — Add visual echo bubbles for mute play. |
| **U6** | Lunker Lore (Mastery + Souvenirs) | UI/UX | Bottom #1 (grind) | **SPLIT** — Cut 5× Gold+Medal grind; keep dock souvenirs for chill milestones. |
| **U2** | Pocket Polaroid (Manual Camera) | UI/UX | Bottom #3 (skipped) | **MERGED INTO S3** — Cut manual catch button; keep PNG save in album. |
| **S5** | Weather Postcards from W. | Storyteller | Bottom #2 (FOMO) | **REJECTED** — Weather+Time double-gating creates FOMO in 10-min sessions. |
| **CG** | Persistent Critters & Swirl Fireflies | Casual Gamer | Wildcard | **FUTURE POLISH (S)** — Don't duplicate existing frog; add swirlable fireflies + visit turtle. |

---

## 5. Three Questions for the Developer

1. **First "delight" slice after M2 River Bend:** Between **#1 (Shore Fiddles + Bestia's Stick Museum)** and **#2 (Wardrobe + Lost Red Bobber)**, which would make Alex grin bigger on her very next week of playing?
2. **Thumb-Arc Aiming (#5) timing:** Since River Bend (`docs/RIVER_BEND.md §4`) has boulders and current seams, would you rather ship Thumb-Arc Aiming *inside* River Bend (replacing fixed-point drift) or keep River Bend simple and add aiming later?
3. **Glovebox Polaroids (#3) scope:** Should the album live inside the Car / Road Map panel (Storyteller's pitch, fits "Glovebox") or as a tab on the Trophy Board (UI/UX's pitch, closer to catches)?
