// PL Imagery v2 — LOCKED signature: feathered "dissolve", mostly-blue.
// Engraving subject keyed off the flat field; field recoloured to a consistent
// blue/navy; subject dissolves into a light-blue pixel/ASCII mosaic with a soft
// scattered boundary. Orange used once as a rare accent.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync } from 'fs';
import { PAL, FIELD, loadBuffer, renderVariant, save } from './mosaic-core.mjs';

const LAB = '/Users/joe/code/pl-imagery-lab';
const ENG = `${LAB}/engravings`;
mkdirSync(`${LAB}/out/final`, { recursive: true });

const SCALE = 2.5;                 // upscale sources so finals are large enough to inspect/use
const CELL = Math.round(8 * SCALE); // keep block density constant relative to the image

const hash = (x, y) => ((x * 7919 + y * 104729) >>> 0) / 4294967296;

// High-quality upscale of an ImageBuffer via canvas (keeps engraving smooth; pixel
// cells are drawn fresh at CELL size so the mosaic stays crisp).
function upscaleBuffer(buf, scale) {
  const w = Math.round(buf.width * scale), h = Math.round(buf.height * scale);
  const src = createCanvas(buf.width, buf.height); const sctx = src.getContext('2d');
  const id = sctx.createImageData(buf.width, buf.height); id.data.set(buf.data); sctx.putImageData(id, 0, 0);
  const dst = createCanvas(w, h); const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = true; dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(src, 0, 0, w, h);
  return { ...dctx.getImageData(0, 0, w, h), width: w, height: h };
}

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
// Replace the flat field (mask==0) with a clean brand colour → returns a new buffer.
function recolorField(buf, mask, rgb) {
  const data = new Uint8ClampedArray(buf.data);
  for (let i = 0; i < buf.width * buf.height; i++) {
    if (mask[i] === 0) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255; }
  }
  return { data, width: buf.width, height: buf.height };
}
// Feathered dissolve: probabilistic, per-cell scatter across a transition band.
function dissolveMask(buf, subj, split, bandFrac = 0.36, cell = 16) {
  const w = buf.width, h = buf.height;
  const rad = split.angle * Math.PI / 180, nx = Math.cos(rad), ny = Math.sin(rad);
  const cx = split.pos * w, cy = split.pos * h;
  const range = Math.abs(nx) * w + Math.abs(ny) * h;
  const band = bandFrac * range;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!subj[y * w + x]) continue;
    const d = (x - cx) * nx + (y - cy) * ny;
    const p = d > band / 2 ? 1 : d < -band / 2 ? 0 : (d + band / 2) / band;
    if (hash(Math.floor(x / cell), Math.floor(y / cell)) < p) m[y * w + x] = 1;
  }
  return m;
}

// Dissolve ramp: engraving dark→deep navy, mid→blue, light→light-blue. Internal
// dark/light contrast so the pixel zone reads clearly on a bright electric-blue field.
const BLUE_DISSOLVE = { stops: [[6, 20, 70], [30, 110, 255], [200, 225, 255]], interp: 'hsl' };
const palOf = (k) => k === 'orange' ? PAL.orange : BLUE_DISSOLVE;

// mostly-blue: bright electric-blue field everywhere (so the B&W engraving reads),
// light-blue pixel dissolve; crystal = the lone orange accent.
const SOURCES = [
  { f: 'eng_figure',    field: FIELD.blue, pix: 'lightblue', split: { pos: 0.40, angle: 90 } },
  { f: 'eng_figure2',   field: FIELD.blue, pix: 'lightblue', split: { pos: 0.42, angle: 90 } },
  { f: 'eng_agents',    field: FIELD.blue, pix: 'lightblue', split: { pos: 0.52, angle: 0 } },
  { f: 'eng_knowledge', field: FIELD.blue, pix: 'lightblue', split: { pos: 0.50, angle: 0 } },
  { f: 'eng_crystal',   field: FIELD.blue, pix: 'orange',    split: { pos: 0.48, angle: 45 } }, // rare accent
  { f: 'eng_object',    field: FIELD.blue, pix: 'lightblue', split: { pos: 0.50, angle: 45 } },
  { f: 'eng_classical', field: FIELD.blue, pix: 'lightblue', split: { pos: 0.52, angle: 0 } },
  { f: 'eng_pointer',   field: FIELD.blue, pix: 'lightblue', split: { pos: 0.40, angle: 90 } },
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

const tiles = [];
for (const s of SOURCES) {
  const raw = await loadBuffer(`${ENG}/${s.f}.png`);
  const up = upscaleBuffer(raw, SCALE);
  const subj = subjectMask(up);
  const buf = recolorField(up, subj, s.field);
  const mask = dissolveMask(buf, subj, s.split, 0.36, CELL * 2);
  const canvas = renderVariant(buf, mask, {
    direction: 'subject', colorMode: 'gradient', palette: palOf(s.pix),
    cellSize: CELL, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.8, asciiInk: 'brand',
  });
  await save(canvas, `${LAB}/out/final/${s.f}.png`);
  tiles.push({ canvas, label: s.f.replace('eng_', '') });
}
await save(montage('PROGRESSION LABS · signature imagery  (engraving → feathered pixel dissolve · mostly blue)', tiles, 2, { w: 560, h: 440 }), `${LAB}/out/final-showcase.png`);
console.log('saved out/final-showcase.png + out/final/*.png');
