"use client";

import { useEffect, useRef, useState } from "react";
import { CANVAS_PAGE } from "@/shared/canvas";
import type { KonvaCanvasDocumentController } from "./use-konva-canvas-document";
import { useKonvaCanvasStage } from "./use-konva-canvas-stage";
import type { CanvasTool, CanvasZoom } from "./canvas-toolbar";

type KonvaCanvasRuntimeOptions = {
  initialDocumentRef: KonvaCanvasDocumentController["initialDocumentRef"];
  applyDocumentRef: KonvaCanvasDocumentController["applyDocumentRef"];
  commitRef: KonvaCanvasDocumentController["commitRef"];
  tool: CanvasTool;
  text: string;
  zoom: CanvasZoom;
};

export function useKonvaCanvasRuntime({
  initialDocumentRef,
  applyDocumentRef,
  commitRef,
  tool,
  text,
  zoom,
}: KonvaCanvasRuntimeOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const displayScale = zoom === "fit" ? fitScale : zoom;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateFitScale = () => {
      setFitScale(Math.min(1, viewport.clientWidth / CANVAS_PAGE.width));
    };
    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const stage = useKonvaCanvasStage({
    initialDocumentRef,
    applyDocumentRef,
    commitRef,
    tool,
    text,
    displayScale,
  });

  return {
    viewportRef,
    ...stage,
  };
}
