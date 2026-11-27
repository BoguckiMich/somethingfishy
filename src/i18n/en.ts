import { DEFAULT_PROFILE, type Profile } from '../core/profile';

/**
 * English text helpers and the home for NEW shared UI strings (A3 words pass). Pure: no Phaser, no DOM.
 *
 * Data files keep plain strings with placeholders and the display code fills them in:
 *   {player}    her name (default Alex)          {companion}  his name (default Pajkel)
 *   {dog}       the dog (default Bestia)         {place}      the place now ("Quiet Lake", "River bend")
 *   {water}     the body of water with its article ("the lake", "the river")
 * Unknown placeholders are left as they are, so a typo shows up on screen instead of vanishing.
 */
export interface TextContext extends Profile {
  place: string;
  water: string;
}

export const DEFAULT_TEXT_CONTEXT: TextContext = { ...DEFAULT_PROFILE, place: 'Quiet Lake', water: 'the lake' };

/** "the lake" or "the river": what the player is standing at, by the place's background. */
export const WATER_BY_BACKGROUND: Record<'lake' | 'river', string> = { lake: 'the lake', river: 'the river' };

/** Fills `{player}`, `{companion}`, `{dog}`, `{place}` and `{water}` from the context (a bare Profile fills the names only). */
export function fill(template: string, ctx: Partial<TextContext>): string {
  if (!template.includes('{')) return template;
  return template.replace(/\{(player|companion|dog|place|water)\}/g, (whole, key: keyof TextContext) => ctx[key] ?? whole);
}

let current: TextContext = DEFAULT_TEXT_CONTEXT;

/** The scene sets this whenever the names or the place change, so UI code can call `tr` without being handed the profile. */
export function setTextContext(ctx: TextContext): void {
  current = ctx;
}

export const textContext = (): TextContext => current;

/** Fills a template from the current context (the names and place the player has now). */
export const tr = (template: string): string => fill(template, current);

/** "a" or "an" for a word, by its first letter (good enough for the fish names). */
export const article = (word: string): 'a' | 'an' => (/^[aeiou]/i.test(word.trim()) ? 'an' : 'a');

/** New shared UI strings live here (placeholders allowed). Add River Bend copy here too. */
export const EN = {
  releasedBack: 'Released it back into {water}',
  noPagesYet: 'No pages yet. Watch {water} for bottles and odd things.',
  roadFixedLines: ['The road to the river is fixed.', '{companion} packs the car.', '{dog} packs a stick.'],
  newRecord: 'New record!',
  newGearInShop: 'New gear in the shop!',
  reelInForBait: 'Reel in to change bait',
  reelInFirstStory: 'Reel in first to read the story',
  // Feeding Bestia (slice 30)
  feedNoTreats: 'Out of treats. The shop has some.',
  feedFull: "She's full. Look at that belly.",
  feedBonus: 'Spoiled. Good.',
  /** Pajkel, the first time a bobber settles in the river's slack water (slice 25c). */
  eddyLine: "Slack water. Fish don't love it there.",
  /** Pajkel, the first cast at the river with the trotting float / the heavy lead (slice 25g). */
  floatLine: 'That float rides it nicely. Longer in the seam.',
  leadLine: 'The lead holds it down there. Patient fish like that.',
  feedAsleep: '{dog} is asleep.',
  feedBedtime: 'Bedtime first.',
  feedAfter: '{dog} can eat after this one.',
  feedHeading: 'For {dog}',
} as const;
