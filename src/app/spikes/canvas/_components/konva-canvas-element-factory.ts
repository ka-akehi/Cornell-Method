import {
  createElementId,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import { boundsForPoints, type Point } from "./konva-canvas-geometry";
import type { CanvasTool } from "./canvas-toolbar";

export function createDraggedElement(
  type: Extract<CanvasTool, "line" | "arrow" | "rect" | "ellipse">,
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

export function createTextElement(
  point: Point,
  text: string,
  z: number,
): CanvasDocumentV1["elements"][number] {
  return {
    id: createElementId("text"),
    type: "text",
    x: point.x,
    y: point.y,
    width: 290,
    height: 58,
    rotation: 0,
    text: text || "Canvas text",
    style: {
      fill: "#25302e",
      fontSize: 26,
      fontFamily: "Arial, sans-serif",
    },
    z,
  };
}

export function createStrokeElement(
  points: Array<[number, number]>,
  z: number,
): CanvasDocumentV1["elements"][number] {
  const pointBounds = boundsForPoints(points);
  return {
    id: createElementId("stroke"),
    type: "stroke",
    x: pointBounds.x,
    y: pointBounds.y,
    width: pointBounds.width,
    height: pointBounds.height,
    rotation: 0,
    points,
    style: { stroke: "#2f5544", strokeWidth: 5 },
    z,
  };
}

