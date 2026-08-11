"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import {
  completeReview,
  deleteNote as deleteRemoteNote,
  NotesRemoteError,
  updateNote,
} from "@/modules/notes/remote";
import {
  noteDetailToSummaryUpdatePayload,
  normalizeSourceType,
} from "@/modules/notes/model";
import { addDaysToDateString, todayDateString } from "@/shared/date";
import { updateMarkdownTaskMarker } from "@/shared/markdown";
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
type UrlMode = Exclude<Mode, "review">;
type ReviewSuccessFeedback = {
  nextReviewDate: string | null;
};

export type NoteDetailModesProps = {
  initialNote: NoteDetailResponse;
  initialMode?: UrlMode;
};

export function NoteDetailModes({
  initialNote,
  initialMode = "view",
}: NoteDetailModesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [note, setNote] = useState(initialNote);
  const [summaryDraft, setSummaryDraft] = useState(initialNote.summary ?? "");
  const [summarySaving, setSummarySaving] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summarySavingRef = useRef(false);
  const summaryRevisionRef = useRef(0);
  const [showBody, setShowBody] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [bodyConfirmed, setBodyConfirmed] = useState(false);
  const [summaryConfirmed, setSummaryConfirmed] = useState(false);
  const [reviewNextDate, setReviewNextDate] = useState(initialNote.nextReviewDate ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] =
    useState<ReviewSuccessFeedback | null>(null);
  const summaryDirty = summaryDraft !== (note.summary ?? "");

  function replaceModeUrl(nextMode: UrlMode) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (nextMode === "edit") {
      nextSearchParams.set("mode", "edit");
    } else {
      nextSearchParams.delete("mode");
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function discardSummaryDraft(nextSummary = note.summary ?? "") {
    if (summarySavingRef.current) {
      return;
    }

    summaryRevisionRef.current += 1;
    setSummaryDraft(nextSummary);
    setSummaryError(null);
  }

  function handleSummaryTaskToggle(taskIndex: number, checked: boolean) {
    if (summarySavingRef.current) {
      return;
    }

    summaryRevisionRef.current += 1;
    setSummaryDraft((current) =>
      updateMarkdownTaskMarker(current, taskIndex, checked),
    );
    setSummaryError(null);
  }

  async function saveSummary() {
    if (!summaryDirty || summarySavingRef.current) {
      return;
    }

    const saveRevision = summaryRevisionRef.current;
    summarySavingRef.current = true;
    setSummarySaving(true);
    setSummaryError(null);

    try {
      const savedNote = await updateNote(
        note.id,
        noteDetailToSummaryUpdatePayload(note, summaryDraft),
      );

      if (summaryRevisionRef.current !== saveRevision) {
        return;
      }

      setNote(savedNote);
      setSummaryDraft(savedNote.summary ?? "");
      summaryRevisionRef.current += 1;
      setSummaryError(null);
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
    } finally {
      summarySavingRef.current = false;
      setSummarySaving(false);
    }
  }

  function enterEditMode() {
    if (summarySavingRef.current) {
      return;
    }

    discardSummaryDraft();
    setReviewSuccess(null);
    replaceModeUrl("edit");
    setMode("edit");
  }

  function leaveEditMode(nextSummary = note.summary ?? "") {
    if (summarySavingRef.current) {
      return;
    }

    discardSummaryDraft(nextSummary);
    replaceModeUrl("view");
    setMode("view");
  }

  async function submitReview() {
    if (
      summarySavingRef.current ||
      reviewing ||
      !bodyConfirmed ||
      !summaryConfirmed
    ) {
      return;
    }

    const submittedNextReviewDate = reviewNextDate || null;

    setReviewing(true);
    setError(null);
    setReviewSuccess(null);

    try {
      const data = await completeReview(note.id, {
        nextReviewDate: reviewNextDate || null,
      });
      const confirmedNextReviewDate =
        data.nextReviewDate !== undefined
          ? data.nextReviewDate
          : submittedNextReviewDate;

      setNote((current) => ({
        ...current,
        reviewedAt: data?.reviewedAt ?? current.reviewedAt,
        nextReviewDate: data?.nextReviewDate ?? null,
      }));
      setReviewNextDate(data?.nextReviewDate ?? "");
      discardSummaryDraft(note.summary ?? "");
      setShowBody(false);
      setShowSummary(false);
      setBodyConfirmed(false);
      setSummaryConfirmed(false);
      setReviewSuccess({ nextReviewDate: confirmedNextReviewDate });
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
          <NoteDetailEditActions onCancel={() => leaveEditMode()} />
        }
        showCancel={false}
        onCancel={() => leaveEditMode()}
        onSaved={(savedNote) => {
          setNote(savedNote);
          setReviewNextDate(savedNote.nextReviewDate ?? "");
          setSummaryDraft(savedNote.summary ?? "");
          setSummaryError(null);
          setShowBody(false);
          setShowSummary(false);
          setError(null);
          leaveEditMode(savedNote.summary ?? "");
        }}
      />
    );
  }

  return (
    <NoteDetailReadView
      note={note}
      mode={mode}
      error={error}
      summaryDraft={summaryDraft}
      summaryDirty={summaryDirty}
      summarySaving={summarySaving}
      summaryError={summaryError}
      reviewSuccess={reviewSuccess}
      showBody={showBody}
      showSummary={showSummary}
      bodyConfirmed={bodyConfirmed}
      onShowBody={() => {
        if (summarySavingRef.current) {
          return;
        }
        setBodyConfirmed(true);
        setShowBody(true);
      }}
      onHideBody={() => {
        if (summarySavingRef.current) {
          return;
        }
        setShowBody(false);
        setShowSummary(false);
      }}
      onShowSummary={() => {
        if (summarySavingRef.current || !bodyConfirmed) {
          return;
        }
        setSummaryConfirmed(true);
        setShowSummary(true);
      }}
      onHideSummary={() => {
        if (summarySavingRef.current) {
          return;
        }
        setShowSummary(false);
      }}
      onSummaryTaskToggle={handleSummaryTaskToggle}
      onSaveSummary={() => void saveSummary()}
      onDiscardSummary={() => discardSummaryDraft()}
      modeActions={
        mode === "review" ? (
          <NoteDetailReviewModeActions
            disabled={summarySaving}
            onBackToView={() => {
              if (summarySavingRef.current) {
                return;
              }
              discardSummaryDraft();
              setError(null);
              setShowBody(false);
              setShowSummary(false);
              setBodyConfirmed(false);
              setSummaryConfirmed(false);
              setMode("view");
            }}
          />
        ) : (
          <NoteDetailViewActions
            disabled={summarySaving}
            onEdit={enterEditMode}
            onReview={() => {
              if (summarySavingRef.current) {
                return;
              }
              discardSummaryDraft();
              setReviewSuccess(null);
              setShowBody(false);
              setShowSummary(false);
              setBodyConfirmed(false);
              setSummaryConfirmed(false);
              setReviewNextDate(addDaysToDateString(todayDateString(), 7));
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
          disabled={summarySaving}
          reviewConfirmationComplete={bodyConfirmed && summaryConfirmed}
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
