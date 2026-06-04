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

## "Split position" makes the effect vanish below an arbitrary value
Symptom: with Subject + Split, dragging Split position past some image-specific value (e.g. 0.43) makes
the whole dissolve disappear. Cause: `isOnEffectSide` measured the split line across the WHOLE frame
(`position*width`), but the subject only occupies part of the frame — so once the line clears the
subject's bounding edge, the effect-half no longer intersects the subject (cut-out shows just the sharp
subject). The "dead" slider range = wherever the subject isn't; the threshold = the subject's edge.
Fix: when `direction==='subject'` with a mask, anchor the split line to the SUBJECT's bounding box
(`anchorX = minX + pos*(maxX-minX)`, same for Y; bbox cached in a WeakMap per mask) so 0→1 always
sweeps the subject (0 = whole subject dissolved, 1 = none). Other directions keep `anchor = pos*frame`,
which is mathematically identical to `isOnEffectSide` → parity byte-identical (the "split" parity case
has no subject mask). Verified by sweeping cells 0.0→1.0: smooth full→none for every angle.

## base-ui `<Input>` ignores native `onChange` — text fields silently don't update state
Symptom: typing in the Characters field (and contact-sheet / preset-name / export / hex fields) updated
the field's DISPLAY but not the app — e.g. typing "prog" left the ASCII drawing the previous charset.
Cause: our `ui/input.tsx` wraps base-ui's `@base-ui/react/input` → `Field.Control`, which builds its OWN
`onChange` that fires **`onValueChange(value)`**, NOT the consumer's native `onChange`. Every call site
used `onChange={(e)=>f(e.target.value)}`, so typed text never reached React state; `params.asciiCharset`
stayed stuck (at the old "undefined") and the renderer kept using it. (Slider/Switch/Select already used
base-ui's `onValueChange`/`onCheckedChange` — text inputs were the lone holdout.) This was the REAL cause
behind the persistent "undefined"; `saneCharset` only masked a stale value. Fix: bridge it once in
`ui/input.tsx` — destructure `onChange` out and pass `onValueChange={(value)=>onChange?.({target:{value},
currentTarget:{value}} as ChangeEvent)}` so all existing call sites work unchanged. Verified with REAL
keystrokes (browser_type): typing now changes the canvas hash (dispatched DOM events took a different
path and hid the bug — always test inputs with real typing). Lesson: base-ui controlled inputs use
`onValueChange`, not `onChange`.

## The fix was right but "didn't work" — a stale Turbopack dev server was serving pre-fix code
Symptom: after the `saneCharset` guards + the `Input` bridge above, the user STILL saw "undefined" glyphs
(mixed with their typed "prog") even after reloading the browser. The instinct is "there's another code
bug" — there wasn't. Proof the on-disk code was already correct: `bunx tsc --noEmit` exits 0; the only
`saneCharset` is the one in `palettes.ts`; both charset reads (`render.ts`) + the `load` reducer go through
it; `ASCII_CHARSET` has **no lowercase letters**; and `render()` fully repaints every pixel via
`putImageData` each frame — so current code literally cannot draw the word "undefined". The real cause was
**environmental**: the dev server (`next-server`, Turbopack) had been running ~19h **across a machine
sleep** and silently **stopped recompiling** — its file watcher went stale. The dev log
(`.next/dev/logs/next-development.log`) showed the last `✓ Compiled` was the *previous evening* and **zero
compiles** the day of the bug, despite the source files having newer mtimes. Worse, earlier that session a
**duplicate-`saneCharset` compile error** in `params.ts` (`the name 'saneCharset' is defined multiple
times`, since fixed on disk) had **frozen the served bundle** at a pre-fix state — when a module fails to
compile, Turbopack keeps serving the last good bundle. So the browser kept running old code that loaded the
saved preset's persisted `asciiCharset:"undefined"` **raw** and rendered it; the typed "prog" appended to
the field's leftover "undefined" (cursor at end, no select-all) → a `"undefinedprog"` charset → one frame
drew **both** letter sets (exactly the mix in the screenshot). A browser reload can't fix server-side
staleness. Fix: kill the dev procs + `rm -rf .next` (drop every stale chunk generation) + restart →
fresh compile of current source. Verified with real keystrokes on the fresh server: with the field set to
the literal `"undefined"`, the canvas hash is **byte-identical** to the default-charset baseline (saneCharset
collapses it → the word can't render), and typing `"prog"` changes the hash (charset reaches the renderer).
Also hardened `loadUserPresets()` (`lib/presets.ts`) to run `saneCharset` over each stored preset's
`asciiCharset` and re-save once, so a dirty saved preset can't resurface the value.
**Lessons:** (1) when an on-disk fix "doesn't work," first confirm the dev server actually recompiled
(watch for a fresh `✓ Compiled`, check the dev log timestamps) before re-debugging the code — don't assume
HMR applied. (2) A long-lived dev server that survives a sleep can serve a bundle frozen behind an old
compile error; `rm -rf .next` + restart is the reset. (3) `tsc` exit 0 + parity pass while the browser
misbehaves is the tell-tale signature of stale-server, not a code bug.

## …and then it STILL showed "undefined" — exact-match guard vs a SUBSTRING ("undefinedprog")
After the stale server was fixed, the word still rendered. New evidence (reproduced in Playwright, real
typing): the persisted charset wasn't the string `"undefined"` — it was **`"undefinedprog"`**. Provenance:
during the stale-code window the field held `"undefined"`; the user clicked in and typed `prog` onto the
**end** (cursor at end, no select-all) → `"undefinedprog"`, which got saved into the "horse 1" preset.
`saneCharset` only rejected the **exact** strings `""`/`"undefined"`/`"null"`, so a value that merely
**contains** `undefined` as a substring passed straight through and the renderer drew its letters → the
word. The exact-match guard, the load reducer, and the preset migration all sailed past it. Fix: make
`saneCharset` **strip** the embedded tokens instead of exact-matching —
`c.replace(/undefined|null/g, "")`, falling back to `ASCII_CHARSET` if nothing remains. So
`"undefinedprog"` → `"prog"` (recovers the user's intent), `"undefined"` → default, and `ASCII_CHARSET`
(no lowercase) is untouched → renderer stays byte-identical (parity PASS). It's the single guard used by
the renderer, the `load` reducer, AND `loadUserPresets()`'s migration, so the bad value is stripped live,
on load, and permanently in storage. Verified **in one session** (controls for canvas-load drift):
`render("undefinedprog")` produced the **same canvas hash** as `render("prog")`, and reloading with a
seeded `"undefinedprog"` preset rewrote it to `"prog"`. **Lesson:** sanitize coercion artifacts as
**substrings**, not exact strings — a corrupted value usually gets *edited* (text typed onto it), not
replaced wholesale, so an `=== "undefined"` check is necessarily too narrow. Also: cross-session canvas
hashes aren't comparable (image-load/DPR state drifts) — always A/B within the same page session.

## THE ACTUAL ROOT CAUSE: scatterGlyph negative index → `ctx.fillText(undefined)` paints "undefined"
Everything above (saneCharset, the input bridge, the stale server, the migration) was chasing the wrong
thing. The word "undefined" on the canvas had **nothing to do with `asciiCharset`** — it appeared for ANY
charset, even `"ZZZZ"`. Root cause: the avalanche hash in `scatterGlyph` (render.ts, the default-on glyph
picker added for glyph variety) ends with `h ^= h >>> 16`. In JS, `^` returns a **signed int32**, so `h`
is negative ~half the time. Then `charset[h % charset.length]` is `charset[negative]`, and JS string
indexing with a negative index returns **`undefined`** (the value). That `undefined` flows to
`ctx.fillText(undefined)`, and the Canvas 2D API **coerces it to the string `"undefined"`** — so ~half the
cells literally paint the word. The legacy `asciiGlyph` never had this because it does `(… >>> 0) %
charset.length` (unsigned before the modulo); `scatterGlyph` dropped the final `>>> 0`. Fix (one char):
`return charset[(h >>> 0) % charset.length];`.
**Why it evaded every test for hours:** (1) the bug is **charset-independent and deterministic per (cx,cy)**,
so every canvas-hash A/B I ran cancelled it out — `render("undefined")`, `render("prog")` and
`render(default)` all carried the *same* "undefined" cells, so hashes matched and "proved" sanitizing that
wasn't the issue. (2) `scripts/parity.mjs` renders with scatter **OFF** (legacy path) → byte-identical and
green while the live (scatter-on) path was broken. (3) Small overlapping glyphs in screenshots read as
"undef" so I dismissed it as misperception. It only became unambiguous when rendering a **single-character
charset (`"ZZZZ"`) on a FLAT gray field** — every glyph must then be `Z`, so the rogue `undefined` strings
stood out — and then instrumenting `drawAsciiChar` to dump `char` (28 of 88 were the value `undefined`).
Regression test: `scripts/scatter-test.mjs` asserts `scatterGlyph` never returns `undefined` across 64k
positions × charset lengths 1–40. **Lessons:** `(signedHash) % n` can be negative in JS — always `>>> 0`
before indexing. `fillText(undefined)` (and template literals) silently stringify `undefined` into visible
text, so one bad index becomes a word on screen. Test glyph-selection logic with a single-glyph charset on a
flat field where the correct output is trivially verifiable — hashes and busy photos hide deterministic,
content-independent bugs.

## ASCII rendered the literal word "undefined" (charset = the string "undefined")
Symptom: ASCII cells spelled "undefined". NOT a `charset[NaN]` bug — the in-pixel path is guarded
(`p.asciiCharset || ASCII_CHARSET`) and the guard has existed since the first commit, so `charset` is
never empty. Real cause: `params.asciiCharset` was the **string** `"undefined"` (9 letters u,n,d,e,f,i,
n,e,d), which render as glyphs that read as the word. Provenance: `CharsetRow` bound
`value={params.asciiCharset}` with no `?? ""`; when the param was momentarily the *value* `undefined`
(an older preset loaded before the merge-defaults `load`), base-ui's Input surfaced the literal text
"undefined", which then persisted (and got saved into the preset). Fixes: (a) `value={params.asciiCharset
?? ""}`; (b) sanitize on `load` — `saneCharset()` resets `""`/`"undefined"`/`"null"`/non-string →
ASCII_CHARSET, cleaning already-saved bad presets. Confirmed with a `charset="X"` render (all X, zero
"undefined" → glyphs are 100% charset-driven). Lesson: never bind a controlled input to a possibly-
undefined value without `?? ""`; base-ui surfaces it as the text "undefined".

## Adaptive "Processing" fill — full pixel coverage without gaps
Dark/flat image regions sampled to the near-black palette stop and blended into the background → the
dissolve looked full of gaps. Fix (`lib/process.ts`): adaptive local-contrast normalization —
summed-area table (integral image) for an O(1)/px local mean, then `v = clamp01(0.5 + (lum−mean)/255 ·
contrast + bias)` lerped toward a hard threshold by `hardness`. Lifts each region's LOCAL detail to
full range so every cell is vivid (measured: near-black subject fraction 15.5% → 0.1%). Wired into
`render.ts` as a whole-image pre-pass feeding the base layer + cell sampling; bypasses `brightnessCutoff`
and dilates the effect mask by ~1 cell (`cellCovered`) for edge fill (cut-out trims overflow). Caches:
integral image per `src.data` (WeakMap) + processed buffer per process-params key → recompute only when
a Processing slider moves. `process:"off"` default → parity byte-identical.

## Cut-out / solid background was "insanely slow" (per-frame getImageData)
Symptom: with Background = Cut out / Solid, dragging any control stalls (others stay snappy). Measured
(Playwright, 928×1152): photo render ≈ 6 ms, cut-out render ≈ **854 ms** — and a single
`ctx.getImageData(0,0,w,h)` was **853 ms** of it. Cause: the background clip read the whole *live,
GPU-backed* main canvas back to CPU every frame; that readback is catastrophically slow (GPU→CPU
flush). `willReadFrequently` would fix the readback but forces the WHOLE canvas onto the CPU,
penalising the common photo path + every-frame GPU upload. Real fix: **don't read back** — composite.
Build the mask once as a drawable canvas (subject opaque / bg transparent, cached in a `WeakMap` keyed
by the mask `Uint8Array`), then `globalCompositeOperation='destination-in'; drawImage(maskCanvas)` to
cut out, and `'destination-over'` + a solid `fillRect` for the solid field. Result: 854 ms → **~2 ms**
(≈400×), canvas stays GPU-resident in all modes. Lesson: never `getImageData` a displayed canvas
per-frame; clip via composite ops or `clip()`, not readback.

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
