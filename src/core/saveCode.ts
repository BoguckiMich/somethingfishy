import { normalizeProfile, type Profile } from './profile';
import { migrateAndNormalize, type SaveData } from './save';

/**
 * The export code: `RYBKI1-` + base64url of the JSON `{ save, profile }` + `-` + a 6-hex-digit
 * checksum, so a truncated paste is caught. Not compressed, not encrypted. Pure: no btoa or browser globals.
 */
const PREFIX = 'RYBKI1-';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[n & 63];
  }
  return out;
}

/** Null for characters outside the alphabet or an impossible length. */
export function base64UrlDecode(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
      acc &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/** FNV-1a over the payload text, as 6 hex digits. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h & 0xffffff).toString(16).padStart(6, '0');
}

export function encodeSaveCode(save: SaveData, profile: Profile): string {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ save, profile })));
  return `${PREFIX}${payload}-${checksum(payload)}`;
}

export type DecodeResult =
  | { ok: true; save: SaveData; profile: Profile }
  | { ok: false; reason: 'notACode' | 'incomplete' | 'tooNew' | 'unreadable' };

export function decodeSaveCode(text: string): DecodeResult {
  const code = text.replace(/\s+/g, '');
  if (!code.startsWith(PREFIX)) return { ok: false, reason: 'notACode' };
  const rest = code.slice(PREFIX.length);
  const dash = rest.lastIndexOf('-');
  // The alphabet itself has '-', so the checksum is always the last 6 chars after the last dash.
  if (dash < 0 || rest.length - dash - 1 !== 6) return { ok: false, reason: 'incomplete' };
  const payload = rest.slice(0, dash);
  if (checksum(payload) !== rest.slice(dash + 1)) return { ok: false, reason: 'incomplete' };
  const bytes = base64UrlDecode(payload);
  if (!bytes) return { ok: false, reason: 'unreadable' };
  let doc: unknown;
  try {
    doc = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (typeof doc !== 'object' || doc === null) return { ok: false, reason: 'unreadable' };
  const { save, profile } = doc as { save?: unknown; profile?: Partial<Profile> };
  const r = migrateAndNormalize(save);
  if (!r.ok) return r;
  return { ok: true, save: r.save, profile: normalizeProfile(profile) };
}
