"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLab } from "./lab-context";
import {
  BUILTIN_PRESETS,
  loadUserPresets,
  saveUserPreset,
  deleteUserPreset,
  type Preset,
} from "@/lib/presets";
import type { RenderParams } from "@/lib/render";

export function PresetBar() {
  const { params, load } = useLab();
  const [user, setUser] = useState<Preset[]>(() => loadUserPresets());
  const [selected, setSelected] = useState<string>("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const all = [...BUILTIN_PRESETS, ...user];
  const selectedPreset = all.find((p) => p.id === selected);

  const apply = (id: string | null) => {
    if (!id) return;
    setSelected(id);
    const p = all.find((x) => x.id === id);
    if (p) load(JSON.parse(JSON.stringify(p.params)) as RenderParams);
  };

  const doSave = () => {
    const preset = saveUserPreset(name, params);
    setUser(loadUserPresets());
    setSelected(preset.id);
    setSaveOpen(false);
    setName("");
    toast.success(`Saved “${preset.name}”`);
  };

  const doDelete = () => {
    if (!selectedPreset || selectedPreset.builtIn) return;
    deleteUserPreset(selectedPreset.id);
    setUser(loadUserPresets());
    setSelected("");
    toast.success("Preset deleted");
  };

  return (
    <div className="flex items-center gap-1">
      <Select value={selected} onValueChange={apply}>
        <SelectTrigger className="h-8 flex-1 text-xs">
          <SelectValue placeholder="Load preset…">
            {(v) => all.find((p) => p.id === v)?.name ?? "Load preset…"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-[10px] uppercase tracking-wide">Brand</SelectLabel>
            {BUILTIN_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectGroup>
          {user.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide">Yours</SelectLabel>
              {user.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {selectedPreset && !selectedPreset.builtIn && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={doDelete} aria-label="delete preset">
          <Trash2 className="size-3.5" />
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => {
          setName("");
          setSaveOpen(true);
        }}
        aria-label="save preset"
      >
        <Save className="size-3.5" />
      </Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Save preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSave();
              }}
              placeholder="My look"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Saves all current controls (engine {params.engine}). Photo &amp; mask aren’t stored.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs" onClick={doSave}>
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
