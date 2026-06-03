// Full-resolution PNG export. Renders the current params into a throwaway
// canvas at the working source dims (already capped at ≤2048 on load by
// toImageData), then downloads. Never reuses the preview canvas.
import { render, type RenderParams, type Src } from "./render";

function scratchCanvas(w: number, h: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export async function canvasToPngBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type: "image/png" });
  }
  return new Promise<Blob>((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render `params` at full source resolution and download as PNG. */
export async function exportPng(
  src: Src,
  mask: Uint8Array | null,
  params: RenderParams,
  fileName = "pl-imagery.png",
): Promise<{ width: number; height: number }> {
  const canvas = scratchCanvas(src.width, src.height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  render(ctx, src, mask, params); // full quality — blobs + grain included
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, fileName);
  return { width: src.width, height: src.height };
}
