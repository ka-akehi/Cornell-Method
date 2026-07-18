export const CANVAS_SCHEMA_VERSION = 1 as const;
export const CANVAS_PAGE = {
  width: 1200,
  height: 800,
  background: "paper",
} as const;
export const CANVAS_MIN_PAGE_DIMENSION = 320;
export const CANVAS_MAX_PAGE_DIMENSION = 4000;

export const CANVAS_MAX_ELEMENTS = 1_000;
export const CANVAS_MAX_STROKE_POINTS = 20_000;
export const CANVAS_MAX_SERIALIZED_BYTES = 2 * 1024 * 1024;

export type CanvasElementType =
  | "stroke"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text";

export type CanvasPoint = [number, number];

export type CanvasElementStyle = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
};

export type CanvasElementV1 = {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: CanvasPoint[];
  text?: string;
  style: CanvasElementStyle;
  z: number;
};

export type CanvasDocumentV1 = {
  schemaVersion: typeof CANVAS_SCHEMA_VERSION;
  page: {
    width: number;
    height: number;
    background: "paper";
  };
  elements: CanvasElementV1[];
};

export type CanvasPageDimensions = Pick<
  CanvasDocumentV1["page"],
  "width" | "height"
>;

export class CanvasDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasDocumentValidationError";
  }
}

const DEFAULT_STROKE = "#2f5544";
const DEFAULT_TEXT = "#25302e";
const ELEMENT_TYPES: CanvasElementType[] = [
  "stroke",
  "line",
  "arrow",
  "rect",
  "ellipse",
  "text",
];
const POINT_ELEMENT_TYPES: CanvasElementType[] = ["stroke", "line", "arrow"];

export function createElementId(prefix = "element") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getElementBounds(
  element: Pick<CanvasElementV1, "x" | "y" | "width" | "height" | "points">,
) {
  if (!element.points?.length) {
    return {
      x: element.x,
      y: element.y,
      width: Math.max(1, element.width),
      height: Math.max(1, element.height),
    };
  }

  const xs = element.points.map(([x]) => x);
  const ys = element.points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - x);
  const height = Math.max(1, Math.max(...ys) - y);

  return { x, y, width, height };
}

export function createEmptyCanvasDocument(): CanvasDocumentV1 {
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    page: { ...CANVAS_PAGE },
    elements: [],
  };
}

export function createDemoCanvasDocument(): CanvasDocumentV1 {
  const elements: CanvasElementV1[] = [
    {
      id: "demo-stroke",
      type: "stroke",
      x: 92,
      y: 112,
      width: 148,
      height: 88,
      rotation: 0,
      points: [
        [92, 182],
        [108, 160],
        [121, 174],
        [138, 132],
        [158, 154],
        [180, 120],
        [204, 145],
        [240, 112],
      ],
      style: { stroke: DEFAULT_STROKE, strokeWidth: 5 },
      z: 0,
    },
    {
      id: "demo-line",
      type: "line",
      x: 315,
      y: 108,
      width: 204,
      height: 1,
      rotation: 0,
      points: [
        [315, 108],
        [519, 108],
      ],
      style: { stroke: "#c66b3d", strokeWidth: 4 },
      z: 1,
    },
    {
      id: "demo-arrow",
      type: "arrow",
      x: 570,
      y: 108,
      width: 206,
      height: 98,
      rotation: 0,
      points: [
        [570, 190],
        [655, 128],
        [776, 108],
      ],
      style: { stroke: "#98492c", strokeWidth: 4 },
      z: 2,
    },
    {
      id: "demo-rect",
      type: "rect",
      x: 94,
      y: 286,
      width: 236,
      height: 132,
      rotation: 0,
      style: {
        stroke: "#2f5544",
        fill: "#e8f0e7",
        strokeWidth: 4,
      },
      z: 3,
    },
    {
      id: "demo-ellipse",
      type: "ellipse",
      x: 404,
      y: 286,
      width: 220,
      height: 132,
      rotation: 0,
      style: {
        stroke: "#c66b3d",
        fill: "#fff2df",
        strokeWidth: 4,
      },
      z: 4,
    },
    {
      id: "demo-text",
      type: "text",
      x: 704,
      y: 300,
      width: 300,
      height: 72,
      rotation: 0,
      text: "Canvas text is searchable",
      style: {
        fill: DEFAULT_TEXT,
        fontSize: 28,
        fontFamily: "Arial, sans-serif",
      },
      z: 5,
    },
  ];

  return { schemaVersion: CANVAS_SCHEMA_VERSION, page: { ...CANVAS_PAGE }, elements };
}

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

function normalizeStyle(value: unknown, field: string): CanvasElementStyle {
  if (value === undefined) return {};
  if (!isRecord(value)) invalid(`${field} must be an object`);

  const style: CanvasElementStyle = {};
  const stroke = asOptionalString(value.stroke, `${field}.stroke`);
  const fill = asOptionalString(value.fill, `${field}.fill`);
  const fontFamily = asOptionalString(value.fontFamily, `${field}.fontFamily`);
  const strokeWidth = asOptionalFiniteNumber(value.strokeWidth, `${field}.strokeWidth`);
  const fontSize = asOptionalFiniteNumber(value.fontSize, `${field}.fontSize`);

  if (stroke !== undefined) style.stroke = stroke;
  if (fill !== undefined) style.fill = fill;
  if (fontFamily !== undefined) style.fontFamily = fontFamily;
  if (strokeWidth !== undefined) style.strokeWidth = strokeWidth;
  if (fontSize !== undefined) style.fontSize = fontSize;

  return style;
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

function serializedByteLength(serialized: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).byteLength;
  }

  return encodeURIComponent(serialized).replace(/%[0-9A-F]{2}|./g, "x").length;
}

function assertSerializedSize(serialized: string) {
  const bytes = serializedByteLength(serialized);
  if (bytes > CANVAS_MAX_SERIALIZED_BYTES) {
    invalid(`Canvas document must be at most ${CANVAS_MAX_SERIALIZED_BYTES} bytes`);
  }
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
    const element: CanvasElementV1 = {
      id: asRequiredString(rawElement.id, `elements[${index}].id`),
      type: elementType,
      x: asFiniteNumber(rawElement.x, `elements[${index}].x`),
      y: asFiniteNumber(rawElement.y, `elements[${index}].y`),
      width: asFiniteNumber(rawElement.width, `elements[${index}].width`),
      height: asFiniteNumber(rawElement.height, `elements[${index}].height`),
      rotation: asFiniteNumber(rawElement.rotation, `elements[${index}].rotation`),
      style: normalizeStyle(rawElement.style, `elements[${index}].style`),
      z: asFiniteNumber(rawElement.z, `elements[${index}].z`),
    };

    if (element.width <= 0 || element.height <= 0) {
      invalid(`elements[${index}] dimensions must be positive`);
    }

    if (POINT_ELEMENT_TYPES.includes(element.type)) {
      element.points = asPoints(rawElement.points, `elements[${index}].points`);
      pointCount += element.points.length;
    }

    if (element.type === "text") {
      if (typeof rawElement.text !== "string") {
        invalid(`elements[${index}].text must be a string`);
      }
      element.text = rawElement.text;
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

export function serializeCanvasDocument(document: CanvasDocumentV1) {
  const validated = validateCanvasDocument(document);
  const serialized = JSON.stringify(validated);
  assertSerializedSize(serialized);
  return serialized;
}

export function restoreCanvasDocument(serialized: string): CanvasDocumentV1 {
  if (typeof serialized !== "string") {
    invalid("Serialized canvas document must be a string");
  }
  assertSerializedSize(serialized);
  return validateCanvasDocument(JSON.parse(serialized) as unknown);
}

export function cloneCanvasDocument(document: CanvasDocumentV1) {
  return validateCanvasDocument(JSON.parse(serializeCanvasDocument(document)) as unknown);
}

export function extractCanvasSearchText(document: CanvasDocumentV1) {
  return document.elements
    .filter((element) => element.type === "text")
    .slice()
    .sort((a, b) => a.z - b.z)
    .map((element) => element.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function formatDocumentBytes(serialized: string) {
  const bytes = serializedByteLength(serialized);
  return `${bytes.toLocaleString("ja-JP")} bytes`;
}
