import Link from "next/link";
import { formatDate, formatSource, getReviewStatus } from "@/modules/notes/model";
import type { NotebookListItem } from "@/modules/notes/contracts";
import { todayDateString } from "@/shared/date";

type NotesListCardProps = {
  note: NotebookListItem;
};

function getReviewBadgeClassName(note: NotebookListItem) {
  if (note.nextReviewDate && note.nextReviewDate <= todayDateString()) {
    return "border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent-deep)]";
  }

  if (note.nextReviewDate) {
    return "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-ink)]";
  }

  return "border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-muted-ink)]";
}

export function NotesListCard({ note }: NotesListCardProps) {
  const reviewStatus = getReviewStatus(note);
  const reviewBadgeClassName = getReviewBadgeClassName(note);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="block min-w-0 px-4 py-4 transition-colors hover:bg-[var(--app-accent-soft)] focus-visible:bg-[var(--app-accent-soft)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-[-2px]"
    >
      <article className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-[var(--app-ink)]">
              {note.title}
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 text-left text-xs text-[var(--app-muted-ink)] sm:block sm:text-right">
            <div>学習日</div>
            <div className="font-medium text-[var(--app-ink)]">
              {formatDate(note.noteDate, { dateOnly: true })}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-x-4 gap-y-1.5 text-sm text-[var(--app-muted-ink)] md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <p className="min-w-0 truncate">
            学習元:{" "}
            {formatSource(note.sourceType, note.sourceTitle, {
              trimTitle: true,
            })}
          </p>
          <p className="whitespace-nowrap">Cue {note.cueCount}件</p>
          <p className="whitespace-nowrap">
            {note.hasSummary ? "要約あり" : "要約未作成"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {note.tags.length > 0 ? (
            note.tags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-full rounded-full border border-[var(--app-line)] px-2.5 py-1 text-xs font-medium text-[var(--app-ink)]"
                style={{ backgroundColor: tag.color ?? "var(--app-accent-soft)" }}
              >
                <span className="inline-block max-w-[12rem] truncate align-bottom">
                  {tag.name}
                </span>
              </span>
            ))
          ) : (
            <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface)] px-2.5 py-1 text-xs font-medium text-[var(--app-muted-ink)]">
              タグなし
            </span>
          )}
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${reviewBadgeClassName}`}
          >
            {reviewStatus.label}
          </span>
        </div>
      </article>
    </Link>
  );
}
