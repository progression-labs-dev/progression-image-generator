"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid2x2, Loader2 } from "lucide-react";
import { SWEEPS } from "@/lib/contactSheet";

export interface SheetConfig {
  param: string;
  valuesText: string;
  cols: number;
  title: string;
}

export function ContactSheetDialog({
  onBuild,
  busy,
  disabled,
}: {
  onBuild: (cfg: SheetConfig) => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [param, setParam] = useState("cellSize");
  const [valuesText, setValuesText] = useState(SWEEPS.cellSize.def);
  const [cols, setCols] = useState(3);
  const [title, setTitle] = useState("cellSize sweep · Pixel Dissolve");

  const changeParam = (p: string | null) => {
    if (!p) return;
    setParam(p);
    setValuesText(SWEEPS[p]?.def ?? "");
    setTitle(`${p} sweep · Pixel Dissolve`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Grid2x2 className="size-3.5" /> Contact sheet…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Contact sheet — sweep a parameter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sweep parameter</Label>
              <Select value={param} onValueChange={changeParam}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue>{(v) => v ?? "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(SWEEPS).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Values (comma-separated{SWEEPS[param]?.kind === "palette" ? " palette names" : ""})
              </Label>
              <Input
                value={valuesText}
                onChange={(e) => setValuesText(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex gap-3">
              <div className="w-20 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Renders one tile per value, holding all other controls fixed (uses the current photo +
              mask).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={busy}
              onClick={() => {
                onBuild({ param, valuesText, cols, title });
                setOpen(false);
              }}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Grid2x2 className="size-3.5" />}
              Build sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
