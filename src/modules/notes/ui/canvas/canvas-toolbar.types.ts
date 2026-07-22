import type { CanvasPageDimensions } from "@/shared/canvas";
import type { CanvasNoteTool } from "@/modules/notes/lib/canvas-editor-types";
import type {
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
} from "./canvas-editor-types";

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
