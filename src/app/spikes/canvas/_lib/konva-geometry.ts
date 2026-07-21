import {
  getElementBounds,
  type CanvasElementV1,
  type CanvasPoint,
} from "@/shared/canvas";
import { getKonvaMetadata } from "./konva-metadata";
import type { KonvaNodeLike } from "./konva-types";

export function flattenPoints(points: CanvasPoint[] | undefined) {
  return (points ?? []).flatMap(([x, y]) => [x, y]);
}

export function translatePointList(
  element: CanvasElementV1,
  node: KonvaNodeLike,
): CanvasPoint[] | undefined {
  if (!element.points?.length) return undefined;
  const base = getElementBounds(element);
  const metadata = getKonvaMetadata(node);
  const dx = node.x() - (metadata?.baseNodeX ?? 0);
  const dy = node.y() - (metadata?.baseNodeY ?? 0);
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  return element.points.map(([x, y]) => [
    base.x + (x - base.x) * scaleX + dx,
    base.y + (y - base.y) * scaleY + dy,
  ]);
}
