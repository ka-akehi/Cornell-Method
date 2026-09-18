type NotesListPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function NotesListPagination({
  page,
  totalPages,
  onPageChange,
}: NotesListPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-[var(--app-line)] px-4 py-3 sm:justify-between">
      <button
        type="button"
        className="min-h-10 rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        前へ
      </button>
      <p className="order-[-1] w-full text-center text-sm text-[var(--app-muted-ink)] sm:order-none sm:w-auto">
        {page} / {totalPages}
      </p>
      <button
        type="button"
        className="min-h-10 rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        次へ
      </button>
    </div>
  );
}
