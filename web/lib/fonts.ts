// Ensure the literal "Inter" family (self-hosted via @fontsource/inter) is parsed
// before any canvas fillText — otherwise the browser silently falls back to
// system-ui with different glyph metrics, and the first frame renders wrong.
let readyPromise: Promise<void> | null = null;

export function ensureFontsReady(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    try {
      await Promise.all([
        document.fonts.load("500 16px Inter"),
        document.fonts.load("600 26px Inter"),
        document.fonts.load("700 16px Inter"),
      ]);
      await document.fonts.ready;
    } catch {
      /* best-effort — fall back to system-ui if Inter fails to load */
    }
  })();
  return readyPromise;
}
