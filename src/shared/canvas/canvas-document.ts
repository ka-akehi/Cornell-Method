export {
  CANVAS_MAX_ELEMENTS,
  CANVAS_MAX_SERIALIZED_BYTES,
  CANVAS_MAX_STROKE_POINTS,
  CANVAS_MAX_PAGE_DIMENSION,
  CANVAS_MIN_PAGE_DIMENSION,
  CANVAS_PAGE,
  CANVAS_SCHEMA_VERSION,
  CanvasDocumentValidationError,
} from "./canvas-document-types";
export type {
  CanvasDocumentV1,
  CanvasElementStyle,
  CanvasElementTextStyle,
  CanvasElementType,
  CanvasElementV1,
  CanvasPageDimensions,
  CanvasPoint,
  CanvasTextAlign,
} from "./canvas-document-types";

export {
  createDemoCanvasDocument,
  createElementId,
  createEmptyCanvasDocument,
} from "./canvas-document-defaults";
export { getElementBounds } from "./canvas-document-geometry";
export { validateCanvasDocument } from "./canvas-document-validation";
export {
  cloneCanvasDocument,
  restoreCanvasDocument,
  serializeCanvasDocument,
} from "./canvas-document-serialization";
export {
  extractCanvasSearchText,
  formatDocumentBytes,
} from "./canvas-document-search";
