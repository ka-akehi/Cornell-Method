import type {
  CanvasElementType,
  CanvasTextAlign,
} from "@/shared/canvas/canvas-document";
import type { FabricObjectLike, FabricStyleChange } from "./fabric-types";

export const DEFAULT_STROKE = "#2f5544";
export const DEFAULT_STROKE_WIDTH = 3;
export const DEFAULT_TEXT = "#25302e";
export const DEFAULT_TEXT_FONT_SIZE = 12;
export const DEFAULT_STANDALONE_TEXT_FONT_SIZE = 24;
export const DEFAULT_TEXT_FONT_FAMILY = "Arial, sans-serif";
export const DEFAULT_STANDALONE_TEXT_ALIGN: CanvasTextAlign = "left";
export const DEFAULT_SHAPE_TEXT_ALIGN: CanvasTextAlign = "center";
export const SHAPE_TEXT_PADDING = 12;

export function readFabricNumber(
  object: FabricObjectLike,
  key: string,
  fallback: number,
) {
  const value = object.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readFabricString(object: FabricObjectLike, key: string) {
  const value = object.get(key);
  return typeof value === "string" ? value : undefined;
}

export function readFabricTextAlign(
  object: FabricObjectLike,
  fallback: CanvasTextAlign,
): CanvasTextAlign {
  const value = readFabricString(object, "textAlign");
  return value === "left" || value === "center" || value === "right"
    ? value
    : fallback;
}

export function applyFabricObjectStyle(
  object: FabricObjectLike,
  elementType: CanvasElementType,
  change: FabricStyleChange,
) {
  const styleObject = ["arrow", "rect", "ellipse"].includes(elementType)
    ? object.getObjects?.()[0] ?? object
    : object;
  const properties: Record<string, unknown> = {};
  if (change.stroke !== undefined) properties.stroke = change.stroke;
  if (change.fill !== undefined) properties.fill = change.fill;
  if (change.strokeWidth !== undefined) properties.strokeWidth = change.strokeWidth;
  if (change.fontSize !== undefined) properties.fontSize = change.fontSize;
  if (change.textAlign !== undefined) properties.textAlign = change.textAlign;
  if (Object.keys(properties).length > 0) styleObject.set(properties);

  if (elementType === "arrow" && change.stroke !== undefined) {
    object.getObjects?.()[1]?.set({ fill: change.stroke });
  }
}
