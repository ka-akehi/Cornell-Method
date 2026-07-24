import {
  CANVAS_PAGE,
  type CanvasElementV1,
  type CanvasElementStyle,
  type CanvasElementTextStyle,
  type CanvasPoint,
} from "@/shared/canvas/canvas-document-types";
import { cloneCanvasDocument } from "@/shared/canvas/canvas-document-serialization";
import type {
  FabricEventLike,
  FabricObjectLike,
} from "./fabric-types";

export type FabricMetadata = {
  element: CanvasElementV1;
  baseLeft: number;
  baseTop: number;
};

const CANVAS_ELEMENT_METADATA_KEY = "canvasElement";
const CANVAS_PREVIEW_KEY = "isCanvasPreview";
const CANVAS_SHAPE_TEXT_EDITOR_KEY = "isCanvasShapeTextEditor";

const CANVAS_ELEMENT_TYPES = [
  "stroke",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "text",
] as const;
const CANVAS_POINT_ELEMENT_TYPES = ["stroke", "line", "arrow"] as const;
const CANVAS_TEXT_ALIGNS = ["left", "center", "right"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOwnField(value: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function isCanvasElementType(value: unknown): value is CanvasElementV1["type"] {
  return (
    typeof value === "string" &&
    (CANVAS_ELEMENT_TYPES as readonly string[]).includes(value)
  );
}

function isCanvasElementStyle(value: unknown): value is CanvasElementStyle {
  if (!isRecord(value)) return false;

  return (
    (value.stroke === undefined || typeof value.stroke === "string") &&
    (value.fill === undefined || typeof value.fill === "string") &&
    (value.strokeWidth === undefined || isFiniteNumber(value.strokeWidth)) &&
    (value.fontSize === undefined || isFiniteNumber(value.fontSize)) &&
    (value.fontFamily === undefined || typeof value.fontFamily === "string") &&
    (value.textAlign === undefined ||
      (typeof value.textAlign === "string" &&
        (CANVAS_TEXT_ALIGNS as readonly string[]).includes(value.textAlign)))
  );
}

function isCanvasElementTextStyle(
  value: unknown,
): value is CanvasElementTextStyle | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  return (
    (value.fill === undefined || typeof value.fill === "string") &&
    (value.fontSize === undefined || isFiniteNumber(value.fontSize)) &&
    (value.fontFamily === undefined || typeof value.fontFamily === "string") &&
    (value.textAlign === undefined ||
      (typeof value.textAlign === "string" &&
        (CANVAS_TEXT_ALIGNS as readonly string[]).includes(value.textAlign)))
  );
}

function isCanvasPoint(value: unknown): value is CanvasPoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1])
  );
}

function isCanvasPointList(value: unknown): value is CanvasPoint[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isCanvasPoint);
}

function isCanvasElement(value: unknown): value is CanvasElementV1 {
  if (!isRecord(value) || !isCanvasElementType(value.type)) return false;
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height) ||
    !isFiniteNumber(value.rotation) ||
    !isFiniteNumber(value.z) ||
    value.width <= 0 ||
    value.height <= 0 ||
    !hasOwnField(value, "style") ||
    !isCanvasElementStyle(value.style)
  ) {
    return false;
  }

  if (value.points !== undefined && !isCanvasPointList(value.points)) {
    return false;
  }

  if (
    (CANVAS_POINT_ELEMENT_TYPES as readonly string[]).includes(value.type) &&
    !isCanvasPointList(value.points)
  ) {
    return false;
  }

  if (value.type !== "text" && value.style.textAlign !== undefined) {
    return false;
  }

  if (value.type === "rect" || value.type === "ellipse") {
    return (
      (value.text === undefined || typeof value.text === "string") &&
      isCanvasElementTextStyle(value.textStyle)
    );
  }

  if (value.type === "text") {
    return typeof value.text === "string" && !hasOwnField(value, "textStyle");
  }

  return !hasOwnField(value, "text") && !hasOwnField(value, "textStyle");
}

function isFabricMetadata(value: unknown): value is FabricMetadata {
  if (!isRecord(value)) return false;
  return (
    isCanvasElement(value.element) &&
    isFiniteNumber(value.baseLeft) &&
    isFiniteNumber(value.baseTop)
  );
}

export function attachFabricMetadata(
  object: FabricObjectLike,
  element: CanvasElementV1,
  position = { left: element.x, top: element.y },
) {
  object.set({
    id: element.id,
    [CANVAS_ELEMENT_METADATA_KEY]: {
      element: cloneCanvasDocument({
        schemaVersion: 1,
        page: { ...CANVAS_PAGE },
        elements: [element],
      }).elements[0],
      baseLeft: position.left,
      baseTop: position.top,
    } satisfies FabricMetadata,
  });
  return object;
}

export function readCanvasElementMetadata(object?: FabricObjectLike) {
  const metadata = object?.get(CANVAS_ELEMENT_METADATA_KEY);
  // The converter and gesture-target allowlist share this validated
  // app-owned boundary; temporary and malformed Fabric objects stay opaque.
  return isFabricMetadata(metadata) ? metadata : undefined;
}

export function readCanvasElement(object?: FabricObjectLike) {
  return readCanvasElementMetadata(object)?.element;
}

export function readCanvasElementType(object?: FabricObjectLike) {
  const type = readCanvasElement(object)?.type;
  return isCanvasElementType(type) ? type : undefined;
}

export function isCanvasElementObject(object?: FabricObjectLike) {
  return readCanvasElementType(object) !== undefined;
}

export function isCanvasPreviewObject(object?: FabricObjectLike) {
  return object?.get(CANVAS_PREVIEW_KEY) === true;
}

export function markCanvasPreviewObject(object: FabricObjectLike) {
  object.set({ [CANVAS_PREVIEW_KEY]: true });
  return object;
}

export function isCanvasShapeTextEditorObject(object?: FabricObjectLike) {
  return object?.get(CANVAS_SHAPE_TEXT_EDITOR_KEY) === true;
}

export function markCanvasShapeTextEditorObject(object: FabricObjectLike) {
  object.set({ [CANVAS_SHAPE_TEXT_EDITOR_KEY]: true });
  return object;
}

type FabricCanvasElementOwner = {
  object: FabricObjectLike;
  element: CanvasElementV1;
};

function findFabricCanvasElementOwner(object?: FabricObjectLike) {
  const visited = new Set<FabricObjectLike>();
  let current = object;

  while (current && !visited.has(current)) {
    visited.add(current);
    const metadata = readCanvasElementMetadata(current);
    if (metadata?.element) {
      return {
        object: current,
        element: metadata.element,
      } satisfies FabricCanvasElementOwner;
    }
    current = current.group;
  }

  return null;
}

export function isCanvasDrawingTarget(event: FabricEventLike) {
  const targets = [event.target, ...(event.subTargets ?? [])].filter(
    (target): target is FabricObjectLike => target !== undefined,
  );

  // No target means the pointer is on empty Canvas space. Every persisted
  // Canvas element is a valid drawing surface; an object with missing or
  // unknown app metadata remains blocked so temporary/non-Canvas objects do
  // not become part of a new drawing gesture.
  return targets.length === 0 || targets.every(isCanvasElementObject);
}

export function isCanvasShapeTextEditorTarget(
  event: Pick<FabricEventLike, "target" | "subTargets">,
  editor?: FabricObjectLike,
) {
  const targets = [event.target, ...(event.subTargets ?? [])];
  return targets.some(
    (target) =>
      (editor !== undefined && target === editor) ||
      isCanvasShapeTextEditorObject(target),
  );
}

export function resolveFabricShapeTarget(
  event: Pick<FabricEventLike, "target" | "subTargets">,
) {
  const candidates = [event.target, ...(event.subTargets ?? [])];
  for (const candidate of candidates) {
    const owner = findFabricCanvasElementOwner(candidate);
    if (
      owner &&
      (owner.element.type === "rect" || owner.element.type === "ellipse")
    ) {
      return {
        object: owner.object,
        element: owner.element as Extract<
          CanvasElementV1,
          { type: "rect" | "ellipse" }
        >,
      };
    }
  }

  return null;
}
