import {
  CANVAS_PAGE,
  getElementBounds,
  type CanvasDocumentV1,
  type CanvasElementV1,
} from "@/shared/canvas";
import { getKonvaMetadata } from "./konva-metadata";
import { translatePointList } from "./konva-geometry";
import type { KonvaLayerLike, KonvaNodeLike } from "./konva-types";

function nodeToElement(node: KonvaNodeLike, z: number): CanvasElementV1 | null {
  const metadata = getKonvaMetadata(node);
  if (!metadata?.element) return null;
  const base = metadata.element;
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const next: CanvasElementV1 = {
    ...base,
    rotation: node.rotation(),
    style: { ...base.style },
    z,
  };

  if (base.type === "ellipse") {
    const radiusX = node.radiusX?.() ?? base.width / 2;
    const radiusY = node.radiusY?.() ?? base.height / 2;
    next.x = node.x() - radiusX * scaleX;
    next.y = node.y() - radiusY * scaleY;
    next.width = Math.max(1, radiusX * 2 * scaleX);
    next.height = Math.max(1, radiusY * 2 * scaleY);
  } else if (["stroke", "line", "arrow"].includes(base.type)) {
    next.points = translatePointList(base, node);
    const bounds = next.points ? getElementBounds({ ...next, points: next.points }) : getElementBounds(base);
    next.x = bounds.x;
    next.y = bounds.y;
    next.width = bounds.width;
    next.height = bounds.height;
  } else {
    next.x = node.x();
    next.y = node.y();
    next.width = Math.max(1, node.width() * scaleX);
    next.height = Math.max(1, node.height() * scaleY);
  }

  if (base.type === "text") {
    next.text = node.text?.() ?? base.text ?? "";
    next.style = {
      ...next.style,
      fontSize: (base.style.fontSize ?? 24) * scaleY,
    };
  }

  return next;
}

export function konvaLayerToDocument(layer: KonvaLayerLike): CanvasDocumentV1 {
  const elements = layer
    .getChildren()
    .filter((node) => (node.getClassName?.() ?? node.className) !== "Transformer")
    .map((node, index) => nodeToElement(node, index))
    .filter((element): element is CanvasElementV1 => element !== null);

  return {
    schemaVersion: 1,
    page: { ...CANVAS_PAGE },
    elements,
  };
}
