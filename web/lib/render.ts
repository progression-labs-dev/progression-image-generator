// ───────────────────────────────────────────────────────────────────────────
// render.ts — the load-bearing renderer.
// Math ported VERBATIM from mosaic-core.mjs (= websiteplab mosaic tool) and the
// deck post-passes from process-deck-image.js. Every constant that was inlined
// in those files is now a field on RenderParams. Do NOT re-derive the math.
// Runs unchanged in the browser (CanvasRenderingContext2D), in a Worker
// (OffscreenCanvas), and in Node via @napi-rs/canvas (the parity harness).
// ───────────────────────────────────────────────────────────────────────────
import {
  ASCII_CHARSET,
  POSHASH_A,
  POSHASH_B,
  POSHASH_DIV,
  JITTER_HASH_MUL,
  JITTER_HASH_SCALE,
  LUMA_R,
  LUMA_G,
  LUMA_B,
  saneCharset,
  type RGB,
  type Interp,
  type Palette,
} from "./palettes";
import { mulberry32 } from "./rng";
import { adaptiveProcess, type ProcessMode } from "./process";

export type { RGB, Interp, Palette };

export type Engine = "mosaic" | "deck";
// region the mosaic applies to. "split" is a legacy alias for "all" + splitEnabled.
export type Direction = "subject" | "surroundings" | "all" | "split" | "solid";
export type Shape = "pixel" | "circle";
export type ColorMode = "original" | "gradient";
export type AsciiInk = "white" | "brand" | "custom" | "source";
export type AsciiOpacityModel = "constant" | "fade";
export type AsciiBlend = "overlay" | "source-over" | "screen";
export type AsciiPlacement =
  | "in-pixel" // glyph centered on the block (current look)
  | "ascii-only" // skip the block — render purely as characters
  | "separate-grid" // glyphs on their own stride, decoupled from blocks
  | "between" // glyphs anchored in the gutters (needs spacing > 0)
  | "deck-tint"; // deck semantics — the glyph + glow colorize the block

/** A loose 2D context type that covers browser canvas, OffscreenCanvas and @napi-rs/canvas. */
export type Ctx = CanvasRenderingContext2D;
export interface Src {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface RenderParams {
  engine: Engine;
  // ── grid / pixelation ──
  cellSize: number; // mosaic 16, deck 14
  spacing: number; // step = cellSize*2 + spacing
  shape: Shape;
  // ── direction / masking ──
  direction: Direction;
  splitEnabled: boolean; // gate the mosaic to one side of a line (combines with subject/surroundings)
  splitPosition: number; // 0..1
  splitAngle: number; // degrees — 0 = vertical (L/R), 90 = horizontal (T/B)
  solidColor: RGB;
  boundaryFeather: number; // 0 = hard split edge; >0 = probabilistic scatter band (fraction of extent)
  maskThreshold: number; // 128 — used when building the mask, kept for reference
  coverEdges: boolean; // dilate the effect mask ~1 cell so boundary cells fully cover the
  // subject's outline (no original photo showing at the petal/silhouette edges). Cut-out trims overflow.
  // ── image pre-processing (adaptive local-contrast "fill") ──
  // "adaptive" normalizes each region's LOCAL detail to full range so dark/flat areas
  // still become vivid pixels — the dissolve covers completely (no see-through gaps).
  // "off" = no-op (parity preserved). Whole-image: feeds the base layer AND the cells.
  process: ProcessMode; // "off" | "adaptive"
  processRadius: number; // local window radius px
  processBias: number; // brightness lift −0.5..0.5
  processContrast: number; // local-detail gain 0..4
  processHardness: number; // 0 tonal → 1 hard engraving threshold
  // ── background compositing (needs a subject mask) ──
  // photo = keep the original scene behind the subject (default — parity preserved);
  // transparent = cut the subject out onto transparency ("just the subject");
  // solid = fill everything outside the subject with `solidColor`.
  backgroundMode: "photo" | "transparent" | "solid";
  // ── colour ──
  colorMode: ColorMode;
  palette: Palette;
  // ── per-column sample jitter (mosaic only) ──
  jitterEnabled: boolean;
  jitterMagnitude: number; // 0.035
  // ── ASCII overlay ──
  ascii: boolean;
  asciiCharset: string;
  asciiGlyphScatter: boolean; // true = avalanche-hash the glyph pick so the WHOLE charset shows.
  // false = legacy mosaic-core pick, which aliases to ~1–2 glyphs on the regular grid (the
  // "0 / +" checkerboard). App defaults true; the parity harness leaves it unset → legacy → byte-identical.
  asciiDensity: number; // fill-gate: posHash<=density draws. mosaic .4 / deck .5
  asciiInk: AsciiInk;
  asciiInkCustom: RGB; // custom ink OR deck brand tint
  asciiOpacityModel: AsciiOpacityModel;
  asciiOpacity: number; // constant model
  asciiFadeTop: number; // .9
  asciiFadeBottom: number; // .05
  asciiFadeSlope: number; // .85
  asciiBlend: AsciiBlend;
  asciiPlacement: AsciiPlacement;
  asciiGridScale: number; // separate-grid stride multiplier (1 = locked)
  // ── ASCII-art mode (glyphs FORM the subject — refs #2–#5) ──
  asciiArt: boolean; // dense glyphs replace blocks; the subject becomes text
  asciiGlyphMode: "random" | "ramp"; // random = position-seeded letters (tinted); ramp = glyph by luminance
  asciiRamp: string; // dark→light ramp, e.g. "@%#*+=-:. "
  asciiBackground: "scene" | "solid"; // scene = source shows behind glyphs; solid = flat field behind glyphs
  fontSizeMul: number; // 1.6
  fontSizeMin: number; // 8
  fontWeight: number; // 500
  fontFamily: string; // 'Inter, system-ui, sans-serif'
  shadowBlurMosaic: number; // 4
  shadowBlurDeckMul: number; // 0.3 -> max(3, cellSize*0.3)
  shadowAlphaMosaic: number; // 0.6
  shadowAlphaDeckMul: number; // 0.4
  // ── deck-only post passes ──
  brightnessCutoff: number; // 0 disables; deck 80
  watercolorBlobs: boolean;
  blobCountMin: number; // 3
  blobCountMax: number; // 5
  blobRadiusMul: number; // 10 -> cellSize*10
  blobTintScale: number; // 0.35
  blobRedrawAlpha: number; // 0.7
  grainOpacity: number; // 0.06 deck; 0 mosaic
  // ── determinism ──
  seed: number;
  // ── circle convex shading (advanced) ──
  circleHlOffset: number; // 0.25
  circleHlRadius: number; // 0.35
  circleMidStop: number; // 0.55
  circleHighlight: number; // 1.6
  circleShadow: number; // 0.45
}

// ───────────────────────── colorMapping.ts (verbatim) ─────────────────────────
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h, s, l];
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
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
export function interpolateColor(c1: RGB, c2: RGB, t: number): RGB {
  const [h1, s1, l1] = rgbToHsl(...c1);
  const [h2, s2, l2] = rgbToHsl(...c2);
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = h1 + dh * t,
    s = s1 + (s2 - s1) * t,
    l = l1 + (l2 - l1) * t;
  return hslToRgb(h < 0 ? h + 1 : h, s, l);
}
export function multiStopGradientColor(brightness: number, stops: RGB[]): RGB {
  if (stops.length === 0) return [0, 0, 0];
  if (stops.length === 1) return stops[0];
  const t = brightness / 255,
    segments = stops.length - 1;
  const i = Math.min(Math.floor(t * segments), segments - 1);
  return interpolateColor(stops[i], stops[i + 1], t * segments - i);
}
export function interpolateColorRGB(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}
export function multiStopGradientColorRGB(brightness: number, stops: RGB[]): RGB {
  if (stops.length === 1) return stops[0];
  const t = brightness / 255,
    seg = stops.length - 1;
  const i = Math.min(Math.floor(t * seg), seg - 1);
  return interpolateColorRGB(stops[i], stops[i + 1], t * seg - i);
}
export function adjustBrightness(r: number, g: number, b: number, factor: number): RGB {
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h, s, Math.min(1, Math.max(0, l * factor)));
}
const rgbStr = (r: number, g: number, b: number, a = 1) =>
  a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;

// ───────────────────────── imageProcessing.ts (verbatim) ─────────────────────────
export function sampleColorAt(buf: Src, x: number, y: number): RGB {
  const px = Math.min(Math.max(Math.round(x), 0), buf.width - 1);
  const py = Math.min(Math.max(Math.round(y), 0), buf.height - 1);
  const i = (py * buf.width + px) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2]];
}
export const getBrightness = (r: number, g: number, b: number) =>
  LUMA_R * r + LUMA_G * g + LUMA_B * b;

// ───────────────────────── shapes.ts (verbatim, parameterized) ─────────────────────────
export const posHash = (x: number, y: number) =>
  ((x * POSHASH_A + y * POSHASH_B) >>> 0) / POSHASH_DIV;

function drawPixelBlock(ctx: Ctx, x: number, y: number, size: number, r: number, g: number, b: number) {
  ctx.fillStyle = rgbStr(r, g, b);
  ctx.fillRect(x, y, size, size);
}
function drawConvexCircle(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  p: RenderParams,
) {
  const grad = ctx.createRadialGradient(
    cx - radius * p.circleHlOffset,
    cy - radius * p.circleHlOffset,
    radius * p.circleHlRadius,
    cx,
    cy,
    radius,
  );
  const [hr, hg, hb] = adjustBrightness(r, g, b, p.circleHighlight);
  const [sr, sg, sb] = adjustBrightness(r, g, b, p.circleShadow);
  grad.addColorStop(0, rgbStr(hr, hg, hb));
  grad.addColorStop(p.circleMidStop, rgbStr(r, g, b));
  grad.addColorStop(1, rgbStr(sr, sg, sb));
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}
function asciiGlyph(charset: string, cx: number, cy: number): string {
  return charset[((cx * POSHASH_A + cy * POSHASH_B) >>> 0) % charset.length];
}
// Avalanche-mixed glyph pick. The legacy hash above collapses to ~1–2 glyphs on a
// regular grid (cell stride is even, so the low bits of cx*A+cy*B barely move → the
// "0 / +" checkerboard). Running the seed through an xxhash-style finalizer spreads
// it across the WHOLE charset while staying deterministic per position.
export function scatterGlyph(charset: string, cx: number, cy: number): string {
  let h = (Math.imul(cx | 0, POSHASH_A) + Math.imul(cy | 0, POSHASH_B)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  // `h ^= …` yields a SIGNED int32, so without this `>>> 0` the high-bit-set ~50% of
  // positions give a NEGATIVE index → charset[-n] === undefined → ctx.fillText(undefined)
  // paints the literal word "undefined". Coerce to uint32 before the modulo.
  return charset[(h >>> 0) % charset.length];
}
const glyphFor = (p: RenderParams, charset: string, cx: number, cy: number): string =>
  p.asciiGlyphScatter ? scatterGlyph(charset, cx, cy) : asciiGlyph(charset, cx, cy);
// luminance → glyph from a dark→light ramp (classic ASCII art)
function rampGlyph(ramp: string, brightness: number): string {
  if (!ramp.length) return " ";
  const idx = Math.min(
    ramp.length - 1,
    Math.max(0, Math.round((brightness / 255) * (ramp.length - 1))),
  );
  return ramp[idx];
}
function drawAsciiChar(
  ctx: Ctx,
  cx: number,
  cy: number,
  cellSize: number,
  ink: RGB,
  opacity: number,
  brightness: number,
  p: RenderParams,
) {
  if (posHash(cx, cy) > p.asciiDensity) return;
  const charset = saneCharset(p.asciiCharset);
  const char =
    p.asciiArt && p.asciiGlyphMode === "ramp"
      ? rampGlyph(p.asciiRamp || "@%#*+=-:. ", brightness)
      : glyphFor(p, charset, cx, cy);
  const fontSize = Math.max(p.fontSizeMin, cellSize * p.fontSizeMul);
  ctx.font = `${p.fontWeight} ${fontSize}px ${p.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = p.asciiBlend;
  const [ir, ig, ib] = ink;
  let shadowBlur: number, shadowAlpha: number;
  if (p.engine === "deck") {
    shadowBlur = Math.max(3, cellSize * p.shadowBlurDeckMul);
    shadowAlpha = opacity * p.shadowAlphaDeckMul;
  } else {
    shadowBlur = p.shadowBlurMosaic;
    shadowAlpha = p.shadowAlphaMosaic;
  }
  ctx.shadowColor = `rgba(${ir},${ig},${ib},${shadowAlpha})`;
  ctx.shadowBlur = shadowBlur;
  ctx.fillStyle = `rgba(${ir},${ig},${ib},${opacity})`;
  ctx.fillText(char, cx, cy);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = prev;
}
export function isOnEffectSide(
  x: number,
  y: number,
  width: number,
  height: number,
  position: number,
  angleDeg: number,
): boolean {
  const rad = (angleDeg * Math.PI) / 180;
  const nx = Math.cos(rad),
    ny = Math.sin(rad);
  return (x - position * width) * nx + (y - position * height) * ny >= 0;
}

// ───────────────────────── helpers ─────────────────────────
function resolveInk(p: RenderParams): RGB {
  if (p.asciiInk === "brand") return p.palette ? p.palette.stops[1] : [0, 0, 255];
  if (p.asciiInk === "custom") return p.asciiInkCustom;
  return [255, 255, 255];
}
function makeScratch(width: number, height: number): Ctx {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height).getContext("2d") as unknown as Ctx;
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c.getContext("2d") as Ctx;
}

// Subject mask as a drawable canvas (subject = opaque, background = transparent),
// cached per mask reference. Used by the background composite so the cut-out needs
// NO per-frame getImageData — reading the live GPU-backed canvas back each frame is
// catastrophically slow (~850ms for 1MP). Rebuilds only when the mask changes.
const maskSourceCache = new WeakMap<Uint8Array, CanvasImageSource & { width: number; height: number }>();
function maskAlphaSource(mask: Uint8Array, width: number, height: number) {
  const cached = maskSourceCache.get(mask);
  if (cached && cached.width === width && cached.height === height) return cached;
  const sctx = makeScratch(width, height);
  const id = sctx.createImageData(width, height);
  const d = id.data;
  for (let i = 0; i < mask.length; i++) if (mask[i]) d[i * 4 + 3] = 255; // alpha only; rgb stays 0
  sctx.putImageData(id, 0, 0);
  const src = (sctx as unknown as { canvas: CanvasImageSource & { width: number; height: number } }).canvas;
  maskSourceCache.set(mask, src);
  return src;
}

// Subject bounding box (in px), cached per mask reference. Lets the split line sweep
// across the SUBJECT instead of the whole frame, so "Split position" always divides the
// subject (otherwise the effect vanishes once the line clears the subject's edge).
const maskBBoxCache = new WeakMap<Uint8Array, { minX: number; minY: number; maxX: number; maxY: number }>();
function subjectBBox(mask: Uint8Array, width: number, height: number) {
  const hit = maskBBoxCache.get(mask);
  if (hit) return hit;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bb = maxX < 0 ? { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 } : { minX, minY, maxX, maxY };
  maskBBoxCache.set(mask, bb);
  return bb;
}

interface Block {
  x: number;
  y: number;
}

// Is a cell inside the effect region? Tests the cell centre; when `dilate` (full-coverage
// mode) also accepts a cell whose 2·cellSize block overlaps the mask, so boundary cells
// draw and there's no sub-cell sliver of original at the silhouette edge (cut-out trims
// any overflow back to the true mask).
function cellCovered(
  effMask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  cellSize: number,
  dilate: boolean,
): boolean {
  const at = (px: number, py: number) => {
    const ix = Math.round(px),
      iy = Math.round(py);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return false;
    return effMask[iy * width + ix] !== 0;
  };
  if (at(cx, cy)) return true;
  if (!dilate) return false;
  const s = cellSize;
  // 8-neighbourhood at the block extent → fills the edge band on straight AND diagonal outlines
  return (
    at(cx - s, cy) ||
    at(cx + s, cy) ||
    at(cx, cy - s) ||
    at(cx, cy + s) ||
    at(cx - s, cy - s) ||
    at(cx + s, cy - s) ||
    at(cx - s, cy + s) ||
    at(cx + s, cy + s)
  );
}

// ───────────────────────── core renderer (mirrors renderVariant + deck passes) ─────────────────────────
export function render(ctx: Ctx, src: Src, mask: Uint8Array | null, p: RenderParams): void {
  const { width, height, data } = src;

  // ── direction: solid ── (verbatim renderVariant solid branch)
  if (p.direction === "solid") {
    const out = new Uint8ClampedArray(data);
    const [br, bg, bb] = p.solidColor;
    for (let i = 0; i < width * height; i++) {
      if (!mask || mask[i] === 0) {
        out[i * 4] = br;
        out[i * 4 + 1] = bg;
        out[i * 4 + 2] = bb;
        out[i * 4 + 3] = 255;
      }
    }
    const id = ctx.createImageData(width, height);
    id.data.set(out);
    ctx.putImageData(id, 0, 0);
    return;
  }

  // ── adaptive pre-process: the buffer the base layer AND the cells sample from.
  // Whole-image, so the sharp side is the processed version too ("no raw original"). ──
  const useProc = p.process === "adaptive";
  const sampleData = useProc ? adaptiveProcess(src, p) : data;
  const sampleSrc: Src = useProc ? { data: sampleData, width, height } : src;
  // dilate the effect mask (cover the silhouette edge band) when asked, or implicitly
  // whenever processing is on (full-coverage intent).
  const dilate = p.coverEdges || useProc;

  // ── base layer = the (optionally processed) image ──
  const id0 = ctx.createImageData(width, height);
  id0.data.set(sampleData);
  ctx.putImageData(id0, 0, 0);

  // ── ASCII-art "solid" background: replace the scene with a flat field so the
  // glyphs sit on a clean colour (the #4 / every.to look). "scene" keeps the source. ──
  if (p.asciiArt && p.asciiBackground === "solid") {
    ctx.fillStyle = rgbStr(p.solidColor[0], p.solidColor[1], p.solidColor[2]);
    ctx.fillRect(0, 0, width, height);
  }

  // ── effective mask: where to APPLY the mosaic (region gate) ──
  // "split" is a legacy alias for "all" + split. subject/surroundings still mask;
  // the split gate (below) now combines with the region, so you can dissolve only
  // one half of the SUBJECT and leave the background untouched.
  let effMask: Uint8Array | null = null;
  if (p.direction === "subject" && mask) effMask = mask;
  if (p.direction === "surroundings" && mask) {
    effMask = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) effMask[i] = mask[i] ? 0 : 1;
  }
  const useSplit = p.splitEnabled || p.direction === "split";

  const cellSize = p.cellSize;
  const spacing = p.spacing || 0;
  const step = cellSize * 2 + spacing;
  const cols = Math.ceil(width / step),
    rows = Math.ceil(height / step);
  const pal = p.palette;
  const ink = resolveInk(p);
  const placement = p.asciiPlacement;
  const drawShape = placement !== "ascii-only" && !p.asciiArt; // art mode = glyphs only, no blocks
  const drawInlineAscii = (p.ascii || p.asciiArt) && placement !== "separate-grid";
  // split-line normal + feather band (only used when boundaryFeather > 0)
  const srad = (p.splitAngle * Math.PI) / 180;
  const snx = Math.cos(srad),
    sny = Math.sin(srad);
  const featherRange = (Math.abs(snx) * width + Math.abs(sny) * height) * p.boundaryFeather;
  // The point the split line passes through. Frame-relative by default (parity-identical
  // to isOnEffectSide). For a masked SUBJECT, sweep splitPosition across the subject's
  // bounding box so the slider always divides the subject instead of dead-zoning once the
  // line moves past its edge. The split test is then `(x-anchorX)*snx + (y-anchorY)*sny >= 0`.
  let anchorX = p.splitPosition * width;
  let anchorY = p.splitPosition * height;
  if (useSplit && p.direction === "subject" && mask) {
    const bb = subjectBBox(mask, width, height);
    anchorX = bb.minX + p.splitPosition * (bb.maxX - bb.minX);
    anchorY = bb.minY + p.splitPosition * (bb.maxY - bb.minY);
  }

  const opacityFor = (cy: number) =>
    p.asciiOpacityModel === "fade"
      ? Math.max(p.asciiFadeBottom, p.asciiFadeTop - (cy / height) * p.asciiFadeSlope)
      : p.asciiOpacity;

  const blocks: Block[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * step + cellSize,
        cellY = row * step + cellSize;
      if (cellX >= width || cellY >= height) continue;
      if (useSplit) {
        if (p.boundaryFeather > 0) {
          // feathered/scattered dissolve boundary (vs the hard split line)
          const d = (cellX - anchorX) * snx + (cellY - anchorY) * sny;
          const prob =
            d > featherRange / 2
              ? 1
              : d < -featherRange / 2
                ? 0
                : (d + featherRange / 2) / featherRange;
          if (posHash(cellX, cellY) >= prob) continue;
        } else if ((cellX - anchorX) * snx + (cellY - anchorY) * sny < 0) {
          continue;
        }
      }
      if (effMask && !cellCovered(effMask, width, height, cellX, cellY, cellSize, dilate)) continue;

      // per-column sample jitter (mosaic) — shifts only the SAMPLE point
      let sampleY = cellY;
      if (p.jitterEnabled) {
        const colHash = (Math.sin(col * JITTER_HASH_MUL) * JITTER_HASH_SCALE) % 1;
        sampleY = Math.min(cellY + Math.abs(colHash) * p.jitterMagnitude * cellSize, height - 1);
      }
      const [r, g, b] = sampleColorAt(sampleSrc, cellX, sampleY);
      const brightness = getBrightness(r, g, b);

      // brightness cutoff (deck) — skip dark cells entirely. Bypassed when processing
      // is on (adaptive fill wants every cell drawn → no gaps).
      if (!useProc && p.brightnessCutoff > 0 && brightness < p.brightnessCutoff) continue;

      let fr = r,
        fg = g,
        fb = b;
      if (p.colorMode === "gradient") {
        [fr, fg, fb] =
          pal.interp === "rgb"
            ? multiStopGradientColorRGB(brightness, pal.stops)
            : multiStopGradientColor(brightness, pal.stops);
      }

      if (drawShape) {
        if (p.shape === "pixel")
          drawPixelBlock(ctx, cellX - cellSize, cellY - cellSize, cellSize * 2, fr, fg, fb);
        else drawConvexCircle(ctx, cellX, cellY, cellSize, fr, fg, fb, p);
      }

      if (p.watercolorBlobs) blocks.push({ x: cellX - cellSize, y: cellY - cellSize });

      if (drawInlineAscii) {
        const ax = placement === "between" ? cellX + step / 2 : cellX;
        const ay = placement === "between" ? cellY + step / 2 : cellY;
        const cellInk: RGB = p.asciiInk === "source" ? [fr, fg, fb] : ink;
        drawAsciiChar(ctx, ax, ay, cellSize, cellInk, opacityFor(cellY), brightness, p);
      }
    }
  }

  // ── ASCII on its own decoupled grid (separate-grid placement) ──
  if (p.ascii && placement === "separate-grid") {
    const astep = Math.max(2, Math.round(step * p.asciiGridScale));
    const acols = Math.ceil(width / astep),
      arows = Math.ceil(height / astep);
    for (let row = 0; row < arows; row++) {
      for (let col = 0; col < acols; col++) {
        const ax = col * astep + cellSize,
          ay = row * astep + cellSize;
        if (ax >= width || ay >= height) continue;
        if (useSplit && (ax - anchorX) * snx + (ay - anchorY) * sny < 0) continue;
        if (effMask && !cellCovered(effMask, width, height, ax, ay, cellSize, dilate)) continue;
        const [gr, gg, gb] = sampleColorAt(sampleSrc, ax, ay);
        const gB = getBrightness(gr, gg, gb);
        if (!useProc && p.brightnessCutoff > 0 && gB < p.brightnessCutoff) continue;
        let gfr = gr,
          gfg = gg,
          gfb = gb;
        if (p.colorMode === "gradient") {
          [gfr, gfg, gfb] =
            pal.interp === "rgb"
              ? multiStopGradientColorRGB(gB, pal.stops)
              : multiStopGradientColor(gB, pal.stops);
        }
        const gridInk: RGB = p.asciiInk === "source" ? [gfr, gfg, gfb] : ink;
        drawAsciiChar(ctx, ax, ay, cellSize, gridInk, opacityFor(ay), gB, p);
      }
    }
  }

  // ── watercolor blobs (deck) — tint clusters of blocks toward the brand colour ──
  if (p.watercolorBlobs && blocks.length > 0) {
    const rand = mulberry32(p.seed);
    const blobCount = p.blobCountMin + Math.floor(rand() * (p.blobCountMax - p.blobCountMin + 1));
    const shuffled = [...blocks].sort(() => rand() - 0.5);
    const blobCenters = shuffled.slice(0, Math.max(0, blobCount));
    const blobRadius = cellSize * p.blobRadiusMul;
    const [ir, ig, ib] = ink;
    ctx.globalCompositeOperation = "source-over";
    const charset = saneCharset(p.asciiCharset);
    const fontSize = Math.max(p.fontSizeMin, cellSize * p.fontSizeMul);
    for (const block of blocks) {
      let closestDist = Infinity;
      for (const c of blobCenters) {
        const dx = block.x - c.x,
          dy = block.y - c.y;
        closestDist = Math.min(closestDist, Math.sqrt(dx * dx + dy * dy));
      }
      if (closestDist > blobRadius) continue;
      const t = 1 - closestDist / blobRadius;
      const tintStrength = t * t;
      ctx.fillStyle = `rgba(${ir},${ig},${ib},${tintStrength * p.blobTintScale})`;
      ctx.fillRect(block.x, block.y, cellSize * 2, cellSize * 2);
      const bCx = block.x + cellSize,
        bCy = block.y + cellSize;
      if (p.ascii && posHash(bCx, bCy) <= p.asciiDensity) {
        ctx.font = `${p.fontWeight} ${fontSize}px ${p.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${ir},${ig},${ib},${p.blobRedrawAlpha})`;
        ctx.fillText(glyphFor(p, charset, bCx, bCy), bCx, bCy);
      }
    }
  }

  // ── film grain (deck) — overlay-blended monochrome noise ──
  if (p.grainOpacity > 0) {
    const rand = mulberry32((p.seed ^ 0x9e3779b9) >>> 0);
    const gctx = makeScratch(width, height);
    const gid = gctx.createImageData(width, height);
    const px = gid.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = rand() * 255;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
    gctx.putImageData(gid, 0, 0);
    ctx.globalAlpha = p.grainOpacity;
    ctx.globalCompositeOperation = "overlay";
    ctx.drawImage((gctx as unknown as { canvas: CanvasImageSource }).canvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ── background composite (final pass) — keep only the subject so the result is
  // "just the subject". Done with GPU compositing against a cached mask canvas — NOT
  // a per-frame getImageData readback, which is catastrophically slow on a GPU-backed
  // canvas (~850ms for 1MP → dragging stalls). No-op without a mask or in the default
  // "photo" mode → parity preserved. (direction "solid" returns earlier.)
  if (mask && (p.backgroundMode === "transparent" || p.backgroundMode === "solid")) {
    const maskSrc = maskAlphaSource(mask, width, height);
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "destination-in"; // erase everything outside the subject
    ctx.drawImage(maskSrc, 0, 0);
    if (p.backgroundMode === "solid") {
      ctx.globalCompositeOperation = "destination-over"; // lay a flat field behind the subject
      ctx.fillStyle = rgbStr(p.solidColor[0], p.solidColor[1], p.solidColor[2]);
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalCompositeOperation = prevOp;
  }
}
