// In-browser subject isolation via @imgly/background-removal (v1.7).
// Runs entirely client-side (WASM/ONNX). Imported dynamically inside the handler
// so the ~80MB model + glue never touch the server bundle or the initial chunk.
import type { RGB } from "./palettes";

export type BgProgress = (stage: string, current: number, total: number) => void;

/**
 * Run background removal and return a binary subject mask (1 = subject) at the
 * given working dims (must match the renderer's Src dims). Mirrors mask.py:
 * threshold the cutout's alpha channel at `threshold`.
 */
export async function isolateSubjectMask(
  input: Blob | string,
  width: number,
  height: number,
  threshold = 128,
  onProgress?: BgProgress,
): Promise<Uint8Array> {
  const { removeBackground } = await import("@imgly/background-removal");
  // removeBackground → PNG cutout: subject opaque, background transparent.
  const cutout = await removeBackground(input, {
    progress: onProgress,
    output: { format: "image/png" },
  });
  const bmp = await createImageBitmap(cutout);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as OffscreenCanvas | HTMLCanvasElement).getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  // scale the (model-resolution) cutout into the working dims — same as loadMask
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > threshold ? 1 : 0;
  return mask;
}

/** Render a binary mask to a small RGBA data array for thumbnail preview. */
export function maskToPreview(mask: Uint8Array, width: number, height: number, tint: RGB) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i++) {
    const on = mask[i] === 1;
    out[i * 4] = on ? tint[0] : 17;
    out[i * 4 + 1] = on ? tint[1] : 17;
    out[i * 4 + 2] = on ? tint[2] : 22;
    out[i * 4 + 3] = 255;
  }
  return out;
}
