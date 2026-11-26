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

**Bots.** Classic: hold while the fish is above the zone centre. Line: sees the tension (+ noise) and whether a surge or a cut is showing (the telegraph or the pull), holds below the middle of the gold band when nothing shows, lets go on a
surge/cut or above the middle. Reaction is per event (x0.8..1.5), plus a **lapse** (looking away: +0.6 s) with chance 22 % for *decent* (200 ms, noise 0.05) and 6 % for *skilled* (150 ms). Without lapses the fair 0.35 s+ telegraphs make
every fish a 95-100 % catch, so the lapse is what lets the hard fish be lost.

**Catch rate, decent bot** (classic -> line; fiberglass / carbon unless noted): shallow species on bamboo 100 % -> 92-100 % (eel 92 %); asp bamboo 96 -> 80 %, fiberglass 100 -> 99 %; bream 93/98 -> 93/100; tench 98/100 -> 98/100;
zander 99/100 -> 92/94; burbot 100 -> 94/96; carp 75/92 -> 89/100; pike 62/83 -> 83/98; catfish 73/94 -> 82/98; golden tench 42/68 -> 68/88; mossback 58/85 -> 52/85; silver ghost (bamboo / fiberglass) 21/43 -> 21/61;
Pale One 54/81 -> 66/94. **Outside +-10 points:** asp on bamboo (-16), carp on fiberglass (+14), pike (+21 fiberglass, +15 carbon), **golden tench (+26 fiberglass, +20 carbon)**, silver ghost on fiberglass (+18), Pale One (+12 / +13).
Everything else is within 10. Median won-fight length: shallow 5-12 s, deep 17-36 s (classic 9-28 s).

**Perfect catch, skilled bot, top gear** (perfect = no red at all, at most 250 ms slack in total): classic darting 11 %, trophies 3 %, others 34 %; **line skilled: darting 77 %, trophies 42 %, others 69 %**; line decent: darting 40 %, trophies 2 %,
others 39 %. This is **far above the 15-25 % aim**: with fair telegraphs a skilled player can always release in time, so a perfect catch is common on every fish that cannot go red by its own cuts. Not fixed (a deliberate trade for the
fairer telegraphs); the next levers are a shorter perfect slack allowance, or counting a missed telegraph (releasing after the surge started) as a blemish.

**Dumb players:** never holding lands nothing (the hook slips after 4 s of calm with the thumb up, at any depth; a 60 s safety net says "It got away"); holding forever lands nothing except the roach (98 %) and snaps the line elsewhere.

Tuning levers (`src/core/data/lineFight.ts`): rod flex (`flexBase`, `flexPerZone`) and `redRecovery` / `redRecoveryGold`; `patterns.*.warn` (telegraph, floor 0.35 s), `rise`, `cutKick`; `trophyFlex`; `reelBase` (a faster reel makes it much easier);
`releasedSlipS`, `slackS`; `tireM` for the last metres.
