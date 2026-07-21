import { CANVAS_PAGE } from "@/shared/canvas";
import type { CanvasTool } from "./canvas-toolbar";

export type Point = { x: number; y: number };

export type DragDraft = {
  tool: Extract<CanvasTool, "line" | "arrow" | "rect" | "ellipse">;
  start: Point;
  current: Point;
};

export function clampPoint(point: Point) {
  return {
    x: Math.min(CANVAS_PAGE.width, Math.max(0, point.x)),
    y: Math.min(CANVAS_PAGE.height, Math.max(0, point.y)),
  };
}

export function boundsForPoints(points: Array<[number, number]>) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
}

export function pointFromPointer(event: PointerEvent, container: HTMLElement): Point {
  const rect = container.getBoundingClientRect();
  return clampPoint({
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * CANVAS_PAGE.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * CANVAS_PAGE.height,
  });
}

