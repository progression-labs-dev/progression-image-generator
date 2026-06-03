// Verifies the seeded PRNG (mulberry32) makes the deck watercolor-blob pass
// reproducible: same seed → byte-identical, different seed → differs.
// (Grain uses the same rng mechanism; it needs OffscreenCanvas so is verified
// in-browser, not here — we disable it for this Node check.)
import { createCanvas } from "@napi-rs/canvas";
import { loadBuffer, loadMask } from "../../mosaic-core.mjs";
import { render } from "../lib/render.ts";
import { defaultParams } from "../lib/params.ts";

const ROOT = "/Users/joe/code/pl-imagery-lab";
const buf = await loadBuffer(`${ROOT}/inputs/portrait.png`);
const mask = await loadMask(`${ROOT}/masks/portrait.png`, buf.width, buf.height);

function renderData(seed) {
  const p = defaultParams("deck", { seed, grainOpacity: 0, watercolorBlobs: true });
  const c = createCanvas(buf.width, buf.height);
  render(c.getContext("2d"), buf, mask, p);
  return c.getContext("2d").getImageData(0, 0, buf.width, buf.height).data;
}

const a = renderData(7);
const b = renderData(7);
const c = renderData(99);
let ab = 0,
  ac = 0;
for (let i = 0; i < a.length; i++) {
  if (a[i] !== b[i]) ab++;
  if (a[i] !== c[i]) ac++;
}
console.log(`seed 7 vs 7  → diff bytes ${ab} (expect 0)`);
console.log(`seed 7 vs 99 → diff bytes ${ac} (expect > 0)`);
const ok = ab === 0 && ac > 0;
console.log(ok ? "PASS — seed is deterministic and meaningful" : "FAIL");
process.exit(ok ? 0 : 1);
