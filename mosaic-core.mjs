// PL Imagery — shared core. Render math ported VERBATIM from
// websiteplab/app/tools/mosaic/utils/{colorMapping,shapes}.ts + the render()
// loop in hooks/useMosaicRenderer.ts, plus the corrected brand palettes.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { basename, dirname } from 'path';

// ───────── colorMapping.ts (verbatim) ─────────
export function rgbToHsl(r, g, b) {
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
export function hslToRgb(h, s, l) {
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
  return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}
export function interpolateColor(c1, c2, t) {
  const [h1, s1, l1] = rgbToHsl(...c1);
  const [h2, s2, l2] = rgbToHsl(...c2);
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = h1 + dh * t, s = s1 + (s2 - s1) * t, l = l1 + (l2 - l1) * t;
  return hslToRgb(h < 0 ? h + 1 : h, s, l);
}
export function multiStopGradientColor(brightness, stops) {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1) return stops[0];
  const t = brightness / 255, segments = stops.length - 1;
  const i = Math.min(Math.floor(t * segments), segments - 1);
  return interpolateColor(stops[i], stops[i + 1], t * segments - i);
}
// RGB-space lerp — for complementary ramps (blue↔orange) that would swing
// through magenta/green under HSL hue interpolation.
export function interpolateColorRGB(c1, c2, t) {
  return [Math.round(c1[0] + (c2[0] - c1[0]) * t), Math.round(c1[1] + (c2[1] - c1[1]) * t), Math.round(c1[2] + (c2[2] - c1[2]) * t)];
}
export function multiStopGradientColorRGB(brightness, stops) {
  if (stops.length === 1) return stops[0];
  const t = brightness / 255, seg = stops.length - 1;
  const i = Math.min(Math.floor(t * seg), seg - 1);
  return interpolateColorRGB(stops[i], stops[i + 1], t * seg - i);
}
export function adjustBrightness(r, g, b, factor) {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h, s, Math.min(1, Math.max(0, l * factor)));
}
const rgbStr = (r, g, b, a = 1) => a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;

// ───────── imageProcessing.ts (verbatim) ─────────
export function sampleColorAt(buf, x, y) {
  const px = Math.min(Math.max(Math.round(x), 0), buf.width - 1);
  const py = Math.min(Math.max(Math.round(y), 0), buf.height - 1);
  const i = (py * buf.width + px) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2]];
}
export const getBrightness = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ───────── shapes.ts (verbatim, ASCII ink selectable) ─────────
const ASCII_CHARSET = '0123456789@#$%&*+=?<>{}[]/\\|LABS';
const posHash = (x, y) => ((x * 7919 + y * 104729) >>> 0) / 4294967296;
export function drawPixelBlock(ctx, x, y, size, r, g, b) {
  ctx.fillStyle = rgbStr(r, g, b);
  ctx.fillRect(x, y, size, size);
}
export function drawConvexCircle(ctx, cx, cy, radius, r, g, b) {
  const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, radius * 0.35, cx, cy, radius);
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
export function drawAsciiChar(ctx, cx, cy, cellSize, opacity, ink) {
  if (posHash(cx, cy) > 0.4) return;
  const char = ASCII_CHARSET[((cx * 7919 + cy * 104729) >>> 0) % ASCII_CHARSET.length];
  ctx.font = `500 ${Math.max(8, cellSize * 1.6)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'overlay';
  const [ir, ig, ib] = ink || [255, 255, 255];
  ctx.shadowColor = `rgba(${ir},${ig},${ib},0.6)`;
  ctx.shadowBlur = 4;
  ctx.fillStyle = `rgba(${ir},${ig},${ib},${opacity})`;
  ctx.fillText(char, cx, cy);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = prev;
}
export function isOnEffectSide(x, y, width, height, position, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const nx = Math.cos(rad), ny = Math.sin(rad);
  return (x - position * width) * nx + (y - position * height) * ny >= 0;
}

// ───────── corrected brand palettes ─────────
// HSL palettes stay within the blue hue family (no neutral endpoint → no magenta).
// blueOrange is RGB-lerped through a light neutral (diverging).
export const PAL = {
  blue:       { stops: [[6, 12, 46], [0, 40, 235], [150, 190, 255]], interp: 'hsl' },
  navySky:    { stops: [[9, 29, 64], [9, 67, 160], [120, 180, 255]], interp: 'hsl' },
  blueOrange: { stops: [[10, 30, 200], [245, 245, 245], [255, 140, 80]], interp: 'rgb' },
  orange:     { stops: [[52, 22, 16], [255, 150, 90], [255, 232, 210]], interp: 'hsl' },
};
export const FIELD = { blue: [30, 91, 255], navy: [9, 67, 160], orange: [255, 160, 122], cream: [250, 247, 242] };

// ───────── IO ─────────
export async function loadBuffer(path) {
  const img = await loadImage(path);
  const w = img.width, h = img.height;
  const ctx = createCanvas(w, h).getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { ...ctx.getImageData(0, 0, w, h), width: w, height: h };
}
export async function loadMask(path, width, height) {
  const img = await loadImage(path);
  const ctx = createCanvas(width, height).getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const d = ctx.getImageData(0, 0, width, height).data;
  const m = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) m[i] = d[i * 4] > 128 ? 1 : 0;
  return m;
}
// Generate (and cache) a rembg subject mask next to the lab masks/ dir.
export function ensureMask(inputPath, labDir) {
  const out = `${labDir}/masks/${basename(inputPath)}`;
  if (!existsSync(out)) {
    execFileSync(`${labDir}/.venv/bin/python`, [`${labDir}/mask.py`, inputPath, out], { stdio: 'inherit' });
  }
  return out;
}

// ───────── core renderer (mirrors render() in useMosaicRenderer.ts) ─────────
// direction: 'subject' | 'surroundings' | 'split' | 'solid'
export function renderVariant(buf, mask, p) {
  const { width, height, data } = buf;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

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

  const id0 = ctx.createImageData(width, height);
  id0.data.set(data);
  ctx.putImageData(id0, 0, 0);

  let effMask = null;
  if (p.direction === 'subject' && mask) effMask = mask;
  if (p.direction === 'surroundings' && mask) {
    effMask = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) effMask[i] = mask[i] ? 0 : 1;
  }
  const useSplit = p.direction === 'split';
  const cellSize = p.cellSize, spacing = p.spacing || 0, step = cellSize * 2 + spacing;
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
      const sampleY = Math.min(cellY + Math.abs(colHash) * 0.035 * cellSize, height - 1);
      const [r, g, b] = sampleColorAt(buf, cellX, sampleY);
      const brightness = getBrightness(r, g, b);
      let fr = r, fg = g, fb = b;
      if (p.colorMode === 'gradient') {
        [fr, fg, fb] = pal.interp === 'rgb' ? multiStopGradientColorRGB(brightness, pal.stops) : multiStopGradientColor(brightness, pal.stops);
      }
      if (p.shape === 'pixel') drawPixelBlock(ctx, cellX - cellSize, cellY - cellSize, cellSize * 2, fr, fg, fb);
      else drawConvexCircle(ctx, cellX, cellY, cellSize, fr, fg, fb);
      if (p.ascii) drawAsciiChar(ctx, cellX, cellY, cellSize, p.asciiOpacity ?? 0.85, inkAccent);
    }
  }
  return canvas;
}

export async function save(canvas, path) {
  writeFileSync(path, await canvas.encode('png'));
  return path;
}

// ───────── locked presets (Joe's Phase-1 choices: Pixel Blue, ~16px medium) ─────────
export const PRESETS = {
  surround: { label: 'Sharp subject / pixel surround', direction: 'surroundings', colorMode: 'gradient', palette: PAL.blue, cellSize: 16, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.85, asciiInk: 'white', needsMask: true },
  jacket:   { label: 'Sharp face / pixel jacket',       direction: 'split', splitPosition: 0.46, splitAngle: 90, colorMode: 'gradient', palette: PAL.blue, cellSize: 16, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.85, asciiInk: 'white', needsMask: false },
  subject:  { label: 'Pixel subject',                   direction: 'subject', colorMode: 'gradient', palette: PAL.blue, cellSize: 16, spacing: 0, shape: 'pixel', ascii: true, asciiOpacity: 0.85, asciiInk: 'white', needsMask: true },
  solid:    { label: 'every.to solid field',            direction: 'solid', solidColor: FIELD.blue, needsMask: true },
};
