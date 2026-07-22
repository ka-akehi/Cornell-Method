export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "./canvas-editor-types";
export type {
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
  FabricInteractionState,
  NoteCanvasEditorProps,
  SelectedCanvasStyle,
} from "./canvas-editor-types";
export type {
  CanvasNoteTool,
  CanvasStyleDefaults,
  DragDraft,
  Point,
  ShapeCanvasElement,
} from "@/modules/notes/lib/canvas-editor-types";

export type {
  CanvasRuntimeOptions,
  CanvasRuntimeResult,
  RuntimeRef,
} from "./canvas-runtime-types";

export {
  TEXT_ALIGNMENT_OPTIONS,
  TOOL_GROUPS,
  findToolDefinition,
  getToolGroup,
} from "./canvas-toolbar-definitions";
export type {
  TextAlignmentOption,
  ToolDefinition,
  ToolGroupDefinition,
  ToolbarIconName,
} from "./canvas-toolbar-definitions";
export type { NoteCanvasToolbarProps } from "./canvas-toolbar.types";

export {
  DEFAULT_FONT_FAMILY,
  DEFAULT_STROKE_COLOR,
  DEFAULT_TEXT_COLOR,
  INITIAL_STYLE_DEFAULTS,
  applyFabricStyleChange,
  getDrawingStyleTarget,
  isCanvasTextAlign,
  isColorInputValue,
  isEditingStandaloneText,
  readFabricInteractionState,
  readFabricString,
  readSelectedCanvasStyle,
  shapeTextStyleForEditing,
  textStylesEqual,
} from "./fabric-style-bridge";
