import type { CanvasPageDimensions } from "../../canvas-document-types";
import type { FabricCanvasLike } from "./fabric-types";

export type FabricCanvasSurfaceDimensionTargets = {
  canvas: FabricCanvasLike | null;
  canvasElement?: HTMLCanvasElement | null;
  surface: HTMLDivElement | null;
};

function applyDimensionStyle(
  element: HTMLElement | HTMLCanvasElement,
  style: { width: string; height: string },
) {
  element.style.width = style.width;
  element.style.height = style.height;
}

function getCanvasSurfaceDimensionStyle(dimensions: CanvasPageDimensions) {
  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
  };
}

/**
 * Keeps the app-owned paper frame and Fabric's generated canvas frame at the
 * same physical size. Zoom is intentionally not involved in this operation.
 */
export function applyCanvasSurfaceDimensions(
  targets: FabricCanvasSurfaceDimensionTargets,
  dimensions: CanvasPageDimensions,
) {
  const { canvas, canvasElement, surface } = targets;
  if (!canvas) return;

  const style = getCanvasSurfaceDimensionStyle(dimensions);
  canvas.setDimensions(dimensions);
  if (surface) applyDimensionStyle(surface, style);
  if (canvasElement) applyDimensionStyle(canvasElement, style);

  const fabricWrapper = canvas.upperCanvasEl.parentElement;
  if (fabricWrapper) {
    applyDimensionStyle(fabricWrapper, style);
    fabricWrapper.querySelectorAll("canvas").forEach((element) => {
      applyDimensionStyle(element, style);
    });
  }

  canvas.requestRenderAll?.();
}
