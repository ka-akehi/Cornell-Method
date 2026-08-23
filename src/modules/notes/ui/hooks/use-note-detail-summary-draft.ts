"use client";

import { useEffect, useRef, useState } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import { noteDetailToSummaryUpdatePayload } from "@/modules/notes/model";
import { NotesRemoteError, updateNote } from "@/modules/notes/remote";
import { updateMarkdownTaskMarker } from "@/shared/markdown";
import { registerDesktopDirtyController } from "@/shared/desktop/desktop-close-bridge";

type NoteDetailMode = "view" | "edit" | "review";

type UseNoteDetailSummaryDraftOptions = {
  mode: NoteDetailMode;
  note: NoteDetailResponse;
  onSavedNote: (savedNote: NoteDetailResponse) => void;
};

export function useNoteDetailSummaryDraft({
  mode,
  note,
  onSavedNote,
}: UseNoteDetailSummaryDraftOptions) {
  const [summaryDraft, setSummaryDraft] = useState(note.summary ?? "");
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const noteRef = useRef(note);
  const summaryDraftRef = useRef(note.summary ?? "");
  const summarySavingRef = useRef(false);
  const summaryRevisionRef = useRef(0);
  const summaryDirtyRef = useRef(false);
  const summarySaveRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  const summaryDiscardRef = useRef<() => boolean>(() => false);

  const summaryDirty = summaryDraft !== (note.summary ?? "");
  noteRef.current = note;
  summaryDraftRef.current = summaryDraft;

  function discardSummaryDraft(nextSummary = noteRef.current.summary ?? "") {
    if (summarySavingRef.current) {
      return false;
    }

    summaryRevisionRef.current += 1;
    summaryDraftRef.current = nextSummary;
    setSummaryDraft(nextSummary);
    setSummaryError(null);
    summaryDirtyRef.current = nextSummary !== (noteRef.current.summary ?? "");
    return true;
  }

  function handleSummaryTaskToggle(taskIndex: number, checked: boolean) {
    if (summarySavingRef.current) {
      return;
    }

    summaryRevisionRef.current += 1;
    summaryDirtyRef.current = true;
    const nextSummary = updateMarkdownTaskMarker(
      summaryDraftRef.current,
      taskIndex,
      checked,
    );
    summaryDraftRef.current = nextSummary;
    setSummaryDraft(nextSummary);
    setSummaryError(null);
  }

  async function saveSummary(): Promise<boolean> {
    if (!summaryDirtyRef.current) {
      return true;
    }
    if (summarySavingRef.current) {
      return false;
    }

    const saveRevision = summaryRevisionRef.current;
    summarySavingRef.current = true;
    setSummarySaving(true);
    setSummaryError(null);

    try {
      const savedNote = await updateNote(
        noteRef.current.id,
        noteDetailToSummaryUpdatePayload(
          noteRef.current,
          summaryDraftRef.current,
        ),
      );

      if (summaryRevisionRef.current !== saveRevision) {
        return false;
      }

      noteRef.current = savedNote;
      summaryDraftRef.current = savedNote.summary ?? "";
      setSummaryDraft(savedNote.summary ?? "");
      summaryRevisionRef.current += 1;
      setSummaryError(null);
      summaryDirtyRef.current = false;
      onSavedNote(savedNote);
      return true;
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setSummaryError(caught.message);
      } else if (caught instanceof Error) {
        setSummaryError(caught.message);
      } else {
        setSummaryError(
          "サマリーの保存に失敗しました。通信状態またはAPIを確認してください。",
        );
      }
      return false;
    } finally {
      summarySavingRef.current = false;
      setSummarySaving(false);
    }
  }

  function acceptSavedNote(savedNote: NoteDetailResponse) {
    if (summarySavingRef.current) {
      return false;
    }

    noteRef.current = savedNote;
    summaryDraftRef.current = savedNote.summary ?? "";
    summaryRevisionRef.current += 1;
    summaryDirtyRef.current = false;
    setSummaryDraft(savedNote.summary ?? "");
    setSummaryError(null);
    onSavedNote(savedNote);
    return true;
  }

  summaryDirtyRef.current = summaryDirty;
  summarySaveRef.current = saveSummary;
  summaryDiscardRef.current = discardSummaryDraft;

  useEffect(() => {
    if (mode === "edit") {
      return;
    }

    return registerDesktopDirtyController({
      isDirty: () => summaryDirtyRef.current,
      save: () => summarySaveRef.current(),
      discard: () => summaryDiscardRef.current(),
    });
  }, [mode]);

  return {
    summaryDraft,
    summaryDirty,
    summarySaving,
    summaryError,
    handleSummaryTaskToggle,
    saveSummary,
    discardSummaryDraft,
    isSummarySaving: () => summarySavingRef.current,
    acceptSavedNote,
  };
}
