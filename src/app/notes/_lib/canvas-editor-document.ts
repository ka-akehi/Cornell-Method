import {
  createEmptyCanvasDocument,
  type CanvasDocumentV1,
  type CanvasElementTextStyle,
  type CanvasElementV1,
} from "@/shared/canvas";
import type {
  FabricEventLike,
  FabricObjectLike,
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

export function isCanvasElementType(value: unknown): value is CanvasElementV1["type"] {
  return (
    value === "stroke" ||
    value === "line" ||
    value === "arrow" ||
    value === "rect" ||
    value === "ellipse" ||
    value === "text"
  );
}

export function readCanvasElementType(object: FabricObjectLike | undefined) {
  if (!object) return undefined;

  const metadata = object.get("canvasElement");
  if (!metadata || typeof metadata !== "object") return undefined;

  const element = (metadata as { element?: unknown }).element;
  if (!element || typeof element !== "object") return undefined;

  const type = (element as { type?: unknown }).type;
  return isCanvasElementType(type) ? type : undefined;
}

export function readCanvasElement(object: FabricObjectLike | undefined) {
  if (!object) return undefined;

  const metadata = object.get("canvasElement");
  if (!metadata || typeof metadata !== "object") return undefined;

  return (metadata as { element?: CanvasElementV1 }).element;
}

export function isCanvasDrawingTarget(event: FabricEventLike) {
  const targets = [event.target, ...(event.subTargets ?? [])].filter(
    (target): target is FabricObjectLike => target !== undefined,
  );

  // No target means the pointer is on empty Canvas space. Every persisted
  // Canvas element is a valid drawing surface; an object with missing or
  // unknown app metadata remains blocked so temporary/non-Canvas objects do
  // not become part of a new drawing gesture.
  return (
    targets.length === 0 ||
    targets.every((target) => readCanvasElementType(target) !== undefined)
  );
}

export function isCanvasShapeTextEditor(object: FabricObjectLike | undefined) {
  return object?.get("isCanvasShapeTextEditor") === true;
}

export function isCanvasShapeTextEditorTarget(
  event: Pick<FabricEventLike, "target" | "subTargets">,
  editor?: FabricObjectLike,
) {
  const targets = [event.target, ...(event.subTargets ?? [])];
  return targets.some(
    (target) =>
      (editor !== undefined && target === editor) || isCanvasShapeTextEditor(target),
  );
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
