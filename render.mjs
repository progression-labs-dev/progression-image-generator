// PL Imagery Lab — headless contact-sheet generator.
// Render math ported VERBATIM from websiteplab/app/tools/mosaic/utils/{colorMapping,shapes}.ts
// + the render() loop in hooks/useMosaicRenderer.ts. Do not re-derive.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';

const IN = '/Users/joe/code/pl-imagery-lab/inputs';
const MASK = '/Users/joe/code/pl-imagery-lab/masks';
const OUT = '/Users/joe/code/pl-imagery-lab/out';

// ───────────────────────── colorMapping.ts (verbatim) ─────────────────────────
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
function interpolateColor(c1, c2, t) {
  const [h1, s1, l1] = rgbToHsl(...c1);
  const [h2, s2, l2] = rgbToHsl(...c2);
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = h1 + dh * t, s = s1 + (s2 - s1) * t, l = l1 + (l2 - l1) * t;
  return hslToRgb(h < 0 ? h + 1 : h, s, l);
}
function multiStopGradientColor(brightness, stops) {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1) return stops[0];
  const t = brightness / 255;
  const segments = stops.length - 1;
  const segIndex = Math.min(Math.floor(t * segments), segments - 1);
  const segT = (t * segments) - segIndex;
  return interpolateColor(stops[segIndex], stops[segIndex + 1], segT);
}
// RGB-space lerp variant — for complementary ramps (blue↔orange) where HSL
// shortest-path hue interpolation would swing through magenta/green.
function interpolateColorRGB(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}
function multiStopGradientColorRGB(brightness, stops) {
  if (stops.length === 1) return stops[0];
  const t = brightness / 255;
  const seg = stops.length - 1;
  const i = Math.min(Math.floor(t * seg), seg - 1);
  return interpolateColorRGB(stops[i], stops[i + 1], t * seg - i);
}
function adjustBrightness(r, g, b, factor) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = Math.min(1, Math.max(0, l * factor));
  return hslToRgb(h, s, newL);
}
const rgbStr = (r, g, b, a = 1) => a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;

// ───────────────────────── imageProcessing.ts (verbatim) ─────────────────────────
function sampleColorAt(buf, x, y) {
  const px = Math.min(Math.max(Math.round(x), 0), buf.width - 1);
  const py = Math.min(Math.max(Math.round(y), 0), buf.height - 1);
  const i = (py * buf.width + px) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2]];
}
const getBrightness = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ───────────────────────── shapes.ts (verbatim) ─────────────────────────
const ASCII_CHARSET = '0123456789@#$%&*+=?<>{}[]/\\|LABS';
const posHash = (x, y) => ((x * 7919 + y * 104729) >>> 0) / 4294967296;
function drawPixelBlock(ctx, x, y, size, r, g, b) {
  ctx.fillStyle = rgbStr(r, g, b);
  ctx.fillRect(x, y, size, size);
}
function drawConvexCircle(ctx, cx, cy, radius, r, g, b) {
  const hlX = cx - radius * 0.25, hlY = cy - radius * 0.25, hlRadius = radius * 0.35;
  const grad = ctx.createRadialGradient(hlX, hlY, hlRadius, cx, cy, radius);
  const [hr, hg, hb] = adjustBrightness(r, g, b, 1.6);
  const [sr, sg, sb] = adjustBrightness(r, g, b, 0.45);
  grad.addColorStop(0, rgbStr(hr, hg, hb));
  grad.addColorStop(0.55, rgbStr(r, g, b));
  grad.addColorStop(1, rgbStr(sr, sg, sb));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}
// drawAsciiChar — extended so ink color is selectable (white = current brand, 'brand' = palette accent)
function drawAsciiChar(ctx, cx, cy, cellSize, opacity, ink) {
  const fillGate = posHash(cx, cy);
  if (fillGate > 0.4) return;
  const charIdx = ((cx * 7919 + cy * 104729) >>> 0) % ASCII_CHARSET.length;
  const char = ASCII_CHARSET[charIdx];
  const fontSize = Math.max(8, cellSize * 1.6);
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'overlay';
  const [ir, ig, ib] = ink || [255, 255, 255];
  ctx.shadowColor = `rgba(${ir},${ig},${ib},0.6)`;
  ctx.shadowBlur = 4;
  ctx.fillStyle = `rgba(${ir},${ig},${ib},${opacity})`;
  ctx.fillText(char, cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = prev;
}

// half-plane split test (verbatim from useMosaicRenderer.ts)
function isOnEffectSide(x, y, width, height, position, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const nx = Math.cos(rad), ny = Math.sin(rad);
  const cx = position * width, cy = position * height;
  return (x - cx) * nx + (y - cy) * ny >= 0;
}

// ───────────────────────── corrected brand palettes ─────────────────────────
// All HSL-interpolated palettes stay WITHIN the blue hue family (no neutral
// endpoint) so highlights don't swing through magenta. blueOrange is RGB-lerped
// through a light neutral (diverging) to stay clean across complementary hues.
const PAL = {
  blue:      { stops: [[6, 12, 46], [0, 40, 235], [150, 190, 255]], interp: 'hsl' },  // signature pixel-blue
  navySky:   { stops: [[9, 29, 64], [9, 67, 160], [120, 180, 255]], interp: 'hsl' },  // cool blue duotone
  blueOrange:{ stops: [[10, 30, 200], [245, 245, 245], [255, 140, 80]], interp: 'rgb' }, // diverging blue→cream→orange
  orange:    { stops: [[52, 22, 16], [255, 150, 90], [255, 232, 210]], interp: 'hsl' }, // warm
};
const FIELD = { blue: [30, 91, 255], navy: [9, 67, 160], orange: [255, 160, 122], cream: [250, 247, 242] };

// ───────────────────────── IO ─────────────────────────
async function loadBuffer(path) {
  const img = await loadImage(path);
  const w = img.width, h = img.height;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { ...ctx.getImageData(0, 0, w, h), width: w, height: h };
}
async function loadMask(path, width, height) {
  const img = await loadImage(path);
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const d = ctx.getImageData(0, 0, width, height).data;
  const m = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) m[i] = d[i * 4] > 128 ? 1 : 0;
  return m;
}

// ───────────────────────── core renderer (mirrors render()) ─────────────────────────
// direction: 'subject' | 'surroundings' | 'split' | 'solid'
function renderVariant(buf, mask, p) {
  const { width, height, data } = buf;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // every.to solid field: flat color bg + sharp subject on top
  if (p.direction === 'solid') {
    const out = new Uint8ClampedArray(data);
    const [br, bg, bb] = p.solidColor;
    for (let i = 0; i < width * height; i++) {
      if (!mask || mask[i] === 0) { out[i * 4] = br; out[i * 4 + 1] = bg; out[i * 4 + 2] = bb; out[i * 4 + 3] = 255; }
    }
    const id = ctx.createImageData(width, height);
    id.data.set(out);
    ctx.putImageData(id, 0, 0);
    return canvas;
  }

  // base layer = original sharp photo
  const id0 = ctx.createImageData(width, height);
  id0.data.set(data);
  ctx.putImageData(id0, 0, 0);

  // effective mask: where to APPLY mosaic (skip cells where effMask===0)
  let effMask = null;
  if (p.direction === 'subject' && mask) effMask = mask;                       // pixelate subject
  if (p.direction === 'surroundings' && mask) {                                // pixelate everything else
    effMask = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) effMask[i] = mask[i] ? 0 : 1;
  }
  const useSplit = p.direction === 'split';

  const cellSize = p.cellSize, spacing = p.spacing || 0;
  const step = cellSize * 2 + spacing;
  const cols = Math.ceil(width / step), rows = Math.ceil(height / step);
  const pal = p.palette;
  const inkAccent = p.asciiInk === 'brand' ? (pal ? pal.stops[1] : [0, 0, 255]) : [255, 255, 255];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * step + cellSize, cellY = row * step + cellSize;
      if (cellX >= width || cellY >= height) continue;

      if (useSplit && !isOnEffectSide(cellX, cellY, width, height, p.splitPosition, p.splitAngle)) continue;
      if (effMask) {
        const idx = Math.round(cellY) * width + Math.round(cellX);
        if (idx < 0 || idx >= effMask.length || effMask[idx] === 0) continue;
      }

      const colHash = (Math.sin(col * 127.1) * 43758.5453123) % 1;
      const colYOffset = Math.abs(colHash) * 0.035 * cellSize;
      const sampleY = Math.min(cellY + colYOffset, height - 1);
      const [r, g, b] = sampleColorAt(buf, cellX, sampleY);
      const brightness = getBrightness(r, g, b);

      let fr = r, fg = g, fb = b;
      if (p.colorMode === 'gradient') {
        [fr, fg, fb] = pal.interp === 'rgb'
          ? multiStopGradientColorRGB(brightness, pal.stops)
          : multiStopGradientColor(brightness, pal.stops);
      }

      if (p.shape === 'pixel') drawPixelBlock(ctx, cellX - cellSize, cellY - cellSize, cellSize * 2, fr, fg, fb);
      else drawConvexCircle(ctx, cellX, cellY, cellSize, fr, fg, fb);

      if (p.ascii) drawAsciiChar(ctx, cellX, cellY, cellSize, p.asciiOpacity ?? 0.85, inkAccent);
    }
  }
  return canvas;
}

// ───────────────────────── montage / contact sheet ─────────────────────────
function buildSheet(title, tiles, cols, box) {
  const pad = 20, labelH = 30, gap = 16, titleH = 64;
  const rows = Math.ceil(tiles.length / cols);
  const W = pad * 2 + cols * box.w + (cols - 1) * gap;
  const H = titleH + pad + rows * (box.h + labelH) + (rows - 1) * gap + pad;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff'; ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(title, pad, 22);

  tiles.forEach((t, i) => {
    const cx = i % cols, cy = Math.floor(i / cols);
    const x = pad + cx * (box.w + gap);
    const y = titleH + pad + cy * (box.h + labelH + gap);
    // image area
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, box.w, box.h);
    const iw = t.canvas.width, ih = t.canvas.height;
    const s = Math.min(box.w / iw, box.h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(t.canvas, x + (box.w - dw) / 2, y + (box.h - dh) / 2, dw, dh);
    // label
    ctx.fillStyle = '#15151f'; ctx.fillRect(x, y + box.h, box.w, labelH);
    ctx.fillStyle = '#e8e8ef'; ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, x + box.w / 2, y + box.h + labelH / 2);
    ctx.textAlign = 'left';
  });
  return c;
}
async function save(canvas, name) {
  const p = `${OUT}/${name}`;
  writeFileSync(p, await canvas.encode('png'));
  console.log('saved', p, `${canvas.width}x${canvas.height}`);
}

// ───────────────────────── build the sheets ─────────────────────────
const DIRS = [
  { key: 'split',        label: 'sharp face / pixel jacket', splitPosition: 0.46, splitAngle: 90 },
  { key: 'surroundings', label: 'sharp subject / pixel surround' },
  { key: 'subject',      label: 'pixel subject (current deck)' },
  { key: 'solid',        label: 'every.to solid field' },
];
const COLORS = [
  { key: 'blue', label: 'Blue', palette: PAL.blue },
  { key: 'blueOrange', label: 'Blue→Orange', palette: PAL.blueOrange },
  { key: 'original', label: 'Original color', palette: null },
];

async function main() {
  const which = process.argv[2] || 'all';
  const portrait = await loadBuffer(`${IN}/portrait.png`);
  const pMask = await loadMask(`${MASK}/portrait.png`, portrait.width, portrait.height);

  // ── Sheet A: pixelation DIRECTION × COLOR (portrait) ──
  if (which === 'all' || which === 'A') {
    const tiles = [];
    const solidFieldByCol = { blue: ['Blue field', FIELD.blue], blueOrange: ['Orange field', FIELD.orange], original: ['Cream field', FIELD.cream] };
    for (const d of DIRS) {
      for (const c of COLORS) {
        const isSolid = d.key === 'solid';
        const sf = solidFieldByCol[c.key];
        const p = {
          direction: d.key, colorMode: c.palette ? 'gradient' : 'original', palette: c.palette,
          cellSize: 16, spacing: 0, shape: 'pixel', ascii: false,
          splitPosition: d.splitPosition, splitAngle: d.splitAngle,
          solidColor: isSolid ? sf[1] : FIELD.blue,
        };
        const label = isSolid ? `${d.label} · ${sf[0]}` : `${d.label} · ${c.label}`;
        tiles.push({ canvas: renderVariant(portrait, pMask, p), label });
      }
    }
    await save(buildSheet('A · Pixelation direction × colour  (portrait, 16px pixels, no ASCII)', tiles, 3, { w: 320, h: 400 }), 'sheet-A-directions.png');
  }

  // ── Sheet B: granularity (cell size) × shape, with ASCII (portrait, surroundings, blue) ──
  if (which === 'all' || which === 'B') {
    const tiles = [];
    for (const shape of ['pixel', 'circle']) {
      for (const cs of [10, 18, 28]) {
        const p = { direction: 'surroundings', colorMode: 'gradient', palette: PAL.blue, cellSize: cs, spacing: 0, shape, ascii: true, asciiOpacity: 0.85, asciiInk: 'white' };
        tiles.push({ canvas: renderVariant(portrait, pMask, p), label: `${shape} · ${cs}px · ASCII` });
      }
    }
    await save(buildSheet('B · Granularity & shape  (portrait · sharp subject / pixel surround · Blue · ASCII on)', tiles, 3, { w: 320, h: 400 }), 'sheet-B-granularity.png');
  }

  // ── Sheet C: cross-subject cohesion (blue & blue→orange, surroundings, ASCII) ──
  if (which === 'all' || which === 'C') {
    const subjects = [
      { name: 'portrait', buf: portrait, mask: pMask, dir: 'surroundings' },
      { name: 'object', file: 'object', dir: 'surroundings' },
      { name: 'concept', file: 'concept', dir: 'surroundings' },
      { name: 'abstract', file: 'abstract', dir: 'split', noMask: true },
    ];
    const tiles = [];
    for (const s of subjects) {
      const buf = s.buf || await loadBuffer(`${IN}/${s.file}.png`);
      const mask = s.noMask ? null : (s.mask || await loadMask(`${MASK}/${s.file}.png`, buf.width, buf.height));
      for (const c of [{ label: 'Blue', pal: PAL.blue }, { label: 'Blue→Orange', pal: PAL.blueOrange }]) {
        const p = { direction: s.dir, colorMode: 'gradient', palette: c.pal, cellSize: 18, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.85, asciiInk: 'white', splitPosition: 0.5, splitAngle: 90 };
        tiles.push({ canvas: renderVariant(buf, mask, p), label: `${s.name} · ${c.label}` });
      }
    }
    await save(buildSheet('C · Cross-subject cohesion  (sharp subject / pixel surround · 18px · ASCII on)', tiles, 4, { w: 300, h: 300 }), 'sheet-C-subjects.png');
  }

  // ── Sheet D: every.to solid field (portrait + object on flat brand colours) ──
  if (which === 'all' || which === 'D') {
    const object = await loadBuffer(`${IN}/object.png`);
    const oMask = await loadMask(`${MASK}/object.png`, object.width, object.height);
    const tiles = [];
    for (const s of [{ name: 'portrait', buf: portrait, mask: pMask }, { name: 'object', buf: object, mask: oMask }]) {
      for (const f of [['Blue', FIELD.blue], ['Navy', FIELD.navy], ['Orange', FIELD.orange], ['Cream', FIELD.cream]]) {
        const p = { direction: 'solid', solidColor: f[1] };
        tiles.push({ canvas: renderVariant(s.buf, s.mask, p), label: `${s.name} · ${f[0]} field` });
      }
    }
    await save(buildSheet('D · every.to solid colour field  (sharp cut-out subject on flat brand colour)', tiles, 4, { w: 300, h: 340 }), 'sheet-D-solidfield.png');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
