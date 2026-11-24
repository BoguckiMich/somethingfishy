# Prompt for the UI / polish review agent

Copy everything below the line into a new session (in this repo).

---

You are reviewing the **UI and character polish** of *Something Fishy* (code name Rybki): a cozy pixel-art
fishing game for phones (portrait PWA, Phaser 4 + TypeScript + DOM panels). I'm Pajkel, a
software developer, and I'm making it as a gift for my wife Alex (Stardew Valley / Terraria fan).
Friends test it on their phones. It goes public on Google Play later (see `docs/ROADMAP.md`), so it must
make sense to someone who has never seen it.

**Your job: review and plan. Don't change any code.** Another session is building features in
`src/` at the same time. Your output is `docs/ui-review/UI_REVIEW.md` plus questions for me.

## Read first
- `docs/HANDOFF.md` (state, *Known weak spots*, dev URL flags, how to take screenshots),
  `docs/GAME_DESIGN.md` §2 *Look & feel* and §2b *Characters*, `docs/ROADMAP.md` (M1 polish pass).
- **The screenshots in this folder** (`docs/ui-review/*.png`, 720x1280 = a 360x640 phone at 2x,
  taken 2026-11-24 from `main`). Names say what each one shows: lake by day/dusk/night, name card,
  fight (catch bar), catch screens, bag, shop, fish log, quests (notice board), daily bait box,
  bait picker, settings, road map, checklist, nap card, Pajkel sitting, fetch, bag full.
- Code you may read: `src/ui/*.ts` (DOM panels: `panel.ts` is the shared frame/buttons),
  `src/scenes/BottomBar.ts`, `src/scenes/LakeScene.ts` (HUD, hint line, toasts, catch screen),
  `src/scenes/CatchBarView.ts`, `src/font.ts`, `src/art/characters.ts` (Pajkel, Bestia, Alex),
  `src/scenes/companions/` (poses, fetch, sticks).
- If you need more views, run the dev server and use the dev flags in HANDOFF (any flag runs a
  sandbox that never touches the save). The art sheets are at `/dev/char-sheet.html`,
  `/dev/icon-sheet.html` and `/dev/moment-sheet.html`. **Never open, describe or use `me.png`,
  `wife.png` or `/reference/`**: those are private photos.

## What I want fixed before milestone M1 ends
1. **Pajkel, sitting on the dock:** the pose reads poorly (see `19-pajkel-sitting.png` and the char
   sheet). Also the **thermos drinking** animation. Describe what is wrong, pixel by pixel if
   needed, and what a good sitting pose and sip would look like at this size (he's about 32 px tall).
2. **Bestia is perfect: don't touch her.** But the **fetch sticks** need fixing: how they look on
   the grass, their size and colour, where they land and pile up (see `20-fetch-start.png`, and
   watch `?debug=afk` in motion, or drive the scene by hand as HANDOFF describes).
3. **Overall UI, more user-friendly.** Think like a first-time player on a phone, one thumb, in bed
   at night. Some things I noticed that you should check, not take as given:
   - two worm counters (top HUD and bottom bar); the top-right icons (notice board, pencil?) are unclear
   - panels are long scrolls; long titles wrap (e.g. the checklist title)
   - small or pale text and stars (silver stars on bright water), dim hint text
   - the hint line "Hold to charge, release to cast" is always there
   - no first-time tutorial; new players may not know the car, crate, notice board and dog can be tapped
   - consistency between panels (close buttons, button colours, spacing, icons, headers)
   - touch targets under ~44 px, things covered by the bottom bar, safe areas on tall phones

## Output: `docs/ui-review/UI_REVIEW.md`
1. **Top 10 fixes**, ranked by how much they help a new player, each with: what's wrong (name the
   screenshot), why it matters, the proposed fix (concrete: sizes in px, colours from the existing
   palette, wording), and effort (S/M/L).
2. **Pajkel sitting + thermos:** a written spec for the new frames (frame list, timings, what
   changes per frame). Add ASCII pixel mock-ups if that helps.
3. **Fetch sticks:** a spec (sprite size, colours, landing area, max sticks, fade).
4. **Everything else** you found, as a list grouped by screen.
5. **A proposed split into 2-4 slices** that a coding agent can build one at a time, each with
   files touched and how to verify it (screenshots at 360 px).
6. **Open questions for me**, in this format: numbered ❓ question, then ➡️ your recommendation.

Keep the game's look: chunky pixel art, the VT323 font on its 12.5 px grid (`FS` sizes in
`font.ts`), wooden panels, warm colours. Cozy first: no pop-ups that nag, no red alerts.
Start by asking me your top 3-5 questions in the ❓/➡️ format before writing the whole document.
