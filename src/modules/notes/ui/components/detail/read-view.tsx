"use client";

import type { ReactNode } from "react";
import type { NoteDetailResponse } from "@/modules/notes/contracts";
import {
  NoteDetailBody,
  NoteDetailCueList,
  NoteDetailHeading,
  NoteDetailMetadata,
  NoteDetailSection,
} from "./display";
import { MarkdownPreview } from "@/shared/markdown";

type ReadMode = "view" | "review";

type NoteDetailReadViewProps = {
  note: NoteDetailResponse;
  mode: ReadMode;
  error: string | null;
  showBody: boolean;
  showSummary: boolean;
  onShowBody: () => void;
  onHideBody: () => void;
  onShowSummary: () => void;
  onHideSummary: () => void;
  modeActions: ReactNode;
  children: ReactNode;
};

export function NoteDetailReadView({
  note,
  mode,
  error,
  showBody,
  showSummary,
  onShowBody,
  onHideBody,
  onShowSummary,
  onHideSummary,
  modeActions,
  children,
}: NoteDetailReadViewProps) {
  return (
    <div className="note-paper-shell note-paper-content note-paper-detail">
      <NoteDetailHeading title={note.title} />

      <NoteDetailMetadata note={note} />

      {modeActions}

      {error && (
        <div
          role="alert"
          className="note-paper-alert rounded-lg border px-4 py-3 text-sm leading-6"
        >
          {error}
        </div>
      )}

      <div className="note-paper-cornell-grid grid min-w-0 gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <NoteDetailSection title="キーワード / 質問">
          <NoteDetailCueList cues={note.cues} />
        </NoteDetailSection>
        <NoteDetailSection title="ノート本文">
          {mode === "review" ? (
            showBody ? (
              <div className="space-y-3">
                <button
                  type="button"
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
              <MarkdownPreview
                value={note.summary ?? ""}
                emptyLabel="サマリーは未入力です。"
              />
              <button
                type="button"
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
                disabled={!showBody}
                onClick={onShowSummary}
                className="mt-3 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {showBody ? "サマリーを表示" : "本文確認後に開く"}
              </button>
            </div>
          )}
        </NoteDetailSection>
      ) : (
        <NoteDetailSection title="Summary / 要約と次の一歩">
          <MarkdownPreview
            value={note.summary ?? ""}
            emptyLabel="サマリーは未入力です。"
          />
        </NoteDetailSection>
      )}

      {children}
    </div>
  );
}
