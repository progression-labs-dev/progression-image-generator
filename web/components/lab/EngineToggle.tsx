"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Engine } from "@/lib/render";
import { useLab } from "./lab-context";

export function EngineToggle() {
  const { params, setEngine } = useLab();
  return (
    <ToggleGroup
      size="sm"
      variant="outline"
      value={[params.engine]}
      onValueChange={(vals: string[]) => {
        const v = vals[0];
        if (v === "mosaic" || v === "deck") setEngine(v as Engine);
      }}
    >
      <ToggleGroupItem value="mosaic" className="px-3 text-[11px]">
        Mosaic
      </ToggleGroupItem>
      <ToggleGroupItem value="deck" className="px-3 text-[11px]">
        ASCII-Gradient
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
