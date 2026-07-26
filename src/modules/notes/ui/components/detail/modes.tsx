"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import {
  completeReview,
  deleteNote as deleteRemoteNote,
  NotesRemoteError,
} from "@/modules/notes/remote";
import { normalizeSourceType } from "@/modules/notes/model";
import {
  NoteDetailEditActions,
  NoteDetailReviewActions,
  NoteDetailReviewModeActions,
  NoteDetailViewActions,
  NoteDetailViewFooterActions,
} from "./actions";
import { NoteEditor } from "../editor/editor";
import { NoteDetailReadView } from "./read-view";

type Mode = "view" | "edit" | "review";

export type NoteDetailModesProps = {
  initialNote: NoteDetailResponse;
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
      <NoteEditor
        mode="edit"
        shell={true}
        initial={editorInitial}
        topActions={
          <NoteDetailEditActions onCancel={() => setMode("view")} />
        }
        showCancel={false}
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
    );
  }

  return (
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
      modeActions={
        mode === "review" ? (
          <NoteDetailReviewModeActions
            onBackToView={() => {
              setError(null);
              setShowBody(false);
              setShowSummary(false);
              setMode("view");
            }}
          />
        ) : (
          <NoteDetailViewActions
            onEdit={() => setMode("edit")}
            onReview={() => {
              setShowBody(false);
              setShowSummary(false);
              setReviewNextDate(note.nextReviewDate ?? "");
              setMode("review");
            }}
          />
        )
      }
    >
      {mode === "review" ? (
        <NoteDetailReviewActions
          reviewNextDate={reviewNextDate}
          reviewing={reviewing}
          onReviewNextDateChange={setReviewNextDate}
          onSubmitReview={() => void submitReview()}
        />
      ) : (
        <NoteDetailViewFooterActions
          deleting={deleting}
          onDelete={() => void deleteNote()}
        />
      )}
    </NoteDetailReadView>
  );
}
