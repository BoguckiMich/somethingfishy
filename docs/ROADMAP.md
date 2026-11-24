# Roadmap: milestones

_Drafted 2026-11-24 with the user. Design details live in [GAME_DESIGN.md](GAME_DESIGN.md), the story in
[STORY.md](STORY.md), and the current state in [HANDOFF.md](HANDOFF.md). This file is the big picture:
what each milestone delivers and what "done" means. GAME_DESIGN §4 (v2a-v2d bait farming,
spinning, feeder) stays as an idea pool for after M5._

Rule of thumb: every milestone ends in something Alex can play on her phone and enjoy for weeks,
even if we stopped there.

---

## M1 · "Quiet Lake, complete" (the gift is whole)
The first lake has a beginning, a middle and an end.
- [x] Road map with places "coming soon" (slice 18)
- [x] Size stars + fish of the day (slice 19)
- [x] The Doorstep checklist (slice 20)
- [ ] Phone-test fixes for 15a-20
- [ ] Story chapters engine + Quiet Lake chapters Q1-Q8 (sealed story bottle, wax-seal badge on the
      notice board, one chapter per real day, STORY.md §3) and the Pale One bonus beat
- [ ] Grzesiu's fish knowledge in the log (size ranges after N catches)

**Done when:** a fresh save can play ~2 weeks of daily 15-minute visits on Quiet Lake with something
new each day, and finishing the checklist shows the "road is fixed" card.

## M2 · "Road trip: River bend"
The first real travel.
- [ ] Travel by car (map → drive fade → new scene), companions and the duck come along
- [ ] Location as data: background art, zones, moments, fish pool per place
- [ ] River bend art (bend, current, the old ferry hut), 6 river fish + the Ferryman
- [ ] Fish log pages per place; quests and fish of the day aware of places
- [ ] River moments, River checklist "Against the Current", chapters R1-R6
- [ ] Weekly quest (one bigger goal, Monday reset)

**Done when:** she can drive to the river and back, and the river has ~2 weeks of its own goals.

## M3 · "Ready for strangers" (public beta)
Everything someone who isn't Alex needs.
- [ ] Onboarding: a short first-time tutorial (cast, hook, catch bar, bag, shop)
- [ ] Choose your character (Alex stays the default; friends can play as someone else; the full
      cosmetics come in M4.5)
- [ ] Personal vs public content: decide what stays (Pajkel, Bestia, the DS4 name, band nods)
- [ ] Polish translation (the testers are Polish), text in one place
- [ ] Performance + battery pass on a mid-range Android phone
- [ ] Privacy policy page (no data leaves the phone), store listing art, screenshots
- [ ] Android build + Google Play closed test with friends (see *Google Play* below)

**Done when:** the game is in a Play closed test with 12+ friends and the crash/feedback list is short.

## M4 · "Old quarry"
Deep, clear water, odd fish, the Ironjaw (the noon legendary), chapters O1-O7, quarry checklist.
Fossil collection as a side goal (STORY §4).

## M4.5 · "Make it yours" (cosmetics, just before the public release)
Decided 2026-11-24: the public release comes at M5, and right before it players get options to
change the personal parts.
- [ ] Alex: hair, outfit, colours (the current look stays the default)
- [ ] Pajkel: the same kind of options (beard, jacket, colours)
- [ ] The car: rename it (no brand name by default in public text), maybe a colour
- [ ] The wardrobe card (also holds the Pale Scale pendant from M5)

## M5 · "Sea pier: In Waves" (the story ends)
Dunwater, gulls, the Other Angler, the finale at dawn, the Pale Scale pendant (into the M4.5 wardrobe),
the epilogue at Quiet Lake. **= version 2.0 = the public Google Play release** (decided 2026-11-24).

## After M5 (pick by mood)
Achievements + total weight per species · trophy wall / aquarium on the dock · treasure in the
catch bar · aimed casting + lake features · post-story bottle notes · seasonal events (frozen pond,
lantern festival) · future places from STORY §7 · the v2 ideas (worm farm, bait crafting,
spinning, feeder) · Pajkel's personal notes to Alex (far future) · cloud sync.

---

## Google Play: how it would work
The game is a PWA, so no rewrite is needed. Two ways to wrap it:

1. **Capacitor** (recommended): bundles the built `dist/` inside a real Android app. Works
   fully offline, no domain setup, saves stay in the app's WebView storage. One more build step
   (`npx cap sync android`, then build in Android Studio).
2. **Trusted Web Activity** (Bubblewrap / PWABuilder): a thin shell that opens the website. Needs
   `/.well-known/assetlinks.json` at the *domain root*, which a GitHub Pages project site
   (`boguckimich.github.io/somethingfishy/`) can't serve without a user-site repo or a custom domain.

What Google asks for (check the current rules when we get there, they change):
- a developer account (one-time fee, identity check);
- for new personal accounts: a **closed test with at least 12 testers for 14 days** before
  production. Friends like Grzesiu are exactly that;
- a privacy policy URL, the Data safety form (we collect nothing), a content rating
  questionnaire, store listing text, icon and screenshots;
- target a recent Android API level (Capacitor handles it).

Things to settle before going public: real car brand names in text ("DS4"), the likeness of real
people (fine for a gift, a choice for a public game), and the band nods (titles only, never lyrics;
already the rule in STORY.md).
