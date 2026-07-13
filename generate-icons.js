// GRANULA icon generator — draws the ember gradient and writes PNG with no dependencies.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

// smooth interpolation over an array of stops [{p, c:[r,g,b]}]
function gradient(stops, y) {
  if (y <= stops[0].p) return stops[0].c;
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i].p) {
      const a = stops[i - 1], b = stops[i];
      const t = smooth((y - a.p) / (b.p - a.p));
      return [lerp(a.c[0], b.c[0], t), lerp(a.c[1], b.c[1], t), lerp(a.c[2], b.c[2], t)];
    }
  }
  return stops[stops.length - 1].c;
}

const STOPS = [
  { p: 0.00, c: [8, 7, 10] },
  { p: 0.26, c: [232, 64, 32] },   // red
  { p: 0.44, c: [242, 202, 180] }, // hot cream core
  { p: 0.66, c: [58, 124, 114] },  // teal
  { p: 1.00, c: [10, 16, 18] },
];

// vertical "flame" + soft horizontal vignette
function color(nx, ny) {
  const base = gradient(STOPS, ny);
  const black = [6, 5, 8];
  // glow is strongest along the column center, falls off toward the X edges
  const edge = Math.abs(nx - 0.5) * 2;          // 0 at center .. 1 at edge
  const column = Math.pow(1 - smooth(edge * 0.9), 1.2);
  const g = Math.max(0, Math.min(1, column));
  return [
    Math.round(lerp(black[0], base[0], g)),
    Math.round(lerp(black[1], base[1], g)),
    Math.round(lerp(black[2], base[2], g)),
  ];
}

function makePNG(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = color(x / (size - 1), y / (size - 1));
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = 255;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const dir = __dirname;
for (const size of [180, 192, 512]) {
  const file = path.join(dir, `icon-${size}.png`);
  fs.writeFileSync(file, makePNG(size));
  console.log("wrote", file);
}
