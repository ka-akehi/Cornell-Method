import type {
  NoteDetailResponse,
  NotebookInput,
} from "@/modules/notes/contracts";
import { cloneCanvasDocument } from "@/shared/canvas";
import { normalizeSourceType } from "./note-display";

/**
 * Rebuild the existing Notebook PATCH contract for a detail Summary save.
 * Only summary is replaced; all other fields come from the saved detail note.
 */
export function noteDetailToSummaryUpdatePayload(
  note: NoteDetailResponse,
  summary: string,
): NotebookInput {
  if (!note.noteDate) {
    throw new Error("学習日がないノートはサマリーを保存できません。");
  }

  const sourceType = normalizeSourceType(note.sourceType);

  if (note.sourceType !== null && sourceType === null) {
    throw new Error(
      "このノートの学習元種別には対応していない値が保存されています。サマリーを保存する前にデータを確認してください。",
    );
  }

  const common = {
    title: note.title,
    noteDate: note.noteDate,
    sourceType: sourceType ?? undefined,
    sourceTitle: note.sourceTitle,
    summary,
    nextReviewDate: note.nextReviewDate,
    cues: note.cues.map((cue) => ({
      id: cue.id,
      text: cue.text,
      order: cue.order,
    })),
    tags: note.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
  };

  if (note.bodyMode === "canvas") {
    if (!note.canvas) {
      throw new Error("Canvas documentがないノートはサマリーを保存できません。");
    }

    return {
      ...common,
      bodyMode: "canvas",
      body: "",
      canvas: cloneCanvasDocument(note.canvas),
    };
  }

  return {
    ...common,
    bodyMode: "markdown",
    body: note.body ?? "",
  };
}
