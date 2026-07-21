import Link from "next/link";
import { formatDate, formatSource, getReviewStatus } from "@/modules/notes/model";
import type { NotebookListItem } from "@/modules/notes/remote";

type NotesListCardProps = {
  note: NotebookListItem;
};

export function NotesListCard({ note }: NotesListCardProps) {
  const reviewStatus = getReviewStatus(note);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="block px-4 py-4 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
    >
      <article className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-stone-900">
              {note.title}
            </h3>
          </div>
          <div className="shrink-0 text-right text-sm text-stone-500">
            <div>学習日</div>
            <div className="font-medium text-stone-800">
              {formatDate(note.noteDate, { dateOnly: true })}
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-stone-600 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <p className="min-w-0 truncate">
            学習元:{" "}
            {formatSource(note.sourceType, note.sourceTitle, {
              trimTitle: true,
            })}
          </p>
          <p>Cue {note.cueCount}件</p>
          <p>{note.hasSummary ? "要約あり" : "要約未作成"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {note.tags.length > 0 ? (
            note.tags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-full rounded-full px-2.5 py-1 text-xs font-medium text-stone-800"
                style={{ backgroundColor: tag.color ?? "#fef3c7" }}
              >
                <span className="inline-block max-w-[12rem] truncate align-bottom">
                  {tag.name}
                </span>
              </span>
            ))
          ) : (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
              タグなし
            </span>
          )}
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${reviewStatus.className}`}
          >
            {reviewStatus.label}
          </span>
        </div>
      </article>
    </Link>
  );
}
