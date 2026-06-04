// Verbatim constants from mosaic-core.mjs / process-deck-image.js — single source.
// Do NOT re-derive these; they are ported byte-for-byte from websiteplab.

export type RGB = [number, number, number];
export type Interp = "hsl" | "rgb";
export interface Palette {
  stops: RGB[];
  interp: Interp;
}

// shapes.ts charset (note trailing "LABS" brand glyphs, and the / \ | symbols)
export const ASCII_CHARSET = "0123456789@#$%&*+=?<>{}[]/\\|LABS";

// Guard the ASCII charset against the empty string and the coercion artifacts
// "undefined" / "null" that an older controlled-input bug left in the value. Crucially it
// strips them as SUBSTRINGS, not just as the exact string: under that bug the field could
// hold "undefined", and typing onto the end of it (no select-all) produced e.g.
// "undefinedprog", whose letters then rendered as the word "undefined" on the canvas. We
// remove every embedded "undefined"/"null" token and fall back to the default if nothing
// usable remains. No-op for normal charsets (incl. ASCII_CHARSET, which has no lowercase),
// so the renderer stays byte-identical to mosaic-core. Used by the renderer, the load
// reducer, AND the preset migration, so a bad value can never reach the canvas or persist.
export function saneCharset(c: unknown): string {
  if (typeof c !== "string") return ASCII_CHARSET;
  // Loop, because one pass can REJOIN a token (e.g. "uundefinedndefinedprog" →
  // "undefinedprog" → "prog"); keep stripping until the string stops changing.
  let cleaned = c;
  for (let prev = ""; cleaned !== prev; ) {
    prev = cleaned;
    cleaned = cleaned.replace(/undefined|null/gi, "");
  }
  return cleaned === "" ? ASCII_CHARSET : cleaned;
}

// ── multi-stop gradient palettes (mosaic) ──
// HSL palettes stay within the blue hue family (no neutral endpoint → no magenta).
// blueOrange is RGB-lerped through a light neutral (diverging) to stay clean.
export const PAL: Record<string, Palette> = {
  blue: { stops: [[6, 12, 46], [0, 40, 235], [150, 190, 255]], interp: "hsl" },
  navySky: { stops: [[9, 29, 64], [9, 67, 160], [120, 180, 255]], interp: "hsl" },
  blueOrange: { stops: [[10, 30, 200], [245, 245, 245], [255, 140, 80]], interp: "rgb" },
  orange: { stops: [[52, 22, 16], [255, 150, 90], [255, 232, 210]], interp: "hsl" },
};

// ── solid "every.to" field colours ──
export const FIELD: Record<string, RGB> = {
  blue: [30, 91, 255],
  navy: [9, 67, 160],
  orange: [255, 160, 122],
  cream: [250, 247, 242],
};

// ── deck single-colour ASCII tints (process-deck-image.js BRAND_COLORS) ──
// Canonical brand palette = blue / light-blue / navy / orange. orchid/green/
// turquoise are legacy and kept only as extra playground options.
export const BRAND_COLORS: Record<string, RGB> = {
  blue: [0, 0, 255],
  salmon: [255, 160, 122],
  orchid: [186, 85, 211],
  green: [185, 233, 121],
  turquoise: [64, 224, 208],
};

// ── brand quick-pick swatches (name + hex/RGB) — used by the colour pickers ──
// Default to the canonical PL palette; override the hex any time via the pickers.
export const BRAND_SWATCHES: { name: string; rgb: RGB }[] = [
  { name: "Blue", rgb: [0, 0, 255] },
  { name: "Sky", rgb: [150, 190, 255] },
  { name: "Navy", rgb: [9, 67, 160] },
  { name: "Orange", rgb: [255, 160, 122] },
  { name: "White", rgb: [255, 255, 255] },
  { name: "Black", rgb: [10, 12, 20] },
];

// ── magic numbers surfaced as named constants ──
export const POSHASH_A = 7919;
export const POSHASH_B = 104729;
export const POSHASH_DIV = 4294967296;
export const JITTER_HASH_MUL = 127.1;
export const JITTER_HASH_SCALE = 43758.5453123;
// ITU-R BT.709 luma weights
export const LUMA_R = 0.2126;
export const LUMA_G = 0.7152;
export const LUMA_B = 0.0722;
