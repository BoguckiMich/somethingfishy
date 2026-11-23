import { describe, expect, it } from 'vitest';
import { SPECIES } from './data/fish';
import { SHOP } from './data/shop';
import { newPlayer } from './inventory';
import type { Profile } from './profile';
import { newSave, type SaveData } from './save';
import { base64UrlDecode, base64UrlEncode, checksum, decodeSaveCode, encodeSaveCode } from './saveCode';

const profile: Profile = { player: 'Żaneta', companion: 'Paweł Ł.', dog: 'Bestia' };

function fullSave(): SaveData {
  const log: SaveData['player']['log'] = {};
  for (const sp of SPECIES) log[sp.id] = { count: 9, bestLengthCm: sp.lengthCm[1], bestWeightG: 1234 };
  const bag = Array.from({ length: SHOP.bagSlots }, (_, i) => ({ speciesId: SPECIES[i % SPECIES.length].id, lengthCm: 30 + i, weightG: 400 + i, price: 20 + i }));
  return { version: 1, player: { coins: 4321, worms: 17, bag, rodId: 'fiberglass', log, daily: { lastBoxDate: '2026-11-23', streakTier: 4 }, quests: { date: '2026-11-23', rerollUsed: true, list: [{ kind: 'catchSpecies', params: { target: 3, speciesId: 'roach' }, progress: 3, done: true, claimed: false, reward: { coins: 25, worms: 3 } }, { kind: 'catchAtTime', params: { target: 2, timeOfDay: 'dusk' }, progress: 1, done: false, claimed: false, reward: { coins: 30, worms: 4 } }] } }, clock: { day: 12, minute: 901.5 } };
}

describe('base64url', () => {
  it('round-trips bytes of every length', () => {
    for (let n = 0; n < 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 250) % 256);
      const text = base64UrlEncode(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(base64UrlDecode(text)!)).toEqual(Array.from(bytes));
    }
  });
  it('rejects characters outside the alphabet', () => {
    expect(base64UrlDecode('ab+/')).toBeNull();
  });
});

describe('save code', () => {
  it('round-trips a full save with non-ASCII names', () => {
    const code = encodeSaveCode(fullSave(), profile);
    expect(code.startsWith('RYBKI1-')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const r = decodeSaveCode(code);
    expect(r).toEqual({ ok: true, save: fullSave(), profile });
  });
  it('round-trips a new save', () => {
    const r = decodeSaveCode(encodeSaveCode(newSave(), profile));
    expect(r.ok && r.save).toEqual({ ...newSave(), player: newPlayer() });
  });
  it('ignores whitespace and newlines from pasting', () => {
    const code = encodeSaveCode(fullSave(), profile);
    const wrapped = '  ' + code.replace(/(.{40})/g, '$1\n ') + '\n';
    expect(decodeSaveCode(wrapped).ok).toBe(true);
  });
  it('rejects text that is not a code', () => {
    expect(decodeSaveCode('hello')).toEqual({ ok: false, reason: 'notACode' });
    expect(decodeSaveCode('')).toEqual({ ok: false, reason: 'notACode' });
    expect(decodeSaveCode('RYBKI2-abc-123456')).toEqual({ ok: false, reason: 'notACode' });
  });
  it('detects a truncated or altered code as incomplete', () => {
    const code = encodeSaveCode(fullSave(), profile);
    expect(decodeSaveCode(code.slice(0, code.length - 20))).toEqual({ ok: false, reason: 'incomplete' });
    expect(decodeSaveCode('RYBKI1-')).toEqual({ ok: false, reason: 'incomplete' });
    const i = 12;
    const flipped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeSaveCode(flipped)).toEqual({ ok: false, reason: 'incomplete' });
  });
  it('reports a newer version', () => {
    const doc = JSON.stringify({ save: { ...newSave(), version: 5 }, profile });
    const code = codeFromJson(doc);
    expect(decodeSaveCode(code)).toEqual({ ok: false, reason: 'tooNew' });
  });
  it('reports an unreadable payload', () => {
    expect(decodeSaveCode(codeFromJson('not json'))).toEqual({ ok: false, reason: 'unreadable' });
    expect(decodeSaveCode(codeFromJson('{"profile":{}}'))).toEqual({ ok: false, reason: 'unreadable' });
  });
  it('normalises what it imports', () => {
    const doc = JSON.stringify({ save: { version: 1, player: { coins: -4, rodId: 'x' }, clock: { day: 0, minute: 5000 } }, profile: { player: '  ' } });
    const r = decodeSaveCode(codeFromJson(doc));
    expect(r.ok && r.save.player.coins).toBe(0);
    expect(r.ok && r.save.player.rodId).toBe('bamboo');
    expect(r.ok && r.profile).toEqual({ player: 'Alex', companion: 'Pajkel', dog: 'Bestia' });
  });
});

/** A well-formed code (right prefix and checksum) around arbitrary JSON text. */
function codeFromJson(json: string): string {
  const payload = base64UrlEncode(new TextEncoder().encode(json));
  return `RYBKI1-${payload}-${checksum(payload)}`;
}
