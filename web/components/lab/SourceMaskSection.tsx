"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, Scissors, Loader2 } from "lucide-react";
import { maskToPreview } from "@/lib/bgRemoval";
import type { Direction, RenderParams } from "@/lib/render";

export interface SourceMaskProps {
  onPickImage: (file: File) => void;
  onPickMask: (file: File) => void;
  onRemoveBackground: () => void;
  busy: boolean;
  progress: string | null;
  hasSource: boolean;
  fileName: string;
  mask: Uint8Array | null;
  srcW: number;
  srcH: number;
  direction: Direction;
  backgroundMode: RenderParams["backgroundMode"];
  maskVisible: boolean;
  onToggleMaskVisible: (v: boolean) => void;
}

export function SourceMaskSection(props: SourceMaskProps) {
  const {
    onPickImage,
    onPickMask,
    onRemoveBackground,
    busy,
    progress,
    hasSource,
    fileName,
    mask,
    srcW,
    srcH,
    direction,
    backgroundMode,
    maskVisible,
    onToggleMaskVisible,
  } = props;
  const [dragOver, setDragOver] = useState(false);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const dirNeedsMask = direction === "subject" || direction === "surroundings";
  const bgNeedsMask = backgroundMode === "transparent" || backgroundMode === "solid";
  const needsMask = dirNeedsMask || bgNeedsMask;

  // draw the mask thumbnail
  useEffect(() => {
    const c = thumbRef.current;
    if (!c || !mask || !srcW || !srcH) return;
    const tw = 96;
    const th = Math.max(1, Math.round((srcH / srcW) * tw));
    // downsample mask into the thumbnail
    const full = document.createElement("canvas");
    full.width = srcW;
    full.height = srcH;
    const fctx = full.getContext("2d");
    if (!fctx) return;
    const id = fctx.createImageData(srcW, srcH);
    id.data.set(maskToPreview(mask, srcW, srcH, [120, 180, 255]));
    fctx.putImageData(id, 0, 0);
    c.width = tw;
    c.height = th;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(full, 0, 0, tw, th);
  }, [mask, srcW, srcH]);

  return (
    <AccordionItem value="source" className="border-border">
      <AccordionTrigger className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:no-underline">
        Source &amp; Mask
      </AccordionTrigger>
      <AccordionContent className="space-y-3 px-4 pb-4 pt-1">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onPickImage(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-5 text-center text-xs transition-colors ${
            dragOver ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
              e.target.value = "";
            }}
          />
          <Upload className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {hasSource ? "Drop / click to replace" : "Drop a photo or click to upload"}
          </span>
          {fileName && (
            <Badge variant="secondary" className="mt-1 max-w-full truncate text-[10px]">
              {fileName}
            </Badge>
          )}
        </label>

        <Button
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          disabled={!hasSource || busy}
          onClick={onRemoveBackground}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Scissors className="size-3.5" />}
          {busy ? (progress ?? "Removing background…") : "Remove background"}
        </Button>

        {busy && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            First run downloads the model (~80&nbsp;MB), then runs locally. Subsequent runs are cached.
          </p>
        )}

        {mask && (
          <div className="flex items-center gap-3 rounded-md border border-border p-2">
            <canvas ref={thumbRef} className="rounded ring-1 ring-inset ring-white/10" />
            <div className="flex-1 space-y-2">
              <p className="text-[11px] text-muted-foreground">Subject mask ready.</p>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px] text-muted-foreground">Show mask</Label>
                <Switch checked={maskVisible} onCheckedChange={onToggleMaskVisible} />
              </div>
            </div>
          </div>
        )}

        {needsMask && !mask && hasSource && (
          <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-400">
            {dirNeedsMask ? (
              <>“{direction}” needs a subject mask</>
            ) : (
              <>“Cut out” / “Solid” background needs a subject mask</>
            )}{" "}
            — click <b>Remove background</b>, or upload a B&amp;W mask below.
          </p>
        )}

        <label className="block cursor-pointer text-center text-[10px] text-muted-foreground underline-offset-2 hover:underline">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickMask(f);
              e.target.value = "";
            }}
          />
          or upload a B&amp;W mask PNG
        </label>
      </AccordionContent>
    </AccordionItem>
  );
}
