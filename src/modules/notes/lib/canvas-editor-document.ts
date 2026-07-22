import {
  createEmptyCanvasDocument,
  type CanvasDocumentV1,
  type CanvasElementTextStyle,
  type CanvasElementV1,
} from "@/shared/canvas";
import {
  isCanvasDrawingTarget as isFabricCanvasDrawingTarget,
  isCanvasShapeTextEditorObject as isFabricCanvasShapeTextEditorObject,
  isCanvasShapeTextEditorTarget as isFabricCanvasShapeTextEditorTarget,
  readCanvasElement as readFabricCanvasElement,
  readCanvasElementType as readFabricCanvasElementType,
  type FabricEventLike,
  type FabricObjectLike,
} from "@/shared/canvas/adapters/fabric";
import type { ShapeCanvasElement } from "./canvas-editor-contract";

export const EMPTY_CANVAS_DOCUMENT = createEmptyCanvasDocument();

export function withoutEmptyTextElements(document: CanvasDocumentV1) {
  const elements = document.elements.filter(
    (element) => element.type !== "text" || Boolean(element.text?.trim()),
  );

  return elements.length === document.elements.length ? document : { ...document, elements };
}

export function isShapeElement(element: CanvasElementV1): element is ShapeCanvasElement {
  return element.type === "rect" || element.type === "ellipse";
}

export function readCanvasElementType(object: FabricObjectLike | undefined) {
  return readFabricCanvasElementType(object);
}

export function readCanvasElement(object: FabricObjectLike | undefined) {
  return readFabricCanvasElement(object);
}

export function isCanvasDrawingTarget(event: FabricEventLike) {
  return isFabricCanvasDrawingTarget(event);
}

export function isCanvasShapeTextEditor(object: FabricObjectLike | undefined) {
  return isFabricCanvasShapeTextEditorObject(object);
}

export function isCanvasShapeTextEditorTarget(
  event: Pick<FabricEventLike, "target" | "subTargets">,
  editor?: FabricObjectLike,
) {
  return isFabricCanvasShapeTextEditorTarget(event, editor);
}

export function replaceShapeText(
  document: CanvasDocumentV1,
  elementId: string,
  text: string,
  textStyle?: CanvasElementTextStyle,
) {
  const elements = document.elements.map((element) => {
    if (element.id !== elementId || !isShapeElement(element)) return element;

    const shape = { ...element };
    delete shape.text;
    delete shape.textStyle;
    if (!text.trim()) return shape;

    return {
      ...shape,
      text,
      ...(textStyle !== undefined ? { textStyle } : {}),
    };
  });

  return elements.some((element, index) => element !== document.elements[index])
    ? { ...document, elements }
    : document;
}

export function extractCanvasEditorText(document: CanvasDocumentV1) {
  return document.elements
    .filter((element) => isShapeElement(element) || element.type === "text")
    .map((element) => element.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("、");
}
