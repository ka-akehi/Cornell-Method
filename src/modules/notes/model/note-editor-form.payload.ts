import { cloneCanvasDocument } from "@/shared/canvas";
import type { NotebookInput } from "@/modules/notes/contracts";
import type { NoteEditorFormState } from "./note-editor-form.types";

export function noteEditorFormToPayload(
  form: NoteEditorFormState,
): NotebookInput {
  const common = {
    title: form.title,
    noteDate: form.noteDate,
    sourceType: form.sourceType || undefined,
    sourceTitle: form.sourceTitle,
    summary: form.summary,
    nextReviewDate: form.nextReviewDate || null,
    cues: form.cues
      .map((cue, index) => ({
        id: cue.id,
        text: cue.text.trim(),
        order: index,
      }))
      .filter((cue) => cue.text.length > 0),
    tags: form.tags.map((tag) => ({
      id: tag.id,
      name: tag.name.trim(),
      color: tag.color ?? null,
    })),
  };

  if (form.bodyMode === "canvas") {
    if (!form.canvas) {
      throw new Error("Canvas documentを読み込めないため保存できません。");
    }

    return {
      ...common,
      bodyMode: "canvas",
      body: "",
      canvas: cloneCanvasDocument(form.canvas),
    };
  }

  return {
    ...common,
    bodyMode: "markdown",
    body: form.body,
  };
}
