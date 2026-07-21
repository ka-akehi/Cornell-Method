import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  type CanvasElementV1,
} from "@/shared/canvas";
import type { KonvaNodeLike } from "./konva-types";

export type KonvaMetadata = {
  element: CanvasElementV1;
  baseNodeX: number;
  baseNodeY: number;
};

export function attachKonvaMetadata(
  node: KonvaNodeLike,
  element: CanvasElementV1,
  x: number,
  y: number,
) {
  node.setAttrs({
    id: element.id,
    name: element.id,
    canvasElement: {
      element: cloneCanvasDocument({
        schemaVersion: 1,
        page: { ...CANVAS_PAGE },
        elements: [element],
      }).elements[0],
      baseNodeX: x,
      baseNodeY: y,
    } satisfies KonvaMetadata,
  });
  return node;
}

export function getKonvaMetadata(node: KonvaNodeLike) {
  return node.getAttr("canvasElement") as KonvaMetadata | undefined;
}
