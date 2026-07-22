export { NoteEditor } from "./note-editor";
export type {
  NoteEditorProps,
  NoteEditorSavedNote,
} from "./note-editor";
export { NoteDetailModes } from "./note-detail-modes";
export type {
  NoteDetailModesProps,
} from "./note-detail-modes";
export type { NoteDetail } from "./note-detail-types";

export { NoteCanvasEditor } from "./note-canvas-editor";
export { NoteCanvasViewer } from "./note-canvas-viewer";
export { NoteCanvasSurface } from "./note-canvas-surface";
export { NoteCanvasToolbar } from "./note-canvas-toolbar";

export type { NoteCanvasEditorProps } from "@/modules/notes/lib/canvas-editor-contract";
export type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
  NoteCanvasToolbarProps,
} from "./note-canvas-toolbar.types";
export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "./note-canvas-toolbar.types";

export type {
  TextAlignmentOption,
  ToolDefinition,
  ToolGroupDefinition,
  ToolbarIconName,
} from "./note-canvas-toolbar-definitions";
export {
  TEXT_ALIGNMENT_OPTIONS,
  TOOL_GROUPS,
  findToolDefinition,
  getToolGroup,
} from "./note-canvas-toolbar-definitions";
export { NotesList } from "./notes-list";
