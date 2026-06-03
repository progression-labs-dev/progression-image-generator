// Browser image helpers: decode to ImageData (the renderer's Src), downscale to
// a working cap, and build the binary subject mask the renderer consumes.
import type { Src } from "./render";

export const DEFAULT_MAX_DIM = 2048;
export const PREVIEW_CLAMP = 960;

function fittedSize(w: number, h: number, maxDim: number) {
  if (w <= maxDim && h <= maxDim) return { w, h, scale: 1 };
  const scale = maxDim / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale), scale };
}

function scratch(w: number, h: number) {
  const c =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  return { canvas: c, ctx };
}

async function decode(srcUrlOrBlob: string | Blob): Promise<ImageBitmap> {
  const blob =
    typeof srcUrlOrBlob === "string"
      ? await (await fetch(srcUrlOrBlob)).blob()
      : srcUrlOrBlob;
  return createImageBitmap(blob);
}

/** Decode an image (URL or Blob) to ImageData, downscaled so the longest edge ≤ maxDim. */
export async function toImageData(
  srcUrlOrBlob: string | Blob,
  maxDim = DEFAULT_MAX_DIM,
): Promise<Src> {
  const bmp = await decode(srcUrlOrBlob);
  const { w, h } = fittedSize(bmp.width, bmp.height, maxDim);
  const { ctx } = scratch(w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const id = ctx.getImageData(0, 0, w, h);
  return { data: id.data, width: w, height: h };
}

/**
 * Build the binary subject mask (1 = subject) at the given working dims.
 * `sourceChannel`: 'red' for B&W mask PNGs (mask.py output), 'alpha' for cutouts
 * (the @imgly/background-removal alphamask). Mirrors mosaic-core loadMask.
 */
export async function toMask(
  srcUrlOrBlob: string | Blob,
  width: number,
  height: number,
  threshold = 128,
  sourceChannel: "red" | "alpha" = "red",
): Promise<Uint8Array> {
  const bmp = await decode(srcUrlOrBlob);
  const { ctx } = scratch(width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const off = sourceChannel === "alpha" ? 3 : 0;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + off] > threshold ? 1 : 0;
  return mask;
}

/** Resample an existing mask to new working dims (for preview ↔ export resolution changes). */
export function previewScale(w: number, h: number, clamp = PREVIEW_CLAMP) {
  if (w <= clamp && h <= clamp) return 1;
  return clamp / Math.max(w, h);
}
