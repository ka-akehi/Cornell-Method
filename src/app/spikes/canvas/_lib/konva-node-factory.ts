import { type CanvasElementV1 } from "@/shared/canvas";
import { attachKonvaMetadata } from "./konva-metadata";
import { flattenPoints } from "./konva-geometry";
import type { KonvaApiLike, KonvaNodeLike } from "./konva-types";

export function createKonvaNode(
  konva: KonvaApiLike,
  element: CanvasElementV1,
): KonvaNodeLike {
  const style = element.style;
  const common = {
    draggable: true,
    stroke: style.stroke ?? "#2f5544",
    strokeWidth: style.strokeWidth ?? 3,
    lineCap: "round",
    lineJoin: "round",
    hitStrokeWidth: 18,
    listening: true,
  };

  if (element.type === "stroke") {
    return attachKonvaMetadata(
      new konva.Line({
        ...common,
        points: flattenPoints(element.points),
        fill: "transparent",
        tension: 0.15,
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "line") {
    return attachKonvaMetadata(
      new konva.Line({
        ...common,
        points: flattenPoints(element.points),
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "arrow") {
    return attachKonvaMetadata(
      new konva.Arrow({
        ...common,
        points: flattenPoints(element.points),
        pointerLength: 16,
        pointerWidth: 16,
        fill: style.stroke ?? "#98492c",
        x: 0,
        y: 0,
      }),
      element,
      0,
      0,
    );
  }

  if (element.type === "rect") {
    return attachKonvaMetadata(
      new konva.Rect({
        ...common,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        fill: style.fill ?? "transparent",
        rotation: element.rotation,
      }),
      element,
      element.x,
      element.y,
    );
  }

  if (element.type === "ellipse") {
    return attachKonvaMetadata(
      new konva.Ellipse({
        ...common,
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
        radiusX: element.width / 2,
        radiusY: element.height / 2,
        fill: style.fill ?? "transparent",
        rotation: element.rotation,
      }),
      element,
      element.x + element.width / 2,
      element.y + element.height / 2,
    );
  }

  return attachKonvaMetadata(
    new konva.Text({
      ...common,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      text: element.text ?? "",
      fontSize: style.fontSize ?? 24,
      fontFamily: style.fontFamily ?? "Arial, sans-serif",
      fill: style.fill ?? "#25302e",
      stroke: undefined,
      padding: 2,
      wrap: "word",
      rotation: element.rotation,
    }),
    element,
    element.x,
    element.y,
  );
}
