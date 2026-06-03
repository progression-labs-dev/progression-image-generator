"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { BRAND_SWATCHES, type RGB, type Interp } from "@/lib/palettes";
import { useLab } from "./lab-context";
import { rgbToHex, ColorEditor } from "./ColorSwatchPopover";

// Multi-stop gradient editor — these stops ARE the pixel colours (dark → light).
// Consumed verbatim by multiStopGradientColor / multiStopGradientColorRGB.
export function GradientEditor() {
  const { params, patch } = useLab();
  const pal = params.palette;
  const setStops = (stops: RGB[]) => patch({ palette: { interp: pal.interp, stops } });
  const setInterp = (interp: Interp) => patch({ palette: { interp, stops: pal.stops } });

  const updateStop = (i: number, rgb: RGB) =>
    setStops(pal.stops.map((s, j) => (j === i ? rgb : ([...s] as RGB))));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pal.stops.length) return;
    const stops = pal.stops.map((s) => [...s] as RGB);
    [stops[i], stops[j]] = [stops[j], stops[i]];
    setStops(stops);
  };
  const remove = (i: number) => {
    if (pal.stops.length <= 2) return;
    setStops(pal.stops.filter((_, j) => j !== i).map((s) => [...s] as RGB));
  };
  const addStop = (rgb: RGB) => setStops([...pal.stops.map((s) => [...s] as RGB), rgb]);

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-medium text-muted-foreground">
          Pixel colours (dark → light)
        </Label>
        <ToggleGroup
          size="sm"
          variant="outline"
          value={[pal.interp]}
          onValueChange={(vals: string[]) => {
            const nv = vals[0];
            if (nv === "hsl" || nv === "rgb") setInterp(nv);
          }}
        >
          <ToggleGroupItem value="hsl" className="h-6 px-2 text-[10px]">
            HSL
          </ToggleGroupItem>
          <ToggleGroupItem value="rgb" className="h-6 px-2 text-[10px]">
            RGB
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1">
        {pal.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-4 text-center text-[10px] text-muted-foreground">{i + 1}</span>
            <Popover>
              <PopoverTrigger className="flex h-7 flex-1 items-center gap-2 rounded border border-border px-1.5 text-[11px] hover:bg-accent">
                <span
                  className="size-4 rounded-[3px] ring-1 ring-inset ring-white/20"
                  style={{ backgroundColor: rgbToHex(stop) }}
                />
                <span className="font-mono text-muted-foreground">{rgbToHex(stop)}</span>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <ColorEditor rgb={stop} onChange={(v) => updateStop(i, v)} />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="move stop up"
            >
              <ArrowUp className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => move(i, 1)}
              disabled={i === pal.stops.length - 1}
              aria-label="move stop down"
            >
              <ArrowDown className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
              disabled={pal.stops.length <= 2}
              aria-label="remove stop"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Add a stop</Label>
        <div className="flex flex-wrap gap-1">
          {BRAND_SWATCHES.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => addStop([...s.rgb] as RGB)}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-[10px] hover:bg-accent"
              title={`Add ${s.name} ${rgbToHex(s.rgb)}`}
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

      <p className="text-[10px] leading-snug text-muted-foreground">
        HSL stays in one hue family · RGB lerps straight (use for blue → cream → orange).
      </p>
    </div>
  );
}
