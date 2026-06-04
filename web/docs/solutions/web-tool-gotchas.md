---
title: PL Imagery Lab web tool — build gotchas
category: frontend
date: 2026-06-03
stack: [next16, react19, base-ui, shadcn, tailwind4, imgly]
---

Gotchas hit building the interactive Pixel Dissolve tool (`web/`). Symptom → fix.

## shadcn@latest is base-ui, not Radix
`shadcn init` (2026) scaffolds `@base-ui/react/*` components. APIs differ from all Radix examples.
- **`asChild` unknown** → "React does not recognize the asChild prop" + nested `<button>` hydration
  error. Fix: style the trigger directly (className+children on `<PopoverTrigger>` / `<DialogTrigger>`),
  or use base-ui `render={<el/>}` (children live on the render element).
- **ToggleGroup**: no `type="single"`; `value` is `string[]`, `onValueChange(vals: string[])` → use `vals[0]`.
- **Accordion**: no `type="multiple"`; `openMultiple` (default true) + `defaultValue={string[]}`.
- **Select**: `onValueChange(v: string | null)`, `Select.Value` function child gets `string | null`,
  label shows only via function child `{(v)=>labelFor(v)}`. Generic value mis-infers → coerce with
  `value={String(v)}` and map back through options.
- **TooltipProvider** prop is `delay` (not `delayDuration`). Slider `value` must be an array (number → 2 thumbs).
- `bun run build` (full tsc) surfaces every one of these.

## @imgly/background-removal relative URL → 404
Passing `/samples/x.png` to `removeBackground()` makes it resolve against the model CDN
(`staticimgly.com/samples/x.png` → 404). Always pass a **Blob** (fetch the URL to a blob first).
Output mask alpha must be drawn into the working source dims (`drawImage(bmp,0,0,w,h)`) and
thresholded at 128 — must match the renderer's Src dims.

## React 19 StrictMode double-mount
A `loadedRef` guard + a `cancelled` cleanup flag interacted badly: mount1 starts load → cleanup
cancels it → mount2 skips (guard already set) → nothing loads. Fix: drop the ref guard; keep only
the per-effect `cancelled` flag (mount2 runs its own load fully).

## Canvas + Inter font
Canvas `ctx.font = '...Inter...'` needs the literal "Inter" family registered. `next/font/google`
obfuscates the name → use `@fontsource/inter` (real "Inter") and gate first draw on
`document.fonts.ready` + `document.fonts.load('500 16px Inter')`.

## COOP/COEP trade-off
WASM multi-threading needs cross-origin isolation (COOP same-origin + COEP require-corp). But
require-corp blocks the cross-origin @imgly model CDN. So either run single-threaded (current —
works, slower) OR self-host the model in `public/imgly/` + `publicPath` + headers. Don't half-enable.

## ASCII glyphs collapse to "0 / +" (glyph-hash aliasing)
Symptom: the ASCII overlay only ever shows 1–2 characters regardless of charset. Cause: the legacy
`asciiGlyph` picks `charset[(cx*7919 + cy*104729) % len]`, but cell centres sit on a regular grid
with an **even stride** (`2*cellSize`), so that index barely moves — at cellSize 16 it's a single
glyph (`0`), at 8 it's a 2-glyph checkerboard (`0`/`+`). The full charset is never reached. Fix:
`scatterGlyph()` runs the position seed through an xxhash-style avalanche finalizer (`Math.imul` +
xorshifts) so low bits depend on all bits → whole charset, still deterministic per position. Gated
behind `asciiGlyphScatter` (default **on** in the app, **unset/off** in `scripts/parity.mjs` so
render.ts stays byte-identical to mosaic-core). Also added a **Characters** picker (free text +
presets) bound to the existing `asciiCharset` param. Verified empirically: legacy=1–2 distinct vs
scatter=33 distinct across cell sizes 8/10/16/18.
