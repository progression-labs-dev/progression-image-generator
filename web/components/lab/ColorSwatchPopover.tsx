"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BRAND_SWATCHES, type RGB } from "@/lib/palettes";
import type { RenderParams } from "@/lib/render";
import { useLab, type RgbKey } from "./lab-context";

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
export function hexToRgb(hex: string): RGB {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16) || 0,
    parseInt(m.slice(2, 4), 16) || 0,
    parseInt(m.slice(4, 6), 16) || 0,
  ];
}

/** Text field that commits on a valid 6-digit hex, but lets you type freely. */
export function HexInput({ rgb, onChange }: { rgb: RGB; onChange: (rgb: RGB) => void }) {
  const [text, setText] = useState(rgbToHex(rgb));
  useEffect(() => setText(rgbToHex(rgb)), [rgb]);
  return (
    <Input
      value={text}
      spellCheck={false}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        const m = v.trim().replace(/^#/, "");
        if (/^[0-9a-fA-F]{6}$/.test(m)) onChange(hexToRgb(`#${m}`));
      }}
      onBlur={() => setText(rgbToHex(rgb))}
      placeholder="#0000ff"
      className="h-7 w-[5.5rem] px-1 text-center font-mono text-[11px] tabular-nums"
    />
  );
}

/** Full RGB editor body — colour input + hex + R/G/B + brand swatches. Reused everywhere. */
export function ColorEditor({
  rgb,
  onChange,
  swatches = BRAND_SWATCHES,
}: {
  rgb: RGB;
  onChange: (rgb: RGB) => void;
  swatches?: { name: string; rgb: RGB }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={rgbToHex(rgb)}
          onChange={(e) => onChange(hexToRgb(e.target.value))}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
          aria-label="colour picker"
        />
        <HexInput rgb={rgb} onChange={onChange} />
        <div className="grid flex-1 grid-cols-3 gap-1">
          {(["R", "G", "B"] as const).map((ch, i) => (
            <Input
              key={ch}
              type="number"
              min={0}
              max={255}
              value={rgb[i]}
              onChange={(e) => {
                const next = [...rgb] as RGB;
                next[i] = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                onChange(next);
              }}
              className="h-7 px-1 text-center text-xs tabular-nums"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {swatches.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onChange([...s.rgb] as RGB)}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
            title={`${s.name} ${rgbToHex(s.rgb)}`}
          >
            <span
              className="size-2.5 rounded-[2px] ring-1 ring-inset ring-white/20"
              style={{ backgroundColor: rgbToHex(s.rgb) }}
            />
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A reusable single-colour picker bound to an RGB param (solidColor, asciiInkCustom). */
export function ColorRow({
  k,
  label,
  hint,
  swatches,
}: {
  k: RgbKey;
  label: string;
  hint?: string;
  swatches?: { name: string; rgb: RGB }[];
}) {
  const { params, set } = useLab();
  const rgb = params[k] as RGB;
  const setRgb = (v: RGB) => set(k, v as RenderParams[RgbKey]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <span className="font-mono text-[10px] text-muted-foreground">{rgbToHex(rgb)}</span>
      </div>
      <Popover>
        <PopoverTrigger className="flex h-8 w-full items-center gap-2 rounded-md border border-border px-2 text-xs hover:bg-accent">
          <span
            className="size-5 shrink-0 rounded-sm ring-1 ring-inset ring-white/20"
            style={{ backgroundColor: rgbToHex(rgb) }}
          />
          <span className="font-mono text-muted-foreground">{rgbToHex(rgb)}</span>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2" align="end">
          <ColorEditor rgb={rgb} onChange={setRgb} swatches={swatches} />
          {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// kept for any callers expecting the old name
export { ColorEditor as ColorSwatchPopover };
