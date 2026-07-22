import {
  applyFabricObjectStyle,
  DEFAULT_SHAPE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_FONT_SIZE,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT,
  DEFAULT_TEXT_FONT_FAMILY,
  readFabricNumber,
  readFabricString,
  readFabricTextAlign,
  type FabricObjectLike,
} from "@/shared/canvas/adapters/fabric";
import type {
  CanvasElementTextStyle,
  CanvasElementType,
  CanvasTextAlign,
} from "@/shared/canvas";
import { readCanvasElement } from "./canvas-editor-document";
import {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  type CanvasNoteTool,
  type CanvasStyleChange,
  type CanvasStyleDefaults,
  type CanvasStyleTarget,
  type SelectedCanvasStyle,
  type ShapeCanvasElement,
  type FabricInteractionState,
} from "./canvas-editor-contract";

export { readFabricString };

export const DEFAULT_STROKE_COLOR = DEFAULT_STROKE;
export const DEFAULT_TEXT_COLOR = DEFAULT_TEXT;
export const DEFAULT_FONT_FAMILY = DEFAULT_TEXT_FONT_FAMILY;

export const INITIAL_STYLE_DEFAULTS: CanvasStyleDefaults = {
  strokeWidth: CANVAS_DEFAULT_STROKE_WIDTH,
  strokeColor: DEFAULT_STROKE_COLOR,
  textColor: DEFAULT_TEXT_COLOR,
  fontSize: CANVAS_DEFAULT_FONT_SIZE,
  textAlign: "left",
};

export function isColorInputValue(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function isCanvasTextAlign(value: unknown): value is CanvasTextAlign {
  return value === "left" || value === "center" || value === "right";
}

function readFabricBoolean(object: FabricObjectLike, key: string, fallback: boolean) {
  const value = object.get(key);
  return typeof value === "boolean" ? value : fallback;
}

export function readFabricInteractionState(
  object: FabricObjectLike,
): FabricInteractionState {
  return {
    visible: readFabricBoolean(object, "visible", true),
    selectable: readFabricBoolean(object, "selectable", true),
    evented: readFabricBoolean(object, "evented", true),
  };
}

function getStyleObject(object: FabricObjectLike, type: CanvasElementType) {
  return ["arrow", "rect", "ellipse"].includes(type)
    ? object.getObjects?.()[0] ?? object
    : object;
}

export function isEditingStandaloneText(object: FabricObjectLike | undefined) {
  return object?.get("isEditing") === true && readCanvasElement(object)?.type === "text";
}

export function textStylesEqual(
  left: CanvasElementTextStyle | undefined,
  right: CanvasElementTextStyle | undefined,
) {
  return (
    left?.fill === right?.fill &&
    left?.fontSize === right?.fontSize &&
    left?.fontFamily === right?.fontFamily &&
    left?.textAlign === right?.textAlign
  );
}

export function readSelectedCanvasStyle(
  object: FabricObjectLike,
): SelectedCanvasStyle | null {
  const element = readCanvasElement(object);
  if (!element) return null;

  const styleObject = getStyleObject(object, element.type);
  const isText = element.type === "text";
  return {
    elementType: element.type,
    strokeWidth: readFabricNumber(
      styleObject,
      "strokeWidth",
      element.style.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    ),
    color: isText
      ? readFabricString(object, "fill") ?? element.style.fill ?? DEFAULT_TEXT_COLOR
      : readFabricString(styleObject, "stroke") ??
        element.style.stroke ??
        DEFAULT_STROKE_COLOR,
    fontSize: readFabricNumber(
      object,
      "fontSize",
      element.style.fontSize ?? DEFAULT_STANDALONE_TEXT_FONT_SIZE,
    ),
    textAlign: isText
      ? readFabricTextAlign(object, element.style.textAlign ?? DEFAULT_STANDALONE_TEXT_ALIGN)
      : "left",
  };
}

export function applyFabricStyleChange(
  object: FabricObjectLike,
  elementType: CanvasElementType,
  change: CanvasStyleChange,
) {
  if (elementType === "text") {
    applyFabricObjectStyle(object, elementType, {
      fill: change.color,
      fontSize: change.fontSize,
      textAlign: change.textAlign,
    });
    return;
  }

  applyFabricObjectStyle(object, elementType, {
    stroke: change.color,
    strokeWidth: change.strokeWidth,
  });
}

export function shapeTextStyleForEditing(
  element: ShapeCanvasElement,
  defaults: CanvasStyleDefaults,
): CanvasElementTextStyle {
  return {
    fill: element.textStyle?.fill ?? defaults.textColor,
    fontSize: element.textStyle?.fontSize ?? defaults.fontSize,
    fontFamily: element.textStyle?.fontFamily ?? DEFAULT_FONT_FAMILY,
    textAlign: element.textStyle?.textAlign ?? DEFAULT_SHAPE_TEXT_ALIGN,
  };
}

export function getDrawingStyleTarget(
  tool: CanvasNoteTool,
): Exclude<CanvasStyleTarget, null> | null {
  if (tool === "text") return "text";
  if (["pen", "line", "arrow", "rect", "ellipse"].includes(tool)) return "stroke";
  return null;
}
