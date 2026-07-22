import {
  createElementId,
  type CanvasDocumentV1,
  type CanvasPageDimensions,
} from "@/shared/canvas";
import type {
  CanvasNoteTool,
  CanvasStyleDefaults,
  Point,
} from "./canvas-editor-contract";

export const DRAW_DRAG_THRESHOLD = 4;

export function clampPoint(point: Point, pageDimensions: CanvasPageDimensions) {
  return {
    x: Math.min(pageDimensions.width, Math.max(0, point.x)),
    y: Math.min(pageDimensions.height, Math.max(0, point.y)),
  };
}

export function pointFromPointer(
  event: PointerEvent,
  element: HTMLCanvasElement,
  pageDimensions: CanvasPageDimensions,
): Point {
  const rect = element.getBoundingClientRect();
  return clampPoint(
    {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * pageDimensions.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * pageDimensions.height,
    },
    pageDimensions,
  );
}

export function createDraggedElement(
  type: Extract<CanvasNoteTool, "line" | "arrow" | "rect" | "ellipse">,
  start: Point,
  current: Point,
  z: number,
  styleDefaults: CanvasStyleDefaults,
): CanvasDocumentV1["elements"][number] {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.max(2, Math.abs(current.x - start.x));
  const height = Math.max(2, Math.abs(current.y - start.y));
  const style = {
    stroke: styleDefaults.strokeColor,
    fill: type === "rect" || type === "ellipse" ? "#fff2df" : undefined,
    strokeWidth: styleDefaults.strokeWidth,
  };

  if (type === "line" || type === "arrow") {
    return {
      id: createElementId(type),
      type,
      x,
      y,
      width,
      height,
      rotation: 0,
      points: [
        [start.x, start.y],
        [current.x, current.y],
      ],
      style,
      z,
    };
  }

  return {
    id: createElementId(type),
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    style,
    z,
  };
}
