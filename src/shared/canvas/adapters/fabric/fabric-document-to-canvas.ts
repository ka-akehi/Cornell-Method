import type { CanvasDocumentV1 } from "@/shared/canvas/canvas-document-types";
import { createFabricObject } from "./fabric-object-factory";
import type { FabricApiLike, FabricCanvasLike } from "./fabric-types";

export function fabricDocumentToCanvas(
  canvas: FabricCanvasLike,
  fabric: FabricApiLike,
  document: CanvasDocumentV1,
) {
  canvas.clear();
  canvas.backgroundColor = "#fffdf8";
  canvas.setDimensions({
    width: document.page.width,
    height: document.page.height,
  });

  document.elements
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((element) => canvas.add(createFabricObject(fabric, element)));

  canvas.discardActiveObject();
  canvas.renderAll();
}
