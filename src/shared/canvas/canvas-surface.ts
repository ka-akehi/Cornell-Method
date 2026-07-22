import type { CanvasPageDimensions } from "./canvas-document";
import type { FabricCanvasLike } from "./adapters/fabric";

export type CanvasSurfaceDimensionStyle = {
  width: string;
  height: string;
};

export type CanvasSurfaceDimensionTargets = {
  canvas: FabricCanvasLike | null;
  canvasElement?: HTMLCanvasElement | null;
  surface: HTMLDivElement | null;
};

export function getCanvasSurfaceDimensionStyle(
  dimensions: CanvasPageDimensions,
): CanvasSurfaceDimensionStyle {
  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
  };
}

function applyDimensionStyle(
  element: HTMLElement | HTMLCanvasElement,
  style: CanvasSurfaceDimensionStyle,
) {
  element.style.width = style.width;
  element.style.height = style.height;
}

/**
 * Keeps the app-owned paper frame and Fabric's generated canvas frame at the
 * same physical size. Zoom is intentionally not involved in this operation.
 */
export function applyCanvasSurfaceDimensions(
  targets: CanvasSurfaceDimensionTargets,
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
