import { todayDateString } from "@/shared/date";
import type { SourceType } from "./note-editor-form";

export type ReviewStatusDisplay = {
  label: string;
  className: string;
};

type ReviewStatusNote = {
  nextReviewDate: string | null;
  reviewedAt: string | null;
};

const sourceTypes = ["book", "lecture", "video", "article", "other"] as const;

const sourceTypeLabels: Record<string, string> = {
  book: "書籍",
  lecture: "講義",
  video: "動画",
  article: "記事",
  other: "その他",
};

export function normalizeSourceType(value: string | null): SourceType | null {
  return sourceTypes.some((sourceType) => sourceType === value)
    ? (value as SourceType)
    : null;
}

export function formatDate(
  value: string | null,
  options: { dateOnly?: boolean } = {},
) {
  if (!value) return "未設定";
  return options.dateOnly ? value.slice(0, 10) : value;
}

export function formatDateTime(value: string | null) {
  if (!value) return "未記録";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatSource(
  type: string | null,
  title: string | null,
  options: { trimTitle?: boolean } = {},
) {
  const typeLabel = type ? (sourceTypeLabels[type] ?? type) : "学習元未設定";
  if (options.trimTitle) {
    const rawTitle = title ?? "";
    return rawTitle.trim() ? `${typeLabel}: ${rawTitle}` : typeLabel;
  }
  return title ? `${typeLabel}: ${title}` : typeLabel;
}

export function isDateRangeInvalid(from: string, to: string) {
  return Boolean(from && to && from > to);
}

export function getReviewStatus(
  note: ReviewStatusNote,
  today = todayDateString(),
): ReviewStatusDisplay {
  if (note.reviewedAt && !note.nextReviewDate) {
    return {
      label: "復習済み",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (!note.nextReviewDate) {
    return {
      label: "復習予定なし",
      className: "border-stone-200 bg-stone-50 text-stone-600",
    };
  }

  if (note.nextReviewDate <= today) {
    return {
      label: `復習期限到来: ${formatDate(note.nextReviewDate, { dateOnly: true })}`,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: `復習予定日: ${formatDate(note.nextReviewDate, { dateOnly: true })}`,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  };
}
