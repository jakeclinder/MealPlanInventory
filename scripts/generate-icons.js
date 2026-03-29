#!/usr/bin/env node
// Generates icon-192.png, icon-512.png, and apple-touch-icon.png (180x180)
// using only Node.js built-ins (no canvas / sharp needed).
//
// Design: warm cream (#FAF7F2) background, terracotta (#D4856A) rounded-square
// badge — matches the app palette.  Swap in real artwork any time by replacing
// the files in public/.

import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public");

// ── CRC-32 (required by the PNG spec for every chunk) ──────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG chunk builder ───────────────────────────────────────────────────────
function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const dataBytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dataBytes.length, 0);
  const crcInput = Buffer.concat([typeBytes, dataBytes]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, dataBytes, crcBuf]);
}

// ── Pixel shader ────────────────────────────────────────────────────────────
// Returns [r, g, b, a] for each pixel.  Draws a rounded-rectangle badge.
function pixel(x, y, w, h) {
  // Badge occupies 80% of the canvas, centred
  const pad = w * 0.1;
  const bx1 = pad, by1 = pad, bx2 = w - pad, by2 = h - pad;
  const radius = (bx2 - bx1) * 0.22; // corner radius

  // Rounded-rect signed-distance check
  const qx = Math.max(Math.abs(x - (bx1 + bx2) / 2) - (bx2 - bx1) / 2 + radius, 0);
  const qy = Math.max(Math.abs(y - (by1 + by2) / 2) - (by2 - by1) / 2 + radius, 0);
  const dist = Math.sqrt(qx * qx + qy * qy) - radius;

  if (dist <= 0) {
    // Inside badge — terracotta #D4856A
    return [0xd4, 0x85, 0x6a, 0xff];
  }
  // Outside — cream #FAF7F2
  return [0xfa, 0xf7, 0xf2, 0xff];
}

// ── PNG encoder ─────────────────────────────────────────────────────────────
function makePNG(w, h) {
  // Raw image data: one filter byte (0 = None) per row, then RGBA pixels
  const raw = Buffer.alloc(h * (1 + w * 4));
  let offset = 0;
  for (let y = 0; y < h; y++) {
    raw[offset++] = 0; // filter type: None
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y, w, h);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // colour type: RGBA
  // compression, filter, interlace all 0

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk("IHDR", ihdrData), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Generate ─────────────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const png = makePNG(size, size);
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`✓  icon-${size}.png  (${png.length} bytes)`);
}

const apple = makePNG(180, 180);
writeFileSync(join(OUT, "apple-touch-icon.png"), apple);
console.log(`✓  apple-touch-icon.png  (${apple.length} bytes)`);
