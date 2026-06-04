// Verify the shipped (built-in) copies of the user's presets reproduce the exact look
// they saved. Compares each BUILTIN_PRESETS entry against the user's ORIGINAL exported
// params, merged through the same `load` reducer the app uses.  cd web && bun scripts/verify-shipped-presets.mjs
import { BUILTIN_PRESETS } from "../lib/presets.ts";
import { paramsReducer, defaultParams } from "../lib/params.ts";

// the three presets exactly as exported from the running app's localStorage
const ORIGINAL = {
  "version 1": {"spacing":0,"maskThreshold":128,"asciiCharset":"0123456789@#$%&*+=?<>{}[]/\\|LABS","asciiFadeTop":0.9,"asciiFadeBottom":0.05,"asciiFadeSlope":0.85,"asciiGridScale":1,"fontSizeMul":1.6,"fontSizeMin":8,"fontWeight":500,"fontFamily":"Inter, system-ui, sans-serif","shadowBlurMosaic":4,"shadowBlurDeckMul":0.3,"shadowAlphaMosaic":0.6,"shadowAlphaDeckMul":0.4,"splitEnabled":false,"boundaryFeather":0,"backgroundMode":"photo","asciiArt":false,"asciiGlyphMode":"random","asciiRamp":"@%#*+=-:. ","asciiBackground":"scene","blobCountMin":3,"blobCountMax":5,"blobRadiusMul":10,"blobTintScale":0.35,"blobRedrawAlpha":0.7,"seed":7,"splitPosition":0.46,"splitAngle":90,"solidColor":[30,91,255],"circleHlOffset":0.25,"circleHlRadius":0.35,"circleMidStop":0.55,"circleHighlight":1.6,"circleShadow":0.45,"engine":"mosaic","direction":"subject","cellSize":10,"shape":"pixel","colorMode":"gradient","palette":{"interp":"rgb","stops":[[27,18,169],[244,189,194],[245,245,245]]},"jitterEnabled":true,"jitterMagnitude":0.2,"ascii":true,"asciiDensity":0.4,"asciiInk":"white","asciiInkCustom":[0,0,255],"asciiOpacityModel":"constant","asciiOpacity":0.85,"asciiBlend":"overlay","asciiPlacement":"in-pixel","brightnessCutoff":0,"watercolorBlobs":false,"grainOpacity":0},
  "horse 1": {"spacing":0,"maskThreshold":128,"asciiCharset":"0123456789@#$%&*+=?<>{}[]/\\|LABS","asciiGlyphScatter":true,"asciiFadeTop":1,"asciiFadeBottom":0.17,"asciiFadeSlope":1.5,"asciiGridScale":1,"fontSizeMul":1.75,"fontSizeMin":8,"fontWeight":500,"fontFamily":"Inter, system-ui, sans-serif","shadowBlurMosaic":4,"shadowBlurDeckMul":0.3,"shadowAlphaMosaic":0.6,"shadowAlphaDeckMul":0.4,"splitEnabled":true,"boundaryFeather":0,"backgroundMode":"photo","coverEdges":false,"process":"off","processRadius":14,"processBias":0.12,"processContrast":1.4,"processHardness":0,"asciiArt":false,"asciiGlyphMode":"random","asciiRamp":"@%#*+=-:. ","asciiBackground":"scene","blobCountMin":3,"blobCountMax":5,"blobRadiusMul":10,"blobTintScale":0.35,"blobRedrawAlpha":0.7,"seed":7,"splitPosition":0.51,"splitAngle":18,"solidColor":[30,91,255],"circleHlOffset":0.25,"circleHlRadius":0.35,"circleMidStop":0.55,"circleHighlight":1.6,"circleShadow":0.45,"engine":"mosaic","direction":"subject","cellSize":8,"shape":"pixel","colorMode":"gradient","palette":{"interp":"rgb","stops":[[27,18,169],[92,154,255],[255,176,112]]},"jitterEnabled":true,"jitterMagnitude":0.2,"ascii":true,"asciiDensity":0.3,"asciiInk":"white","asciiInkCustom":[0,0,255],"asciiOpacityModel":"fade","asciiOpacity":0.63,"asciiBlend":"overlay","asciiPlacement":"in-pixel","brightnessCutoff":0,"watercolorBlobs":false,"grainOpacity":0},
  "look 2": {"spacing":0,"maskThreshold":128,"asciiCharset":"Progression Labs*@//!$(+=","asciiGlyphScatter":true,"asciiFadeTop":1,"asciiFadeBottom":0.17,"asciiFadeSlope":1.5,"asciiGridScale":1,"fontSizeMul":1.75,"fontSizeMin":8,"fontWeight":500,"fontFamily":"Inter, system-ui, sans-serif","shadowBlurMosaic":4,"shadowBlurDeckMul":0.3,"shadowAlphaMosaic":0.6,"shadowAlphaDeckMul":0.4,"splitEnabled":true,"boundaryFeather":0,"backgroundMode":"photo","coverEdges":true,"process":"off","processRadius":14,"processBias":0.12,"processContrast":1.4,"processHardness":0,"asciiArt":false,"asciiGlyphMode":"random","asciiRamp":"@%#*+=-:. ","asciiBackground":"scene","blobCountMin":3,"blobCountMax":5,"blobRadiusMul":10,"blobTintScale":0.35,"blobRedrawAlpha":0.7,"seed":7,"splitPosition":0.45,"splitAngle":18,"solidColor":[30,91,255],"circleHlOffset":0.25,"circleHlRadius":0.35,"circleMidStop":0.55,"circleHighlight":1.6,"circleShadow":0.45,"engine":"mosaic","direction":"subject","cellSize":6,"shape":"pixel","colorMode":"gradient","palette":{"interp":"rgb","stops":[[27,18,169],[92,154,255],[255,176,112]]},"jitterEnabled":true,"jitterMagnitude":0.2,"ascii":true,"asciiDensity":0.3,"asciiInk":"white","asciiInkCustom":[0,0,255],"asciiOpacityModel":"fade","asciiOpacity":0.63,"asciiBlend":"overlay","asciiPlacement":"in-pixel","brightnessCutoff":0,"watercolorBlobs":false,"grainOpacity":0},
};

const stable = (o) => JSON.stringify(o, Object.keys(JSON.parse(JSON.stringify(o))).sort?.() ?? null);
function deepDiff(a, b, path = "") {
  const out = [];
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const pa = `${path}${path ? "." : ""}${k}`;
    const va = a?.[k], vb = b?.[k];
    if (typeof va === "object" && va && typeof vb === "object" && vb) out.push(...deepDiff(va, vb, pa));
    else if (JSON.stringify(va) !== JSON.stringify(vb)) out.push(`${pa}: shipped=${JSON.stringify(va)} expected=${JSON.stringify(vb)}`);
  }
  return out;
}

let fail = 0;
for (const [name, original] of Object.entries(ORIGINAL)) {
  const shipped = BUILTIN_PRESETS.find((p) => p.name === name)?.params;
  if (!shipped) { console.error(`MISSING shipped preset "${name}"`); fail++; continue; }
  // what the app produces when LOADING the user's original export:
  const expected = paramsReducer(defaultParams("mosaic"), { type: "load", params: original });
  const diffs = deepDiff(shipped, expected);
  if (diffs.length) { console.error(`DIFF "${name}":\n  ${diffs.join("\n  ")}`); fail++; }
  else console.log(`OK   "${name}" — shipped preset reproduces the saved look exactly`);
}
if (fail) { console.error(`\nFAIL — ${fail} preset(s) differ`); process.exit(1); }
console.log("\nPASS — all shipped presets match the user's saved looks");
