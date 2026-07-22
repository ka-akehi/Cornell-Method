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
    <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
      <button
        type="button"
        className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        前へ
      </button>
      <p className="text-sm text-stone-500">
        {page} / {totalPages}
      </p>
      <button
        type="button"
        className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        次へ
      </button>
    </div>
  );
}
