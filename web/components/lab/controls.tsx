"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import type { RenderParams } from "@/lib/render";
import { useLab, type BoolKey, type NumKey } from "./lab-context";

function HintIcon({ hint }: { hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="cursor-help text-muted-foreground/60" />}
      >
        <Info className="size-3" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[230px] text-xs leading-relaxed">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function Row({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint?: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {label}
          {hint && <HintIcon hint={hint} />}
        </Label>
        {value !== undefined && (
          <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px] tabular-nums">
            {value}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

export function SliderRow({
  k,
  label,
  hint,
  min,
  max,
  step = 1,
  fmt,
}: {
  k: NumKey;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
}) {
  const { params, set, setDragging } = useLab();
  const v = params[k] as number;
  return (
    <Row label={label} hint={hint} value={fmt ? fmt(v) : v}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[v]}
        onValueChange={(vals) => {
          const nv = Array.isArray(vals) ? vals[0] : (vals as number);
          set(k, nv as RenderParams[NumKey]);
        }}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
      />
    </Row>
  );
}

export function SwitchRow({
  k,
  label,
  hint,
}: {
  k: BoolKey;
  label: string;
  hint?: string;
}) {
  const { params, set } = useLab();
  const v = params[k] as boolean;
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <Label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {hint && <HintIcon hint={hint} />}
      </Label>
      <Switch checked={v} onCheckedChange={(c) => set(k, c as RenderParams[BoolKey])} />
    </div>
  );
}

export function SelectRow<K extends keyof RenderParams>({
  k,
  label,
  hint,
  options,
}: {
  k: K;
  label: string;
  hint?: string;
  options: { value: RenderParams[K]; label: string }[];
}) {
  const { params, set } = useLab();
  const v = params[k];
  return (
    <Row label={label} hint={hint}>
      <Select
        value={String(v)}
        onValueChange={(nv) => {
          const m = nv != null && options.find((o) => String(o.value) === nv);
          if (m) set(k, m.value);
        }}
      >
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue>
            {(val) => options.find((o) => String(o.value) === val)?.label ?? String(val ?? "")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

export function ToggleRow<K extends keyof RenderParams>({
  k,
  label,
  hint,
  options,
}: {
  k: K;
  label: string;
  hint?: string;
  options: { value: RenderParams[K]; label: string }[];
}) {
  const { params, set } = useLab();
  const v = params[k];
  return (
    <Row label={label} hint={hint}>
      <ToggleGroup
        size="sm"
        variant="outline"
        value={[String(v)]}
        onValueChange={(vals: string[]) => {
          const nv = vals[0];
          if (nv != null) {
            const match = options.find((o) => String(o.value) === nv);
            if (match) set(k, match.value);
          }
        }}
        className="w-full"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={String(o.value)}
            value={String(o.value)}
            className="flex-1 text-[11px]"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Row>
  );
}
