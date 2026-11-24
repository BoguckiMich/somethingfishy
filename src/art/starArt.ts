import { STAR_COUNT, type Star } from '../core/data/stars';
import { PAL } from './palette';
import { TRANSPARENT, sprite, type Sprite } from './pixelGrid';

/** Pure art for the size stars (slice 19): a 9 x 9 pixel star per tier, and a row of 1-3 of them. Usable in Phaser and on DOM canvases. */

type Tier = Exclude<Star, 'none'>;
/** Body, highlight and edge per tier. Silver is a grey star (stone body, white highlight, dark stone edge) so it stays visible on bright water. */
const FILL: Record<Tier, { f: number; h: number; o: number }> = {
  bronze: { f: 0xcd7f45, h: 0xefb27d, o: PAL.outline },
  silver: { f: PAL.stoneLight, h: PAL.white, o: PAL.stoneDark },
  gold: { f: 0xffc72c, h: 0xfff3a6, o: PAL.outline },
};

const STAR = `
....o....
...ofo...
..ofhfo..
ooofhfooo
offfffffo
.offfffo.
.offoffo.
.ofo.ofo.
..o...o..
`;

export const STAR_SIZE = 9;

/** One star of the tier. */
export function starSprite(tier: Tier): Sprite {
  return sprite(STAR, { o: FILL[tier].o, f: FILL[tier].f, h: FILL[tier].h });
}

/** The stars a fish of this star shows, side by side with a 1 px gap (1 bronze, 2 silver, 3 gold); undefined for none. */
export function starRowSprite(star: Star): Sprite | undefined {
  if (star === 'none') return undefined;
  const n = STAR_COUNT[star];
  const one = starSprite(star);
  const width = n * STAR_SIZE + (n - 1);
  const pixels = new Int32Array(width * STAR_SIZE).fill(TRANSPARENT);
  for (let i = 0; i < n; i++) {
    for (let y = 0; y < STAR_SIZE; y++) for (let x = 0; x < STAR_SIZE; x++) pixels[y * width + i * (STAR_SIZE + 1) + x] = one.pixels[y * STAR_SIZE + x];
  }
  return { width, height: STAR_SIZE, pixels };
}

/** Texture key of a star row (Phaser). */
export const starKey = (star: Star): string => `star:${star}`;
