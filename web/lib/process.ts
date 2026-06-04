// ───────────────────────────────────────────────────────────────────────────
// process.ts — image PRE-processing for the pixel/ASCII effect.
//
// Problem it solves: dark / low-contrast parts of the image sample to the dark
// end of the palette and blend into the background, so the dissolve looks full of
// gaps ("you can see the image behind it"). Adaptive local-contrast normalization
// lifts each region's LOCAL detail to full range, so every cell maps to a vivid
// palette stop → the dissolved region covers completely.
//
// Pure JS (no DOM / canvas APIs) so it runs unchanged in the browser AND in Node
// via @napi-rs/canvas (the parity harness). All heavy work is O(W·H) via a
// summed-area table (integral image); results are cached so a frame only pays for
// it when a Processing control actually changes.
// ───────────────────────────────────────────────────────────────────────────
import { LUMA_R, LUMA_G, LUMA_B } from "./palettes";

export type ProcessMode = "off" | "adaptive";

export interface ProcessParams {
  process: ProcessMode;
  processRadius: number; // local window radius in px (bigger = broader contrast)
  processBias: number; // brightness lift, −0.5..0.5
  processContrast: number; // local-detail gain, 0..4
  processHardness: number; // 0 = tonal local-contrast · 1 = hard engraving threshold
}

interface Buf {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── luminance summed-area table (integral image), cached per source buffer ──
interface Integral {
  sat: Float64Array; // size (w+1)·(h+1), row-major
  w: number;
  h: number;
}
const integralCache = new WeakMap<Uint8ClampedArray, Integral>();

function luminanceIntegral(data: Uint8ClampedArray, w: number, h: number): Integral {
  const hit = integralCache.get(data);
  if (hit && hit.w === w && hit.h === h) return hit;
  const W1 = w + 1;
  const sat = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const cur = (y + 1) * W1;
    const prev = y * W1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rowSum += LUMA_R * data[i] + LUMA_G * data[i + 1] + LUMA_B * data[i + 2];
      sat[cur + x + 1] = sat[prev + x + 1] + rowSum;
    }
  }
  const out = { sat, w, h };
  integralCache.set(data, out);
  return out;
}

// mean luminance over the inclusive box [x0,x1]×[y0,y1] in O(1) via the SAT
function boxMean(sat: Float64Array, W1: number, x0: number, y0: number, x1: number, y1: number): number {
  const a = sat[y0 * W1 + x0];
  const b = sat[y0 * W1 + (x1 + 1)];
  const c = sat[(y1 + 1) * W1 + x0];
  const d = sat[(y1 + 1) * W1 + (x1 + 1)];
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  return (d - b - c + a) / area;
}

// ── processed grayscale buffer, cached per (source, process params) ──
interface Cached {
  key: string;
  buf: Uint8ClampedArray;
}
const processedCache = new WeakMap<Uint8ClampedArray, Cached>();

/**
 * Adaptive local-contrast normalization → a grayscale RGBA buffer (R=G=B=v, A=255)
 * the same size as `src`. Each pixel: lift its deviation from the LOCAL mean to full
 * range, so flat/dark regions still produce mid-bright, vivid cells. `hardness`
 * lerps toward a binary adaptive threshold (the classic engraving look).
 */
export function adaptiveProcess(src: Buf, p: ProcessParams): Uint8ClampedArray {
  const { data, width: w, height: h } = src;
  const key = `${p.processRadius}|${p.processBias}|${p.processContrast}|${p.processHardness}`;
  const hit = processedCache.get(data);
  if (hit && hit.key === key) return hit.buf;

  const { sat } = luminanceIntegral(data, w, h);
  const W1 = w + 1;
  const r = Math.max(1, Math.round(p.processRadius));
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    const y0 = y - r < 0 ? 0 : y - r;
    const y1 = y + r >= h ? h - 1 : y + r;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = LUMA_R * data[i] + LUMA_G * data[i + 1] + LUMA_B * data[i + 2];
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r >= w ? w - 1 : x + r;
      const mean = boxMean(sat, W1, x0, y0, x1, y1);
      // tonal: centre on mid-grey, scale local deviation, lift by bias
      const tonal = clamp01(0.5 + ((lum - mean) / 255) * p.processContrast + p.processBias);
      // hardness lerps the tonal value toward a hard 0/1 adaptive threshold
      const v = tonal * (1 - p.processHardness) + (tonal > 0.5 ? 1 : 0) * p.processHardness;
      const g = (v * 255) | 0;
      out[i] = g;
      out[i + 1] = g;
      out[i + 2] = g;
      out[i + 3] = 255;
    }
  }
  processedCache.set(data, { key, buf: out });
  return out;
}
