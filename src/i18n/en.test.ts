import { describe, expect, it } from 'vitest';
import { CAMP_ITEMS } from '../core/data/camp';
import { BEDTIME_LINES, GIVE_UP_LINES, GOLD_LINES, MEDAL_LINES } from '../core/data/pajkelLines';
import { STORY_LINES } from '../core/data/story';
import { TROPHY_TEXT } from '../core/data/rare';
import { article, DEFAULT_TEXT_CONTEXT, EN, fill, setTextContext, textContext, tr } from './en';

describe('fill', () => {
  const ctx = { player: 'Mia', companion: 'Tom', dog: 'Rex', place: 'River bend', water: 'the river' };
  it('fills every placeholder, more than once', () => {
    expect(fill('{dog}, come! {dog}! {player} and {companion}', ctx)).toBe('Rex, come! Rex! Mia and Tom');
    expect(fill('Fish at {place}, back into {water}', ctx)).toBe('Fish at River bend, back into the river');
  });
  it('leaves plain text and unknown or missing placeholders alone', () => {
    expect(fill('Nothing here', ctx)).toBe('Nothing here');
    expect(fill('{nobody} {dog}', { player: 'A' })).toBe('{nobody} {dog}');
  });
  it('tr uses the current context', () => {
    expect(tr('Hi {player}')).toBe('Hi Alex');
    setTextContext({ ...DEFAULT_TEXT_CONTEXT, player: 'Zed' });
    expect(tr('Hi {player}')).toBe('Hi Zed');
    expect(textContext().player).toBe('Zed');
    setTextContext(DEFAULT_TEXT_CONTEXT);
  });
});

describe('article', () => {
  it('picks a or an', () => {
    expect(article('eel')).toBe('an');
    expect(article('Asp')).toBe('an');
    expect(article('perch')).toBe('a');
  });
});

describe('no hardcoded names in shown data', () => {
  const NAMES = /\b(Alex|Pajkel|Bestia)\b/;
  const all: string[] = [
    ...BEDTIME_LINES, ...GIVE_UP_LINES, ...GOLD_LINES, ...MEDAL_LINES, ...Object.values(STORY_LINES),
    ...Object.values(TROPHY_TEXT.pajkelFirst), TROPHY_TEXT.backInLake, ...Object.values(EN).flat(),
    ...CAMP_ITEMS.flatMap((c) => [c.name, c.effect]),
  ];
  it('uses placeholders instead', () => {
    for (const t of all) expect(t).not.toMatch(NAMES);
  });
});
