/**
 * Renders the app icon (src/art/appIconArt.ts) to the PNGs in public/icons. Run: npm run icons.
 * The art modules are TypeScript, so they are loaded through a throw-away Vite server (no extra deps).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const OUT = new URL('../public/icons/', import.meta.url);

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Opaque RGB PNG from a sprite ({width, height, pixels: 0xRRGGBB per pixel}). */
function encodePng({ width, height, pixels }) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const c = pixels[y * width + x];
      raw[row + 1 + x * 3] = (c >> 16) & 255;
      raw[row + 2 + x * 3] = (c >> 8) & 255;
      raw[row + 3 + x * 3] = c & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { renderIcon } = await server.ssrLoadModule('/src/art/appIconArt.ts');
  const targets = [
    ['icon-192.png', false, 192],
    ['icon-512.png', false, 512],
    ['icon-maskable-512.png', true, 512],
    ['apple-touch-icon-180.png', true, 180],
    ['favicon-32.png', false, 32],
  ];
  mkdirSync(OUT, { recursive: true });
  for (const [name, maskable, size] of targets) {
    writeFileSync(new URL(name, OUT), encodePng(renderIcon(maskable, size)));
    console.log('wrote public/icons/' + name);
  }
} finally {
  await server.close();
}
