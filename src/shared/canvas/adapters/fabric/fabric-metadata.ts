import {
  CANVAS_PAGE,
  cloneCanvasDocument,
  type CanvasElementV1,
} from "@/shared/canvas/canvas-document";
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

function isCanvasElementType(value: unknown): value is CanvasElementV1["type"] {
  return (
    value === "stroke" ||
    value === "line" ||
    value === "arrow" ||
    value === "rect" ||
    value === "ellipse" ||
    value === "text"
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
  return metadata && typeof metadata === "object"
    ? (metadata as FabricMetadata)
    : undefined;
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
