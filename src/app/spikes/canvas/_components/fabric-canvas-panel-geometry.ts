import {
  CANVAS_PAGE,
  createElementId,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import type { CanvasTool } from "./canvas-toolbar";

export type Point = { x: number; y: number };

export type DragDraft = {
  tool: Extract<CanvasTool, "line" | "arrow" | "rect" | "ellipse">;
  start: Point;
  current: Point;
};

function clampPoint(point: Point) {
  return {
    x: Math.min(CANVAS_PAGE.width, Math.max(0, point.x)),
    y: Math.min(CANVAS_PAGE.height, Math.max(0, point.y)),
  };
}

export function pointFromPointer(
  event: PointerEvent,
  element: HTMLCanvasElement,
): Point {
  const rect = element.getBoundingClientRect();
  return clampPoint({
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_PAGE.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_PAGE.height,
  });
}

export function createDraggedElement(
  type: DragDraft["tool"],
  start: Point,
  current: Point,
  z: number,
): CanvasDocumentV1["elements"][number] {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.max(2, Math.abs(current.x - start.x));
  const height = Math.max(2, Math.abs(current.y - start.y));
  const style = {
    stroke: type === "arrow" ? "#98492c" : "#2f5544",
    fill: type === "rect" || type === "ellipse" ? "#fff2df" : undefined,
    strokeWidth: 4,
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
