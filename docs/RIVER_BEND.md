# River bend: first sketch (M2)

_Draft 2026-11-24. **Decided 2026-11-25: the user accepted every ➡️ recommendation below.** Every ❓
keeps its ➡️ as the decision. Story beats, moments and the checklist already exist in
`docs/STORY.md` (§3 River bend R1-R6, §4 river moments, §5 "Against the Current"); this sketch fits them
to the systems we built since (hourly weather, rare trophy fish, camp, gear gates, story milestones,
perfect catch). Layout picture: `docs/sketches/river-bend.svg`._

_**Revised 2026-11-26 (M2 groundwork A), decided with the user:** no forced auto reel-in (§4 ❓1, §9), river fights get a pattern feel instead of one-sided bar gravity (§4 ❓2), the Ferry pike's rope band is 18-26 m (§5), and R4 has a fallback milestone (§7 ❓6). Each is marked "(decided 2026-11-26)"._

## 1. The feel in one line

Quiet Lake is still water you wait on. **River bend is moving water you read.** The bobber drifts,
fish hold in the current seams, and the best spots change with the weather. Same cozy tone, a bit
more lively: kingfisher flashes, an otter, the sound of water over stones.

## 2. The place (layout, 360x640 portrait like the lake)

- **Top:** sky and a far bank of willows and alders (lower, closer than the lake's pine ridge, so the
  scene feels narrower and more intimate).
- **Middle:** the river comes in from the top right, bends round in front of her and leaves at the
  left edge. Visible current lines (foam streaks moving right-to-left), small standing waves on the
  gravel riffle.
- **The old ferry landing** instead of the dock: a short wooden platform on the near bank with two
  thick posts and the **ferry rope** sagging across the river to a post on the far bank. Alex stands
  on the landing; Pajkel's chair sits on it (deck chair if bought).
- **W.'s hut** on the near bank, right side: small, weathered, a sign "W. - FERRY & BAIT", a rusty
  kettle on the stove pipe (R2 "still warm" steam wisp). Tap later = story/journal; for now decoration.
- **Bottom:** a gravel and grass bank with the dirt track where the car parks (left), Bestia's fetch
  area on the gravel (sticks can land in the shallows, R1 moment: one floats upstream).
- **Camp:** comes along (see ❓4): tent and fire fit on the bank right of the car.

## 3. Water zones (by cast distance, like the lake)

| Zone | Distance | Water | Fish |
|---|---|---|---|
| **Riffle** | 0-12 m | shallow, fast over gravel (inside of the bend) | trout, grayling, nase, small chub |
| **Seam** | 12-26 m | where fast meets slow; the money spot | chub, asp, barbel (dusk) |
| **Bend pool** | 26-40 m | deep, slow, dark (outside of the bend, under the far bank) | barbel, big chub, the Ferryman |

➡️ Same three-rod reach as the lake (bamboo 14 m, fiberglass 26 m, carbon 40 m), so the rods she owns
still mean something, and the deep pool waits for the carbon rod as before.

## 4. The new mechanic: current

❓1. **How does the current change fishing?**
➡️ **The bobber drifts downstream while waiting**, slowly, from where it landed toward the left edge
(a few px per second, faster on rain/high-water hours). **(decided 2026-11-26)** There is **no forced
auto reel-in**: when the bobber reaches the end of the run it slows and settles in the slack water of
the eddy and waits there as long as she likes (bites there are rarer than in the seam, so it nudges her
to reel in and cast again, but never takes the decision away). The forced "The current took it." reel-in
is dropped until aimed casting exists (see below). Bites come **more often while
the bobber passes through the seam**, so where you cast matters: cast upstream (right) to get a long
drift through the seam. Simple, readable, no new controls: it is still hold-and-release. A forced reel-in only makes sense once she
can aim the cast upstream and so choose the length of the drift herself.
Open: should the cast aim left/right at all? Today casting has only distance. ➡️ Not now; the drift
starts at a fixed point and only the distance (zone) is chosen; aiming can come with "aimed casting"
from the Ideas list later.

❓2. **Does the current change the fight?**
➡️ Yes, as a **pattern or speed feel, not a one-sided bar gravity** **(decided 2026-11-26)**. A constant
pull in one direction would make river fish simply harder than lake fish of the same difficulty. Instead
the river fights run in **surges with the current**: the fish holds, then the bar's fish-marker speeds up
for a moment (a "surge", a second or two, a short telegraph before it) and calms again, so the rhythm
is what she reads. Rain and high water make the surges a bit more frequent. It stays symmetric: the bar is
not pushed to one side. Trout and asp keep the darting pattern, barbel and the Ferryman use sinker and
abyssal; the surge is added on top as a new modifier (tested and simulated in slice 25c).

## 5. Fish (6 normal + 3 rare trophies + the legendary)

STORY.md planned trout, grayling, chub, asp, barbel, nase. **Asp now lives at Quiet Lake too
(slice 23c).**

❓3. **Shared species between places?**
➡️ **Yes, a few are shared**, with their own weights per place (asp is rarer at the lake, common at the
river; perch and pike can turn up in the river's slow pool). The fish log stays one book with a
"where" line per species. To keep 6 new species, swap asp out of the river's "new" list for **vimba
(certa)**, a river bream-cousin that migrates upstream (fits "against the current").

| Species | Zone | Time | Rarity | Pattern | Likes | Note |
|---|---|---|---|---|---|---|
| Brown trout | riffle | dawn, dusk | uncommon | darting | rain, overcast | spotted, red dots |
| Grayling | riffle | day | uncommon | floater | sunny | big sail-like dorsal fin |
| Nase | riffle | day | common | smooth | sunny | the river's "roach": common, cheap |
| Chub | seam | any | common | smooth | any (not fussy) | the wink fact from R5 |
| Barbel | seam, pool | dusk, night | uncommon | sinker | rain | whiskers, bottom feeder |
| Vimba | seam | dawn, day | uncommon | smooth | overcast | swims upstream |
| Asp (shared) | seam | day | uncommon here | darting | windy | |

**Rare trophy fish (like golden tench / Old Mossback / silver ghost):**
- **Rainbow trout "Lantern"**: a trout with glowing spots; **rain + night + riffle + maggots**. Hint:
  "When it rains after dark, the riffle lights up like a window."
- **The Barbel King**: a huge old barbel with a white moustache; **overcast + dusk + bend pool + fish strip**.
  Hint: "The old king eats at dusk, when the sky can't make up its mind."
- **Ferry pike**: a long pike that lives under the ferry rope; **windy + day + seam + any bait, cast exactly
  under the rope (18-26 m, widened 2026-11-26, decided; the whole seam, so the narrow 20-24 m band is gone)**. Hint: "Something hunts under the rope when the wind shakes it."

**Legendary: The Ferryman** (STORY.md): a huge old sturgeon, dusk, deep pool by the far ferry post,
carbon rod. Its own eerie window like the Pale One: at dusk the ferry rope creaks by itself and the
current slows for a moment. Fact: *"Sturgeons are older than the dinosaurs, and this one acts like it."*

## 6. Weather at the river (hourly weather from slice 23b + the hourly change)

| Weather | River effect |
|---|---|
| Sunny | clear water, grayling and nase bite more, slow drift |
| Overcast | vimba, barbel and chub more; the Barbel King's weather |
| Rain | **water rises and colours**: faster drift, trout and barbel more, the Lantern trout's weather |
| Windy | the ferry rope sways, asp and the Ferry pike's weather |
| Fog | fog sits in the bend until 10:00; the far bank disappears; rare fish x2 (as at the lake) |

## 7. Systems carried over

❓4. **Does the camp come along?**
➡️ **The camp travels in the car**: tent, fire, lights, Bestia's bed and the windsock appear at the river
on fixed river spots (it is "their" camp, not the lake's). **The trophy board stays at Quiet Lake**
(home), and the river gets its own small board by the hut for river trophies. No new camp items at
first; maybe a hammock between two willows later (coin sink for the river).

❓5. **Gear gates at the river?**
➡️ New gear is a good river goal: **a float set ("trotting float")** that slows the drift (longer run
through the seam) and **a heavier lead** that keeps the bait down in the pool. Both gated by river
checklist bundles, same pattern as 23a. Rods/lines/reels stay as they are. **(2026-11-27)** The spinning rod is
not river gear in this sense but a second way of fishing, slice 32 (GAME_DESIGN -> "Spinning rod"); it is sold in
the river shop's "River tackle" section next to these two.

❓6. **Story pacing (R1-R6)**: milestones like Quiet Lake (slice 24) instead of days.
➡️ R1 first arrival · R2 first river catch · R3 first catch in the seam · R4 first dusk at the river
(the duck finds them; **(decided 2026-11-26)** fallback if the dusk trigger can be missed: R4 also fires
on the **third river catch after R3**, or on the first river day that ends without a dusk visit, so the
chapter chain can never stall behind one time of day) · R5 first river bundle · R6 river checklist done (gate key tag -> quarry).
Cap 2 per real day, strict order, as at the lake.

❓7. **Checklist "Against the Current"**: STORY.md has Swift Water, The Hunter, Ferry Fare (800),
Upstream Mail, A Stick for the Road. ➡️ Keep those five, add a sixth **"Ferryman's Toll"**: one perfect
catch at the river (uses the perfect-catch system), so there are 6 bundles like at the lake.

❓8. **Quests and fish of the day per place?**
➡️ Fish of the day and daily quests pick from **the place you are at** (quests rolled when you arrive,
one set per real day per place). The bait box stays global (in the car).

## 8. Travel

❓9. **How does she get there?**
➡️ The road map (slice 18): tap the River bend pin -> "Drive there" button -> the car drives off the left
edge, a short fade with a road sound and a tiny map animation (the car icon moving along the road),
then the river scene fades in with the car arriving. Same way back. Travel only when idle (no line in
the water), and the companions get in the car (reuse the bedtime carry/enter phases quickly, or just
fade if they are playing). ~5 s, skippable by tap.

❓10. **Does the clock or anything else change with travel?**
➡️ The in-game clock keeps running (the drive takes ~30 in-game minutes). Weather is the same
everywhere (it is the real hour), which also keeps the code simple.

## 9. Build order (slices 25a-25g, then 32)

1. **Location as data + travel**: scene takes a `Location` (background, zones, fish pool, moments, spots for
   car/camp/companions), map "Drive there", the fade. River scene with placeholder art.
2. **River art**: bend, current animation, ferry landing and rope, W.'s hut, far bank willows, the camp spots.
3. **Current mechanic**: bobber drift, seam bonus, the settle-in-the-eddy end of the run (no forced reel-in, decided 2026-11-26), river fight surges (decided 2026-11-26); tests and a sim.
4. **River fish** (BUILT, slice 25d): trout, grayling, nase, chub, barbel, vimba (+ shared asp, perch, pike) with art and facts.
5. **River checklist + story R1-R6 + river moments** (BUILT, slice 25e): kingfisher, otter, upstream lantern, paper boat, heron.
6. **Rare river fish + river trophy board, the Ferryman** (BUILT, slice 25f): the three trophies by their exact conditions, the river board, and the Ferryman with its creak window.
7. **River gear** (trotting float, heavy lead) behind river bundles.
8. **Spinning rod** (slice 32, GAME_DESIGN -> "Spinning rod", grilled 2026-11-27): lures, retrieve rhythm, the lure drifts in the current while paused.

**Done when (M2):** she can drive to the river and back; the river has ~4 days of its own goals; the river
checklist ends with the key tag pointing at the quarry.
