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

export type CanvasTextAlign = "left" | "center" | "right";

export type CanvasElementStyle = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: CanvasTextAlign;
};

export type CanvasElementTextStyle = {
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: CanvasTextAlign;
};

type CanvasElementBaseV1 = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: CanvasPoint[];
  style: CanvasElementStyle;
  z: number;
};

type CanvasShapeElementV1 = CanvasElementBaseV1 & {
  type: "rect" | "ellipse";
  text?: string;
  textStyle?: CanvasElementTextStyle;
};

type CanvasStandaloneTextElementV1 = CanvasElementBaseV1 & {
  type: "text";
  text: string;
  textStyle?: never;
};

type CanvasDrawingElementV1 = CanvasElementBaseV1 & {
  type: "stroke" | "line" | "arrow";
  text?: never;
  textStyle?: never;
};

export type CanvasElementV1 =
  | CanvasShapeElementV1
  | CanvasStandaloneTextElementV1
  | CanvasDrawingElementV1;

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
