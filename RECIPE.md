# Progression Labs Imagery — "Pixel Dissolve" recipe

The reproducible system for turning any photo into on-brand PL imagery: a sharp
subject with a brand-coloured pixel + ASCII mosaic, or a sharp cut-out on a flat
brand-colour field (the every.to move).

## Brand palette (corrected — blue / light blue / navy / orange ONLY)

| Role        | Hex       | RGB             |
|-------------|-----------|-----------------|
| Blue        | `#0000FF` / `#1e5bff` (UI) | (0,0,255) / (30,91,255) |
| Light/Sky   | `#60a5fa` | (96,165,250)    |
| Navy        | `#0943a0` | (9,67,160)      |
| Orange      | `#FFA07A` | (255,160,122)   |

**Do NOT use** turquoise / green / purple-orchid — off-brand (legacy values in the
Mosaic Tool + deck-imagery skill need replacing with the above).

### Gradient palettes (in `mosaic-core.mjs` → `PAL`)
- **blue** (signature, HSL): `[6,12,46] → [0,40,235] → [150,190,255]` — stays in the
  blue hue family so highlights never swing to magenta.
- **navySky** (HSL): `[9,29,64] → [9,67,160] → [120,180,255]`.
- **blueOrange** (RGB lerp, diverging): `[10,30,200] → [245,245,245] → [255,140,80]` —
  complementary hues MUST interpolate in RGB through a light neutral, not across the
  HSL hue wheel (which produces magenta/green mud).
- Solid fields (`FIELD`): blue `[30,91,255]`, navy `[9,67,160]`, orange `[255,160,122]`, cream `[250,247,242]`.

> ⚠️ Gotcha: HSL shortest-path hue interpolation toward a neutral white endpoint
> renders **magenta highlights**. Keep ramp endpoints inside the target hue, or lerp in RGB.

## Locked presets (Phase-1 choices: Pixel Blue default, ~16px medium blocks)

| Preset     | Look                                   | How it's built                               |
|------------|----------------------------------------|----------------------------------------------|
| `surround` | Sharp subject / pixel surround (HERO)  | subject mask **inverted**, blue gradient, ASCII |
| `jacket`   | Sharp face / pixel jacket              | horizontal **split** @0.46, lower region pixelates |
| `subject`  | Pixel subject                          | subject mask as-is                           |
| `solid`    | every.to solid field                   | sharp cut-out subject composited on flat field |

## CLI usage

```bash
cd /Users/joe/code/pl-imagery-lab
# any photo → a preset (auto-generates a rembg subject mask, cached in masks/)
bun apply.mjs <input.png> --preset surround                 # hero: sharp subject, blue pixel surround
bun apply.mjs <input.png> --preset jacket --color original  # jacket: face sharp, real-colour pixel jacket
bun apply.mjs <input.png> --preset solid  --field navy      # every.to: cut-out on navy field
# overrides: --color blue|navysky|original|blueorange  --size 10..28  --shape pixel|circle  --no-ascii
```

Contact-sheet experiment harness (compares many variants at once):
```bash
bun render.mjs all      # writes out/sheet-{A,B,C,D}-*.png
```

## Generating test/source imagery (Nano Banana)

```bash
export GOOGLE_AI_API_KEY=$(grep '^GOOGLE_AI_API_KEY=' ~/.claude/.env | cut -d= -f2-)
cd ~/.claude/skills/art/tools
bun generate-ulart-image.ts "<COLOUR prompt, brand blue+orange>" --aspect 4:5 --model google
```
> Gotcha: the shell defines `GOOGLE_AI_API_KEY` as empty, and dotenv won't overwrite it,
> so export the real value from `~/.claude/.env` first. Override the skill's B&W default —
> request **colour** explicitly. Only the Google key is set (no OpenAI/Replicate fallback).

## Masks

- Whole-subject (cut-out, surround, pixel-subject): `mask.py` via rembg (venv at `.venv/`).
- Partial region (e.g. jacket-only, sharp face): use the in-browser Mosaic Tool's SAM
  segmentation — rembg can only cut the whole foreground. The `jacket` preset approximates
  this headlessly with a horizontal split.

## Files
- `mosaic-core.mjs` — shared render math (ported verbatim from the Mosaic Tool) + palettes + presets.
- `apply.mjs` — single-image preset CLI.
- `render.mjs` — multi-variant contact-sheet harness (the experiment).
- `mask.py` — rembg subject mask.
- `inputs/`, `masks/`, `out/` — test images, cached masks, results.

## Status / next
- ✅ Experiment + corrected palette + CLI presets (verified).
- ⏳ Port the palette fix + presets + solid-field + mask-polarity into the live in-browser
  Mosaic Tool (`websiteplab/app/tools/mosaic/`), and update `deck-imagery` skill `BRAND_COLORS`.
- ⏳ Apply chosen imagery to the website.
