"use client";

import type { ReactNode } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import { formatDate } from "@/modules/notes/model";
import {
  NoteDetailBody,
  NoteDetailCueList,
  NoteDetailHeading,
  NoteDetailMetadata,
  NoteDetailSection,
} from "./display";
import { MarkdownReadView } from "@/shared/markdown";
import { NoteDetailSummaryActions } from "./actions";

type ReadMode = "view" | "review";
type ReviewSuccessFeedback = {
  nextReviewDate: string | null;
};

type NoteDetailReadViewProps = {
  note: NoteDetailResponse;
  mode: ReadMode;
  error: string | null;
  summaryDraft: string;
  summaryDirty: boolean;
  summarySaving: boolean;
  summaryError: string | null;
  reviewSuccess: ReviewSuccessFeedback | null;
  showBody: boolean;
  showSummary: boolean;
  bodyConfirmed: boolean;
  onShowBody: () => void;
  onHideBody: () => void;
  onShowSummary: () => void;
  onHideSummary: () => void;
  onSummaryTaskToggle: (taskIndex: number, checked: boolean) => void;
  onSaveSummary: () => void;
  onDiscardSummary: () => void;
  modeActions: ReactNode;
  children: ReactNode;
};

export function NoteDetailReadView({
  note,
  mode,
  error,
  summaryDraft,
  summaryDirty,
  summarySaving,
  summaryError,
  reviewSuccess,
  showBody,
  showSummary,
  bodyConfirmed,
  onShowBody,
  onHideBody,
  onShowSummary,
  onHideSummary,
  onSummaryTaskToggle,
  onSaveSummary,
  onDiscardSummary,
  modeActions,
  children,
}: NoteDetailReadViewProps) {
  return (
    <div className="note-paper-shell note-paper-content note-paper-detail">
      <section className="note-paper-section note-paper-metadata-section min-w-0 !space-y-0 !p-0">
        <NoteDetailHeading
          title={note.title}
          actions={modeActions}
        />

        <NoteDetailMetadata note={note} />
      </section>

      {reviewSuccess && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          <p className="font-semibold">復習済みにしました。</p>
          <p>次回復習日: {formatDate(reviewSuccess.nextReviewDate)}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="note-paper-alert rounded-lg border px-4 py-3 text-sm leading-6"
        >
          {error}
        </div>
      )}

      <div className="note-paper-cornell-grid grid w-full min-w-0 gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <NoteDetailSection title="Cue / キーワード">
          <NoteDetailCueList cues={note.cues} />
        </NoteDetailSection>
        <NoteDetailSection title="ノート本文">
          {mode === "review" ? (
            showBody ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={summarySaving}
                  onClick={onHideBody}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                >
                  本文を隠す
                </button>
                <NoteDetailBody note={note} />
              </div>
            ) : (
              <div className="border border-dashed border-stone-300/80 bg-transparent px-4 py-4">
                <p className="text-sm leading-6 text-stone-600">
                  本文は非表示です。Cue を手がかりに思い出してから表示してください。
                </p>
                <button
                  type="button"
                  disabled={summarySaving}
                  onClick={onShowBody}
                  className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  本文を表示
                </button>
              </div>
            )
          ) : (
            <NoteDetailBody note={note} />
          )}
        </NoteDetailSection>
      </div>

      {mode === "review" ? (
        <NoteDetailSection title="Summary / 要約と次の一歩">
          {showSummary ? (
            <div className="space-y-3">
              <MarkdownReadView
                value={summaryDraft}
                emptyLabel="サマリーは未入力です。"
                onTaskToggle={onSummaryTaskToggle}
                taskToggleDisabled={summarySaving}
              />
              <button
                type="button"
                disabled={summarySaving}
                onClick={onHideSummary}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                サマリーを隠す
              </button>
            </div>
          ) : (
            <div className="border border-dashed border-stone-300/80 bg-transparent px-4 py-4">
              <p className="text-sm leading-6 text-stone-600">
                サマリーは本文確認後に開きます。まず Cue と本文で答え合わせをしてください。
              </p>
              <button
                type="button"
                disabled={!bodyConfirmed || summarySaving}
                onClick={onShowSummary}
                className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {bodyConfirmed ? "サマリーを表示" : "本文確認後に開く"}
              </button>
            </div>
          )}
          <NoteDetailSummaryActions
            dirty={summaryDirty}
            saving={summarySaving}
            error={summaryError}
            onSave={onSaveSummary}
            onDiscard={onDiscardSummary}
          />
        </NoteDetailSection>
      ) : (
        <NoteDetailSection title="Summary / 要約と次の一歩">
          <MarkdownReadView
            value={summaryDraft}
            emptyLabel="サマリーは未入力です。"
            onTaskToggle={onSummaryTaskToggle}
            taskToggleDisabled={summarySaving}
          />
          <NoteDetailSummaryActions
            dirty={summaryDirty}
            saving={summarySaving}
            error={summaryError}
            onSave={onSaveSummary}
            onDiscard={onDiscardSummary}
          />
        </NoteDetailSection>
      )}

      {children}
    </div>
  );
}
