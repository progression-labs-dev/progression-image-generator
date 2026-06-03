// PL Imagery v2 — apply the pixel/ASCII signature to every.to-style engravings.
// Subject is keyed off the flat colour field (line-art defeats rembg), so the field
// stays perfectly flat and colour appears ONLY in the pixelated subject zone.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync } from 'fs';
import { PAL, isOnEffectSide, loadBuffer, renderVariant, save } from './mosaic-core.mjs';

const LAB = '/Users/joe/code/pl-imagery-lab';
const ENG = `${LAB}/engravings`;
mkdirSync(`${LAB}/out/eng`, { recursive: true });

// ── flat-field colour key → subject mask (1 = subject, 0 = flat field) ──
function fieldColor(buf) {
  const { data, width, height } = buf;
  const pts = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) { const i = (y * width + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  return [r / 4, g / 4, b / 4];
}
function subjectMask(buf, thresh = 64) {
  const { data, width, height } = buf;
  const [fr, fg, fb] = fieldColor(buf);
  const m = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const dr = data[i * 4] - fr, dg = data[i * 4 + 1] - fg, db = data[i * 4 + 2] - fb;
    m[i] = Math.sqrt(dr * dr + dg * dg + db * db) > thresh ? 1 : 0;
  }
  return m;
}
function splitRegion(w, h, pos, angle) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = isOnEffectSide(x, y, w, h, pos, angle) ? 1 : 0;
  return m;
}
function band(w, h, frac) { // bottom band
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = y > h * (1 - frac) ? 1 : 0;
  return m;
}
const and = (a, b) => { const m = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) m[i] = a[i] && b[i] ? 1 : 0; return m; };

const palOf = (k) => k === 'orange' ? PAL.orange : k === 'lightblue' ? PAL.navySky : PAL.blue;

function treat(buf, subj, kind, src) {
  const w = buf.width, h = buf.height;
  let mask;
  if (kind === 'full') mask = subj;
  else if (kind === 'dissolve') mask = and(subj, splitRegion(w, h, src.split.pos, src.split.angle));
  else mask = and(subj, band(w, h, 0.18)); // accent = bottom-edge band
  return renderVariant(buf, mask, {
    direction: 'subject', colorMode: 'gradient', palette: palOf(src.pix),
    cellSize: 8, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.8, asciiInk: 'brand',
  });
}

// ── sources (field colour known from generation → choose complementary pixel colour) ──
const SOURCES = [
  { f: 'eng_figure',    pix: 'orange', split: { pos: 0.42, angle: 90 } }, // blue field
  { f: 'eng_figure2',   pix: 'blue',   split: { pos: 0.42, angle: 90 } }, // orange field
  { f: 'eng_agents',    pix: 'orange', split: { pos: 0.50, angle: 0 } },  // blue field
  { f: 'eng_knowledge', pix: 'orange', split: { pos: 0.50, angle: 0 } },  // navy field
  { f: 'eng_crystal',   pix: 'orange', split: { pos: 0.50, angle: 45 } }, // navy field
  { f: 'eng_object',    pix: 'orange', split: { pos: 0.50, angle: 45 } }, // light-blue field
  { f: 'eng_classical', pix: 'blue',   split: { pos: 0.50, angle: 0 } },  // orange field
  { f: 'eng_pointer',   pix: 'orange', split: { pos: 0.42, angle: 90 } }, // blue field
];

function montage(title, tiles, cols, box) {
  const pad = 24, labelH = 30, gap = 16, titleH = 64;
  const rows = Math.ceil(tiles.length / cols);
  const W = pad * 2 + cols * box.w + (cols - 1) * gap;
  const H = titleH + pad + rows * (box.h + labelH) + (rows - 1) * gap + pad;
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = '600 24px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(title, pad, 24);
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * (box.w + gap);
    const y = titleH + pad + Math.floor(i / cols) * (box.h + labelH + gap);
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, box.w, box.h);
    const s = Math.min(box.w / t.canvas.width, box.h / t.canvas.height);
    const dw = t.canvas.width * s, dh = t.canvas.height * s;
    ctx.drawImage(t.canvas, x + (box.w - dw) / 2, y + (box.h - dh) / 2, dw, dh);
    ctx.fillStyle = '#15151f'; ctx.fillRect(x, y + box.h, box.w, labelH);
    ctx.fillStyle = '#e8e8ef'; ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, x + box.w / 2, y + box.h + labelH / 2);
    ctx.textAlign = 'left';
  });
  return ctx.canvas;
}

const bufs = {}, masks = {};
for (const s of SOURCES) { bufs[s.f] = await loadBuffer(`${ENG}/${s.f}.png`); masks[s.f] = subjectMask(bufs[s.f]); }

// Sheet T — three treatments on three hero sources
const heroes = ['eng_figure', 'eng_agents', 'eng_crystal'];
const tTiles = [];
for (const f of heroes) {
  const src = SOURCES.find(s => s.f === f);
  for (const kind of ['dissolve', 'accent', 'full']) {
    const c = treat(bufs[f], masks[f], kind, src);
    await save(c, `${LAB}/out/eng/${f}_${kind}.png`);
    tTiles.push({ canvas: c, label: `${f.replace('eng_', '')} · ${kind}` });
  }
}
await save(montage('v2 · THREE TREATMENTS  (engraving + pixel signature · colour in pixel zone)', tTiles, 3, { w: 330, h: 300 }), `${LAB}/out/eng-treatments.png`);
console.log('saved eng-treatments.png');

// Sheet S — the dissolve treatment across all 8 subjects (cohesion)
const sTiles = [];
for (const s of SOURCES) {
  const c = treat(bufs[s.f], masks[s.f], 'dissolve', s);
  await save(c, `${LAB}/out/eng/${s.f}_dissolve.png`);
  sTiles.push({ canvas: c, label: `${s.f.replace('eng_', '')} · dissolve` });
}
await save(montage('v2 · DISSOLVE across subjects  (every.to formula, PL pixel signature)', sTiles, 4, { w: 300, h: 240 }), `${LAB}/out/eng-subjects.png`);
console.log('saved eng-subjects.png');
console.log('individual finished images in out/eng/');
