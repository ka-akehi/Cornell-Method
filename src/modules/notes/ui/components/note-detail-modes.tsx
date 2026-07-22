"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  completeReview,
  deleteNote as deleteRemoteNote,
  NotesRemoteError,
} from "@/modules/notes/remote";
import { normalizeSourceType } from "@/modules/notes/model";
import { AppChromeModeReporter } from "@/shared/ui/app-chrome-state";
import { NoteDetailReviewActions, NoteDetailViewActions } from "./note-detail-actions";
import { NoteEditor } from "./note-editor";
import { NoteDetailReadView } from "./note-detail-read-view";
import type { NoteDetail } from "./note-detail-types";

export type { NoteDetail } from "./note-detail-types";

type Mode = "view" | "edit" | "review";

export type NoteDetailModesProps = {
  initialNote: NoteDetail;
};

export function NoteDetailModes({ initialNote }: NoteDetailModesProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [note, setNote] = useState(initialNote);
  const [showBody, setShowBody] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [reviewNextDate, setReviewNextDate] = useState(initialNote.nextReviewDate ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chromeState =
    mode === "edit" ? null : <AppChromeModeReporter state={mode} />;

  async function submitReview() {
    setReviewing(true);
    setError(null);

    try {
      const data = await completeReview(note.id, {
        nextReviewDate: reviewNextDate || null,
      });

      setNote((current) => ({
        ...current,
        reviewedAt: data?.reviewedAt ?? current.reviewedAt,
        nextReviewDate: data?.nextReviewDate ?? null,
      }));
      setReviewNextDate(data?.nextReviewDate ?? "");
      setShowBody(false);
      setShowSummary(false);
      setMode("view");
      router.refresh();
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setError(caught.message);
        return;
      }
      setError("復習済み更新に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setReviewing(false);
    }
  }

  async function deleteNote() {
    const confirmed = window.confirm("このノートを削除します。よろしいですか？");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteRemoteNote(note.id);
      router.push("/notes");
      router.refresh();
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setError(caught.message);
        return;
      }
      setError("削除に失敗しました。通信状態またはAPIを確認してください。");
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "edit") {
    const editorInitial = {
      ...note,
      noteDate: note.noteDate ?? "",
      sourceType: normalizeSourceType(note.sourceType),
      sourceTitle: note.sourceTitle ?? "",
      bodyMode: note.bodyMode,
      body: note.body ?? "",
      canvas: note.canvas,
      summary: note.summary ?? "",
      nextReviewDate: note.nextReviewDate ?? "",
    };

    return (
      <>
        {chromeState}
        <NoteEditor
          mode="edit"
          shell={true}
          initial={editorInitial}
          onCancel={() => setMode("view")}
          onSaved={(savedNote) => {
            setNote(savedNote);
            setReviewNextDate(savedNote.nextReviewDate ?? "");
            setShowBody(false);
            setShowSummary(false);
            setError(null);
            setMode("view");
          }}
        />
      </>
    );
  }

  return (
    <>
      {chromeState}
      <NoteDetailReadView
        note={note}
        mode={mode}
        error={error}
        showBody={showBody}
        showSummary={showSummary}
        onShowBody={() => setShowBody(true)}
        onHideBody={() => {
          setShowBody(false);
          setShowSummary(false);
        }}
        onShowSummary={() => setShowSummary(true)}
        onHideSummary={() => setShowSummary(false)}
      >
        {mode === "review" ? (
          <NoteDetailReviewActions
            reviewNextDate={reviewNextDate}
            reviewing={reviewing}
            onReviewNextDateChange={setReviewNextDate}
            onSubmitReview={() => void submitReview()}
            onBackToView={() => {
              setError(null);
              setShowBody(false);
              setShowSummary(false);
              setMode("view");
            }}
          />
        ) : (
          <NoteDetailViewActions
            deleting={deleting}
            onEdit={() => setMode("edit")}
            onReview={() => {
              setShowBody(false);
              setShowSummary(false);
              setReviewNextDate(note.nextReviewDate ?? "");
              setMode("review");
            }}
            onDelete={() => void deleteNote()}
          />
        )}
      </NoteDetailReadView>
    </>
  );
}
