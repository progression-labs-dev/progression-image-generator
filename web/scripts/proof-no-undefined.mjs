// Visual proof at LEGIBLE settings (sparse, non-overlapping glyphs) that the real
// renderer turns the breaking value "undefinedprog" into clean p/r/o/g — no "undefined".
//   cd web && bun scripts/proof-no-undefined.mjs
import { createCanvas } from "@napi-rs/canvas";
import { render } from "../lib/render.ts";
import { defaultParams } from "../lib/params.ts";
import { saneCharset } from "../lib/palettes.ts";
import { loadBuffer, loadMask, save } from "../../mosaic-core.mjs";

const LAB = "/Users/joe/code/pl-imagery-lab";
const src = await loadBuffer(`${LAB}/web/public/samples/portrait.png`);
const mask = await loadMask(`${LAB}/web/public/samples/portrait-mask.png`, src.width, src.height);

function renderWith(charset, over = {}) {
  const p = defaultParams("mosaic", {
    direction: "surroundings", ascii: true, asciiPlacement: "in-pixel",
    asciiCharset: charset,
    asciiDensity: 0.3,      // sparse like the user's 0.33 → glyphs don't overlap
    cellSize: 20,
    fontSizeMul: 1.25,      // glyph fits inside the cell → legible, isolated
    asciiOpacity: 1,
    ...over,
  });
  const canvas = createCanvas(src.width, src.height);
  render(canvas.getContext("2d"), src, mask, p);
  return canvas;
}

function saveZoom(canvas, path, zoom = 3) {
  const cw = 380, ch = 300, sx = src.width - cw - 30, sy = 150;
  const crop = createCanvas(cw * zoom, ch * zoom);
  const cctx = crop.getContext("2d");
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw * zoom, ch * zoom);
  return save(crop, path);
}

const fixed = renderWith("undefinedprog");
await save(fixed, `${LAB}/web/proof-full.png`);
await saveZoom(fixed, `${LAB}/web/proof-zoom.png`);

console.log("charset in     :", JSON.stringify("undefinedprog"));
console.log("renderer uses  :", JSON.stringify(saneCharset("undefinedprog")), "→ glyphs can only be:", [...new Set(saneCharset("undefinedprog"))].join(" "));
console.log("saved web/proof-zoom.png (zoomed, sparse → each glyph is clearly p / r / o / g)");
