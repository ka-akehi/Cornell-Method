import {
  getElementBounds,
  createElementId,
  type CanvasDocumentV1,
  type CanvasElementType,
} from "@/shared/canvas";
import {
  createFabricObject,
  type FabricApiLike,
  type FabricCanvasLike,
  type FabricEventLike,
  type FabricObjectLike,
} from "../_lib/fabric-adapter";
import type { CanvasTool } from "./canvas-toolbar";
import {
  createDraggedElement,
  pointFromPointer,
  type DragDraft,
} from "./fabric-canvas-panel-geometry";
import type { MutableRefObject } from "react";

type FabricCanvasInteractionOptions = {
  canvas: FabricCanvasLike;
  fabric: FabricApiLike;
  element: HTMLCanvasElement;
  toolRef: MutableRefObject<CanvasTool>;
  textRef: MutableRefObject<string>;
  dragRef: MutableRefObject<DragDraft | null>;
  draftPointsRef: MutableRefObject<Array<[number, number]>>;
  previewObjectRef: MutableRefObject<FabricObjectLike | null>;
  removePreview: () => void;
  commitCurrent: () => void;
};

export function createFabricCanvasEventHandlers({
  canvas,
  fabric,
  element,
  toolRef,
  textRef,
  dragRef,
  draftPointsRef,
  previewObjectRef,
  removePreview,
  commitCurrent,
}: FabricCanvasInteractionOptions) {
  const onMouseDown = (event: FabricEventLike) => {
    const activeTool = toolRef.current;
    const pointer = pointFromPointer(event.e, element);
    if (activeTool === "pen") {
      draftPointsRef.current = [[pointer.x, pointer.y]];
      return;
    }

    if (activeTool === "select") {
      dragRef.current = null;
      draftPointsRef.current = [];
      removePreview();
      return;
    }

    if (["line", "arrow", "rect", "ellipse"].includes(activeTool)) {
      if (event.target) {
        dragRef.current = null;
        removePreview();
        return;
      }
      dragRef.current = {
        tool: activeTool as DragDraft["tool"],
        start: pointer,
        current: pointer,
      };
      return;
    }

    if (activeTool === "text") {
      const elementForText: CanvasDocumentV1["elements"][number] = {
        id: createElementId("text"),
        type: "text",
        x: pointer.x,
        y: pointer.y,
        width: 290,
        height: 58,
        rotation: 0,
        text: textRef.current || "Canvas text",
        style: {
          fill: "#25302e",
          fontSize: 26,
          fontFamily: "Arial, sans-serif",
        },
        z: canvas.getObjects().length,
      };
      canvas.add(createFabricObject(fabric, elementForText));
      commitCurrent();
      return;
    }

    if (activeTool === "erase" && event.target) {
      canvas.remove(event.target);
      canvas.discardActiveObject();
      commitCurrent();
    }
  };

  const onMouseMove = (event: FabricEventLike) => {
    const pointer = pointFromPointer(event.e, element);
    if (toolRef.current === "pen" && draftPointsRef.current.length) {
      const last = draftPointsRef.current.at(-1);
      if (!last || Math.hypot(pointer.x - last[0], pointer.y - last[1]) >= 2) {
        draftPointsRef.current.push([pointer.x, pointer.y]);
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    drag.current = pointer;
    removePreview();
    const elementForPreview = createDraggedElement(
      drag.tool,
      drag.start,
      drag.current,
      canvas.getObjects().length,
    );
    const preview = createFabricObject(fabric, elementForPreview);
    preview.set({ isCanvasPreview: true, selectable: false, evented: false });
    previewObjectRef.current = preview;
    canvas.add(preview);
    canvas.requestRenderAll?.();
  };

  const onMouseUp = () => {
    if (toolRef.current === "select") {
      dragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    removePreview();
    const elementForShape = createDraggedElement(
      drag.tool,
      drag.start,
      drag.current,
      canvas.getObjects().length,
    );
    canvas.add(createFabricObject(fabric, elementForShape));
    commitCurrent();
  };

  const onPathCreated = (event: FabricEventLike) => {
    const points = draftPointsRef.current;
    draftPointsRef.current = [];
    if (!event.target || points.length < 2) return;
    const bounds = getElementBounds({
      x: Math.min(...points.map(([x]) => x)),
      y: Math.min(...points.map(([, y]) => y)),
      width: 1,
      height: 1,
      points,
    });
    const targetLeft = event.target.get("left");
    const targetTop = event.target.get("top");
    event.target.set({
      canvasElement: {
        element: {
          id: createElementId("stroke"),
          type: "stroke" as CanvasElementType,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          rotation: 0,
          points,
          style: { stroke: "#2f5544", strokeWidth: 5 },
          z: canvas.getObjects().length,
        },
        baseLeft: typeof targetLeft === "number" ? targetLeft : bounds.x,
        baseTop: typeof targetTop === "number" ? targetTop : bounds.y,
      },
    });
    commitCurrent();
  };

  const onObjectModified = () => commitCurrent();

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onPathCreated,
    onObjectModified,
  };
}
