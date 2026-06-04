// Default RenderParams per engine + the params reducer.
// Mosaic defaults reproduce mosaic-core.mjs exactly (verified by scripts/parity.mjs).
// Deck defaults reproduce process-deck-image.js.
import { PAL, FIELD, BRAND_COLORS, ASCII_CHARSET, type RGB } from "./palettes";
import type { Engine, RenderParams } from "./render";

const SHARED = {
  spacing: 0,
  maskThreshold: 128,
  asciiCharset: ASCII_CHARSET,
  asciiGlyphScatter: true,
  asciiFadeTop: 0.9,
  asciiFadeBottom: 0.05,
  asciiFadeSlope: 0.85,
  asciiGridScale: 1,
  fontSizeMul: 1.6,
  fontSizeMin: 8,
  fontWeight: 500,
  fontFamily: "Inter, system-ui, sans-serif",
  shadowBlurMosaic: 4,
  shadowBlurDeckMul: 0.3,
  shadowAlphaMosaic: 0.6,
  shadowAlphaDeckMul: 0.4,
  splitEnabled: false,
  boundaryFeather: 0,
  backgroundMode: "photo",
  asciiArt: false,
  asciiGlyphMode: "random",
  asciiRamp: "@%#*+=-:. ",
  asciiBackground: "scene",
  blobCountMin: 3,
  blobCountMax: 5,
  blobRadiusMul: 10,
  blobTintScale: 0.35,
  blobRedrawAlpha: 0.7,
  seed: 7,
  splitPosition: 0.46,
  splitAngle: 90,
  solidColor: FIELD.blue,
  circleHlOffset: 0.25,
  circleHlRadius: 0.35,
  circleMidStop: 0.55,
  circleHighlight: 1.6,
  circleShadow: 0.45,
} as const;

const MOSAIC: RenderParams = {
  ...SHARED,
  engine: "mosaic",
  // hero look: sharp subject / pixel surround, signature blue, ASCII on
  direction: "surroundings",
  cellSize: 16,
  shape: "pixel",
  colorMode: "gradient",
  palette: PAL.blue,
  jitterEnabled: true,
  jitterMagnitude: 0.035,
  ascii: true,
  asciiDensity: 0.4,
  asciiInk: "white",
  asciiInkCustom: [0, 0, 255] as RGB,
  asciiOpacityModel: "constant",
  asciiOpacity: 0.85,
  asciiBlend: "overlay",
  asciiPlacement: "in-pixel",
  brightnessCutoff: 0,
  watercolorBlobs: false,
  grainOpacity: 0,
  solidColor: FIELD.blue,
};

const DECK: RenderParams = {
  ...SHARED,
  engine: "deck",
  // deck "ASCII-gradient": greyscale frosted subject, brand tint via ASCII + blobs + grain
  direction: "subject",
  cellSize: 14,
  shape: "pixel",
  colorMode: "original",
  palette: PAL.blue,
  jitterEnabled: false,
  jitterMagnitude: 0.035,
  ascii: true,
  asciiDensity: 0.5,
  asciiInk: "custom",
  asciiInkCustom: BRAND_COLORS.blue, // canonical brand blue (deck CLI default was orchid)
  asciiOpacityModel: "fade",
  asciiOpacity: 0.85,
  asciiBlend: "source-over",
  asciiPlacement: "deck-tint",
  brightnessCutoff: 80,
  watercolorBlobs: true,
  grainOpacity: 0.06,
  solidColor: FIELD.blue,
};

export function defaultParams(engine: Engine, over: Partial<RenderParams> = {}): RenderParams {
  const base = engine === "deck" ? DECK : MOSAIC;
  return { ...base, ...over, palette: cloneParams(over.palette ?? base.palette) };
}

// deep-clone the palette so editing stops in one params object never mutates a default
function cloneParams(p: RenderParams["palette"]): RenderParams["palette"] {
  return { interp: p.interp, stops: p.stops.map((s) => [...s] as RGB) };
}

// ── reducer ──
export type ParamsAction =
  | { type: "set"; key: keyof RenderParams; value: RenderParams[keyof RenderParams] }
  | { type: "patch"; patch: Partial<RenderParams> }
  | { type: "setEngine"; engine: Engine }
  | { type: "load"; params: RenderParams };

export function paramsReducer(state: RenderParams, action: ParamsAction): RenderParams {
  switch (action.type) {
    case "set":
      return { ...state, [action.key]: action.value };
    case "patch":
      return { ...state, ...action.patch };
    case "setEngine":
      // switch engine but keep the user's region/colour choices where sensible
      return defaultParams(action.engine, {
        direction: state.direction,
        cellSize: state.cellSize,
        palette: state.palette,
        colorMode: state.colorMode,
        splitEnabled: state.splitEnabled,
        splitPosition: state.splitPosition,
        splitAngle: state.splitAngle,
        backgroundMode: state.backgroundMode,
        asciiInk: state.asciiInk,
        asciiInkCustom: state.asciiInkCustom,
        solidColor: state.solidColor,
      });
    case "load":
      // merge over engine defaults so presets saved before a param existed still get
      // a sensible value (e.g. asciiGlyphScatter / backgroundMode on older presets).
      return { ...defaultParams(action.params.engine), ...action.params };
    default:
      return state;
  }
}
