# 09 — Multi-Day & Daily-Habit Retention Ideas

**Author:** Studio Head / Game Design  
**Purpose:** Brainstormed ideas for making *Something Fishy* something Alex (and future Play Store players) genuinely wants to open for 10–15 minutes every day across weeks — keeping the game 100% cozy, zero-guilt, and free of predatory FOMO.

---

## Why Multi-Day Play Currently Collapses Too Fast

Before adding new retention systems, four existing leaks shorten Quiet Lake to ~1–2 sittings (see [01-game-design.md](01-game-design.md) and [08-roadmap-proposal.md](08-roadmap-proposal.md)):
1. **Gear gates bypass in ~3 minutes:** `Duck Tax` (1 bleak) + `Dawn Chorus` (3 shallow commons) unlock the Carbon Rod before deep fishing even starts.
2. **Unlimited naps + Deep Night inflation:** Napping straight to 20:00 with Fish Strip earns ~200 coins/min, buying out the entire 17,050-coin shop in ~85 minutes.
3. **Weak daily hooks:** Sunny weather is a no-op (`weather.ts:42`), quest rewards don't scale past Bamboo (55 coins vs. 220 for one Catfish), and Perfect Catch medals on darting trophies are 0% achievable for humans.
4. **No weekly or multi-day cadence:** After the 6 checklist bundles, there is no structured rhythm differentiating Tuesday from Saturday beyond hourly weather RNG.

Fixing those gets Quiet Lake back to its intended **4–6 real days**. The ideas below extend the game cleanly to **weeks and months**.

---

## Layer 1 — The 5-Minute Daily Ritual ("What's new at the lake today?")

### 1. Daily "Morning Forecast" + Lake Quirk
- On the first visit of each real day, Pajkel gives a 1-line **forecast** (e.g., *"Rain's coming around noon — good day for tench"*, or *"Saw a huge shadow by the reeds today"*), replacing blind hourly weather guessing.
- Layer **1 daily lake quirk** on top of hourly weather so every day feels subtly different:
  - *Biting frenzy* — nibbles arrive faster
  - *Big fish day* — gentler length skew (better bronze/silver/gold odds)
  - *Bottle tide* — extra floating bottles / moments
  - *Lucky duck* — duck drops bonus worms or coins when tapped
  - *Calm water* — slightly slower fish speed in the catch bar

### 2. Streak-Exclusive Curiosities in the Daily Bait Box
- Keep the cozy streak rule (missed days drop only 1 tier, never to 0).
- At **Streak Tier 3–5**, add small surprises coins can't buy:
  - Special single-use baits (e.g., *"Pajkel's Secret Dough"* — boosts gold-star odds for 5 casts)
  - Collectible **postcards / stamps** for the Story Journal
  - Rare cosmetic trinkets (bobber colours, Bestia bandanas, thermos stickers)

### 3. Daily "Angler's Request" (Story-Flavoured Quest Slot #3)
- Scale daily quest coin/bait rewards to the player's current rod tier so quests stay meaningful past Bamboo.
- Turn Quest #3 into a charming, personal request from Pajkel, W., or the Duck (e.g., *"Pajkel wants to see a 50+ cm pike today"* → rewards a guaranteed Glow Bait + a unique Pajkel speech-bubble reaction).

---

## Layer 2 — The Weekly Rhythm ("Why check in this weekend?")

### 4. Weekly Trophy / Derby Challenge (Monday Reset)
- Already sketched in `docs/GAME_DESIGN.md §5`, not yet built.
- One relaxed 7-day goal sized for casual play (e.g., *"Catch 3 silver+ fish across two places"*, *"Land a 100+ cm catfish this week"*, or *"Earn 3 perfect catches"*).
- **Non-coin reward:** a cosmetic unlock (bobber style, hat/hoodie, camp prop) or a Master Bait pack, so it stays exciting even after the shop is bought out.

### 5. Weekend Visitor / Travelling Bait Boat (Saturday–Sunday)
- On real weekends, a small **travelling bait boat** or **old angler's basket** appears at the dock edge:
  - Sells **1 rotating cosmetic** each weekend (coloured bobbers, thermos designs, Bestia harness/bandana colours, Alex's dinosaur hoodie, Pajkel's shirts).
  - Buys one specific category (e.g., *"Predators"* or *"Gold-star fish"*) at **×2.5 coins**.
- Gives Animal Crossing "Sunday market" charm without punishing weekday-only players (items rotate back eventually, never permanently missed).

---

## Layer 3 — Slow-Burn Projects (Weeks 2–8+)

### 6. Turn Camp & Dock into a Living, Expandable Home
- Right now the 6 Camp items (5,500 coins) are mostly static sprites. Make them feel alive and expandable over weeks:
  - **Campfire** — adds a dusk/night crackle sound + Pajkel warming his hands / roasting a marshmallow.
  - **Bestia's bed** — redraw with cushion depth so she actually curls up in it; later unlock a **plush toy** or **blanket** for her.
  - **Customisable Trophy Wall / Keep-Net** — let the player pick which 3–5 favourite catches to display (species + size + medal), giving a reason to hunt bigger/medal versions long after the log hits 100%.
  - **Wardrobe** — Alex's outfits (dinosaur hoodie, rain jacket), Pajkel's tees/mugs, Bestia's bandanas, and car colours unlocked through **trophies, mastery, and weekly challenges** rather than pure coin grinding.

### 7. Fish Knowledge → Species "Mastery" Perks
- Fix the flat `5 / 10 / 25` tiers in `src/core/data/fishKnowledge.ts` to **rarity-scaled tiers** (e.g., common `5/10/25`, uncommon `3/7/15`, rare `1/3/8`).
- Grant a small, satisfying reward at **Tier 3 Mastery**: a **golden crown** on that species' log tile plus a tiny permanent perk (e.g., `+5% gold-star odds` for that species). Completionists get a multi-week goal with zero pressure.

### 8. Paced Multi-Location Arc + Personal Milestone Bottles
- Across all four places (`Quiet Lake → River Bend → Old Quarry → Sea Pier`), `27 chapters + 4 legendaries + 12 rare trophies` naturally sustain **3–5 weeks** of daily visits once each place takes ~4–6 real days to clear.
- **Personal gift touch (private/gift mode):** Space out 6–10 secret sealed bottles signed `"— P."` on **real-day / milestone triggers** (Day 3, Day 7, Day 14, Day 30, first legendary, anniversary date). Opening the game on Day 14 and discovering a hidden personal note is the highest-value retention beat a gift game can have.

---

## Suggested Priority If You Pick Just 3

1. **Weekly Derby Challenge + Scaled Daily Quests** (small scope, huge immediate rhythm).
2. **Rarity-Scaled Fish Mastery Crowns + Living Camp** (makes existing systems pay off for weeks).
3. **Weekend Rotating Cosmetic Boat** (high charm, creates a built-in coin sink and a reason to check in every weekend).
