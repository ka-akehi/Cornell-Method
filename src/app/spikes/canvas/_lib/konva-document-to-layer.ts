import type { CanvasDocumentV1 } from "@/shared/canvas";
import { createKonvaNode } from "./konva-node-factory";
import type {
  KonvaApiLike,
  KonvaLayerLike,
  KonvaTransformerLike,
} from "./konva-types";

export function konvaDocumentToLayer(
  layer: KonvaLayerLike,
  konva: KonvaApiLike,
  document: CanvasDocumentV1,
  transformer?: KonvaTransformerLike,
) {
  layer.getChildren().slice().forEach((node) => {
    if ((node.getClassName?.() ?? node.className) !== "Transformer") node.destroy();
  });
  document.elements
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((element) => layer.add(createKonvaNode(konva, element)));
  if (transformer && !layer.getChildren().includes(transformer)) layer.add(transformer);
  transformer?.nodes([]);
  layer.draw();
}
