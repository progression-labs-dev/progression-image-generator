// Presets — bundled brand looks (in code, seeded from the render.mjs sheets) +
// user presets persisted in localStorage. A preset captures the FULL param set
// so loading is a deterministic re-render. Source image + mask are NOT stored.
import { defaultParams } from "./params";
import { PAL, BRAND_COLORS, FIELD, saneCharset } from "./palettes";
import { SHIPPED_PRESETS } from "./shipped-presets";
import type { Engine, RenderParams } from "./render";

export interface Preset {
  id: string;
  name: string;
  builtIn: boolean;
  createdAt: number;
  engine: Engine;
  params: RenderParams;
}

const KEY = "pl-imagery-lab.presets.v1";
const VERSION = 1;

function cloneParams(p: RenderParams): RenderParams {
  return {
    ...p,
    palette: { interp: p.palette.interp, stops: p.palette.stops.map((s) => [...s] as [number, number, number]) },
    solidColor: [...p.solidColor] as [number, number, number],
    asciiInkCustom: [...p.asciiInkCustom] as [number, number, number],
  };
}

// ── bundled brand presets (builtIn) ──
export const BUILTIN_PRESETS: Preset[] = [
  {
    name: "Pixel surround + ASCII",
    engine: "mosaic",
    params: defaultParams("mosaic", { direction: "surroundings", palette: PAL.blue, cellSize: 18 }),
  },
  {
    name: "Pixel subject",
    engine: "mosaic",
    params: defaultParams("mosaic", { direction: "subject", palette: PAL.blue, cellSize: 16 }),
  },
  {
    name: "Subject · sharp half / dissolve half (↔)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject",
      splitEnabled: true,
      splitPosition: 0.5,
      splitAngle: 0,
      palette: PAL.blue,
      cellSize: 16,
    }),
  },
  {
    name: "Sharp face / pixel jacket (↕)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject",
      splitEnabled: true,
      splitPosition: 0.46,
      splitAngle: 90,
      palette: PAL.blue,
      cellSize: 16,
    }),
  },
  {
    name: "Subject cut-out · dissolve half (transparent)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject",
      splitEnabled: true,
      splitPosition: 0.5,
      splitAngle: 0,
      backgroundMode: "transparent",
      palette: PAL.blue,
      cellSize: 16,
    }),
  },
  {
    name: "Engraving fill · subject cut-out",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      process: "adaptive",
      processContrast: 1.6,
      processBias: 0.15,
      direction: "subject",
      splitEnabled: true,
      splitPosition: 0.5,
      splitAngle: 0,
      backgroundMode: "transparent",
      palette: PAL.blue,
      cellSize: 14,
    }),
  },
  {
    name: "Blue → Orange surround",
    engine: "mosaic",
    params: defaultParams("mosaic", { direction: "surroundings", palette: PAL.blueOrange, cellSize: 18 }),
  },
  {
    name: "Solid blue field",
    engine: "mosaic",
    params: defaultParams("mosaic", { direction: "solid", solidColor: FIELD.blue }),
  },
  {
    name: "Circles · navy sky",
    engine: "mosaic",
    params: defaultParams("mosaic", { direction: "surroundings", shape: "circle", palette: PAL.navySky, cellSize: 16 }),
  },
  {
    name: "ASCII art · tinted letters (bold field)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject", colorMode: "original", cellSize: 8, jitterEnabled: false,
      ascii: true, asciiArt: true, asciiPlacement: "ascii-only", asciiGlyphMode: "random",
      asciiInk: "source", asciiDensity: 0.95, asciiOpacity: 1, asciiBlend: "source-over",
      asciiBackground: "solid", solidColor: FIELD.blue, fontSizeMul: 1.95, fontWeight: 600,
    }),
  },
  {
    name: "ASCII art · tone ramp (bold field)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject", colorMode: "original", cellSize: 8, jitterEnabled: false,
      ascii: true, asciiArt: true, asciiPlacement: "ascii-only", asciiGlyphMode: "ramp",
      asciiRamp: "@%#*+=-:. ", asciiInk: "source", asciiDensity: 1, asciiOpacity: 1,
      asciiBlend: "source-over", asciiBackground: "solid", solidColor: FIELD.blue, fontSizeMul: 1.95,
    }),
  },
  {
    name: "ASCII overlay · old+new (glowing)",
    engine: "mosaic",
    params: defaultParams("mosaic", {
      direction: "subject", colorMode: "original", cellSize: 8, jitterEnabled: false,
      ascii: true, asciiArt: true, asciiPlacement: "ascii-only", asciiGlyphMode: "random",
      asciiInk: "custom", asciiInkCustom: [170, 200, 255], asciiDensity: 0.55, asciiOpacity: 1,
      asciiBlend: "screen", asciiBackground: "scene", fontSizeMul: 1.95, fontWeight: 600,
    }),
  },
  {
    name: "Deck · blue tint",
    engine: "deck",
    params: defaultParams("deck", { direction: "subject", asciiInkCustom: BRAND_COLORS.blue }),
  },
  {
    name: "Deck · orange tint",
    engine: "deck",
    params: defaultParams("deck", { direction: "subject", asciiInkCustom: FIELD.orange }),
  },
  // user-created looks promoted to built-ins (see lib/shipped-presets.ts) — merged over
  // engine defaults so any newer param is filled in, exactly like loading a saved preset.
  ...SHIPPED_PRESETS.map((p) => ({
    name: p.name,
    engine: p.engine,
    params: defaultParams(p.engine, p.params),
  })),
].map((p, i) => ({
  id: `builtin-${i}`,
  builtIn: true,
  createdAt: 0,
  name: p.name,
  engine: p.engine as Engine,
  params: p.params,
}));

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `u-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

export function loadUserPresets(): Preset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version: number; presets: Preset[] };
    if (!parsed?.presets) return [];
    // one-time migration: an older base-ui Input bug persisted asciiCharset as the literal
    // string "undefined" (its letters then rendered as glyphs). Scrub any such value back to
    // the default charset and re-save, so a dirty preset can never resurface the word again.
    let migrated = false;
    const presets = parsed.presets.map((p) => {
      const clean = saneCharset(p.params?.asciiCharset);
      if (clean !== p.params?.asciiCharset) {
        migrated = true;
        return { ...p, params: { ...p.params, asciiCharset: clean } };
      }
      return p;
    });
    if (migrated) persist(presets);
    return presets.map((p) => ({ ...p, builtIn: false }));
  } catch {
    return [];
  }
}

function persist(presets: Preset[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, presets }));
}

export function saveUserPreset(name: string, params: RenderParams): Preset {
  const preset: Preset = {
    id: uid(),
    name: name.trim() || "Untitled",
    builtIn: false,
    createdAt: Date.now(),
    engine: params.engine,
    params: cloneParams(params),
  };
  persist([...loadUserPresets(), preset]);
  return preset;
}

export function deleteUserPreset(id: string) {
  persist(loadUserPresets().filter((p) => p.id !== id));
}

export function exportUserPresetsJson(): string {
  return JSON.stringify({ version: VERSION, presets: loadUserPresets() }, null, 2);
}

export function importUserPresetsJson(json: string): number {
  const parsed = JSON.parse(json) as { presets?: Preset[] };
  if (!parsed?.presets?.length) return 0;
  const incoming = parsed.presets.map((p) => ({ ...p, id: uid(), builtIn: false }));
  persist([...loadUserPresets(), ...incoming]);
  return incoming.length;
}
