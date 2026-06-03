// PL Imagery — apply a locked preset to any photo.
//   node apply.mjs <input> [--preset surround|jacket|subject|solid]
//        [--color blue|navysky|original|blueorange] [--size 16]
//        [--field blue|navy|orange|cream] [--shape pixel|circle]
//        [--no-ascii] [--mask <path>] [--out <path>]
import { basename, extname } from 'path';
import { PRESETS, PAL, FIELD, loadBuffer, loadMask, renderVariant, save, ensureMask } from './mosaic-core.mjs';

const LAB = '/Users/joe/code/pl-imagery-lab';
const a = process.argv.slice(2);
if (!a[0] || a[0].startsWith('--')) {
  console.error('usage: node apply.mjs <input> [--preset surround|jacket|subject|solid] [--color blue|navysky|original|blueorange] [--size N] [--field blue|navy|orange|cream] [--shape pixel|circle] [--no-ascii] [--mask path] [--out path]');
  process.exit(1);
}
const input = a[0];
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
const has = (k) => a.includes(k);

const presetKey = opt('--preset', 'surround');
const preset = PRESETS[presetKey];
if (!preset) { console.error(`unknown preset: ${presetKey}`); process.exit(1); }
const color = opt('--color', 'blue');
const size = Number(opt('--size', 16));
const field = opt('--field', 'blue');
const shape = opt('--shape', 'pixel');

const p = { ...preset, cellSize: size, shape };
// colour override
if (preset.direction !== 'solid') {
  if (color === 'original') { p.colorMode = 'original'; p.palette = null; }
  else if (PAL[color]) { p.colorMode = 'gradient'; p.palette = PAL[color]; }
}
if (preset.direction === 'solid' && FIELD[field]) p.solidColor = FIELD[field];
if (has('--no-ascii')) p.ascii = false;

const buf = await loadBuffer(input);
let mask = null;
if (preset.needsMask) {
  const maskPath = opt('--mask', ensureMask(input, LAB));
  mask = await loadMask(maskPath, buf.width, buf.height);
}

const base = basename(input, extname(input));
const tag = preset.direction === 'solid' ? `solid-${field}` : `${presetKey}-${color}-${size}`;
const out = opt('--out', `${LAB}/out/${base}_${tag}.png`);
await save(renderVariant(buf, mask, p), out);
console.log(`✅ ${preset.label}  →  ${out}`);
