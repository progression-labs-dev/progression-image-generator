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
2026-06-04: ASCII glyphs collapsed to "0/+" -> legacy glyph hash aliases on even grid stride; added scatterGlyph avalanche (opt-in asciiGlyphScatter, default on) + Characters charset picker. Parity still byte-identical.
2026-06-04: cut-out/solid bg "insanely slow" (854ms/frame) -> per-frame getImageData readback of the GPU canvas; replaced with destination-in/over composite + cached mask canvas -> ~2ms. Never getImageData a displayed canvas per-frame.
2026-06-04: Subject+Split effect vanished below an arbitrary split position -> split line was frame-relative so it cleared the subject's edge; anchor split to the subject bbox when direction=subject (frame-relative otherwise → parity intact).
2026-06-04: dissolve had see-through gaps in dark areas -> added Processing (adaptive local-contrast fill, lib/process.ts, integral image) feeding base+cells; bypasses brightnessCutoff + dilates mask for edge fill. process:"off" default → parity intact.
2026-06-04: ASCII showed "undefined" -> asciiCharset was the STRING "undefined" (base-ui Input value={undefined} coercion, then saved). Fix: value={asciiCharset ?? ""} + saneCharset() (in palettes.ts) used in BOTH the render guard AND the load reducer, so a bad value never reaches the canvas even with HMR-persisted state.
2026-06-04: pixels left gaps at the subject's silhouette edges (cell-centre mask test skips edge cells) -> "Fill edges" toggle (coverEdges) dilates the effect mask 1 cell (8-neighbourhood); also implied by Adaptive fill. Default off -> parity intact. Pair with Cut out to trim overflow.
2026-06-04: text inputs (Characters etc.) didn't update state when typing -> base-ui <Input> drives changes via onValueChange, not native onChange; bridged once in ui/input.tsx (onValueChange -> consumer onChange). THIS was the real cause of the stuck "undefined". Always test inputs with real keystrokes, not dispatched DOM events.
2026-06-04: "undefined" STILL rendered after all the code fixes -> the fixes were correct on disk (tsc 0, parity OK) but the Turbopack dev server had been up ~19h across a machine sleep and STOPPED recompiling (dev log: no compiles that day; earlier a duplicate-`saneCharset` compile error in params.ts had frozen the served bundle). It kept serving pre-fix code, so the saved preset's persisted asciiCharset:"undefined" loaded raw + rendered; a browser reload can't fix server-side staleness. Fix: kill the dev procs + `rm -rf .next` + restart -> current code runs. Verified (real keystrokes): field="undefined" renders byte-identical to default (saneCharset live), field="prog" changes the canvas. Lesson: when an on-disk fix "doesn't work", confirm the dev log shows a fresh ✓ Compiled before debugging the code; long-lived dev servers go stale after sleep.
2026-06-04: also scrub persisted bad charset on load -> loadUserPresets() now runs saneCharset over each stored preset's asciiCharset and re-saves once, so a dirty saved preset ("undefined") can never resurface.
2026-06-04: "undefined" STILL showed even on the fresh server -> saneCharset only rejected the EXACT string "undefined"; but the real persisted value was "undefinedprog" (under the old bug the field held "undefined" and the user typed "prog" onto the END), and a substring sails past an exact-match guard -> renders the word. Fix: saneCharset now STRIPS embedded /undefined|null/ tokens (so "undefinedprog"->"prog"), used by render + load + the preset migration. No-op for normal charsets incl. ASCII_CHARSET -> parity byte-identical. Verified in-session: render("undefinedprog") === render("prog") (same canvas hash); migration rewrote a stored "undefinedprog" preset -> "prog". Lesson: sanitize coercion artifacts as substrings, not just exact strings — a corrupt value gets EDITED, not replaced wholesale.
2026-06-04: **THE REAL "undefined" CAUSE (all the charset work above was a red herring): a signed-int bug in scatterGlyph.** The word appeared for ANY charset (even "ZZZZ"), independent of asciiCharset. Cause: scatterGlyph's final `h ^= h >>> 16` yields a SIGNED int32, and `charset[h % charset.length]` with negative h gives a NEGATIVE index -> charset[-n] === undefined (JS) -> ctx.fillText(undefined) paints the literal word "undefined" in ~half the cells. Fix: `charset[(h >>> 0) % charset.length]` (one char: coerce to uint32 before the modulo). Why every test missed it: the bug is charset-INDEPENDENT and DETERMINISTIC per (cx,cy), so canvas-hash comparisons cancelled it out (render("undefined")===render(default)===render("prog") all carried the SAME undefined cells), and parity uses scatter OFF (legacy asciiGlyph already had `>>> 0`). Only rendering a single-char charset ("ZZZZ") on a FLAT field — where every glyph must be identical — exposed the rogue "undefined". Found by instrumenting drawAsciiChar to dump char values (28/88 were `undefined`). Regression test: scripts/scatter-test.mjs (64000 positions, asserts never undefined). Lesson: `(signed) % n` is negative in JS; always `>>> 0` a hash before indexing. And fillText(undefined) silently coerces to the string "undefined" — a single bad index becomes visible text. Verify glyph logic with a SINGLE-char charset on a flat field, not hashes (hashes hide charset-independent bugs).
