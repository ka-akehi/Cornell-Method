"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { CANVAS_PAGE } from "@/shared/canvas";
import type { FabricCanvasLike } from "../_lib/fabric-adapter";
import type { CanvasZoom } from "./canvas-toolbar";

type UseFabricCanvasZoomOptions = {
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
  canvasRef: MutableRefObject<FabricCanvasLike | null>;
  applyZoomRef: MutableRefObject<() => void>;
  zoom: CanvasZoom;
};

export function useFabricCanvasZoom({
  surfaceRef,
  canvasRef,
  applyZoomRef,
  zoom,
}: UseFabricCanvasZoomOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const displayScale = zoom === "fit" ? fitScale : zoom;

  const applyZoom = useCallback(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;
    if (!surface || !canvas) return;

    const width = CANVAS_PAGE.width * displayScale;
    const height = CANVAS_PAGE.height * displayScale;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    const wrapper = canvas.upperCanvasEl.parentElement;
    if (wrapper) {
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.querySelectorAll("canvas").forEach((node) => {
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
      });
    }
    canvas.requestRenderAll?.();
  }, [canvasRef, displayScale, surfaceRef]);

  useEffect(() => {
    applyZoomRef.current = applyZoom;
  }, [applyZoom, applyZoomRef]);

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

  useEffect(() => {
    applyZoom();
  }, [applyZoom]);

  return { viewportRef };
}
