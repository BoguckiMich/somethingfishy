import type { JournalIcon } from '../core/data/story';
import { BLINK_OPEN, DUCK, FOOTPRINT, STORY_BOTTLE } from './momentArt';
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
  }
}
