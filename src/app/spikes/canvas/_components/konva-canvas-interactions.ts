import {
  getElementBounds,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  createKonvaNode,
  type KonvaApiLike,
  type KonvaEventLike,
  type KonvaLayerLike,
  type KonvaNodeLike,
} from "../_lib/konva-adapter";
import {
  boundsForPoints,
  pointFromPointer,
  type DragDraft,
} from "./konva-canvas-geometry";
import {
  createDraggedElement,
  createStrokeElement,
  createTextElement,
} from "./konva-canvas-element-factory";
import type { CanvasTool } from "./canvas-toolbar";

type CurrentRef<T> = { current: T };

type KonvaInteractionContext = {
  container: HTMLElement;
  layer: KonvaLayerLike;
  konva: KonvaApiLike;
  toolRef: CurrentRef<CanvasTool>;
  textRef: CurrentRef<string>;
  dragRef: CurrentRef<DragDraft | null>;
  strokePointsRef: CurrentRef<Array<[number, number]>>;
  previewNodeRef: CurrentRef<KonvaNodeLike | null>;
  removePreview: () => void;
  setSelected: (node: KonvaNodeLike | null) => void;
  commitCurrent: () => void;
};

export type KonvaInteractionHandlers = {
  onPointerDown: (event: KonvaEventLike) => void;
  onPointerMove: (event: KonvaEventLike) => void;
  onPointerUp: () => void;
  onClick: (event: KonvaEventLike) => void;
  onTransformOrDragEnd: (event: KonvaEventLike) => void;
};

function classNameOf(node: KonvaNodeLike) {
  return node.getClassName?.() ?? node.className;
}

export function createKonvaInteractionHandlers({
  container,
  layer,
  konva,
  toolRef,
  textRef,
  dragRef,
  strokePointsRef,
  previewNodeRef,
  removePreview,
  setSelected,
  commitCurrent,
}: KonvaInteractionContext): KonvaInteractionHandlers {
  const onPointerDown = (event: KonvaEventLike) => {
    const activeTool = toolRef.current;
    const target = event.target;
    const targetIsTransformer = classNameOf(target) === "Transformer";
    const pointer = pointFromPointer(event.evt, container);

    if (activeTool === "select") {
      if (targetIsTransformer) return;
      if (target.getAttr("canvasElement")) setSelected(target);
      else setSelected(null);
      return;
    }

    if (activeTool === "erase") {
      if (!targetIsTransformer && target.getAttr("canvasElement")) {
        target.destroy();
        setSelected(null);
        commitCurrent();
      }
      return;
    }

    if (activeTool === "text") {
      const elementForText: CanvasDocumentV1["elements"][number] = createTextElement(
        pointer,
        textRef.current,
        layer.getChildren().length,
      );
      layer.add(createKonvaNode(konva, elementForText));
      layer.draw();
      commitCurrent();
      return;
    }

    if (activeTool === "pen") {
      strokePointsRef.current = [[pointer.x, pointer.y]];
      return;
    }

    if (["line", "arrow", "rect", "ellipse"].includes(activeTool)) {
      dragRef.current = {
        tool: activeTool as DragDraft["tool"],
        start: pointer,
        current: pointer,
      };
    }
  };

  const onPointerMove = (event: KonvaEventLike) => {
    if (toolRef.current === "pen" && strokePointsRef.current.length) {
      const pointer = pointFromPointer(event.evt, container);
      const last = strokePointsRef.current.at(-1);
      if (!last || Math.hypot(pointer.x - last[0], pointer.y - last[1]) >= 2) {
        strokePointsRef.current.push([pointer.x, pointer.y]);
      }
      removePreview();
      const points = strokePointsRef.current;
      const bounds = getElementBounds({
        x: boundsForPoints(points).x,
        y: boundsForPoints(points).y,
        width: 1,
        height: 1,
        points,
      });
      const preview = createKonvaNode(konva, {
        id: "__preview-stroke",
        type: "stroke",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        points,
        style: { stroke: "#2f5544", strokeWidth: 5 },
        z: layer.getChildren().length,
      });
      preview.setAttr("isCanvasPreview", true);
      preview.draggable(false);
      previewNodeRef.current = preview;
      layer.add(preview);
      layer.draw();
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    drag.current = pointFromPointer(event.evt, container);
    removePreview();
    const elementForPreview = createDraggedElement(
      drag.tool,
      drag.start,
      drag.current,
      layer.getChildren().length,
    );
    const preview = createKonvaNode(konva, elementForPreview);
    preview.setAttr("isCanvasPreview", true);
    preview.draggable(false);
    previewNodeRef.current = preview;
    layer.add(preview);
    layer.draw();
  };

  const onPointerUp = () => {
    if (toolRef.current === "pen" && strokePointsRef.current.length) {
      const points = strokePointsRef.current;
      strokePointsRef.current = [];
      removePreview();
      if (points.length >= 2) {
        layer.add(createKonvaNode(konva, createStrokeElement(points, layer.getChildren().length)));
        layer.draw();
        commitCurrent();
      }
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
      layer.getChildren().length,
    );
    layer.add(createKonvaNode(konva, elementForShape));
    layer.draw();
    commitCurrent();
  };

  const onClick = (event: KonvaEventLike) => {
    if (toolRef.current !== "select") return;
    const target = event.target;
    if (target.getAttr("canvasElement")) setSelected(target);
    else if (classNameOf(target) !== "Transformer") setSelected(null);
  };

  const onTransformOrDragEnd = (event: KonvaEventLike) => {
    if (event.target.getAttr("canvasElement")) commitCurrent();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClick,
    onTransformOrDragEnd,
  };
}

