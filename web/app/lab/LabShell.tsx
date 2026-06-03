"use client";

import dynamic from "next/dynamic";

// next/dynamic with ssr:false must live in a Client Component (Next 16).
// This keeps the canvas / WASM tool out of the server render entirely.
const MosaicLab = dynamic(
  () => import("./MosaicLab").then((m) => m.MosaicLab),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-[#0b0b12] text-sm text-zinc-400">
        Loading PL Imagery Lab…
      </div>
    ),
  },
);

export function LabShell() {
  return <MosaicLab />;
}
