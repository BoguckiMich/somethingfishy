/**
 * The one Rybki palette: warm, slightly desaturated, Stardew-ish. Every sprite and scenery
 * raster draws only from these colours (the day cycle tints them at runtime).
 * Colours are 0xRRGGBB.
 */
export const PAL = {
  // Neutrals / outlines
  outline: 0x241a2e,
  outlineSoft: 0x3a2b3c,
  white: 0xfff8e8,
  whiteShade: 0xd9d4cc,
  cream: 0xf3e3bf,

  // Warm accents
  red: 0xd9433a,
  redLight: 0xff7d5e,
  redDark: 0x8f2b38,
  gold: 0xffd35a,
  pink: 0xf08aa8,
  blueFlower: 0x8fb3f2,

  // Wood
  woodDeep: 0x3a2318,
  woodDark: 0x5c3a22,
  wood: 0x84582f,
  woodLight: 0xab7842,
  woodHi: 0xcb9c5a,

  // Foliage
  leafDeep: 0x1d3a2c,
  leafDark: 0x2c5a3a,
  leaf: 0x43803e,
  leafLight: 0x6aa84c,
  leafHi: 0x9ecb5c,
  pineDeep: 0x16302b,
  pineDark: 0x1f4a3c,
  pine: 0x2d6548,
  pineLight: 0x45805a,

  // Grass
  grass0: 0x3a7436,
  grass1: 0x56963e,
  grass2: 0x79b04a,
  grass3: 0xa2cb5c,

  // Sand / stone
  sandDark: 0xb08a58,
  sand: 0xd6b57a,
  sandLight: 0xecd49c,
  stoneDark: 0x5d5a68,
  stone: 0x8d8a92,
  stoneLight: 0xbab5b0,

  // Water
  deep0: 0x1a3b6e,
  deep1: 0x234c86,
  deep2: 0x2d5f9a,
  shallow0: 0x3a76ae,
  shallow1: 0x4a8cbe,
  shallow2: 0x5fa4ca,
  shallow3: 0x7bbcd6,
  foam: 0xd4ecee,

  // Angler
  skin: 0xf0b98e,
  skinShade: 0xc58762,
  hair: 0x6a4430,
  straw: 0xe6c258,
  strawLight: 0xf8e38c,
  strawDark: 0xb78837,
  shirt: 0xc9503f,
  shirtLight: 0xe47b5a,
  shirtDark: 0x95393a,
  denim: 0x3f5f9c,
  denimLight: 0x5f83c2,
  denimDark: 0x2b4474,

  // Reeds / lilies
  reed: 0x7a9b3c,
  reedLight: 0xa3c256,
  reedDark: 0x4b6b2d,
  lily: 0x4f9b4b,
  lilyDark: 0x2f6e40,

  // Sky things
  cloud: 0xfffaf0,
  cloudShade: 0xdbe2f2,
  cloudDark: 0xb5c0de,
  sun: 0xfff3b4,
  sunEdge: 0xffcf5c,
  moon: 0xf6f1e0,
  moonShade: 0xc9cde0,
  moonDark: 0xa2a8c6,
  hillFar: 0x86a8a6,
  hillFarDark: 0x6d9296,
  hill: 0x5f9470,
  hillDark: 0x477a5e,

  // Characters
  tee: 0x2b2b34,
  teeLight: 0x42424e,
  teeDark: 0x18181f,
  // Ash-leaning light brown: deliberately less orange than the dock planks.
  alexHair: 0x9e7e5c,
  alexHairLight: 0xc9ab82,
  alexHairHi: 0xe8d4ae,
  alexHairDark: 0x684a38,
  pajHair: 0xcaa45c,
  pajHairLight: 0xe4c680,
  pajHairDark: 0x9a7a40,
  capWhite: 0xfffbf0,
  capShade: 0xd2cabc,
  capBrimUnder: 0x9a9286,
  beard: 0x7e5836,
  beardLight: 0xa17a4c,
  beardDark: 0x573a20,
  beardGrey: 0x9a8a76,
  // Pajkel's jacket: lighter than the black tee so he reads against the dark dock.
  jacket: 0x62758c,
  jacketLight: 0x8396ad,
  jacketDark: 0x46566a,
  jeans: 0x34425e,
  shoe: 0xe6e1d6,
  shoeDark: 0x4a4455,
  watch: 0xf0f0f6,
  mug: 0x5b9480,
  mugDark: 0x3d6b5c,
  ginger: 0xc2693a,
  gingerLight: 0xe08c52,
  gingerDark: 0x8c4a2a,
  harness: 0xf2c424,
  harnessDark: 0xb88a14,
  heart: 0xe8505b,

  // The catch bar
  barWater: 0x1d3250,

  // Night creatures
  firefly: 0xe6ff72,
  fireflyGlow: 0xa6d84a,
} as const;

export type PaletteColor = (typeof PAL)[keyof typeof PAL];
