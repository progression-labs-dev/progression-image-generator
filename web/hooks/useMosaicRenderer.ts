"use client";

import { useCallback, useEffect, useRef } from "react";
import { render, type RenderParams, type Src } from "@/lib/render";
import { ensureFontsReady } from "@/lib/fonts";

// Decouples imperative canvas drawing from React state.
// - Big buffers (source ImageData, mask) live in refs → never trigger reconciliation.
// - rAF coalescing (NOT debounce): many param changes in one frame collapse to one draw,
//   and the draw always reads the latest paramsRef → zero trailing lag on slider drags.
// - During drag, the expensive deck passes (watercolor blobs, film grain) are skipped;
//   a full-quality frame fires on release.
export function useMosaicRenderer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const srcRef = useRef<Src | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const paramsRef = useRef<RenderParams | null>(null);
  const pendingRef = useRef(false);
  const fontsReadyRef = useRef(false);
  const draggingRef = useRef(false);

  const draw = useCallback(() => {
    pendingRef.current = false;
    const canvas = canvasRef.current;
    const src = srcRef.current;
    const p = paramsRef.current;
    if (!canvas || !src || !p || !fontsReadyRef.current) return;
    if (canvas.width !== src.width) canvas.width = src.width;
    if (canvas.height !== src.height) canvas.height = src.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const effP =
      draggingRef.current && (p.watercolorBlobs || p.grainOpacity > 0)
        ? { ...p, watercolorBlobs: false, grainOpacity: 0 }
        : p;
    render(ctx, src, maskRef.current, effP);
  }, []);

  const scheduleDraw = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    ensureFontsReady().then(() => {
      fontsReadyRef.current = true;
      scheduleDraw();
    });
  }, [scheduleDraw]);

  const setParams = useCallback(
    (p: RenderParams) => {
      paramsRef.current = p;
      scheduleDraw();
    },
    [scheduleDraw],
  );
  const setSource = useCallback(
    (src: Src | null) => {
      srcRef.current = src;
      scheduleDraw();
    },
    [scheduleDraw],
  );
  const setMask = useCallback(
    (m: Uint8Array | null) => {
      maskRef.current = m;
      scheduleDraw();
    },
    [scheduleDraw],
  );
  const setDragging = useCallback(
    (d: boolean) => {
      draggingRef.current = d;
      if (!d) scheduleDraw();
    },
    [scheduleDraw],
  );

  return {
    canvasRef,
    srcRef,
    maskRef,
    paramsRef,
    setParams,
    setSource,
    setMask,
    setDragging,
    scheduleDraw,
  };
}
