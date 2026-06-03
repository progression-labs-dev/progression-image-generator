"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import {
  PixelationSection,
  RegionSection,
  ColourSection,
  AsciiSection,
  TextureSection,
} from "./sections";

const OPEN = ["source", "pixelation", "region", "colour", "ascii", "texture", "export"];

// `header` and `footer` slots let MosaicLab inject the preset bar (P9) and the
// source/mask + export sections (P5/P7) without this component owning them.
export function ControlsRail({
  header,
  source,
  exportSection,
}: {
  header?: ReactNode;
  source?: ReactNode;
  exportSection?: ReactNode;
}) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-sm font-semibold leading-none">PL Imagery Lab</h1>
          <span className="text-[10px] text-muted-foreground">Pixel Dissolve</span>
        </div>
        {header && <div className="mt-2.5">{header}</div>}
      </div>
      <ScrollArea className="flex-1">
        <Accordion defaultValue={OPEN}>
          {source}
          <PixelationSection />
          <RegionSection />
          <ColourSection />
          <AsciiSection />
          <TextureSection />
          {exportSection}
        </Accordion>
      </ScrollArea>
    </aside>
  );
}
