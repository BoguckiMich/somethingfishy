import type { JournalIcon } from '../core/data/story';
import { BLINK_OPEN, DUCK, FOOTPRINT, STICK, STORY_BOTTLE } from './momentArt';
import { PAL } from './palette';
import { sprite, type Sprite } from './pixelGrid';

/** 16 x 9: a little car seen from the side (the road is open, chapter 8). */
const CAR_ICON = sprite(
  `
  ......oooooo....
  .....oWWWWWWo...
  ....oWWWoWWWWo..
  ..ooRRRRRRRRRRoo
  .oRRRRRRRRRRRRRo
  oRRRRRRRRRRRRRRo
  oRRoooRRRRRoooRo
  .ooOOOooooOOOoo.
  ...oOOo..oOOo...
`,
  { o: PAL.outline, W: PAL.foam, R: PAL.red, O: PAL.stoneDark },
);

/** 17 x 8: the Pale One, a white fish (the bonus page). */
const PALE_ICON = sprite(
  `
  ......ooooo......
  ....ooWWWWWoo..oo
  ..ooWWWWWWWWWooWo
  .oWWWWkWWWWWWWWWo
  .oWWWWWWWWWWWWWWo
  ..ooWWWWWWWWWooWo
  ....ooWWWWWoo..oo
  ......ooooo......
`,
  { o: PAL.outline, W: PAL.white, k: PAL.outline },
);

/** 20 x 14: W.'s hut by the bend (R2): weathered boards, a stove pipe with a wisp of steam. */
const HUT_ICON = sprite(
  `
  ..............oo....
  .............oWWo...
  ..........ooooWo....
  ..........oSSo.o....
  ...oooooooooSo......
  ..oHHHHHHHHHHHo.....
  .oHHhHHhHHhHHHHo....
  ooooooooooooooooo...
  .oBbBbBbBbBbBbBo....
  .oBbBbBbBbBbBbBo....
  .oBbooBbBbBsssBo....
  .oBbodBbBbBsWsBo....
  .oBbooBbBbBsssBo....
  .oooooooooooooooo...
`,
  { o: PAL.outline, W: PAL.white, S: PAL.stoneDark, H: PAL.woodDark, h: PAL.wood, B: PAL.wood, b: PAL.woodLight, d: PAL.gold, s: PAL.shallow2 },
);

/** 17 x 9: an old key hook with its gate tag, the key missing (R6). */
const KEY_ICON = sprite(
  `
  ...ooooooo.......
  ..oGGGGGGGo......
  ..oGooooGGo......
  ..oGoTTooGo......
  ...ooTTTTo.......
  .....oTTTTo......
  ......oTTTTo.....
  .......oTTTo.....
  ........ooo......
`,
  { o: PAL.outline, G: PAL.stone, T: PAL.sandLight },
);

/** The picture a journal page starts with. */
export function journalIconSprite(icon: JournalIcon): Sprite {
  switch (icon) {
    case 'bottle':
      return STORY_BOTTLE;
    case 'duck':
      return DUCK;
    case 'star':
      return BLINK_OPEN;
    case 'prints':
      return FOOTPRINT;
    case 'car':
      return CAR_ICON;
    case 'pale':
      return PALE_ICON;
    case 'stick':
      return STICK;
    case 'hut':
      return HUT_ICON;
    case 'key':
      return KEY_ICON;
  }
}
