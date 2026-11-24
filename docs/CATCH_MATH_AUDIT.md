# Catch math audit (friend's feedback, 2026-11-24)

Tester said: "check the maths, some fish are sometimes strangely easy to catch, maybe a formula got tangled" and "fish weights look weird: I caught a tiny catfish".

Scope: read-only analysis of `catchBar.ts`, `fish.ts`, `data/fish.ts`, `rods.ts`, `tackle.ts`, `barGear.ts`, `inventory.ts` (`effectiveBarGear`), `fishingSession.ts`, plus bot simulations. No game code was changed. The simulation scripts were throwaway vitest files (not committed); numbers below came from them.

Method: the existing bot model from `catchBar.test.ts` (good = 150 ms delay, sloppy = 300 ms delay + 0.1 noise), plus "awful" (450 ms, 0.2 noise), "never" (never presses), "always" (always holds) and "mash" (hold 250 ms / release 250 ms). Lengths are rolled with the real `rollLength` and the profile with the real `fightProfile` (so size difficulty and the shallow cap are in). 300 fights per cell (150 per cell in the tackle grid, 200 in the sweeps), seeds fixed.

## Verdict

Nothing is "tangled" in the sense of a mis-wired multiplier: difficulty reaches the bar once, gear multipliers point the right way, units are consistent. But there is one real design hole that matches the tester's feeling exactly, plus a few smaller bugs. The cause of "strangely easy": **sinker fish (bream, crucian, and above all catfish) barely respond to difficulty, and a player who never touches the screen wins 80-99% of catfish and bream.** Catfish is the hardest non-legendary species on paper (0.85) and in practice it is easier than pike, carp and zander for a sloppy player.

## Findings

### Bugs / design holes (fix these)

**B1. The sinker pattern ignores difficulty, so the "hardest" fish is a walkover for a passive player.** (Top finding; HANDOFF already hints at it: "sinker pattern barely responds to difficulty".)

Why: a sinker's target is `lo + u^1.3 * (0.5 - lo)` 72% of the time (the lower half, heavily biased to the bottom) and a uniform stray otherwise. The zone, when released, rests at the bottom, covering fish up to about `zoneSize + 0.02`, i.e. 0.32 / 0.36 / 0.40 for bamboo / fiberglass / carbon. So the fish sits inside a resting zone about 64-70% of the time whatever its speed. Difficulty only scales speed/interval, which does nothing when the target is "down" anyway. Worse, difficulty makes the fish *change its mind faster*, which keeps it near the favourite spot, so a passive player's win rate goes **up** with difficulty at zone 0.30 (64% at d 0.1, 76% at d 0.5).

Sinker, "never press" / sloppy / good catch share by difficulty (zone 0.38 = carbon):

| difficulty | 0.1 | 0.3 | 0.5 | 0.7 | 0.85 | 1.0 |
|---|---|---|---|---|---|---|
| never | 92 | 94 | 98 | 98 | 96 | 87 |
| sloppy | 100 | 100 | 100 | 99 | 91 | 69 |
| good | 100 | 100 | 100 | 100 | 99 | 96 |

For comparison, a smooth fish at difficulty 0.85 on the same rod: never 22, sloppy 41, good 77. Darting 0.85: never 0, sloppy 22, good 88.

Real species, share caught by "never press" (sloppy / good in brackets):

| species | fiberglass | carbon |
|---|---|---|
| catfish (0.85) | 80 (64 / 94) | 94 (87 / 98) |
| bream (0.66) | 93 (90 / 99) | 99 (98 / 100) |
| crucian (0.12, shallow) | 84 | 92 |
| carp (0.70) | 29 (71 / 94) | 35 (85 / 98) |
| pike (0.75) | 0 (23 / 92) | 1 (50 / 97) |

A catfish by length (fiberglass, never / sloppy / good): 60 cm 83/68/97, 90 cm 80/63/96, 180 cm 69/49/89. Even a 180 cm, 43 kg, difficulty 0.95 monster is caught 69% of the time by a player doing nothing.

Fix (tested, `strayChance` is already a tunable in `CATCH_BAR_TUNING`): make the sinker/floater stray chance depend on difficulty, e.g. `stray = 0.28 + 0.45 * d^1` (about 0.6 for the deep sinkers), or just raise it to 0.6 for sinkers. Measured with the global value changed (it only matters for sinkers/floaters; floaters are mirrored and already never win passively):

| strayChance | bream never / sloppy / good (fiberglass) | catfish never / sloppy / good (fiberglass) | catfish (carbon) |
|---|---|---|---|
| 0.28 (now) | 93 / 89 / 100 | 81 / 64 / 93 | 95 / 87 / 99 |
| 0.45 | 71 / 67 / 94 | 37 / 36 / 79 | 72 / 68 / 93 |
| **0.60** | 38 / 55 / 92 | **8 / 21 / 67** | **30 / 54 / 90** |
| 0.75 | 10 / 47 / 85 | 2 / 16 / 60 | 6 / 43 / 88 |

0.6 gives the intended picture: a passive player loses the rare deep fish, a good player still wins 90%+ with carbon. Catfish on fiberglass at 67% good would then be too hard; combine it with a lower base difficulty for catfish (0.85 to about 0.75) or keep 0.5 for it. Bream (a common fish the player meets first in deep water) may want 0.45 so the first deep fish stays friendly. Re-run the existing "8-15 s" tests after the change; they are the guard rails.

**B2. Difficulty ordering is inverted between pattern families.** Catch share with the sloppy bot, carbon, no line/reel: bream (0.66) 98, tench (0.55) 100, zander (0.70) 98, carp (0.70) 85, **catfish (0.85) 87, pike (0.75) 50**. Fiberglass: catfish 64, carp 71, pike 23. Good-bot median fight time, fiberglass: pike 13.4 s, carp 11.3 s, catfish 9.5 s, zander 9.4 s, bream 8.7 s; so catfish plays easier than carp and pike. The `difficulty` number is only meaningful inside one pattern; across patterns the pattern dominates (darting is by far the hardest, sinker the easiest). After B1, re-check that catfish >= pike in fight time. Same family: the Pale One (abyssal) is intentionally hard (good 69% fiberglass, 33 s) and is fine.

**B3. Reel upgrades make sinker fights harder for a sloppy player.** The reel multiplies both lift and gravity, so the zone also falls faster. For the two sinkers that rest at the bottom a stronger reel does nothing for a passive player and hurts a sloppy one: catfish sloppy on fiberglass 62% (no reel) -> 53% (smooth) -> 47% (pro); carbon 84 -> 79 -> 73. For every other deep species the reel helps as intended (pike sloppy 19 -> 39 -> 52). The existing "reel tackle" test only uses a mixed roster, so it hides this. Not a wiring bug; the mechanism is the symmetric scale of gravity. Fix idea: scale only lift by `reelResponse` (or lift by r and gravity by sqrt(r)), then re-run the tackle test.

**B4. Size difficulty is silently dropped for the whole shallow set that sits at the cap.** `fightProfile` adds up to +0.10 for size, then caps shallow fish at 0.30. Eel (base 0.30) never gets a size bonus (0.30 at min and max), perch (0.25) only for the top half of its range, bleak (0.20) loses its top 0.0. Intended effect "big fish fight harder" does not exist for the eel. Harmless for balance (shallow is easy anyway) but it is not what the data comment says. Also the size term is small everywhere: the biggest catfish is only +0.1 harder than the smallest, and for sinkers that has no effect (B1).

**B5. Dead tunables.** `baitCalm` (gear.ts, catchBar.ts `calmEffect`) is read by the bar but no code ever sets it above 0; `effectiveBarGear` never touches it and the baits (`data/baits.ts`) have no calm field. So the "calm" half of `pickMove` is untested dead code. Not a bug in play, but any future bait with calm will go through unchecked maths (`/ calm` can't divide by zero: calm is 0.5-1, fine).

Checked and found correct: difficulty is applied once (`fightProfile`), in both `fishingSession` and `LakeScene.ts:564`, the same function; line `drain` < 1 lowers drain (right direction) and `response` > 1 raises lift (right direction), both stacked by multiplication in `effectiveBarGear`; the drain boost `1 + 1.2 * d^6` uses the final profile difficulty; the fixed-step physics uses `dt` through an accumulator, so frame rate does not change results; `elapsedMs`, timers and pick intervals use seconds consistently (`h = stepMs / 1000`); no clamp collapses difficulty for deep fish (the shallow cap only touches `zone === 'shallow'`).

### Tuning (not bugs)

**T1. Shallow is essentially unlosable.** Good and sloppy bots win 100% of every shallow species on all rods; even the "awful" bot (450 ms, 0.2 noise) wins 85-100% (perch on bamboo 85%, bleak 89%). The "mash" bot (alternate hold/release every 250 ms) wins 20-49% of bleak, perch, eel and 38% of roach; "always hold" wins 70-89% of rudd (floater) and "never" wins 56-66% of roach and crucian. Known and accepted (HANDOFF), but combined with B1 it means there is no species where doing nothing is punished except darting fish and pike.

**T2. Rod zone size decides a lot for passive play.** Passive win on crucian 66 / 84 / 92 % for bamboo / fiberglass / carbon; bream 93 -> 99; catfish 80 -> 94. The 0.30 / 0.34 / 0.38 zone sizes are fine for tracking but raise the sinker floor, which is why B1 gets worse as the player upgrades (the opposite of a challenge curve; the player now needs carbon for catfish, the point where it becomes easiest).

**T3. Line/reel tackle table, deep roster.** Fiberglass, no tackle -> fiberglass + fluoro + pro: pike sloppy 19% -> 99%, carp 67 -> 99, catfish 62 -> 92 (with the reel dip from B3). Carbon with all tackle: sloppy 88-100% on everything. A fully upgraded player is above 99% good-bot on every species and about 95%+ sloppy, which is the intended "pay for comfort" end state. No species has a combination where a gear step makes the *good* bot lose more.

## Per-species results (fiberglass / carbon rods, no tackle)

Catch share per bot (good / sloppy / awful / never / always / mash), good-bot median seconds of a won fight, mean fight difficulty after size.

| species (zone, pattern, base d) | rod | good | sloppy | awful | never | always | mash | med s | mean d |
|---|---|---|---|---|---|---|---|---|---|
| roach (sh, smooth, .10) | bamboo | 100 | 100 | 100 | 56 | 9 | 25 | 4.8 | .13 |
| roach | carbon | 100 | 100 | 100 | 59 | 15 | 38 | 4.4 | .13 |
| rudd (sh, floater, .15) | bamboo | 100 | 100 | 98 | 0 | 70 | 20 | 4.4 | .18 |
| rudd | carbon | 100 | 100 | 100 | 0 | 89 | 49 | 4.4 | .18 |
| bleak (sh, darting, .20) | bamboo | 100 | 100 | 89 | 6 | 7 | 28 | 7.2 | .23 |
| bleak | carbon | 100 | 100 | 100 | 22 | 23 | 48 | 6.0 | .23 |
| perch (sh, darting, .25) | bamboo | 100 | 100 | 85 | 4 | 7 | 20 | 7.6 | .28 |
| perch | carbon | 100 | 100 | 98 | 17 | 23 | 45 | 6.2 | .28 |
| crucian (sh, sinker, .12) | bamboo | 100 | 99 | 87 | 66 | 0 | 15 | 5.5 | .15 |
| crucian | carbon | 100 | 100 | 100 | 92 | 0 | 23 | 4.6 | .15 |
| eel (sh, erratic, .30) | bamboo | 100 | 100 | 96 | 45 | 14 | 21 | 6.7 | .30 |
| eel | carbon | 100 | 100 | 99 | 53 | 24 | 36 | 5.5 | .30 |
| bream (deep, sinker, .66) | fiberglass | 99 | 90 | 76 | **93** | 0 | 10 | 8.7 | .69 |
| bream | carbon | 100 | 98 | 93 | **99** | 0 | 12 | 7.5 | .69 |
| tench (deep, smooth, .55) | fiberglass | 100 | 98 | 87 | 38 | 24 | 10 | 7.3 | .58 |
| tench | carbon | 100 | 100 | 95 | 45 | 29 | 16 | 6.5 | .58 |
| carp (deep, smooth, .70) | fiberglass | 94 | 71 | 49 | 29 | 20 | 5 | 11.3 | .73 |
| carp | carbon | 98 | 85 | 68 | 35 | 24 | 11 | 9.8 | .73 |
| pike (deep, darting, .75) | fiberglass | 92 | 23 | 2 | 0 | 1 | 7 | 13.4 | .78 |
| pike | carbon | 97 | 50 | 11 | 1 | 1 | 19 | 10.4 | .78 |
| zander (deep, erratic, .70) | fiberglass | 99 | 94 | 85 | 30 | 16 | 16 | 9.4 | .73 |
| zander | carbon | 100 | 98 | 94 | 36 | 23 | 24 | 7.9 | .73 |
| catfish (deep, sinker, .85) | fiberglass | 94 | 64 | 51 | **80** | 0 | 8 | 9.5 | .88 |
| catfish | carbon | 98 | 87 | 72 | **94** | 0 | 11 | 8.0 | .88 |
| pale (deep, abyssal, .90) | fiberglass | 69 | 9 | 0 | 0 | 0 | 0 | 33.0 | .93 |
| pale | carbon | 82 | 22 | 1 | 0 | 0 | 0 | 30.4 | .93 |

(Fiberglass and bamboo/fiberglass rows for the shallow species are within a few points of carbon and bamboo; omitted for length. Deep fish are not reachable with bamboo, maxCast 14 m.)

Difficulty by pattern and level (never / sloppy / good, carbon zone 0.38; bamboo zone 0.30 in the second line where it differs):

- smooth: d 0.7 -> 37/91/100 (bamboo 27/60/89); d 0.85 -> 22/41/77 (13/12/33); d 1 -> 9/10/26
- darting: d 0.7 -> 3/79/99 (0/32/92); d 0.85 -> 0/22/88 (0/1/50)
- erratic: d 0.7 -> 37/98/99 (23/89/99); d 0.85 -> 25/93/99 (14/55/91)
- floater: never = 0 always (a released zone sits at the bottom, the fish up); d 0.85 -> sloppy 86, good 99
- sinker: see B1 (flat)

Size difficulty actually applied (min length / max length): roach .10/.20, rudd .15/.25, bleak .20/.30, perch .25/.30 (capped), crucian .12/.22, eel .30/.30 (capped), bream .66/.76, tench .55/.65, carp .70/.80, pike .75/.85, zander .70/.80, catfish .85/.95.

## Weights and the "tiny catfish"

Weights are `bodyFactor * L^3` in grams, lengths rolled `min + (max - min) * u^2` (rounded to cm). The u^2 skew puts the **median at 25% of the range** (u = 0.5 gives 0.25) and 50% of all fish below the bronze-star threshold (share < 0.25); gold (share >= 0.8) is 11%. Real-world figures below are rough, well-known typical weights for a fish of that length (from memory, not looked up now; treat as +/-30%).

| species | length range cm | weight min / mid / max (g) | rolled median L -> W | p10 / p90 W | real-world check |
|---|---|---|---|---|---|
| roach | 12-30 | 19 / 103 / 300 | 17 -> 55 g | 19 / 218 | 30 cm roach is about 300-350 g: ok |
| rudd | 12-30 | 22 / 116 / 338 | 17 -> 61 g | 22 / 246 | ok |
| bleak | 8-18 | 4 / 16 / 43 | 11 -> 10 g | 4 / 30 | 18 cm about 40-50 g: ok |
| perch | 10-35 | 13 / 156 / 549 | 16 -> 52 g | 13 / 346 | 35 cm about 600-700 g: slightly light |
| crucian | 10-30 | 22 / 179 / 605 | 15 -> 76 g | 22 / 394 | 30 cm about 700-900 g: slightly light |
| eel | 40-100 | 147 / 789 / 2300 | 55 -> 383 g | 159 / 1621 | 100 cm eel about 1.5-2 kg: a bit heavy |
| bream | 25-60 | 225 / 1145 / 3110 | 34 -> 566 g | 225 / 2144 | 60 cm about 3-3.5 kg: ok |
| tench | 25-55 | 269 / 1101 / 2862 | 33 -> 618 g | 269 / 2024 | 55 cm about 2.5-3 kg: ok |
| carp | 35-90 | 750 / 4376 / 12758 | 49 -> 2059 g | 816 / 8960 | 90 cm common carp about 12-14 kg: ok |
| pike | 40-110 | 512 / 3375 / 10648 | 58 -> 1561 g | 551 / 7301 | 110 cm about 10-11 kg: ok |
| zander | 35-80 | 454 / 2068 / 5427 | 46 -> 1032 g | 454 / 3956 | 80 cm about 5 kg: ok |
| catfish | 60-180 | 1598 / 12787 / 43157 | 90 -> 5395 g | 1680 / 28637 | wels 1 m about 6-7 kg, 1.5 m about 20-25 kg, 1.8 m about 40 kg: ok |
| pale | 150-220 | 33750 / 63316 / 106480 | 168 -> 47 kg | n/a | invented |

So the formula and `bodyFactor`s are right: cube law, realistic weights for each length. Nothing is wrong with the weights themselves.

**Why the "tiny catfish" happens**
- A catfish is rolled from 60 to 180 cm with the u^2 skew: **57% of all catfish caught are in the small sprite class** (lower third of the range, 60-100 cm; `fishSizeClass` uses `sizeShare` thirds), 35% weigh under 3 kg, and 19% under 2 kg. The single most likely catch is the 60-65 cm, 1.6-2.0 kg fish (the density piles up at the minimum: a quarter of rolls land within 60-70 cm).
- Catch screen shows "62 cm · 1.7 kg" and a shrunk small-class sprite for the species whose fact line says "can pass two metres". That reads as "tiny" next to a log entry and a price (100 coins base) of a giant. A 60 cm minimum is a real juvenile wels (about 3 years old, 1.2-1.6 kg), so it is the **skew** and the **range width** that cause it, not the 60 cm floor. The floor is fine; the issue is that the range is 3x wide (60 to 180 cm) while the u^2 skew makes the lower end the typical result.
- Same pattern on every species, but catfish feels worst because it is rare, night-only, "the biggest freshwater fish in Europe", and the range is widest.

## Recommendations, ranked

1. **Fix sinker difficulty (B1)**, impact highest. Raise the stray chance for sinkers with difficulty; target about 0.55-0.6 for catfish/bream on deep rods. Numbers: catfish carbon passive 95% -> 30%, sloppy 87% -> 54%, good 99% -> 90%; fiberglass passive 81% -> 8%, sloppy 64% -> 21%, good 93% -> 67% (then lower catfish base difficulty by about 0.1 or its stray to 0.5 to bring fiberglass good back to about 80%). Keep crucian (shallow) easy: scale stray by difficulty so 0.12 stays near 0.3. Re-run the deep-roster 8-15 s tests.
2. **Reel scaling (B3)**: scale only lift (or gravity by sqrt) so the pro reel does not hurt sinker fights; re-check the tackle test with a sinker-only roster.
3. **Check the species order afterwards**: catfish should fight at least as long as pike for a good bot (target: good median fiberglass catfish 12-14 s, pike 13-15 s), and sloppy-bot catch share should fall monotonically carp > ... > catfish > pike or similar, not what it is now (catfish 64, carp 71, pike 23).
4. **Weights/size (tuning)**: flatten the skew for rare/large species (catfish `u^1.5`, or shrink the range 60-180 -> 70-170) so the median catfish is about 10 kg, not 5.4 kg. With u^1.5 the median length is 60 + 120 * 0.354 = 102 cm (about 8 kg) and P(<3 kg) falls from 35% to about 24% (calculated, not simulated). Or give species their own `lengthSkew` in data. Also consider a minimum length 70 cm for catfish (2.5 kg); note stars (`STAR_THRESHOLDS`) and `goldFromCm` use `sizeShare`, so changing the range shifts bronze/silver/gold odds and the knowledge text ranges; keep the same star odds by changing the skew rather than the range, if that matters.
5. **Size difficulty (B4)**: either apply the shallow cap after the size term only to the species base (cap 0.35) or accept the dropped bonus on eel/perch; and consider raising `sizeDifficulty` for deep sinkers so a 180 cm catfish is not caught by a passive player 69% of the time (after B1 this matters less).
6. **Tuning, only if desired**: shallow could get a small losable tail (T1); remove or wire `baitCalm` (B5).

Not touched: any file other than this document. The sweeps used the exported `CATCH_BAR_TUNING.strayChance` mutated inside the test only.
