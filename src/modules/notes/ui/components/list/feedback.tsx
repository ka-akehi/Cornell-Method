type NotesListErrorProps = {
  message: string | null;
};

export function NotesListError({ message }: NotesListErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-[0.45rem] border border-[var(--paper-danger)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--paper-danger)]"
    >
      {message}
    </div>
  );
}

export function NotesListLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-10 text-sm text-[var(--app-muted-ink)]"
    >
      読み込み中...
    </div>
  );
}

export function NotesListEmpty() {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-[var(--app-ink)]">
        条件に一致するノートはありません。
      </p>
      <p className="mt-1 text-sm text-[var(--app-muted-ink)]">
        検索条件を変更するか、新規作成から記録を追加してください。
      </p>
    </div>
  );
}
