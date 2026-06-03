import { LabShell } from "./LabShell";

// Server segment — the heavy, browser-only lab is loaded client-side via LabShell
// (canvas, OffscreenCanvas, and @imgly/background-removal are all browser-only).
export default function LabPage() {
  return <LabShell />;
}
