/** The camp items on the grass by the car (GAME_DESIGN section 5, Pacing rework, slice 23e). A coin sink, for sale from the start. Rules live in core/camp.ts. */
export type CampId = 'campfire' | 'deckchair' | 'dogbed' | 'tent' | 'lights' | 'windsock';

export interface CampItem {
  /** Item id: the shop icon (art/shopIconArt.ts), the scene sprite (art/campArt.ts) and the saved list use it. */
  id: CampId;
  name: string;
  price: number;
  /** One line for the shop card, honest about what it does. */
  effect: string;
}

/** In shop order (the saved list is kept in this order too). */
export const CAMP_ITEMS: readonly CampItem[] = [
  { id: 'campfire', name: 'Campfire', price: 800, effect: 'Crackles by the car, glows at dusk and night' },
  { id: 'deckchair', name: 'Deck chair for Pajkel', price: 600, effect: 'A striped chair for Pajkel on the dock' },
  { id: 'dogbed', name: "Bestia's bed", price: 1000, effect: 'A bed for Bestia by the car' },
  { id: 'tent', name: 'Tent', price: 1500, effect: 'A small tent by the car' },
  { id: 'lights', name: 'String lights', price: 1200, effect: 'Coloured lights that glow at night' },
  { id: 'windsock', name: 'Windsock', price: 400, effect: "Shows today's wind: limp, half or full" },
];

export const CAMP_IDS: readonly CampId[] = CAMP_ITEMS.map((c) => c.id);
export const campItemById = (id: string): CampItem | undefined => CAMP_ITEMS.find((c) => c.id === id);
