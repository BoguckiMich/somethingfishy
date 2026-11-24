# Prompt for the storyline agent

Copy everything below the line into a new session (in this repo).

---

You are helping me (Pajkel, a software developer) write the **storyline** for *Something Fishy*
(code name Rybki): a cozy pixel-art fishing game for phones (portrait PWA, Phaser 4 + TypeScript). I'm making it as a gift for my wife
Alex, a big Stardew Valley / Terraria fan. Another session is building game features at the same
time. **Your job is writing and design only: don't write or change any code.** Your output is a story bible in
`docs/STORY.md` (create it), plus open questions for me.

Before you start, read `docs/GAME_DESIGN.md` (especially §2b Characters, Slice 12 *The Pale One*,
Slice 14 *Lake moments*, Ideas → *Eldritch thread*, §5 Retention) and `src/core/data/moments.ts`
(the bottle-note texts) so you match what is already in the game. **Never open, describe or use
`me.png`, `wife.png` or `/reference/`**: those are private photos.

## The game today
- Alex (the player) fishes from a wooden dock on **Quiet Lake**. Her husband **Pajkel** (beard,
  slate-blue jacket) and their dog **Bestia** (who never gives the stick back: "no take, only
  throw") hang around on the grass. Pajkel has a speech bubble for short lines.
- An in-game day lasts 20 real minutes. At 00:00 Pajkel and Bestia go to sleep in the car (a white
  Citroen DS4). At 02:00 Alex goes to bed unless she owns the "Lantern & blanket" night kit.
- 12 ordinary species (roach, rudd, bleak, perch, crucian, eel, bream, tench, carp, pike,
  zander, catfish) and one legendary, **The Pale One**: deep water, 02:00–04:00 only. The lake goes still and green
  during the fight, and it slips back into the water after the show-off. Its log fact: *"No one has caught it
  twice. No one remembers why."*
- **Lake moments**: a duck, a frog, a jumping fish, a shooting star, a **message in a bottle** (12
  short notes, 2 of them eerie: warm water at night, "one more star in the lake than in the sky"),
  and uncanny ones at night (bubbles where nobody cast, a dark shape under the water).
- Daily habit: a free daily bait box (with a streak), 3 daily quests, a fish log with personal records.

## What is coming (decided, being built)
- **Road trips in the car**: tap the car, a map opens, new places unlock one by one:
  **Quiet Lake → River bend → Old quarry (very deep, clear water, odd catches) → Sea pier (later)**.
  Each place will have its own fish, its own lake moments and its own legendary.
- **Lake checklists** (like Stardew's Community Center bundles): give specific fish or coins to
  finish a place's checklist, and that opens the road to the next place.
- **Daily story chapters**: one piece of story per real day, so she wants to come back tomorrow.

## What I want from you
A storyline that ties these places together: a slow, **cozy-creepy** mystery under the water
(Lovecraft-lite, whimsical-spooky rather than horror). The Pale One is the first hint.

Hard rules:
- Cozy first. No fail state, no loss of coins or items, no sanity meter, no energy. Nothing that
  could upset someone playing in bed before sleep.
- Delivered in small pieces that fit what the game can show: bottle notes (≤ ~90 characters each),
  Pajkel's bubble lines (≤ ~40 characters), lake moments (a short visual event + one line),
  fish-log facts (one sentence), checklist names and a short line per checklist item, and the
  occasional card with 2–4 short lines.
- One chapter per real day at most (gated by the real date, like the bait box). A chapter is something she
  sees or reads in a few seconds during a 15-minute visit.
- Mix in warm, funny and personal moments too: Pajkel, Bestia's stick obsession, the duck that
  steals worms. Not everything should be eerie.
- Personal notes from Pajkel to Alex are for the **far future**: don't plan or write them now,
  and don't leave slots for them.

Please produce, in `docs/STORY.md`:
1. A one-paragraph premise and the tone in 3–5 bullets.
2. The arc across the places (Quiet Lake, River bend, Old quarry, Sea pier): what she learns at
   each, how it ends (a special catch, a cosmetic, a reveal?), and the legendary fish of each place
   with a log fact.
3. A chapter list (about 20–30 chapters): day number or unlock trigger, where, which delivery
   mechanism (bottle / bubble / moment / card / fact), and the exact text.
4. Ideas for new lake moments per place (one line each: what is seen, when, what a tap does).
5. Checklist (bundle) names per place that fit the story.
6. Open questions for me in this format: numbered ❓ question, then ➡️ your recommendation.

Start by asking me your most important questions in that ❓/➡️ format (tone, ending, how personal it should be)
before writing the whole document.
