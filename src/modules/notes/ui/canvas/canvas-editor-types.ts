import type {
  CanvasDocumentV1,
  CanvasElementType,
  CanvasTextAlign,
} from "@/shared/canvas";
import type { CanvasNoteTool } from "@/modules/notes/lib/canvas-editor-types";

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

export type SelectedCanvasStyle = CanvasStyleControlValues & {
  elementType: CanvasElementType;
};

export type FabricInteractionState = {
  visible: boolean;
  selectable: boolean;
  evented: boolean;
};

export type NoteCanvasEditorProps = {
  initialDocument: CanvasDocumentV1 | null;
  initialTool?: CanvasNoteTool;
  apiError?: string;
  externalError?: string | null;
  onDocumentChange: (document: CanvasDocumentV1) => void;
  onError?: (message: string | null) => void;
};
