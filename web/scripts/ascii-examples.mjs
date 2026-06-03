// Batch ASCII-art examples — imports the REAL web/lib/render.ts (like parity.mjs)
// so there is no logic duplication. Renders engraving sources as text-glyph art:
// bold-field (#4 / every.to) and vintage-scene (#2/#3/#5) variants.
//   cd web && bun scripts/ascii-examples.mjs
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { render } from "../lib/render.ts";
import { defaultParams } from "../lib/params.ts";
import { PAL, FIELD, loadBuffer, loadMask, save } from "../../mosaic-core.mjs";

const LAB = "/Users/joe/code/pl-imagery-lab";
mkdirSync(`${LAB}/out/ascii`, { recursive: true });
const SCALE = 2;

function upscale(buf, s) {
  const w = Math.round(buf.width * s), h = Math.round(buf.height * s);
  const sc = createCanvas(buf.width, buf.height).getContext("2d");
  const id = sc.createImageData(buf.width, buf.height); id.data.set(buf.data); sc.putImageData(id, 0, 0);
  const dc = createCanvas(w, h).getContext("2d");
  dc.imageSmoothingEnabled = true; dc.imageSmoothingQuality = "high";
  dc.drawImage(sc.canvas, 0, 0, w, h);
  return { ...dc.getImageData(0, 0, w, h), width: w, height: h };
}
// subject mask by keying out the flat field colour (corners) — for bold-field sources
function colorKeyMask(buf, thresh = 70) {
  const { data, width, height } = buf;
  const pts = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]];
  let fr = 0, fg = 0, fb = 0;
  for (const [x, y] of pts) { const i = (y * width + x) * 4; fr += data[i]; fg += data[i + 1]; fb += data[i + 2]; }
  fr /= 4; fg /= 4; fb /= 4;
  const m = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const dr = data[i * 4] - fr, dg = data[i * 4 + 1] - fg, db = data[i * 4 + 2] - fb;
    m[i] = Math.sqrt(dr * dr + dg * dg + db * db) > thresh ? 1 : 0;
  }
  return m;
}
function renderTo(buf, mask, over) {
  const p = defaultParams("mosaic", {
    ascii: true, asciiArt: true, asciiPlacement: "ascii-only", asciiDensity: 1,
    asciiOpacity: 1, asciiBlend: "source-over", asciiInk: "source",
    direction: "subject", colorMode: "original", jitterEnabled: false,
    cellSize: 7, fontSizeMul: 1.95, fontWeight: 600, ...over,
  });
  const c = createCanvas(buf.width, buf.height);
  render(c.getContext("2d"), buf, mask, p);
  return c;
}
// brightest corner = the paper/sky tone of a vintage plate
function paperColor(buf) {
  const { data, width, height } = buf;
  const pts = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]];
  let best = [255, 255, 255], bestL = -1;
  for (const [x, y] of pts) { const i = (y * width + x) * 4; const l = data[i] + data[i + 1] + data[i + 2]; if (l > bestL) { bestL = l; best = [data[i], data[i + 1], data[i + 2]]; } }
  return best;
}
// composite the masked region of `top` over the original scene
function compositeMasked(top, scene, mask) {
  const { width: w, height: h } = scene;
  const octx = createCanvas(w, h).getContext("2d");
  const sid = octx.createImageData(w, h); sid.data.set(scene.data); octx.putImageData(sid, 0, 0);
  const td = top.getContext("2d").getImageData(0, 0, w, h).data;
  const od = octx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) if (mask[i]) { od.data[i * 4] = td[i * 4]; od.data[i * 4 + 1] = td[i * 4 + 1]; od.data[i * 4 + 2] = td[i * 4 + 2]; od.data[i * 4 + 3] = 255; }
  octx.putImageData(od, 0, 0);
  return octx.canvas;
}

// mode: "field" = bold colour field; "scene" = paper-fill ASCII over the landscape; "overlay" = glowing ASCII over an old+new painting
const SOURCES = [
  { f: "engravings2/scholar_laptop", key: true, mode: "overlay", label: "scholar+laptop · old+new" },
  { f: "engravings2/noble_phone_scene", mask: "masks/noble_phone_scene.png", mode: "overlay", label: "noble+phone · old+new" },
  { f: "engravings2/horse_blue",     key: true, mode: "field", label: "horse · bold field" },
  { f: "engravings/eng_agents",      key: true, mode: "field", label: "agents · bold field" },
  { f: "engravings/eng_figure",      key: true, mode: "field", label: "figure · bold field" },
  { f: "engravings/eng_crystal",     key: true, mode: "field", label: "crystal · bold field" },
  { f: "engravings2/horse_scene",    mask: "masks/horse_scene.png", mode: "scene", label: "horse · vintage scene" },
  { f: "engravings2/bison_scene",    mask: "masks/bison_scene.png", mode: "scene", label: "bison · vintage scene" },
];

function montage(title, tiles, cols, box) {
  const pad = 24, labelH = 28, gap = 14, titleH = 60;
  const rows = Math.ceil(tiles.length / cols);
  const W = pad * 2 + cols * box.w + (cols - 1) * gap;
  const H = titleH + pad + rows * (box.h + labelH) + (rows - 1) * gap + pad;
  const ctx = createCanvas(W, H).getContext("2d");
  ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.font = "600 22px sans-serif"; ctx.textBaseline = "top"; ctx.fillText(title, pad, 22);
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * (box.w + gap), y = titleH + pad + Math.floor(i / cols) * (box.h + labelH + gap);
    ctx.fillStyle = "#000"; ctx.fillRect(x, y, box.w, box.h);
    const s = Math.min(box.w / t.canvas.width, box.h / t.canvas.height);
    const dw = t.canvas.width * s, dh = t.canvas.height * s;
    ctx.drawImage(t.canvas, x + (box.w - dw) / 2, y + (box.h - dh) / 2, dw, dh);
    ctx.fillStyle = "#15151f"; ctx.fillRect(x, y + box.h, box.w, labelH);
    ctx.fillStyle = "#e8e8ef"; ctx.font = "500 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t.label, x + box.w / 2, y + box.h + labelH / 2); ctx.textAlign = "left";
  });
  return ctx.canvas;
}

// bold colour field — tinted letters / tone ramp on a flat brand blue (#4 / every.to)
const makeField = (buf, mask, glyph) =>
  renderTo(buf, mask, {
    asciiBackground: "solid", solidColor: FIELD.blue, colorMode: "original", asciiInk: "source",
    asciiGlyphMode: glyph, asciiRamp: "@%#*+=-:. ", asciiDensity: glyph === "ramp" ? 1 : 0.95,
  });
// vintage scene — fill the subject with paper tone + glyphs, then composite over the landscape (#2/#3)
const makeScene = (buf, mask, glyph) => {
  const top = renderTo(buf, mask, {
    asciiBackground: "solid", solidColor: paperColor(buf), colorMode: "original", asciiInk: "source",
    asciiGlyphMode: glyph, asciiRamp: "@%#*+=-:. ", asciiDensity: 1,
  });
  return compositeMasked(top, buf, mask);
};
// old+new painting — glowing light-blue ASCII over the kept painting (digital-over-renaissance)
const makeOverlay = (buf, mask) =>
  renderTo(buf, mask, {
    asciiBackground: "scene", colorMode: "original", asciiInk: "custom", asciiInkCustom: [170, 200, 255],
    asciiBlend: "screen", asciiGlyphMode: "random", asciiDensity: 0.55,
  });

const tiles = [];
for (const s of SOURCES) {
  const raw = await loadBuffer(`${LAB}/${s.f}.png`);
  const buf = upscale(raw, SCALE);
  const mask = s.key ? colorKeyMask(buf) : await loadMask(`${LAB}/${s.mask}`, buf.width, buf.height);
  const base = s.f.split("/").pop();
  let primary, alt, altName;
  if (s.mode === "field") { primary = makeField(buf, mask, "random"); alt = makeField(buf, mask, "ramp"); altName = "ramp"; }
  else if (s.mode === "scene") { primary = makeScene(buf, mask, "ramp"); alt = makeScene(buf, mask, "random"); altName = "random"; }
  else { primary = makeOverlay(buf, mask); }
  await save(primary, `${LAB}/out/ascii/${base}.png`);
  if (alt) await save(alt, `${LAB}/out/ascii/${base}_${altName}.png`);
  tiles.push({ canvas: primary, label: s.label });
}
await save(montage("v3 · ASCII-ART showcase  (field · scene · old+new overlay)", tiles, 4, { w: 320, h: 250 }), `${LAB}/out/ascii-showcase.png`);
console.log("saved out/ascii-showcase.png + out/ascii/*.png");
