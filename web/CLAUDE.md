@AGENTS.md

# PL Imagery Lab — Interactive Web Tool

Interactive playground for Progression Labs' "Pixel Dissolve" mosaic / ASCII-gradient image
treatment. Take a photo → rebuild a chosen region as frosted pixel blocks + glowing ASCII glyphs,
recoloured through a gradient palette. Replaces a manual DaVinci workflow.

**Run:** `bun dev` → http://localhost:3000/lab (uses next free port if 3000 busy).

## Architecture
- `lib/render.ts` — ★ the renderer. VERBATIM TypeScript port of the repo-root `mosaic-core.mjs`
  math (websiteplab mosaic tool) + the deck post-passes from `~/.claude/skills/deck-imagery/process-deck-image.js`.
  Every constant is a field on `RenderParams`. Runs in browser, worker, and Node (@napi-rs/canvas).
  **Do NOT re-derive the math** — it's verified byte-identical against the source.
- `lib/params.ts` — `defaultParams(engine)` (mosaic vs deck) + the params reducer.
- `hooks/useMosaicRenderer.ts` — decouples React state from the canvas: big buffers (source
  ImageData, mask) live in refs; draws are **rAF-coalesced** (not debounced); heavy passes
  (blobs/grain) skip during slider drag.
- `components/lab/*` — `ControlsRail` (Accordion of sections), `controls.tsx` (Slider/Toggle/Select
  rows via `LabContext`), `GradientEditor`, `SourceMaskSection`, `ExportSection`, `ContactSheetDialog`,
  `PresetBar`, `Stage`.
- `lib/bgRemoval.ts` — @imgly/background-removal (client-only dynamic import) → binary mask.
- `lib/exportPng.ts`, `lib/contactSheet.ts`, `lib/presets.ts`.

## Verify (run before claiming done)
- `bun scripts/parity.mjs` — render port vs mosaic-core, must be byte-identical.
- `bun scripts/deck-determinism.mjs` — seeded blobs reproducible.
- `bun run build` — full tsc; catches base-ui type issues + any @imgly server-bundle leak.
- Visual: `bun dev` + Playwright screenshot of `/lab` (per global rule — never claim UI done w/o it).

## Gotchas (see also docs/solutions/)
- shadcn here is **base-ui**, not Radix — no `asChild`, ToggleGroup/Accordion/Select APIs differ.
- @imgly needs a **Blob**, not a relative URL (a URL resolves against its model CDN → 404).
- Mask Uint8Array dims MUST equal the working source dims.
- Inter loaded via `@fontsource/inter` so canvas `'Inter'` family + `document.fonts.load` work.
- bg removal runs single-threaded (no COOP/COEP). To multi-thread: self-host the model in
  `public/imgly/` + set `publicPath` + COOP/COEP headers (don't enable COEP without self-hosting —
  it blocks the cross-origin CDN model).

## History
2026-06-03: base-ui (not Radix) shadcn flavor -> rewrote controls (asChild→render, array ToggleGroup, Select string|null).
2026-06-03: @imgly relative-URL → staticimgly 404 -> always pass a Blob.
2026-06-03: React 19 StrictMode double-mount + loadedRef guard -> dropped guard, used cancel flag only.
