// Parity harness — proves web/lib/render.ts reproduces the canonical
// mosaic-core.mjs (= websiteplab mosaic) math pixel-for-pixel.
//
// Run:  cd web && bun scripts/parity.mjs
//
// For each case it renders the SAME params through (a) renderVariant() from the
// repo-root mosaic-core.mjs [reference] and (b) render() from lib/render.ts [port]
// using @napi-rs/canvas in Node, then diffs the pixels.
import { createCanvas } from "@napi-rs/canvas";
import {
  renderVariant,
  loadBuffer,
  loadMask,
  PAL,
  FIELD,
} from "../../mosaic-core.mjs";
import { render } from "../lib/render.ts";
import { ASCII_CHARSET } from "../lib/palettes.ts";

const ROOT = "/Users/joe/code/pl-imagery-lab";

// Full RenderParams with mosaic-equivalent defaults (mirror renderVariant constants).
function mosaicParams(over = {}) {
  return {
    engine: "mosaic",
    cellSize: 16,
    spacing: 0,
    shape: "pixel",
    direction: "surroundings",
    splitEnabled: false,
    splitPosition: 0.46,
    splitAngle: 90,
    solidColor: FIELD.blue,
    maskThreshold: 128,
    colorMode: "gradient",
    palette: PAL.blue,
    jitterEnabled: true,
    jitterMagnitude: 0.035,
    ascii: false,
    asciiCharset: ASCII_CHARSET,
    asciiDensity: 0.4,
    asciiInk: "white",
    asciiInkCustom: [0, 0, 255],
    asciiOpacityModel: "constant",
    asciiOpacity: 0.85,
    asciiFadeTop: 0.9,
    asciiFadeBottom: 0.05,
    asciiFadeSlope: 0.85,
    asciiBlend: "overlay",
    asciiPlacement: "in-pixel",
    asciiGridScale: 1,
    fontSizeMul: 1.6,
    fontSizeMin: 8,
    fontWeight: 500,
    fontFamily: "Inter, system-ui, sans-serif",
    shadowBlurMosaic: 4,
    shadowBlurDeckMul: 0.3,
    shadowAlphaMosaic: 0.6,
    shadowAlphaDeckMul: 0.4,
    brightnessCutoff: 0,
    watercolorBlobs: false,
    blobCountMin: 3,
    blobCountMax: 5,
    blobRadiusMul: 10,
    blobTintScale: 0.35,
    blobRedrawAlpha: 0.7,
    grainOpacity: 0,
    seed: 1,
    circleHlOffset: 0.25,
    circleHlRadius: 0.35,
    circleMidStop: 0.55,
    circleHighlight: 1.6,
    circleShadow: 0.45,
    ...over,
  };
}

// The reference renderVariant only reads these fields:
function refParams(p) {
  return {
    direction: p.direction,
    colorMode: p.colorMode,
    palette: p.colorMode === "gradient" ? p.palette : null,
    cellSize: p.cellSize,
    spacing: p.spacing,
    shape: p.shape,
    ascii: p.ascii,
    asciiOpacity: p.asciiOpacity,
    asciiInk: p.asciiInk,
    splitPosition: p.splitPosition,
    splitAngle: p.splitAngle,
    solidColor: p.solidColor,
  };
}

function diff(aData, bData) {
  let maxCh = 0;
  let nDiff = 0; // pixels where any channel differs by > 1
  let nDiff0 = 0; // pixels with any nonzero diff
  for (let i = 0; i < aData.length; i += 4) {
    let pixelDiff = 0;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(aData[i + c] - bData[i + c]);
      if (d > maxCh) maxCh = d;
      if (d > pixelDiff) pixelDiff = d;
    }
    if (pixelDiff > 0) nDiff0++;
    if (pixelDiff > 1) nDiff++;
  }
  return { maxCh, nDiff, nDiff0, total: aData.length / 4 };
}

const CASES = [
  { name: "solid · blue field", p: mosaicParams({ direction: "solid", solidColor: FIELD.blue }) },
  { name: "subject · blue grad · no ascii", p: mosaicParams({ direction: "subject" }) },
  { name: "surroundings · blue grad · no ascii", p: mosaicParams({ direction: "surroundings" }) },
  { name: "split 0.46/90 · blue · no ascii", p: mosaicParams({ direction: "split" }) },
  { name: "subject · original colour", p: mosaicParams({ direction: "subject", colorMode: "original" }) },
  { name: "surroundings · blue · ASCII on (white)", p: mosaicParams({ direction: "surroundings", ascii: true }) },
  { name: "surroundings · blue · circle · ASCII", p: mosaicParams({ direction: "surroundings", shape: "circle", ascii: true }) },
  { name: "subject · blue · ASCII brand ink · 18px", p: mosaicParams({ direction: "subject", ascii: true, asciiInk: "brand", cellSize: 18 }) },
];

async function main() {
  const buf = await loadBuffer(`${ROOT}/inputs/portrait.png`);
  const mask = await loadMask(`${ROOT}/masks/portrait.png`, buf.width, buf.height);
  console.log(`portrait ${buf.width}x${buf.height}, mask ${mask.length}px\n`);

  let failed = 0;
  for (const { name, p } of CASES) {
    // reference
    const refCanvas = renderVariant(buf, mask, refParams(p));
    const refData = refCanvas.getContext("2d").getImageData(0, 0, buf.width, buf.height).data;
    // port
    const myCanvas = createCanvas(buf.width, buf.height);
    render(myCanvas.getContext("2d"), buf, mask, p);
    const myData = myCanvas.getContext("2d").getImageData(0, 0, buf.width, buf.height).data;

    const d = diff(refData, myData);
    const pct = ((d.nDiff / d.total) * 100).toFixed(4);
    const ok = d.maxCh <= 1; // allow ±1/channel rounding
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} ${name.padEnd(40)} maxΔ=${String(d.maxCh).padStart(3)} ` +
        `pixels>1Δ=${String(d.nDiff).padStart(7)} (${pct}%)  anyΔ=${d.nDiff0}`,
    );
  }
  console.log(`\n${failed === 0 ? "PASS — port matches mosaic-core" : `FAIL — ${failed} case(s) exceeded ±1/channel`}`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
