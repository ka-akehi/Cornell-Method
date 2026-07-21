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

export function attachFabricMetadata(
  object: FabricObjectLike,
  element: CanvasElementV1,
  position = { left: element.x, top: element.y },
) {
  object.set({
    id: element.id,
    canvasElement: {
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

export function getFabricMetadata(object: FabricObjectLike) {
  return object.get("canvasElement") as FabricMetadata | undefined;
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
    const metadata = getFabricMetadata(current);
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
