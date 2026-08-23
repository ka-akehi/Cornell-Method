"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import {
  completeReview,
  deleteNote as deleteRemoteNote,
  NotesRemoteError,
} from "@/modules/notes/remote";
import { normalizeSourceType } from "@/modules/notes/model";
import { addDaysToDateString, todayDateString } from "@/shared/date";
import { registerDesktopDirtyController } from "@/shared/desktop/desktop-close-bridge";
import { useNoteDetailSummaryDraft } from "@/modules/notes/ui/hooks/use-note-detail-summary-draft";
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

type InFlightReviewCompletionRef = {
  current: Promise<boolean> | null;
};

function shareInFlightReviewCompletion(
  inFlightCompletionRef: InFlightReviewCompletionRef,
  complete: () => Promise<boolean>,
): Promise<boolean> {
  if (inFlightCompletionRef.current) {
    return inFlightCompletionRef.current;
  }

  const nextCompletion = complete();
  inFlightCompletionRef.current = nextCompletion;
  const clearInFlightCompletion = () => {
    if (inFlightCompletionRef.current === nextCompletion) {
      inFlightCompletionRef.current = null;
    }
  };
  void nextCompletion.then(clearInFlightCompletion, clearInFlightCompletion);
  return nextCompletion;
}

export function NoteDetailModes({
  initialNote,
  initialMode = "view",
}: NoteDetailModesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [note, setNote] = useState(initialNote);
  const {
    summaryDraft,
    summaryDirty,
    summarySaving,
    summaryError,
    handleSummaryTaskToggle,
    saveSummary,
    discardSummaryDraft,
    isSummarySaving,
    acceptSavedNote,
  } = useNoteDetailSummaryDraft({
    mode,
    note,
    onSavedNote: (savedNote) =>
      setNote((current) =>
        mode === "edit"
          ? savedNote
          : {
              ...savedNote,
              reviewedAt: current.reviewedAt,
              nextReviewDate: current.nextReviewDate,
            },
      ),
  });
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
  const reviewNextDateRef = useRef(initialNote.nextReviewDate ?? "");
  const reviewBaselineRef = useRef("");
  const reviewDateDirtyRef = useRef(false);
  const reviewCompletionInFlightRef = useRef<Promise<boolean> | null>(null);
  const reviewSaveRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  const reviewDiscardRef = useRef<() => boolean>(() => false);
  const reviewingRef = useRef(false);
  const bodyConfirmedRef = useRef(false);
  const summaryConfirmedRef = useRef(false);

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

  function enterEditMode() {
    if (isSummarySaving()) {
      return;
    }

    discardSummaryDraft();
    setReviewSuccess(null);
    replaceModeUrl("edit");
    setMode("edit");
  }

  function leaveEditMode(nextSummary = note.summary ?? "") {
    if (isSummarySaving()) {
      return;
    }

    discardSummaryDraft(nextSummary);
    replaceModeUrl("view");
    setMode("view");
  }

  async function performReviewCompletion(
    submittedNextReviewDate: string | null,
  ): Promise<boolean> {
    if (!bodyConfirmedRef.current || !summaryConfirmedRef.current) {
      return false;
    }

    reviewingRef.current = true;
    setReviewing(true);
    setError(null);
    setReviewSuccess(null);

    try {
      const data = await completeReview(note.id, {
        nextReviewDate: submittedNextReviewDate,
      });
      const confirmedNextReviewDate =
        data.nextReviewDate !== undefined
          ? data.nextReviewDate
          : submittedNextReviewDate;

      setNote((current) => ({
        ...current,
        reviewedAt: data?.reviewedAt ?? current.reviewedAt,
        nextReviewDate: confirmedNextReviewDate,
      }));
      reviewBaselineRef.current = confirmedNextReviewDate ?? "";
      reviewNextDateRef.current = confirmedNextReviewDate ?? "";
      reviewDateDirtyRef.current = false;
      setReviewNextDate(confirmedNextReviewDate ?? "");
      discardSummaryDraft();
      setShowBody(false);
      setShowSummary(false);
      setBodyConfirmed(false);
      setSummaryConfirmed(false);
      bodyConfirmedRef.current = false;
      summaryConfirmedRef.current = false;
      setReviewSuccess({ nextReviewDate: confirmedNextReviewDate });
      setMode("view");
      router.refresh();
      return true;
    } catch (caught) {
      if (caught instanceof NotesRemoteError) {
        setError(caught.message);
        return false;
      }
      setError("復習済み更新に失敗しました。通信状態またはAPIを確認してください。");
      return false;
    } finally {
      reviewingRef.current = false;
      setReviewing(false);
    }
  }

  async function saveReviewDateForClose(): Promise<boolean> {
    if (reviewCompletionInFlightRef.current) {
      return reviewCompletionInFlightRef.current;
    }
    if (!reviewDateDirtyRef.current) {
      return true;
    }
    if (!bodyConfirmedRef.current || !summaryConfirmedRef.current) {
      return false;
    }

    return shareInFlightReviewCompletion(
      reviewCompletionInFlightRef,
      () => performReviewCompletion(reviewNextDateRef.current || null),
    );
  }

  function discardReviewDateDraft(): boolean {
    if (reviewCompletionInFlightRef.current || reviewingRef.current) {
      return false;
    }

    const baseline = reviewBaselineRef.current;
    reviewNextDateRef.current = baseline;
    reviewDateDirtyRef.current = false;
    setReviewNextDate(baseline);
    return true;
  }

  useEffect(() => {
    reviewSaveRef.current = saveReviewDateForClose;
    reviewDiscardRef.current = discardReviewDateDraft;
  });

  useEffect(() => {
    if (mode !== "review") {
      return;
    }

    return registerDesktopDirtyController({
      isDirty: () => reviewDateDirtyRef.current,
      save: () =>
        reviewCompletionInFlightRef.current ?? reviewSaveRef.current(),
      discard: () => reviewDiscardRef.current(),
    });
  }, [mode]);

  async function submitReview() {
    if (
      isSummarySaving() ||
      reviewing ||
      reviewingRef.current ||
      !bodyConfirmed ||
      !summaryConfirmed
    ) {
      return;
    }

    const submittedNextReviewDate = reviewNextDate || null;

    return shareInFlightReviewCompletion(
      reviewCompletionInFlightRef,
      () => performReviewCompletion(submittedNextReviewDate),
    );
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
          acceptSavedNote(savedNote);
          reviewNextDateRef.current = savedNote.nextReviewDate ?? "";
          reviewDateDirtyRef.current = false;
          setReviewNextDate(savedNote.nextReviewDate ?? "");
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
        if (isSummarySaving()) {
          return;
        }
        bodyConfirmedRef.current = true;
        setBodyConfirmed(true);
        setShowBody(true);
      }}
      onHideBody={() => {
        if (isSummarySaving()) {
          return;
        }
        setShowBody(false);
        setShowSummary(false);
      }}
      onShowSummary={() => {
        if (isSummarySaving() || !bodyConfirmed) {
          return;
        }
        summaryConfirmedRef.current = true;
        setSummaryConfirmed(true);
        setShowSummary(true);
      }}
      onHideSummary={() => {
        if (isSummarySaving()) {
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
              if (isSummarySaving()) {
                return;
              }
              discardSummaryDraft();
              setError(null);
              setShowBody(false);
              setShowSummary(false);
              setBodyConfirmed(false);
              setSummaryConfirmed(false);
              bodyConfirmedRef.current = false;
              summaryConfirmedRef.current = false;
              reviewDateDirtyRef.current = false;
              setMode("view");
            }}
          />
        ) : (
          <NoteDetailViewActions
            disabled={summarySaving}
            onEdit={enterEditMode}
            onReview={() => {
              if (isSummarySaving()) {
                return;
              }
              discardSummaryDraft();
              setReviewSuccess(null);
              setShowBody(false);
              setShowSummary(false);
              setBodyConfirmed(false);
              setSummaryConfirmed(false);
              bodyConfirmedRef.current = false;
              summaryConfirmedRef.current = false;
              const reviewBaseline = addDaysToDateString(todayDateString(), 7);
              reviewBaselineRef.current = reviewBaseline;
              reviewNextDateRef.current = reviewBaseline;
              reviewDateDirtyRef.current = false;
              setReviewNextDate(reviewBaseline);
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
          onReviewNextDateChange={(value) => {
            reviewNextDateRef.current = value;
            reviewDateDirtyRef.current =
              value !== reviewBaselineRef.current;
            setReviewNextDate(value);
          }}
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
