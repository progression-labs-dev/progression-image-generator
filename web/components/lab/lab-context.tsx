"use client";

import { createContext, useContext } from "react";
import type { Engine, RenderParams } from "@/lib/render";

export interface LabApi {
  params: RenderParams;
  set: <K extends keyof RenderParams>(key: K, value: RenderParams[K]) => void;
  patch: (patch: Partial<RenderParams>) => void;
  setEngine: (engine: Engine) => void;
  setDragging: (dragging: boolean) => void;
  load: (params: RenderParams) => void;
}

export const LabContext = createContext<LabApi | null>(null);

export function useLab(): LabApi {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside <LabContext.Provider>");
  return ctx;
}

// numeric / boolean / rgb key helpers for the typed control rows
export type NumKey = {
  [K in keyof RenderParams]: RenderParams[K] extends number ? K : never;
}[keyof RenderParams];
export type BoolKey = {
  [K in keyof RenderParams]: RenderParams[K] extends boolean ? K : never;
}[keyof RenderParams];
export type RgbKey = {
  [K in keyof RenderParams]: RenderParams[K] extends [number, number, number] ? K : never;
}[keyof RenderParams];
