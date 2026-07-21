import type { CanvasPageDimensions } from "@/shared/canvas";
import type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
} from "../_lib/canvas-editor-contract";

export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "../_lib/canvas-editor-contract";
export type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
} from "../_lib/canvas-editor-contract";

export type NoteCanvasToolbarProps = {
  tool: CanvasNoteTool;
  onToolChange: (tool: CanvasNoteTool) => void;
  pageDimensions: CanvasPageDimensions;
  onPageDimensionsChange: (dimensions: CanvasPageDimensions) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  styleTarget: CanvasStyleTarget;
  styleValues: CanvasStyleControlValues;
  onStyleChange: (change: CanvasStyleChange) => void;
};
