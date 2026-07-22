export { NoteEditor } from "./editor/editor";
export type {
  NoteEditorProps,
  NoteEditorSavedNote,
} from "./editor/editor";
export { NoteDetailModes } from "./detail/modes";
export type {
  NoteDetailModesProps,
} from "./detail/modes";
export type { NoteDetailResponse as NoteDetail } from "@/modules/notes/remote";

export { NoteCanvasEditor } from "./canvas/editor";
export { NoteCanvasViewer } from "./canvas/viewer";
export { NoteCanvasSurface } from "./canvas/surface";
export { NoteCanvasToolbar } from "./canvas/toolbar";

export type { NoteCanvasEditorProps } from "@/modules/notes/lib/canvas-editor-contract";
export type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
  NoteCanvasToolbarProps,
} from "@/modules/notes/model/canvas-toolbar.types";
export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "@/modules/notes/model/canvas-toolbar.types";

export type {
  TextAlignmentOption,
  ToolDefinition,
  ToolGroupDefinition,
  ToolbarIconName,
} from "@/modules/notes/model/canvas-toolbar-definitions";
export {
  TEXT_ALIGNMENT_OPTIONS,
  TOOL_GROUPS,
  findToolDefinition,
  getToolGroup,
} from "@/modules/notes/model/canvas-toolbar-definitions";
export { NotesList } from "./list/list";
