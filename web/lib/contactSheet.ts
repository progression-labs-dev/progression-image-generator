// Contact-sheet export — sweep one parameter across a list of values and
// compose a labelled montage. buildSheet() is ported VERBATIM from
// render.mjs:250-280 (same pad/labelH/gap/titleH layout, colours, contain-fit).
import { render, type RenderParams, type Src } from "./render";
import { PAL, type RGB } from "./palettes";
import { canvasToPngBlob } from "./exportPng";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function scratch(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function ctx2d(c: AnyCanvas) {
  return c.getContext("2d") as unknown as CanvasRenderingContext2D;
}

export interface Tile {
  canvas: AnyCanvas;
  label: string;
}

export function renderTile(src: Src, mask: Uint8Array | null, params: RenderParams): AnyCanvas {
  const c = scratch(src.width, src.height);
  render(ctx2d(c), src, mask, params);
  return c;
}

// VERBATIM port of render.mjs buildSheet()
export function buildSheet(
  title: string,
  tiles: Tile[],
  cols: number,
  box: { w: number; h: number },
): AnyCanvas {
  const pad = 20,
    labelH = 30,
    gap = 16,
    titleH = 64;
  const rows = Math.ceil(tiles.length / cols);
  const W = pad * 2 + cols * box.w + (cols - 1) * gap;
  const H = titleH + pad + rows * (box.h + labelH) + (rows - 1) * gap + pad;
  const c = scratch(W, H);
  const ctx = ctx2d(c);
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px Inter, system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(title, pad, 22);

  tiles.forEach((t, i) => {
    const cx = i % cols,
      cy = Math.floor(i / cols);
    const x = pad + cx * (box.w + gap);
    const y = titleH + pad + cy * (box.h + labelH + gap);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, box.w, box.h);
    const iw = t.canvas.width,
      ih = t.canvas.height;
    const s = Math.min(box.w / iw, box.h / ih);
    const dw = iw * s,
      dh = ih * s;
    ctx.drawImage(
      t.canvas as CanvasImageSource,
      x + (box.w - dw) / 2,
      y + (box.h - dh) / 2,
      dw,
      dh,
    );
    ctx.fillStyle = "#15151f";
    ctx.fillRect(x, y + box.h, box.w, labelH);
    ctx.fillStyle = "#e8e8ef";
    ctx.font = "500 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, x + box.w / 2, y + box.h + labelH / 2);
    ctx.textAlign = "left";
  });
  return c;
}

// ── sweepable parameters + default value lists (mirror the deck eval sheets) ──
export interface SweepDef {
  kind: "number" | "enum" | "palette";
  def: string;
}
export const SWEEPS: Record<string, SweepDef> = {
  cellSize: { kind: "number", def: "10,18,28" },
  spacing: { kind: "number", def: "0,8,16" },
  asciiDensity: { kind: "number", def: "0.25,0.5,0.75" },
  asciiOpacity: { kind: "number", def: "0.4,0.6,0.85" },
  brightnessCutoff: { kind: "number", def: "0,80,140" },
  grainOpacity: { kind: "number", def: "0,0.06,0.15" },
  splitAngle: { kind: "number", def: "0,45,90,135" },
  shape: { kind: "enum", def: "pixel,circle" },
  direction: { kind: "enum", def: "subject,surroundings,split,solid" },
  asciiInk: { kind: "enum", def: "white,brand,custom" },
  palette: { kind: "palette", def: "blue,navySky,blueOrange,orange" },
};

function overrideParam(base: RenderParams, param: string, raw: string): RenderParams {
  const def = SWEEPS[param];
  if (param === "palette") {
    const p = PAL[raw] ?? base.palette;
    return { ...base, colorMode: "gradient", palette: { interp: p.interp, stops: p.stops.map((s) => [...s] as RGB) } };
  }
  if (def?.kind === "number") return { ...base, [param]: Number(raw) } as RenderParams;
  return { ...base, [param]: raw } as RenderParams;
}

export async function buildContactSheet(opts: {
  src: Src;
  mask: Uint8Array | null;
  base: RenderParams;
  param: string;
  valuesText: string;
  cols: number;
  title: string;
}): Promise<{ blob: Blob; tiles: number; w: number; h: number }> {
  const { src, mask, base, param, valuesText, cols, title } = opts;
  await new Promise((r) => setTimeout(r, 0)); // let the loading toast paint before sync render
  const values = valuesText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (values.length === 0) throw new Error("no values to sweep");
  const tiles: Tile[] = values.map((v) => ({
    canvas: renderTile(src, mask, overrideParam(base, param, v)),
    label: `${param} = ${v}`,
  }));
  const boxW = 320;
  const boxH = Math.max(120, Math.round((boxW * src.height) / src.width));
  const sheet = buildSheet(title, tiles, Math.max(1, cols), { w: boxW, h: boxH });
  const blob = await canvasToPngBlob(sheet);
  return { blob, tiles: tiles.length, w: sheet.width, h: sheet.height };
}
