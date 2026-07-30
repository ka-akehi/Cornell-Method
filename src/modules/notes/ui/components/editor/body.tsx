"use client";

import { MarkdownField } from "@/shared/markdown";
import type { ApiFieldError } from "@/shared/http/client";
import type { CanvasNoteTool } from "@/modules/notes/lib/canvas-editor-types";
import { fieldError, type NoteEditorFormState } from "@/modules/notes/model";
import { NoteCanvasEditor } from "../canvas/editor";

export function NoteEditorBodySection({
  initialTool,
  bodyMode,
  body,
  canvas,
  fieldErrors,
  canvasError,
  onBodyChange,
  onCanvasDocumentChange,
  onCanvasError,
}: {
  initialTool: CanvasNoteTool;
  bodyMode: NoteEditorFormState["bodyMode"];
  body: string;
  canvas: NoteEditorFormState["canvas"];
  fieldErrors: ApiFieldError[];
  canvasError: string | null;
  onBodyChange: (body: string) => void;
  onCanvasDocumentChange: (canvas: NoteEditorFormState["canvas"]) => void;
  onCanvasError: (error: string | null) => void;
}) {
  return (
    <div className="min-w-0 max-[640px]:!pl-0 max-[640px]:!pt-5">
      {bodyMode === "canvas" ? (
        <div className="note-canvas-field">
          <div className="note-canvas-field-heading">
            <h3>ノート本文</h3>
          </div>
          <NoteCanvasEditor
            initialDocument={canvas}
            initialTool={initialTool}
            apiError={fieldError(fieldErrors, "canvas")}
            externalError={canvasError}
            onDocumentChange={onCanvasDocumentChange}
            onError={onCanvasError}
          />
        </div>
      ) : (
        <MarkdownField
          id="body"
          label="ノート本文"
          value={body}
          onChange={onBodyChange}
          rows={12}
          layout="stacked"
          preview="visible"
          error={fieldError(fieldErrors, "body")}
          placeholder="本文を Markdown で入力"
          previewEmptyLabel="本文のプレビューはまだありません。"
          textareaClassName="!rounded-none !border-0 !border-b !bg-transparent !px-0 !shadow-none focus:!ring-0"
        />
      )}
    </div>
  );
}
