import { BAITS, type Bait } from './data/baits';
import { isLegendary, type Species } from './data/fish';
import { KNOWLEDGE_TIERS, NOT_FUSSY } from './data/fishKnowledge';
import { WEATHER_WORDS, type WeatherId } from './data/weather';
import { starFor } from './data/stars';
import { weightG } from './fish';

/** One extra line on a species' log card (slice 22e). */
export interface KnowledgeRow {
  kind: 'range' | 'bait' | 'weather' | 'gold';
  /** Catches needed to learn it. */
  need: number;
  unlocked: boolean;
  /** The line itself; for a locked row "??? · catch 5 to learn". */
  text: string;
  /** For `bait`: the favourite baits (empty = not fussy). */
  baitIds: string[];
  /** For `weather` (slice 23b): the weathers it likes, shown with their icons. */
  weatherIds: WeatherId[];
}

/** "20 g", "300 g", "1.6 kg", "43 kg": two significant figures, kg from 1000 g. */
export function formatWeightRounded(grams: number): string {
  if (grams < 100) return `${Math.max(1, Math.round(grams / 5) * 5)} g`;
  if (grams < 1000) return `${Math.round(grams / 10) * 10} g`;
  const kg = grams / 1000;
  return kg < 10 ? `${kg.toFixed(1)} kg` : `${Math.round(kg)} kg`;
}

/** "12-30 cm · 20-300 g" from the species data. */
export function sizeRangeText(species: Species): string {
  const [min, max] = species.lengthCm;
  const lo = formatWeightRounded(weightG(species, min));
  const hi = formatWeightRounded(weightG(species, max));
  // Same unit twice: say it once ("1.6-43 kg" only when both are kg).
  const [loN, loU] = lo.split(' ');
  const [hiN, hiU] = hi.split(' ');
  const weight = loU === hiU ? `${loN}-${hiN} ${hiU}` : `${lo}-${hi}`;
  return `${min}-${max} cm · ${weight}`;
}

/** The baits that boost this species by name (several can). Rarity boosts are not a "favourite". */
export function favouriteBaits(species: Species, baits: readonly Bait[] = BAITS): { id: string; name: string }[] {
  return baits.filter((b) => b.speciesBoost?.ids.includes(species.id)).map((b) => ({ id: b.id, name: b.name }));
}

/** The shortest whole length that earns the gold star. */
export function goldFromCm(species: Species): number {
  const [min, max] = species.lengthCm;
  for (let cm = min; cm <= max; cm++) if (starFor(species, cm) === 'gold') return cm;
  return max;
}

/** The extra lines of the card, unlocked by `count` catches. The legendary has none; old saves unlock from their counts. */
export function knowledgeRows(species: Species, count: number): KnowledgeRow[] {
  if (isLegendary(species)) return [];
  const lock = (need: number) => `??? · catch ${need} to learn`;
  const baits = favouriteBaits(species);
  const likes = species.likes ?? [];
  const rows: { kind: KnowledgeRow['kind']; need: number; text: string; baitIds: string[]; weatherIds: WeatherId[] }[] = [
    { kind: 'range', need: KNOWLEDGE_TIERS.range, text: sizeRangeText(species), baitIds: [], weatherIds: [] },
    {
      kind: 'bait',
      need: KNOWLEDGE_TIERS.bait,
      text: baits.length ? `Bites best on: ${baits.map((b) => b.name.toLowerCase()).join(', ')}` : NOT_FUSSY,
      baitIds: baits.map((b) => b.id),
      weatherIds: [],
    },
    // The weather it likes comes with the favourite bait; a species with none has no such line, and it stays hidden until learned.
    ...(likes.length > 0 && count >= KNOWLEDGE_TIERS.bait
      ? [{ kind: 'weather' as const, need: KNOWLEDGE_TIERS.bait, text: `Likes: ${likes.map((w) => WEATHER_WORDS[w]).join(', ')}`, baitIds: [], weatherIds: likes }]
      : []),
    { kind: 'gold', need: KNOWLEDGE_TIERS.gold, text: `Gold from ${goldFromCm(species)} cm`, baitIds: [], weatherIds: [] },
  ];
  return rows.map((r) => {
    const unlocked = count >= r.need;
    return { ...r, unlocked, text: unlocked ? r.text : lock(r.need), baitIds: unlocked ? r.baitIds : [] };
  });
}
