export { NoteEditor } from "./editor/note-editor";
export type {
  NoteEditorProps,
  NoteEditorSavedNote,
} from "./editor/note-editor";
export { NoteDetailModes } from "./detail/note-detail-modes";
export type {
  NoteDetailModesProps,
} from "./detail/note-detail-modes";
export type { NoteDetail } from "./detail/note-detail-types";

export { NoteCanvasEditor } from "./canvas/note-canvas-editor";
export { NoteCanvasViewer } from "./canvas/note-canvas-viewer";
export { NoteCanvasSurface } from "./canvas/note-canvas-surface";
export { NoteCanvasToolbar } from "./canvas/note-canvas-toolbar";

export type { NoteCanvasEditorProps } from "@/modules/notes/lib/canvas-editor-contract";
export type {
  CanvasNoteTool,
  CanvasStyleChange,
  CanvasStyleControlValues,
  CanvasStyleTarget,
  NoteCanvasToolbarProps,
} from "./canvas/note-canvas-toolbar.types";
export {
  CANVAS_DEFAULT_FONT_SIZE,
  CANVAS_DEFAULT_STROKE_WIDTH,
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
} from "./canvas/note-canvas-toolbar.types";

export type {
  TextAlignmentOption,
  ToolDefinition,
  ToolGroupDefinition,
  ToolbarIconName,
} from "./canvas/note-canvas-toolbar-definitions";
export {
  TEXT_ALIGNMENT_OPTIONS,
  TOOL_GROUPS,
  findToolDefinition,
  getToolGroup,
} from "./canvas/note-canvas-toolbar-definitions";
export { NotesList } from "./list/notes-list";
