> [!WARNING]
> **PUBLIC REPOSITORY - PLEASE CHANGE IT TO PRIVATE**

# pl-imagery-lab

Standalone tool for **Progression Labs "Pixel Dissolve" brand imagery** — turn any
photo into an on-brand pixel + ASCII mosaic, or a clean cut-out on a flat brand-colour
field (the every.to look). Render math is ported verbatim from the `websiteplab` Mosaic Tool.

## Quickstart

```bash
bun install                       # @napi-rs/canvas
python3 -m venv .venv && .venv/bin/pip install rembg pillow onnxruntime   # for masks

# apply a locked preset to any photo (auto-masks via rembg, cached in masks/)
bun apply.mjs <photo.png> --preset surround           # HERO: sharp subject, blue pixel surround
bun apply.mjs <photo.png> --preset jacket --color original
bun apply.mjs <photo.png> --preset solid --field navy # every.to cut-out on a flat field

bun gallery.mjs                   # rebuild the curated showcase (out/gallery-*.png)
bun render.mjs all                # the experiment contact sheets (out/sheet-*.png)
```

Presets (Pixel Blue default, ~16px medium blocks): `surround`, `jacket`, `subject`, `solid`.
See **RECIPE.md** for the full system, palette, and gotchas.

## Generating source images (Nano Banana)
```bash
export GOOGLE_AI_API_KEY=$(grep '^GOOGLE_AI_API_KEY=' ~/.claude/.env | cut -d= -f2-)
cd ~/.claude/skills/art/tools && bun generate-ulart-image.ts "<colour brand prompt>" --aspect 4:5
```

## Layout
- `mosaic-core.mjs` — shared render math + brand palettes + presets
- `apply.mjs` — single-image preset CLI · `gallery.mjs` — curated showcase · `render.mjs` — experiment harness
- `mask.py` — rembg subject masks · `inputs/` `masks/` `out/` — sources, masks, results
