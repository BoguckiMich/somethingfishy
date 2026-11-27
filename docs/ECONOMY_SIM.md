# Economy sim (balance pass A2, 2026-11-26)

`src/sim/economy.sim.test.ts` plays the pure core with a seeded RNG and a "decent player" bot. It is skipped by default:

```sh
SIM=1 SIM_SEEDS=24 npx vitest run src/sim --silent=false < /dev/null
```

It uses the real fishing state machine, catch bar (bot: 200 ms reaction, small noise), game clock (20 real minutes a day),
hourly weather, fish of the day, daily quests (claimed at shop visits), the checklist with the real gear gates, the shop,
naps (companions, the 00:00-05:00 car window, the night kit) and the 02:00 bedtime. Medians over 24 seeds.

## What the bot assumes about the human (change `ASSUME` in the file to test others)

- 40 real minutes of play a day (so "days" below = minutes / 40). At 30-45 min a day, divide the hours by 0.5-0.75.
- About 9 s (0.4x-1.6x) of dawdling before each cast (looking, bag, menus): a catch costs ~37 s in total, the 35-50 s in `core/data/quests.ts`.
- Casts at 8 m (shallow) or 20 m (deep, any rod from fiberglass). Zone choice: where a species she still needs (open checklist species slots, species quests) can bite now, else deep.
- A shop trip (30 s) when the bag has 7 fish, worms run low, or a checklist slot can be filled. Species slots are filled before star slots; the Petrol payment only when it does not delay the next gear item. Daily bait box not modelled (about 30 coins a day).
- Shopping order, normal: fiberglass, braided, smooth, carbon, fluoro, pro, night kit, camp (cheapest first); a locked item reserves its price (nothing later is bought out of that money). Baits are only used as rewards come in; worms are bought as needed.
- Normal player naps only when no species she needs can bite at this time of day but one can at another time (to that time). Never to deep night on purpose.
- Nap-abuser: once she can afford the next thing and it is not waiting for a bundle, she naps to deep night (02:00, with the kit; 20:00 before it) every time a nap is allowed, casts at once (30 % of the usual pause) and buys fish strip. Naps are impossible while the companions sleep in the car (00:00-05:00), so one deep-night nap gives one 2.5 minute window (02:00-05:00), then 8 s for them to climb out, then the next nap. While the next item waits for a bundle she plays like the normal player.

## Results

| | Before (HEAD of main) | After A2, all levers |
|---|---|---|
| Normal: whole shop (gear + night kit + camp) | 3.8 h (day 6) | 4.2 h (day 7) |
| Normal: fresh save -> all six bundles | 3.9 h (day 6) | 4.4 h (day 7) |
| Normal: carbon rod | 0.9 h | 0.9 h |
| Abuser: whole shop | 3.1 h (day 5) | 3.4 h (day 6) |
| Abuser: fresh save -> all six bundles | 3.2 h (day 5) | 3.7 h (day 6) |
| Abuser: carbon rod | 1.5 h | 1.4 h |
| Deep-night fish, coins per minute spent in 02:00-05:00 | 120-130 | 100 |
| Coins per minute, last simulated hour (normal / abuser) | 103 / 126 | 102 / 110 |
| Shop total (gear + camp + kit) | 16 550 | 19 300 |

Step by step (normal / abuser whole shop), all other A2 changes included from the second row on: gates by bundle + corn + dawn + asp:
3.7 h / 3.0 h; + nap cooldown: 3.7 h / 2.8 h (no effect); + deep night x0.85: 3.8 h / 3.1 h; + camp x1.5: 4.2 h / 3.4 h.

### Findings

- The review's "free naps + deep night farm ~200 coins/min, whole shop in ~85 min" is **not reproduced**. A fast, strip-using farmer earns
  100-130 coins a minute in deep night (deep fish: bream 20, carp 38, zander 48, burbot 60, catfish 100, times rarity and size, and a fight
  is 10-15 s), and the shop is 16 550 coins plus gates. The farmer is at best ~20 % faster than a normal player; nobody gets the shop in under ~3 h.
- The whole shop and the six bundles finish within minutes of each other: the last gated purchases (fluoro, pro) wait for Night Shift, so the
  pace is set by the checklist (Shiny Ones' three gold fish and the night species), not by coins. Raising prices alone moves the shop and
  the bundles together.
- The 2-minute nap cooldown does nothing to the abuser: the deep-night window is 2.5 real minutes and the companions sleep in the car until
  05:00, so a second nap is not possible sooner than the cooldown anyway. It only stops chains of daytime naps. It is built (card countdown,
  map reason) because it was decided, but it is not an economy lever.
- Levers used, in order: cooldown (no effect), deep night x0.85 (small), camp x1.5 (+0.4 h). **The 6 h shop target is NOT met (4.2 h, normal).** The six-bundle
  target (>= ~4 days at 30-45 min a day) IS met: 4.4 h is 6-9 real days at 30-45 min a day, 5.5 days at 48 min.

### Proposal to reach ~6 h (not built, needs a decision)

The shop needs about +40 % coins or gates that open later. Candidates, cheapest first: camp x2 instead of x1.5 (+2 750 coins, about +0.4 h); pro reel 3 500 -> 5 000 and
fluoro 2 000 -> 3 000 (+2 500, +0.4 h); night kit 2 500 -> 3 500 (+0.2 h); or a flat sale-price cut of ~20 % (+1 h, but it hits every early purchase and the daily quests'
"sell for N coins"). All four together land near 6 h. Night Shift needing real nights (eel, zander and catfish only bite 20:00-05:00; they already do) is not a lever:
a normal player naps to 20:00 and fishes them in ~7 min.

### Story pacing

All six bundles are done after ~4.4 h of play for a normal player (3.7 h for the abuser), i.e. day 7 at 40 min a day, so the story catch-up (`todaysChapter(..., catchUp)`)
does not open before day ~6 for someone who plays normally. A tester who saw Q1-Q8 on day one most likely played a very long session or used dev flags
(`?bundles=`, `?cl=all`); the catch-up lifted the daily cap entirely. Done in this branch: the catch-up cap is now 3 chapters per real date (`STORY_TUNING.catchUpPerDay`).
If bundles should be slower: Shiny Ones (3 gold-or-better fish; about one catch in ten is gold-size, more with perfect catches) is the easiest slider (2 gold fish, or only "silver" ones with a perfect catch),
or a real-time wait of a day between the first and the last bundle.

## Perfect catch (skilled bot: 150 ms reaction, no noise; carbon + fluoro + pro; 200 fights per species)

| Grace outside the green zone (total) | darting fish (bleak, perch, asp, pike) | trophies (golden tench, silver ghost, mossback) | others |
|---|---|---|---|
| 0 ms (before) | 10 % | 2 % | 25 % |
| **300 ms (built)** | **17 %** | **5 %** | 35 % |
| 500 ms | 27 % | 8 % | 43 % |
| 800 ms | 38 % | 11 % | 53 % |

With the "decent" bot (200 ms, noise) at 300 ms: darting 10 %, trophies 3 %. Per species at 300 ms (skilled): bleak 31, perch 28, asp 9, pike 2, golden tench 1, silver ghost 1,
mossback 14. The aim of 15-25 % holds for the easy darters (bleak, perch) and the average; pike (0.75) and the two darting trophies are still
almost impossible, which fits "top achievement", but 1 % may be too harsh: a longer grace for trophies only (e.g. 600 ms) would be the next step.

## Line fight (slice 28, "feel the line"; `src/sim/lineFight.sim.test.ts`, `SIM=1 npx vitest run src/sim/lineFight`)

Second catch style (GAME_DESIGN "Catch mechanic v2"), tuned with its own bot sim next to the classic bar. Pure core, 200 fights per cell, same rolled sizes and casts as the economy sim (8 m shallow, 20 m deep).
`SIM_FIGHTS=N` changes the 200. **Revised after the first tester round** (telegraphs at least 0.35 s on every surge and every sideways cut, passive slip, tiring near the dock, gauge bands = rule bands, faster red recovery in the gold).

**Control tuning round (branch `tune/line-fight`).** The first rounds made the telegraphs fair, so a skilled player reacted in time to everything (skilled perfect on darting fish 77 %, hard fish too easy, the sim needed "reaction lapses"
to lose anything). The skill now sits in CONTROL: while holding, the tension climbs linearly (`rise` + `risePull` x pull, x(1 + 0.6 x surge) in a surge); releasing falls at a steady `fall` rate toward what the fish's pull holds it at.
**Twitchiness floor:** the climb is capped so that crossing the gold takes at least ~0.3 s on the hardest fish (about 0.18 s in a surge; checked by a test on every pattern), so a real thumb can feather; difficulty comes from the narrow gold
(0.15 easy to 0.12 hard, trophies at most 0.15, rod +-0.014), from **surges holding the needle up even with the thumb off** (`surgeHold` 0.45 -> 0.9 by difficulty^2 x a per-pattern `holdMul`: a hard surge pushes the tension toward and into the red
whatever you do, so the rod's flex and the line's snap limit decide), and from the strict perfect rule. Reeling is full speed in the gold, 0.2x while slack, fading to 0 at the snap limit; easy fish reel at 0.65x, long fights speed the reel up
by up to 1.8x after 12-24 s. Perfect = at most 40 ms red and the needle in the gold for 90 % of the fight time after the first second, **70 % -> 62 % for the hardest fish** (difficulty 0.5-0.8). Rod flex `0.4 + 25 x (zoneSize - 0.3)` s (bamboo 0.6,
fiberglass 1.4, carbon 2.4), trophies x1.15.

**Bots.** Classic: hold while the fish is above the zone centre. Line: sees the tension and its speed, and whether a surge, a feint or a cut is showing; holds while the needle (where it will be when the thumb lands) is below the middle
of the gold, lets go above it or at any telegraph. Every press and release lands `delayMs` late with uniform timing noise: *decent* 200 ms +-100 ms, *skilled* 150 ms +-50 ms. Reaction lapses are a realistic 3 % / 2 % (were 22 % / 6 %).

**Hand-play fixes (tester, ~200 ms decisions).** The unwarned spikes were the sideways cut's jerk (up to +1.6 at once on a taut line, with the surge phase still reading "calm"): it is now spread over 0.5 s (`kickS`), and nothing else may lift the needle
faster than a third of the gold's width per 100 ms (`riseCapPerS`, a bit more in a surge; tested on every pattern). Gold: 0.24 (easy) to 0.12 (hard) by difficulty^0.7, so perch 0.21 vs a 0.8 fish 0.14. Never pressing slips in about 4-7 s: thumb-up time
counts from the very start, at full rate in calm and hush, 0.6x in a telegraph and 0.2x in a run, and only 0.3x while the needle is up in the gold or above (`releasedSlipS` 4). Trophy slack limit 1.7 s.

**Catch rate, decent bot** (classic -> line, 300 fights per cell; fiberglass / carbon unless noted): bleak/perch (bamboo) 100 -> 96-97, eel 100 -> 90, asp bamboo 97 -> 98; bream 93/99 -> 100/100; carp 79/92 -> 80/94; pike 63/84 -> 76/87;
catfish 74/93 -> 80/92; golden tench (fiberglass / carbon / top gear) 44/70/100 -> 47/64/97; mossback 61/86/99 -> 70/87/100; silver ghost (bamboo / fiberglass / top) 21/45/100 -> 51/62/93; Pale One 52/80 -> 62/75. **Superseded by the balance pass below** (the cells that were outside +-10 then: pike fiberglass +13, silver ghost bamboo +30 / fiberglass +17). Median won-fight length: shallow 4-5 s, deep 7-14 s.

**Balance pass (branch `tune/line-trophies`): every cell within +-10.** Per-species tuning in `SPECIES_LINE_TUNING` (`src/core/data/lineFight.ts`: `strengthMul`, `flexMul`, `flexSlope`, `slackMul`, `releasedMul`; other species and Classic untouched).
`flexSlope` makes the rod matter more (the flex budget is also x (flex / 1.4 s)^slope), which is what Classic does and the Line fight did not: trophies in Line were too easy on bamboo and fiberglass and slightly too hard with the top rod.
Decent bot, 300 fights per cell, Line minus Classic in points (before -> after):

| cell | bamboo | fiberglass | carbon / top gear |
|---|---|---|---|
| silver ghost | +31 -> +5 | +19 -> +5 | top -5 -> -5 |
| Lantern (river) | +46 -> +4 | +39 -> +3 | top -1 -> -1 |
| Ferry pike (river) | +20 -> +6 | +16 -> +5 | top -15 -> -5 |
| golden tench | | +17 -> +4 | carbon +6 -> +2, top -1 |
| Barbel King (river) | | -10 -> +2 | carbon -14 -> -3, top +1 -> +2 |
| Old Mossback | | +9 -> +7 | carbon +1 -> -1 |
| Pale One / Ferryman | | +9 / +10 -> +4 / +6 | carbon -5 -> +3 |
| pike | | +13 -> +5 | carbon +4 -> -2 |
| eel | -7..-10 -> -2 | -8..-10 -> -2 | |

Absolute Line catch after: silver ghost 26 / 50 %, Lantern 24 / 47 %, Ferry pike 10 / 24 % (Classic 4 / 19 / 98 % on bamboo / fiberglass / top). Perfect catches are unchanged (skilled bot, top gear: darting 41 %, trophies 9 %).
Guard tests: `src/core/lineTrophySim.test.ts` ("Line vs Classic, decent bot, cheap rods"). Re-run the table with `SIM=1 SIM_FIGHTS=300 npx vitest run src/sim/lineFight < /dev/null` (`SIM_ONLY=lantern,pike` limits it to those species).

**Perfect catch, skilled bot, top gear** (150 ms, +-50 ms): classic darting 11 %, trophies 3 %, others 35 %; **line skilled: darting 41 %, trophies 8 %** (golden tench 11, silver ghost 10, mossback 4), pike 17 %, bleak 57, perch 64, asp 26, **easy fish roach 33 %,
rudd 14 %**; line decent: darting 30 %, trophies 7 %. Before the control rounds: darting 77 %, trophies 42 %. Darting is above the 15-25 % aim only because bleak and perch (easy darters) are high; pike and the trophies are in range.

**Dumb players:** never holding and holding forever both land 0 % on every fish tested (roach included: it snaps after about 3-4 s of holding); the hook slips after 4 s of calm with the thumb up; a 60 s safety net says "It got away".

Tuning levers (`src/core/data/lineFight.ts`): `patterns.*.rise` (the main difficulty lever, blended with difficulty^`riseCurve`), `goldWidth`, `perfectGold`, `reelEasy`; rod flex (`flexBase`, `flexPerZone`) and `redRecovery` / `redRecoveryGold`; `patterns.*.warn` (telegraph, floor 0.35 s), `rise`, `cutKick`; `trophyFlex`; `reelBase` (a faster reel makes it much easier);
`releasedSlipS`, `slackS`; `tireM` for the last metres.


## River current (25c, `SIM=1 npx vitest run src/sim/lineFight -t "river"`)

Slice 25c (`core/current.ts`, RIVER_BEND.md section 4). Two things are simulated.

**1. Fight surges at the river** (Line style, decent bot, 300 fights per cell, `SIM_FIGHTS=300`; calm gaps x0.85, x0.7225 in rain). Catch rate without the modifier / dry / rain, for the two rods listed:

| species | rods | without | dry | rain |
|---|---|---|---|---|
| trout | bamboo / fiberglass | 99 / 100 | 99 / 100 | 98 / 99 |
| grayling | bamboo / fiberglass | 99 / 99 | 99 / 99 | 99 / 99 |
| nase | bamboo / fiberglass | 100 / 100 | 100 / 100 | 99 / 99 |
| chub | bamboo / fiberglass | 100 / 100 | 100 / 100 | 99 / 99 |
| barbel | fiberglass / carbon | 100 / 100 | 100 / 100 | 100 / 100 |
| vimba | bamboo / fiberglass | 100 / 100 | 100 / 100 | 100 / 100 |
| asp | bamboo / fiberglass | 98 / 100 | 98 / 100 | 98 / 100 |

Every ordinary river fish drops at most 1 point (they are near 100 % with a decent bot, so the surges show as rhythm, not as lost fish). **The trophies are excluded in the game** (`fightEveryMul(cur, raining, trophy)`): with the modifier forced on (`SIM_TROPHIES=1`), bamboo / fiberglass / top gear lose
Ferry pike 10 -> 8 / 24 -> 12 / 93 -> 77 dry (rain 2 / 3 / 48), Lantern 24 -> 19 / 47 -> 35 / 99 -> 95 (rain 11 / 20 / 85), Barbel King fiberglass / carbon 54 -> 46 / 79 -> 69 (rain 40 / 62), Ferryman carbon 83 -> 76 (rain 70): up to 46 points, far outside the +-10 balance of the trophy pass. A milder x0.95 still cost the Ferry pike 6-8 points.

**2. Mean seconds to the first bite** (carbon rod, day, 400 seeded casts per cell, 25 ms ticks; `-t "river bite timing"`):

| band (cast) | Quiet Lake | river, bobber stays at the landing | river, settled in the eddy | river, real run (runS 30; now 15) | river, runS 12 (flow 1 / rain 1.6) |
|---|---|---|---|---|---|
| riffle 6 m | 6.7 | 6.7 | 16.6 | 6.7 | 6.7 / 7.2 |
| seam 20 m | 8.1 | 4.9 | 16.5 | 4.9 | 4.9 / 4.9 |
| pool 32 m | 8.1 | 7.1 | 17.6 | 7.1 | 7.1 / 8.0 |

The seam bites about 40 % sooner than the lake while the bobber drifts (x1.35); a settled bobber waits about 2.5x longer (x0.4). A normal wait is over before the eddy is reached (the first wait is 2.5-8 s plus nibbles), so the eddy is a fallback for long waits (fog, a slow fish of the day), as designed: "bites there are rarer, so it nudges her to reel in and cast again".


## River gear (25g, `SIM=1 npx vitest run src/sim/lineFight -t "river gear"`)

Slice 25g (`RIVER_GEAR` in `core/current.ts`): trotting float (drift x0.6, seam bites x1.5 instead of x1.35) and heavy lead (pool drift x0.3, pool bites x1.3; both together: pool drift x0.18). Mean seconds to the first bite / share of waits that reached the eddy before biting (carbon rod, day, 400 seeded casts per cell, 25 ms ticks, real run: `runS` 15, flow 1):

| band (cast) | none | float | lead | both |
|---|---|---|---|---|
| riffle 6 m | 6.7 s / 0 % | 6.7 s / 0 % | 6.7 s / 0 % | 6.7 s / 0 % |
| seam 20 m | 4.9 s / 0 % | 4.4 s / 0 % | 4.9 s / 0 % | 4.4 s / 0 % |
| pool 32 m | 7.1 s / 0 % | 7.1 s / 0 % | 5.4 s / 0 % | 5.4 s / 0 % |

The float is worth about 10 % in the seam in bite time (the bigger gain is the 25 s the bobber spends crossing it, which is what the item is for); the lead about 24 % in the pool. Neither changes the riffle. No wait reaches the eddy before the bite with or without gear (the bite comes in 4-7 s on average, the run is 15-83 s), so the eddy rule is untouched. Fights are not changed by the gear, so no catch-rate sim is needed.

## Spinning (32, `SIM=1 npx vitest run src/sim/spinning`)

Method. `src/sim/spinning.sim.test.ts` plays the real fishing state machine (float rig and the spinning rig, Line fight, seeded RNG, game clock) at the River bend for 120 real minutes per seed, 16 seeds (`SIM_SEEDS`, `SIM_MIN`). Kit for both rigs: carbon rod, braided line, smooth reel; the float rig also has the trotting float and heavy lead. Human assumptions (identical for both rigs unless named): 9 s x 0.4..1.6 between the last thing and the next cast, 0.9 s cast flight, reaction 250-500 ms (5 % of strikes she is looking away and takes 0.9 s: a nip), show-off 3.2 s, the Line fight bot of the line sim (200 ms +-100, 3 % lapses). The float bot casts at 8, 19 or 32 m. The decent spinning bot picks the lure and the rhythm of the band it casts at (pool: soft jig, 1.0 s burst / 2.5 s pause; seam: wobbler, 3.0 / 0.5 s; riffle, dawn and dusk only: spinner, 3.5 / 0.4 s; +-20 % noise) and reels in a thumb-up strike within its reaction time. The careless bot reels all the time and never pauses. Lures lost count at their price (the snapped ones Bestia brings back count as kept, snags at full price); worms for the float rig at 1 coin each; quests, bundles and the shop trips are left out of both rigs.

Strikes per cast, by the band the cast lands in (a strike is a predator that followed at least 0.5 s):

| bot | band | follows / cast | strikes / cast | catches / cast |
|---|---|---|---|---|
| decent | riffle (dawn, dusk) | 0.69 | 0.40 | 0.39 |
| decent | seam | 0.99 | 0.99 | 0.98 |
| decent | bend pool | 0.96 | 0.90 | 0.84 |
| careless | riffle | 0.65 | 0.22 | 0.22 |
| careless | seam | 1.22 | 0.63 | 0.63 |
| careless | bend pool | 1.76 | 0.14 | 0.13 |

Coins per minute, River bend, 16 x 120 min:

| rig | casts / min | catches / min | gross c / min | lure + worm cost | net c / min |
|---|---|---|---|---|---|
| float (carbon, trotting float, lead) | 2.42 | 2.39 | 69.2 | 2.4 | 66.7 |
| spinning, decent bot | 2.31 | 2.09 | 76.6 | 15.2 | 61.5 |
| spinning, careless bot | 2.41 | 0.98 | 39.4 | 3.3 | 36.1 |

Spinning / float net = 0.92 (target 0.85-1.15). The careless bot lands 47 % of the decent bot's catches (target about half). The decent bot loses 2.6 lures an hour (about 20 % of its gross; none to snags, because its pauses never reach 3 s on the bottom: a snag needs a long lie), nearly all of them snapped lines in Line fights against pike and asp. The spinning rod brings only predators and bigger ones (mean length cm, float / spin: chub 30 / 38, perch 19 / 23, asp 53 / 63, pike 66 / 78, trout 36 / 46). The float rig numbers are unchanged by this slice (same seeds, same 2.39 catches a minute as before the lure code went in).

What was tuned (the spec fixed the rules, these numbers were mine): a follow roll every 0.5 s with chance 0.14 x the band's suitable-predator weight (full from 15) x the seam bonus; every predator weighs as an uncommon one in the follow pick (a lure does not care how common a fish is: without it the common chub took 55 % of the bites and spinning paid 0.67 of the float); chub likes the spinner 0.8, the wobbler 2, the jig 0.5; size roll exponent x0.45; strike hazard 0.9 per second x interest squared x (3 just after a burst, 0.7 later in a pause, 0.4 while reeling). The riffle is the weak band at 0.4 strikes a cast by design: only the trout (dawn, dusk) and the small chub live there.
