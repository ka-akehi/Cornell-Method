import type {
  CanvasDocumentV1,
  CanvasElementType,
  CanvasTextAlign,
} from "@/shared/canvas";

export type CanvasNoteTool =
  | "select"
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "erase";

export const CANVAS_MIN_STROKE_WIDTH = 1;
export const CANVAS_MAX_STROKE_WIDTH = 20;
export const CANVAS_DEFAULT_STROKE_WIDTH = 1;
export const CANVAS_MIN_FONT_SIZE = 8;
export const CANVAS_MAX_FONT_SIZE = 96;
export const CANVAS_DEFAULT_FONT_SIZE = 12;

export type CanvasStyleTarget = "stroke" | "text" | null;

export type CanvasStyleControlValues = {
  strokeWidth: number;
  color: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
};

export type CanvasStyleChange = {
  strokeWidth?: number;
  color?: string;
  fontSize?: number;
  textAlign?: CanvasTextAlign;
  commit?: boolean;
};

export type CanvasStyleDefaults = {
  strokeWidth: number;
  strokeColor: string;
  textColor: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
};

export type SelectedCanvasStyle = CanvasStyleControlValues & {
  elementType: CanvasElementType;
};

export type Point = { x: number; y: number };

export type DragDraft = {
  tool: Extract<CanvasNoteTool, "line" | "arrow" | "rect" | "ellipse">;
  start: Point;
  current: Point;
  started: boolean;
};

export type ShapeCanvasElement = Extract<
  CanvasDocumentV1["elements"][number],
  { type: "rect" | "ellipse" }
>;

export type FabricInteractionState = {
  visible: boolean;
  selectable: boolean;
  evented: boolean;
};

export type NoteCanvasEditorProps = {
  initialDocument: CanvasDocumentV1 | null;
  apiError?: string;
  externalError?: string | null;
  onDocumentChange: (document: CanvasDocumentV1) => void;
  onError?: (message: string | null) => void;
};
