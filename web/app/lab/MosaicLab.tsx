"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { useMosaicRenderer } from "@/hooks/useMosaicRenderer";
import { defaultParams, paramsReducer } from "@/lib/params";
import { toImageData, toMask } from "@/lib/image";
import { isolateSubjectMask, maskToPreview } from "@/lib/bgRemoval";
import { exportPng, downloadBlob } from "@/lib/exportPng";
import { buildContactSheet } from "@/lib/contactSheet";
import type { Engine, RenderParams } from "@/lib/render";
import { LabContext, type LabApi } from "@/components/lab/lab-context";
import { ControlsRail } from "@/components/lab/ControlsRail";
import { Stage } from "@/components/lab/Stage";
import { SourceMaskSection } from "@/components/lab/SourceMaskSection";
import { ExportSection } from "@/components/lab/ExportSection";
import { ContactSheetDialog, type SheetConfig } from "@/components/lab/ContactSheetDialog";
import { PresetBar } from "@/components/lab/PresetBar";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function MaskOverlay({ mask, w, h }: { mask: Uint8Array; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !mask || !w || !h) return;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const id = ctx.createImageData(w, h);
    // green where subject, transparent elsewhere
    const d = id.data;
    const px = maskToPreview(mask, w, h, [80, 220, 140]);
    for (let i = 0; i < mask.length; i++) {
      d[i * 4] = px[i * 4];
      d[i * 4 + 1] = px[i * 4 + 1];
      d[i * 4 + 2] = px[i * 4 + 2];
      d[i * 4 + 3] = mask[i] === 1 ? 130 : 0;
    }
    ctx.putImageData(id, 0, 0);
  }, [mask, w, h]);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <canvas ref={ref} className="max-h-full max-w-full rounded-md object-contain" />
    </div>
  );
}

export function MosaicLab() {
  const { canvasRef, srcRef, maskRef, paramsRef, setParams, setSource, setMask, setDragging } =
    useMosaicRenderer();
  const [params, dispatch] = useReducer(paramsReducer, undefined, () => defaultParams("mosaic"));

  const [status, setStatus] = useState("loading sample…");
  const [fileName, setFileName] = useState("portrait.png · sample");
  const [hasSource, setHasSource] = useState(false);
  const [maskData, setMaskData] = useState<Uint8Array | null>(null);
  const [srcDims, setSrcDims] = useState({ w: 0, h: 0 });
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState<string | null>(null);
  const [maskVisible, setMaskVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const sourceForBg = useRef<Blob | string | null>(null);

  useEffect(() => {
    setParams(params);
  }, [params, setParams]);

  const loadSource = useCallback(
    async (input: Blob | string, name: string, sampleMask = false) => {
      try {
        // Always keep a Blob for bg-removal — passing a relative URL makes
        // @imgly resolve it against its own model CDN (staticimgly.com → 404).
        const blob = typeof input === "string" ? await (await fetch(input)).blob() : input;
        const src = await toImageData(blob);
        setSource(src);
        setSrcDims({ w: src.width, h: src.height });
        sourceForBg.current = blob;
        setHasSource(true);
        setFileName(name);
        setStatus(`${src.width}×${src.height}`);
        if (sampleMask) {
          const m = await toMask("/samples/portrait-mask.png", src.width, src.height, 128, "red");
          setMask(m);
          setMaskData(m);
        } else {
          setMask(null);
          setMaskData(null);
          setMaskVisible(false);
        }
      } catch (e) {
        setStatus(`load failed: ${(e as Error).message}`);
      }
    },
    [setSource, setMask],
  );

  // initial sample
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadSource("/samples/portrait.png", "portrait.png · sample", true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSource]);

  const onPickImage = useCallback(
    (file: File) => {
      void loadSource(file, file.name, false);
    },
    [loadSource],
  );
  const onPickMask = useCallback(
    async (file: File) => {
      if (!srcDims.w) return;
      const m = await toMask(file, srcDims.w, srcDims.h, params.maskThreshold, "red");
      setMask(m);
      setMaskData(m);
      toast.success("Mask loaded");
    },
    [srcDims, params.maskThreshold, setMask],
  );
  const onRemoveBackground = useCallback(async () => {
    const input = sourceForBg.current;
    if (!input || !srcDims.w) return;
    setBgBusy(true);
    setBgProgress("loading model…");
    const id = toast.loading("Removing background…");
    try {
      const m = await isolateSubjectMask(
        input,
        srcDims.w,
        srcDims.h,
        params.maskThreshold,
        (stage, cur, total) =>
          setBgProgress(total ? `${stage} ${Math.round((cur / total) * 100)}%` : stage),
      );
      setMask(m);
      setMaskData(m);
      toast.success("Subject isolated", { id });
    } catch (e) {
      toast.error(`Background removal failed: ${(e as Error).message}`, { id });
    } finally {
      setBgBusy(false);
      setBgProgress(null);
    }
  }, [srcDims, params.maskThreshold, setMask]);

  const set = useCallback(
    <K extends keyof RenderParams>(key: K, value: RenderParams[K]) =>
      dispatch({ type: "set", key, value }),
    [],
  );
  const patch = useCallback((p: Partial<RenderParams>) => dispatch({ type: "patch", patch: p }), []);
  const setEngine = useCallback((engine: Engine) => dispatch({ type: "setEngine", engine }), []);
  const load = useCallback((p: RenderParams) => dispatch({ type: "load", params: p }), []);

  const onExportPng = useCallback(async (fname: string) => {
    const src = srcRef.current;
    if (!src) return;
    setExporting(true);
    try {
      const { width, height } = await exportPng(src, maskRef.current, paramsRef.current!, fname);
      toast.success(`Exported ${width}×${height} PNG`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBuildSheet = useCallback(async (cfg: SheetConfig) => {
    const src = srcRef.current;
    if (!src) return;
    setSheetBusy(true);
    const id = toast.loading("Building contact sheet…");
    try {
      const { blob, tiles, w, h } = await buildContactSheet({
        src,
        mask: maskRef.current,
        base: paramsRef.current!,
        ...cfg,
      });
      downloadBlob(blob, `contact-${cfg.param}.png`);
      toast.success(`Contact sheet · ${tiles} tiles · ${w}×${h}`, { id });
    } catch (e) {
      toast.error(`Contact sheet failed: ${(e as Error).message}`, { id });
    } finally {
      setSheetBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo<LabApi>(
    () => ({ params, set, patch, setEngine, setDragging, load }),
    [params, set, patch, setEngine, setDragging, load],
  );

  const sourceSection = (
    <SourceMaskSection
      onPickImage={onPickImage}
      onPickMask={onPickMask}
      onRemoveBackground={onRemoveBackground}
      busy={bgBusy}
      progress={bgProgress}
      hasSource={hasSource}
      fileName={fileName}
      mask={maskData}
      srcW={srcDims.w}
      srcH={srcDims.h}
      direction={params.direction}
      backgroundMode={params.backgroundMode}
      maskVisible={maskVisible}
      onToggleMaskVisible={setMaskVisible}
    />
  );

  const exportSection = (
    <ExportSection
      onExportPng={onExportPng}
      busy={exporting}
      dims={status.includes("×") ? status : ""}
      hasSource={hasSource}
      extra={<ContactSheetDialog onBuild={onBuildSheet} busy={sheetBusy} disabled={!hasSource} />}
    />
  );

  return (
    <LabContext.Provider value={api}>
      <div className="flex h-dvh w-full overflow-hidden">
        <ControlsRail header={<PresetBar />} source={sourceSection} exportSection={exportSection} />
        <Stage
          canvasRef={canvasRef}
          status={status}
          toolbarRight={
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={!hasSource || exporting}
              onClick={() => onExportPng("pl-imagery.png")}
            >
              <Download className="size-3.5" /> Export
            </Button>
          }
          overlay={
            maskVisible && maskData ? (
              <MaskOverlay mask={maskData} w={srcDims.w} h={srcDims.h} />
            ) : null
          }
        />
      </div>
    </LabContext.Provider>
  );
}
