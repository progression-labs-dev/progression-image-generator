"use client";

import type { ReactNode, RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { EngineToggle } from "./EngineToggle";

export function Stage({
  canvasRef,
  status,
  toolbarRight,
  overlay,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status?: ReactNode;
  toolbarRight?: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#0b0b12]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <EngineToggle />
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant="outline" className="h-6 border-white/15 font-mono text-[10px] text-zinc-400">
              {status}
            </Badge>
          )}
          {toolbarRight}
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full rounded-md object-contain shadow-2xl shadow-black/60 ring-1 ring-white/10"
        />
        {overlay}
      </div>
    </main>
  );
}
