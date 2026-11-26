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

The second catch style (GAME_DESIGN "Catch mechanic v2") is tuned with its own bot sim, next to the classic bar played by the same kind of bot. Pure core only, 200 fights per cell,
the same rolled sizes (`rollLength`) and the same casts as the economy sim (8 m in the shallows, 20 m in the deep). `SIM_FIGHTS=N` changes the 200.

**Bots.** Classic: hold while the fish is above the zone centre (as in `catchBar.test.ts` and the economy sim). Line: it sees the tension (plus noise) and whether a surge is showing
(the telegraph splash or the pull), holds while the tension is below the middle of the gold band and no surge is showing, lets go on a surge or above the middle. Its reaction is **per
event**: when what it wants differs from what the thumb does, the thumb follows after the reaction time x0.8..1.5. *Decent* = 200 ms + 0.05 noise (the economy sim's `DECENT`), *skilled* = 150 ms, no noise.
Gear: bamboo / fiberglass for shallow species, fiberglass / carbon for deep ones, top gear (carbon + fluoro + pro) for the trophies.

**Catch rate, decent bot** (classic -> line; rods: the line fight only feels the rod through its flex budget, the reel through speed, the line through its snap limit):

| species | rod | classic | line | | species | rod | classic | line |
|---|---|---|---|---|---|---|---|---|
| roach, rudd, bleak, perch, crucian, eel, ide | bamboo | 100 % | 98-100 % | | tench | fiberglass / carbon | 98 / 100 % | 100 / 100 % |
| asp | bamboo / fiberglass | 96 / 100 % | 87 / 99 % | | carp | fiberglass / carbon | 75 / 92 % | 74 / 94 % |
| bream | fiberglass / carbon | 93 / 98 % | 99 / 100 % | | pike | fiberglass / carbon | 62 / 83 % | 67 / 92 % |
| zander, burbot | fiberglass / carbon | 99-100 % | 98-100 % | | catfish | fiberglass / carbon | 73 / 94 % | 66 / 87 % |
| golden tench | fiberglass / carbon / top | 42 / 68 / 100 % | 56 / 88 / 100 % | | mossback | fiberglass / carbon / top | 58 / 85 / 99 % | 59 / 87 / 100 % |
| silver ghost | bamboo / fiberglass / top | 21 / 43 / 100 % | 16 / 48 / 100 % | | the Pale One | fiberglass / carbon | 54 / 81 % | 50 / 87 % |

Every cell is within 10 points except **golden tench** (+14 fiberglass, +20 carbon; the line fight lets the decent bot land it more often) and asp on bamboo (-9, inside). Median fight length of a won fight
(decent bot): shallow 4.6-11 s (classic 4.6-14), deep 13-37 s (classic 9-28): the line fight is a little longer on the hard deep fish because every surge is let go and some of the line is paid back.
Snaps are the only way the decent bot loses (slack never happens to it), so "who loses" is driven by the red budget: bamboo 0.95 s, fiberglass 1.35 s, carbon 1.75 s (trophies x0.85 of that; see `LINE_FIGHT_TUNING`).

**Perfect catch, skilled bot, top gear, 200 fights per species** (perfect = never more than 40 ms in total in the red and 500 ms in total slack):

| | darting (bleak, perch, asp, pike) | trophies | others |
|---|---|---|---|
| classic (300 ms grace, skilled) | 11 % | 3 % | 34 % |
| **line, skilled (150 ms)** | **19 %** | 11 % | 70 % |
| line, decent (200 ms, noise) | 20 % | 2 % | 62 % |

Per species (line, skilled): bleak 35, perch 28, asp 12, pike 4, golden tench 4, silver ghost 1, mossback 27; roach, rudd, crucian, eel, ide 100. The aim "15-25 % for darting fish" holds (19 %); the
weak spot is the easy fish: nothing in the line fight can put a skilled player in the red on a roach, so a perfect catch there is a given (classic roach 74 %, rudd 93 %).

**Dumb players** (60 fights): never holding lands nothing (the hook slips after the slack time); holding forever lands nothing except the easiest fish (roach 98 %, perch 8 %) and snaps the line on everything else.

Tuning levers if testers say it is too hard or easy (all in `src/core/data/lineFight.ts`): `redRecovery` and the rod's flex (`flexBase`, `flexPerZone`) for how forgiving a mistake is; `patterns.*.warn` (the telegraph length) and `rise` for how
fast the line goes red; `cutKick` for the darting fish's yanks; `reelBase` for the fight length (a faster reel also makes it much easier: 0.5 -> 0.6 lifted pike on fiberglass from 62 % to 90 %).
