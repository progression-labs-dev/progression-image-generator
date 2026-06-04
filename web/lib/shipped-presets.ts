// User-created looks promoted to shipped built-ins, so the tool comes pre-set-up for
// everyone (no localStorage import needed). Exported verbatim from the running app's
// localStorage (2026-06-04). Each entry is the FULL param set → an exact reproduction;
// defaultParams() at the call site (lib/presets.ts) merges it over the engine defaults,
// so any control added after this export is filled in — matching how a saved preset loads.
import type { Engine, RenderParams } from "./render";
import type { RGB } from "./palettes";

const c = (r: number, g: number, b: number): RGB => [r, g, b];

export const SHIPPED_PRESETS: { name: string; engine: Engine; params: Partial<RenderParams> }[] = [
  {
    name: "version 1",
    engine: "mosaic",
    params: {
      spacing: 0, maskThreshold: 128, asciiCharset: "0123456789@#$%&*+=?<>{}[]/\\|LABS",
      asciiFadeTop: 0.9, asciiFadeBottom: 0.05, asciiFadeSlope: 0.85, asciiGridScale: 1,
      fontSizeMul: 1.6, fontSizeMin: 8, fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif",
      shadowBlurMosaic: 4, shadowBlurDeckMul: 0.3, shadowAlphaMosaic: 0.6, shadowAlphaDeckMul: 0.4,
      splitEnabled: false, boundaryFeather: 0, backgroundMode: "photo",
      asciiArt: false, asciiGlyphMode: "random", asciiRamp: "@%#*+=-:. ", asciiBackground: "scene",
      blobCountMin: 3, blobCountMax: 5, blobRadiusMul: 10, blobTintScale: 0.35, blobRedrawAlpha: 0.7,
      seed: 7, splitPosition: 0.46, splitAngle: 90, solidColor: c(30, 91, 255),
      circleHlOffset: 0.25, circleHlRadius: 0.35, circleMidStop: 0.55, circleHighlight: 1.6, circleShadow: 0.45,
      engine: "mosaic", direction: "subject", cellSize: 10, shape: "pixel", colorMode: "gradient",
      palette: { interp: "rgb", stops: [c(27, 18, 169), c(244, 189, 194), c(245, 245, 245)] },
      jitterEnabled: true, jitterMagnitude: 0.2, ascii: true, asciiDensity: 0.4,
      asciiInk: "white", asciiInkCustom: c(0, 0, 255), asciiOpacityModel: "constant", asciiOpacity: 0.85,
      asciiBlend: "overlay", asciiPlacement: "in-pixel", brightnessCutoff: 0, watercolorBlobs: false, grainOpacity: 0,
    },
  },
  {
    name: "horse 1",
    engine: "mosaic",
    params: {
      spacing: 0, maskThreshold: 128, asciiCharset: "0123456789@#$%&*+=?<>{}[]/\\|LABS", asciiGlyphScatter: true,
      asciiFadeTop: 1, asciiFadeBottom: 0.17, asciiFadeSlope: 1.5, asciiGridScale: 1,
      fontSizeMul: 1.75, fontSizeMin: 8, fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif",
      shadowBlurMosaic: 4, shadowBlurDeckMul: 0.3, shadowAlphaMosaic: 0.6, shadowAlphaDeckMul: 0.4,
      splitEnabled: true, boundaryFeather: 0, backgroundMode: "photo", coverEdges: false,
      process: "off", processRadius: 14, processBias: 0.12, processContrast: 1.4, processHardness: 0,
      asciiArt: false, asciiGlyphMode: "random", asciiRamp: "@%#*+=-:. ", asciiBackground: "scene",
      blobCountMin: 3, blobCountMax: 5, blobRadiusMul: 10, blobTintScale: 0.35, blobRedrawAlpha: 0.7,
      seed: 7, splitPosition: 0.51, splitAngle: 18, solidColor: c(30, 91, 255),
      circleHlOffset: 0.25, circleHlRadius: 0.35, circleMidStop: 0.55, circleHighlight: 1.6, circleShadow: 0.45,
      engine: "mosaic", direction: "subject", cellSize: 8, shape: "pixel", colorMode: "gradient",
      palette: { interp: "rgb", stops: [c(27, 18, 169), c(92, 154, 255), c(255, 176, 112)] },
      jitterEnabled: true, jitterMagnitude: 0.2, ascii: true, asciiDensity: 0.3,
      asciiInk: "white", asciiInkCustom: c(0, 0, 255), asciiOpacityModel: "fade", asciiOpacity: 0.63,
      asciiBlend: "overlay", asciiPlacement: "in-pixel", brightnessCutoff: 0, watercolorBlobs: false, grainOpacity: 0,
    },
  },
  {
    name: "look 2",
    engine: "mosaic",
    params: {
      spacing: 0, maskThreshold: 128, asciiCharset: "Progression Labs*@//!$(+=", asciiGlyphScatter: true,
      asciiFadeTop: 1, asciiFadeBottom: 0.17, asciiFadeSlope: 1.5, asciiGridScale: 1,
      fontSizeMul: 1.75, fontSizeMin: 8, fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif",
      shadowBlurMosaic: 4, shadowBlurDeckMul: 0.3, shadowAlphaMosaic: 0.6, shadowAlphaDeckMul: 0.4,
      splitEnabled: true, boundaryFeather: 0, backgroundMode: "photo", coverEdges: true,
      process: "off", processRadius: 14, processBias: 0.12, processContrast: 1.4, processHardness: 0,
      asciiArt: false, asciiGlyphMode: "random", asciiRamp: "@%#*+=-:. ", asciiBackground: "scene",
      blobCountMin: 3, blobCountMax: 5, blobRadiusMul: 10, blobTintScale: 0.35, blobRedrawAlpha: 0.7,
      seed: 7, splitPosition: 0.45, splitAngle: 18, solidColor: c(30, 91, 255),
      circleHlOffset: 0.25, circleHlRadius: 0.35, circleMidStop: 0.55, circleHighlight: 1.6, circleShadow: 0.45,
      engine: "mosaic", direction: "subject", cellSize: 6, shape: "pixel", colorMode: "gradient",
      palette: { interp: "rgb", stops: [c(27, 18, 169), c(92, 154, 255), c(255, 176, 112)] },
      jitterEnabled: true, jitterMagnitude: 0.2, ascii: true, asciiDensity: 0.3,
      asciiInk: "white", asciiInkCustom: c(0, 0, 255), asciiOpacityModel: "fade", asciiOpacity: 0.63,
      asciiBlend: "overlay", asciiPlacement: "in-pixel", brightnessCutoff: 0, watercolorBlobs: false, grainOpacity: 0,
    },
  },
];
