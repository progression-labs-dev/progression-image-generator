// Regression test for the scatterGlyph negative-index bug: `h ^= h >>> 16` yields a
// SIGNED int32, so without `(h >>> 0)` ~half the positions returned charset[negative]
// === undefined → ctx.fillText(undefined) painted the literal word "undefined".
// This asserts scatterGlyph ALWAYS returns a real single character — never undefined —
// for every position and charset length.  Run: cd web && bun scripts/scatter-test.mjs
import { scatterGlyph } from "../lib/render.ts";

let checks = 0, bad = 0;
const firstFails = [];
for (let len = 1; len <= 40; len++) {
  const charset = "X".repeat(len); // every index must map to "X"
  for (let cx = 0; cx < 400; cx++) {
    for (let cy = 0; cy < 4; cy++) {
      const g = scatterGlyph(charset, cx * 7 + 1, cy * 13 + 1);
      checks++;
      if (g === undefined || typeof g !== "string" || g.length !== 1) {
        bad++;
        if (firstFails.length < 5) firstFails.push({ len, cx, cy, got: g });
      }
    }
  }
}
console.log(`scatterGlyph checks: ${checks}, undefined/invalid: ${bad}`);
if (bad > 0) {
  console.error("FAIL — scatterGlyph returned undefined/invalid glyphs:", firstFails);
  process.exit(1);
}
console.log("PASS — scatterGlyph never returns undefined (negative-index bug fixed)");
