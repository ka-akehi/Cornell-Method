export type {
  FabricApiLike,
  FabricCanvasLike,
  FabricEventLike,
  FabricObjectLike,
  FabricStyleChange,
} from "./fabric-types";
export {
  applyFabricObjectStyle,
  DEFAULT_SHAPE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_FONT_SIZE,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  SHAPE_TEXT_PADDING,
  readFabricNumber,
  readFabricString,
  readFabricTextAlign,
} from "./fabric-style";
export {
  attachFabricMetadata,
  isCanvasDrawingTarget,
  isCanvasElementObject,
  isCanvasPreviewObject,
  isCanvasShapeTextEditorObject,
  isCanvasShapeTextEditorTarget,
  markCanvasPreviewObject,
  markCanvasShapeTextEditorObject,
  readCanvasElement,
  readCanvasElementMetadata,
  readCanvasElementType,
  resolveFabricShapeTarget,
} from "./fabric-metadata";
export { createFabricShapeTextEditor } from "./fabric-shape-factory";
export { createFabricObject } from "./fabric-object-factory";
export { fabricDocumentToCanvas } from "./fabric-document-to-canvas";
export { fabricCanvasToDocument } from "./fabric-canvas-to-document";
