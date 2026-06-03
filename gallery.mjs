// PL Imagery — build a curated gallery of finished brand examples.
// Renders each example full-res into out/gallery/, and assembles review showcase sheets.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { PRESETS, PAL, FIELD, loadBuffer, loadMask, renderVariant, save, ensureMask } from './mosaic-core.mjs';

const LAB = '/Users/joe/code/pl-imagery-lab';
mkdirSync(`${LAB}/out/gallery`, { recursive: true });

// Build render params from a compact example spec.
function paramsFor(spec) {
  const preset = PRESETS[spec.preset];
  const p = { ...preset, cellSize: spec.size ?? preset.cellSize ?? 16, shape: spec.shape ?? 'pixel' };
  if (spec.ascii === false) p.ascii = false;
  if (preset.direction !== 'solid') {
    if (spec.color === 'original') { p.colorMode = 'original'; p.palette = null; }
    else if (PAL[spec.color]) { p.colorMode = 'gradient'; p.palette = PAL[spec.color]; }
  } else if (spec.field && FIELD[spec.field]) {
    p.solidColor = FIELD[spec.field];
  }
  if (spec.split != null) p.splitPosition = spec.split;
  return p;
}

const cache = {};
async function getBufMask(input, needMask, forceNoMask) {
  if (!cache[input]) cache[input] = await loadBuffer(`${LAB}/inputs/${input}.png`);
  const buf = cache[input];
  let mask = null;
  if (needMask && !forceNoMask) {
    const mp = ensureMask(`${LAB}/inputs/${input}.png`, LAB);
    mask = await loadMask(mp, buf.width, buf.height);
  }
  return { buf, mask };
}

async function renderExample(spec) {
  const preset = PRESETS[spec.preset];
  const { buf, mask } = await getBufMask(spec.input, preset.needsMask, spec.noMask);
  const canvas = renderVariant(buf, mask, paramsFor(spec));
  const name = `${spec.input}_${spec.preset}${spec.field ? '-' + spec.field : ''}${spec.color ? '-' + spec.color : ''}.png`;
  await save(canvas, `${LAB}/out/gallery/${name}`);
  return { canvas, label: spec.label };
}

// ───────── curated gallery ─────────
const SHEETS = [
  {
    title: 'PROGRESSION LABS · Pixel-Dissolve portraits',
    box: { w: 300, h: 375 }, cols: 3,
    items: [
      { input: 'portrait',  preset: 'surround', color: 'blue',     label: 'sharp subject / pixel surround' },
      { input: 'portrait2', preset: 'jacket',   color: 'blue',     label: 'sharp face / pixel jacket' },
      { input: 'portrait3', preset: 'surround', color: 'blue',     label: 'sharp subject / pixel surround' },
      { input: 'portrait',  preset: 'jacket',   color: 'original', label: 'pixel jacket · original colour' },
      { input: 'portrait3', preset: 'solid',    field: 'navy',     label: 'solid field · navy' },
      { input: 'portrait2', preset: 'surround', color: 'blue',     label: 'sharp subject / pixel surround' },
    ],
  },
  {
    title: 'PROGRESSION LABS · Objects on solid colour fields (every.to)',
    box: { w: 300, h: 300 }, cols: 3,
    items: [
      { input: 'object',  preset: 'solid', field: 'blue',   label: 'solid field · blue' },
      { input: 'object2', preset: 'solid', field: 'navy',   label: 'solid field · navy' },
      { input: 'object3', preset: 'solid', field: 'orange', label: 'solid field · orange' },
      { input: 'object',  preset: 'surround', color: 'blue', label: 'sharp object / pixel surround' },
      { input: 'object2', preset: 'solid', field: 'cream',  label: 'solid field · cream' },
      { input: 'object3', preset: 'surround', color: 'blue', label: 'sharp object / pixel surround' },
    ],
  },
  {
    title: 'PROGRESSION LABS · Texture & concept',
    box: { w: 340, h: 300 }, cols: 3,
    items: [
      { input: 'abstract',  preset: 'subject', color: 'blue',       noMask: true, label: 'full pixel · blue' },
      { input: 'abstract2', preset: 'subject', color: 'original',   noMask: true, label: 'full pixel · original' },
      { input: 'abstract',  preset: 'jacket',  color: 'blueOrange', label: 'split · blue↔orange' },
      { input: 'concept',   preset: 'surround', color: 'blue',      label: 'sharp subject / pixel surround' },
      { input: 'concept2',  preset: 'surround', color: 'blue',      label: 'sharp subject / pixel surround' },
      { input: 'concept',   preset: 'subject',  color: 'blue',      label: 'pixel subject' },
    ],
  },
];

function montage(title, tiles, cols, box) {
  const pad = 24, labelH = 30, gap = 16, titleH = 64;
  const rows = Math.ceil(tiles.length / cols);
  const W = pad * 2 + cols * box.w + (cols - 1) * gap;
  const H = titleH + pad + rows * (box.h + labelH) + (rows - 1) * gap + pad;
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = '600 24px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(title, pad, 24);
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

let n = 1;
for (const sheet of SHEETS) {
  const tiles = [];
  for (const item of sheet.items) tiles.push(await renderExample(item));
  await save(montage(sheet.title, tiles, sheet.cols, sheet.box), `${LAB}/out/gallery-${n}.png`);
  console.log(`saved gallery-${n}.png (${sheet.items.length} examples)`);
  n++;
}
console.log('individual finished images in out/gallery/');
