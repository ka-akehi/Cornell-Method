import {
  CANVAS_PAGE,
  getElementBounds,
  type CanvasDocumentV1,
  type CanvasElementV1,
  type CanvasPageDimensions,
  type CanvasPoint,
} from "@/shared/canvas/canvas-document";
import {
  isCanvasPreviewObject,
  isCanvasShapeTextEditorObject,
  readCanvasElementMetadata,
} from "./fabric-metadata";
import {
  DEFAULT_SHAPE_TEXT_ALIGN,
  DEFAULT_STANDALONE_TEXT_ALIGN,
  DEFAULT_TEXT_FONT_SIZE,
  readFabricNumber,
  readFabricString,
  readFabricTextAlign,
} from "./fabric-style";
import type { FabricCanvasLike, FabricObjectLike } from "./fabric-types";

function translatePointList(
  element: CanvasElementV1,
  object: FabricObjectLike,
): CanvasPoint[] | undefined {
  if (!element.points?.length) return undefined;
  const base = getElementBounds(element);
  const metadata = readCanvasElementMetadata(object);
  const left = readFabricNumber(object, "left", metadata?.baseLeft ?? base.x);
  const top = readFabricNumber(object, "top", metadata?.baseTop ?? base.y);
  const scaleX = readFabricNumber(object, "scaleX", 1);
  const scaleY = readFabricNumber(object, "scaleY", 1);
  const deltaX = left - (metadata?.baseLeft ?? base.x);
  const deltaY = top - (metadata?.baseTop ?? base.y);
  return element.points.map(([x, y]) => [
    base.x + (x - base.x) * scaleX + deltaX,
    base.y + (y - base.y) * scaleY + deltaY,
  ]);
}

function fabricObjectToElement(
  object: FabricObjectLike,
  z: number,
): CanvasElementV1 | null {
  if (isCanvasPreviewObject(object) || isCanvasShapeTextEditorObject(object)) {
    return null;
  }
  const metadata = readCanvasElementMetadata(object);
  if (!metadata?.element) return null;

  const base = metadata.element;
  const styleObject =
    ["arrow", "rect", "ellipse"].includes(base.type)
      ? object.getObjects?.()[0] ?? object
      : object;
  const scaleX = readFabricNumber(object, "scaleX", 1);
  const scaleY = readFabricNumber(object, "scaleY", 1);
  const next: CanvasElementV1 = {
    ...base,
    x: ["rect", "ellipse"].includes(base.type)
      ? readFabricNumber(object, "left", base.x)
      : base.x,
    y: ["rect", "ellipse"].includes(base.type)
      ? readFabricNumber(object, "top", base.y)
      : base.y,
    width: ["rect", "ellipse"].includes(base.type)
      ? base.width * Math.abs(scaleX)
      : base.width,
    height: ["rect", "ellipse"].includes(base.type)
      ? base.height * Math.abs(scaleY)
      : base.height,
    rotation: readFabricNumber(object, "angle", base.rotation),
    style: {
      ...base.style,
      stroke: readFabricString(styleObject, "stroke") ?? base.style.stroke,
      fill: readFabricString(styleObject, "fill") ?? base.style.fill,
      strokeWidth: readFabricNumber(
        styleObject,
        "strokeWidth",
        base.style.strokeWidth ?? 3,
      ),
    },
    z,
  };

  if (base.type === "text") {
    next.text = readFabricString(object, "text") ?? base.text ?? "";
    next.style = {
      ...next.style,
      fill: readFabricString(object, "fill") ?? base.style.fill,
      fontSize: readFabricNumber(
        object,
        "fontSize",
        base.style.fontSize ?? 24,
      ),
      fontFamily:
        readFabricString(object, "fontFamily") ?? base.style.fontFamily,
      textAlign: readFabricTextAlign(
        object,
        base.style.textAlign ?? DEFAULT_STANDALONE_TEXT_ALIGN,
      ),
    };
  }

  if (
    (base.type === "rect" || base.type === "ellipse") &&
    base.text !== undefined
  ) {
    const textObject = object.getObjects?.()[1];
    if (textObject) {
      next.text = readFabricString(textObject, "text") ?? base.text;
      const baseTextStyle = base.textStyle ?? {};
      next.textStyle = {
        ...baseTextStyle,
        fill:
          readFabricString(textObject, "fill") ?? baseTextStyle.fill,
        fontSize: readFabricNumber(
          textObject,
          "fontSize",
          baseTextStyle.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
        ),
        fontFamily:
          readFabricString(textObject, "fontFamily") ??
          baseTextStyle.fontFamily,
        textAlign: readFabricTextAlign(
          textObject,
          baseTextStyle.textAlign ?? DEFAULT_SHAPE_TEXT_ALIGN,
        ),
      };
    }
  }

  if (["stroke", "line", "arrow"].includes(base.type)) {
    next.points = translatePointList(base, object);
    if (next.points) {
      const bounds = getElementBounds({ ...next, points: next.points });
      next.x = bounds.x;
      next.y = bounds.y;
      next.width = bounds.width;
      next.height = bounds.height;
    }
  }

  return next;
}

function readCanvasDimension(
  canvas: FabricCanvasLike,
  dimension: keyof CanvasPageDimensions,
) {
  const getterValue =
    dimension === "width" ? canvas.getWidth?.() : canvas.getHeight?.();
  if (typeof getterValue === "number" && Number.isFinite(getterValue)) {
    return getterValue;
  }

  const propertyValue = canvas[dimension];
  return typeof propertyValue === "number" && Number.isFinite(propertyValue)
    ? propertyValue
    : undefined;
}

function getCanvasPageDimensions(canvas: FabricCanvasLike): CanvasPageDimensions {
  return {
    width: readCanvasDimension(canvas, "width") ?? CANVAS_PAGE.width,
    height: readCanvasDimension(canvas, "height") ?? CANVAS_PAGE.height,
  };
}

export function fabricCanvasToDocument(
  canvas: FabricCanvasLike,
  pageDimensions: CanvasPageDimensions = getCanvasPageDimensions(canvas),
): CanvasDocumentV1 {
  const elements = canvas
    .getObjects()
    .map((object) => fabricObjectToElement(object, 0))
    .filter((element): element is CanvasElementV1 => element !== null)
    .map((element, index) => ({ ...element, z: index }));

  return {
    schemaVersion: 1,
    page: {
      width: pageDimensions.width,
      height: pageDimensions.height,
      background: "paper",
    },
    elements,
  };
}
