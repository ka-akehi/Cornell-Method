type NotesListErrorProps = {
  message: string | null;
};

export function NotesListError({ message }: NotesListErrorProps) {
  if (!message) return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function NotesListLoading() {
  return <div className="px-4 py-8 text-sm text-stone-500">読み込み中...</div>;
}

export function NotesListEmpty() {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-stone-700">
        条件に一致するノートはありません。
      </p>
      <p className="mt-1 text-sm text-stone-500">
        検索条件を変更するか、新規作成から記録を追加してください。
      </p>
    </div>
  );
}
