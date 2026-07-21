import {
  CANVAS_MAX_ELEMENTS,
  CANVAS_MAX_STROKE_POINTS,
  CANVAS_MAX_PAGE_DIMENSION,
  CANVAS_MIN_PAGE_DIMENSION,
  CANVAS_SCHEMA_VERSION,
  CanvasDocumentValidationError,
} from "./canvas-document-types";
import type {
  CanvasDocumentV1,
  CanvasElementStyle,
  CanvasElementTextStyle,
  CanvasElementType,
  CanvasElementV1,
  CanvasPoint,
  CanvasTextAlign,
} from "./canvas-document-types";
import { assertSerializedSize } from "./canvas-document-size";

const ELEMENT_TYPES: CanvasElementType[] = [
  "stroke",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "text",
];
const POINT_ELEMENT_TYPES: CanvasElementType[] = ["stroke", "line", "arrow"];
const CANVAS_TEXT_ALIGNS: CanvasTextAlign[] = ["left", "center", "right"];
const TEXT_STYLE_FIELDS = ["fill", "fontSize", "fontFamily", "textAlign"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalid(message: string): never {
  throw new CanvasDocumentValidationError(message);
}

function asFiniteNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(`${field} must be a finite number`);
  }

  return value;
}

function asPageDimension(value: unknown, field: string) {
  const dimension = asFiniteNumber(value, field);
  if (!Number.isInteger(dimension)) {
    invalid(`${field} must be an integer number of pixels`);
  }
  if (
    dimension < CANVAS_MIN_PAGE_DIMENSION ||
    dimension > CANVAS_MAX_PAGE_DIMENSION
  ) {
    invalid(
      `${field} must be between ${CANVAS_MIN_PAGE_DIMENSION} and ${CANVAS_MAX_PAGE_DIMENSION} pixels`,
    );
  }

  return dimension;
}

function asRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    invalid(`${field} must be a non-empty string`);
  }

  return value;
}

function asOptionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid(`${field} must be a string`);
  return value;
}

function asOptionalFiniteNumber(value: unknown, field: string) {
  if (value === undefined) return undefined;
  return asFiniteNumber(value, field);
}

function asOptionalTextAlign(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !CANVAS_TEXT_ALIGNS.includes(value as CanvasTextAlign)
  ) {
    invalid(`${field} must be left, center, or right`);
  }
  return value as CanvasTextAlign;
}

function hasOwnField(value: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function normalizeStyle(value: unknown, field: string): CanvasElementStyle {
  if (value === undefined) return {};
  if (!isRecord(value)) invalid(`${field} must be an object`);

  const style: CanvasElementStyle = {};
  const stroke = asOptionalString(value.stroke, `${field}.stroke`);
  const fill = asOptionalString(value.fill, `${field}.fill`);
  const fontFamily = asOptionalString(value.fontFamily, `${field}.fontFamily`);
  const strokeWidth = asOptionalFiniteNumber(value.strokeWidth, `${field}.strokeWidth`);
  const fontSize = asOptionalFiniteNumber(value.fontSize, `${field}.fontSize`);
  const textAlign = asOptionalTextAlign(value.textAlign, `${field}.textAlign`);

  if (stroke !== undefined) style.stroke = stroke;
  if (fill !== undefined) style.fill = fill;
  if (fontFamily !== undefined) style.fontFamily = fontFamily;
  if (strokeWidth !== undefined) style.strokeWidth = strokeWidth;
  if (fontSize !== undefined) style.fontSize = fontSize;
  if (textAlign !== undefined) style.textAlign = textAlign;

  return style;
}

function normalizeTextStyle(
  value: unknown,
  field: string,
): CanvasElementTextStyle | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || Array.isArray(value)) {
    invalid(`${field} must be an object`);
  }

  for (const key of Object.keys(value)) {
    if (!(TEXT_STYLE_FIELDS as readonly string[]).includes(key)) {
      invalid(`${field}.${key} is not supported`);
    }
  }

  const textStyle: CanvasElementTextStyle = {};
  const fill = asOptionalString(value.fill, `${field}.fill`);
  const fontSize = asOptionalFiniteNumber(value.fontSize, `${field}.fontSize`);
  const fontFamily = asOptionalString(value.fontFamily, `${field}.fontFamily`);
  const textAlign = asOptionalTextAlign(value.textAlign, `${field}.textAlign`);

  if (fill !== undefined) textStyle.fill = fill;
  if (fontSize !== undefined) textStyle.fontSize = fontSize;
  if (fontFamily !== undefined) textStyle.fontFamily = fontFamily;
  if (textAlign !== undefined) textStyle.textAlign = textAlign;

  return textStyle;
}

function asPoints(value: unknown, field: string): CanvasPoint[] {
  if (!Array.isArray(value) || value.length < 2) {
    invalid(`${field} must contain at least two points`);
  }

  return value.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) {
      invalid(`${field}[${index}] must be a [x, y] tuple`);
    }

    return [
      asFiniteNumber(point[0], `${field}[${index}][0]`),
      asFiniteNumber(point[1], `${field}[${index}][1]`),
    ];
  });
}

export function validateCanvasDocument(value: unknown): CanvasDocumentV1 {
  if (!isRecord(value)) invalid("Canvas document must be an object");
  if (value.schemaVersion !== CANVAS_SCHEMA_VERSION) {
    invalid(`Unsupported canvas schema version: ${String(value.schemaVersion)}`);
  }

  const page = value.page;
  if (!isRecord(page) || page.background !== "paper") {
    invalid("Canvas page must use the paper background");
  }

  const pageWidth = asPageDimension(page.width, "page.width");
  const pageHeight = asPageDimension(page.height, "page.height");

  if (!Array.isArray(value.elements)) invalid("Canvas elements must be an array");
  if (value.elements.length > CANVAS_MAX_ELEMENTS) {
    invalid(`Canvas document must contain at most ${CANVAS_MAX_ELEMENTS} elements`);
  }

  let pointCount = 0;
  const elements = value.elements.map((rawElement, index) => {
    if (!isRecord(rawElement)) invalid(`elements[${index}] must be an object`);

    const type = rawElement.type;
    if (typeof type !== "string" || !ELEMENT_TYPES.includes(type as CanvasElementType)) {
      invalid(`elements[${index}].type is not supported`);
    }

    const elementType = type as CanvasElementType;
    const style = normalizeStyle(rawElement.style, `elements[${index}].style`);
    if (elementType !== "text" && style.textAlign !== undefined) {
      invalid(`elements[${index}].style.textAlign is only supported for text elements`);
    }
    const commonElement = {
      id: asRequiredString(rawElement.id, `elements[${index}].id`),
      x: asFiniteNumber(rawElement.x, `elements[${index}].x`),
      y: asFiniteNumber(rawElement.y, `elements[${index}].y`),
      width: asFiniteNumber(rawElement.width, `elements[${index}].width`),
      height: asFiniteNumber(rawElement.height, `elements[${index}].height`),
      rotation: asFiniteNumber(rawElement.rotation, `elements[${index}].rotation`),
      style,
      z: asFiniteNumber(rawElement.z, `elements[${index}].z`),
    };

    let element: CanvasElementV1;

    if (elementType === "rect" || elementType === "ellipse") {
      const text = asOptionalString(rawElement.text, `elements[${index}].text`);
      const textStyle = normalizeTextStyle(
        rawElement.textStyle,
        `elements[${index}].textStyle`,
      );
      element = {
        ...commonElement,
        type: elementType,
        ...(text !== undefined ? { text } : {}),
        ...(textStyle !== undefined ? { textStyle } : {}),
      };
    } else if (elementType === "text") {
      if (hasOwnField(rawElement, "textStyle")) {
        invalid(`elements[${index}].textStyle is not supported for text elements`);
      }
      if (typeof rawElement.text !== "string") {
        invalid(`elements[${index}].text must be a string`);
      }
      element = {
        ...commonElement,
        type: elementType,
        text: rawElement.text,
      };
    } else {
      if (hasOwnField(rawElement, "text")) {
        invalid(`elements[${index}].text is not supported for ${elementType} elements`);
      }
      if (hasOwnField(rawElement, "textStyle")) {
        invalid(
          `elements[${index}].textStyle is not supported for ${elementType} elements`,
        );
      }
      element = { ...commonElement, type: elementType };
    }

    if (element.width <= 0 || element.height <= 0) {
      invalid(`elements[${index}] dimensions must be positive`);
    }

    if (POINT_ELEMENT_TYPES.includes(element.type)) {
      element.points = asPoints(rawElement.points, `elements[${index}].points`);
      pointCount += element.points.length;
    }

    return element;
  });

  if (pointCount > CANVAS_MAX_STROKE_POINTS) {
    invalid(
      `Canvas stroke points must total at most ${CANVAS_MAX_STROKE_POINTS} points`,
    );
  }

  const document: CanvasDocumentV1 = {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    page: { width: pageWidth, height: pageHeight, background: "paper" },
    elements,
  };
  assertSerializedSize(JSON.stringify(document));
  return document;
}
