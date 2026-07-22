import type { CanvasDocumentV1, CanvasTextAlign } from "@/shared/canvas";

export type CanvasNoteTool =
  | "select"
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "erase";

export type CanvasStyleDefaults = {
  strokeWidth: number;
  strokeColor: string;
  textColor: string;
  fontSize: number;
  textAlign: CanvasTextAlign;
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
