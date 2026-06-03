"use client";

import { useState, type ReactNode } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";

export function ExportSection({
  onExportPng,
  busy,
  dims,
  hasSource,
  extra,
}: {
  onExportPng: (fileName: string) => void;
  busy: boolean;
  dims: string;
  hasSource: boolean;
  extra?: ReactNode;
}) {
  const [name, setName] = useState("pl-imagery");
  return (
    <AccordionItem value="export" className="border-border">
      <AccordionTrigger className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:no-underline">
        Export
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-4 pt-1">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">File name</Label>
          <div className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              placeholder="pl-imagery"
            />
            <span className="text-xs text-muted-foreground">.png</span>
          </div>
        </div>
        <Button
          size="sm"
          className="w-full text-xs"
          disabled={!hasSource || busy}
          onClick={() => onExportPng(`${name || "pl-imagery"}.png`)}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Export PNG
        </Button>
        <p className="text-[10px] text-muted-foreground">Full resolution · {dims || "—"} (≤2048px)</p>
        {extra}
      </AccordionContent>
    </AccordionItem>
  );
}
