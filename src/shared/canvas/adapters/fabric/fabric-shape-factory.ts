import type { CanvasElementV1 } from "@/shared/canvas/canvas-document";
import {
  DEFAULT_SHAPE_TEXT_ALIGN,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  SHAPE_TEXT_PADDING,
} from "./fabric-style";
import type { FabricApiLike, FabricObjectLike } from "./fabric-types";

type CanvasShapeElementV1 = Extract<
  CanvasElementV1,
  { type: "rect" | "ellipse" }
>;

export function fabricShapeOptions(
  element: CanvasElementV1,
): Record<string, unknown> {
  const style = element.style;
  return {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    originX: "left",
    originY: "top",
    fill: style.fill ?? "transparent",
    stroke: style.stroke ?? DEFAULT_STROKE,
    strokeWidth: style.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    strokeUniform: true,
    selectable: true,
    evented: true,
    objectCaching: false,
  };
}

function shapeChildOptions(element: CanvasShapeElementV1) {
  return {
    ...fabricShapeOptions(element),
    left: 0,
    top: 0,
    angle: 0,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
  };
}

function shapeTextOptions(element: CanvasShapeElementV1) {
  const textStyle = element.textStyle ?? {};
  return {
    left: 0,
    top: 0,
    width: Math.max(2, element.width - SHAPE_TEXT_PADDING * 2),
    originX: "center",
    originY: "center",
    angle: 0,
    fill: textStyle.fill ?? DEFAULT_TEXT,
    stroke: undefined,
    fontSize: textStyle.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
    fontFamily: textStyle.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
    textAlign: textStyle.textAlign ?? DEFAULT_SHAPE_TEXT_ALIGN,
    editable: false,
    selectable: false,
    evented: false,
    splitByGrapheme: true,
    objectCaching: false,
  };
}

export function createFabricShapeObject(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  if (element.type === "rect") {
    return new fabric.Rect(shapeChildOptions(element));
  }

  return new fabric.Ellipse({
    ...shapeChildOptions(element),
    rx: element.width / 2,
    ry: element.height / 2,
    width: undefined,
    height: undefined,
  });
}

export function createFabricShapeTextGroup(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  const shape = createFabricShapeObject(fabric, element);
  const text = new fabric.Textbox(element.text ?? "", shapeTextOptions(element));
  const group = new fabric.Group([shape, text], {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    originX: "left",
    originY: "top",
    selectable: true,
    evented: true,
    subTargetCheck: false,
    objectCaching: false,
    layoutManager: new fabric.LayoutManager(new fabric.FixedLayout()),
  });

  // FixedLayout keeps the shape box authoritative even when the text wraps.
  group.set({
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    angle: element.rotation,
    scaleX: 1,
    scaleY: 1,
  });
  group.setCoords?.();
  return group;
}

export function createFabricShapeTextEditor(
  fabric: FabricApiLike,
  element: CanvasShapeElementV1,
): FabricObjectLike {
  return new fabric.Textbox(element.text ?? "", {
    ...shapeTextOptions(element),
    left: element.x + element.width / 2,
    top: element.y + element.height / 2,
    angle: element.rotation,
    editable: true,
    selectable: true,
    evented: true,
    isCanvasShapeTextEditor: true,
  });
}
