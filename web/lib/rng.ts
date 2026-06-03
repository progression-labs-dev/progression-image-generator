// Seeded PRNG (mulberry32) — replaces Math.random in the watercolor-blob and
// film-grain passes so a given `seed` reproduces an identical render. The deck
// renderer (process-deck-image.js) used unseeded Math.random; this is the one
// intentional addition over the verbatim port.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
