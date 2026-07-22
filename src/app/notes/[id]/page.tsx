import Link from "next/link";
import { NoteDetailModes } from "@/modules/notes/ui/components";
import { getNoteDetail } from "@/server/notes/application";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notebook = await getNoteDetail(id);

  if (!notebook) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">ノートが見つかりません</h1>
        <p className="mt-2 text-sm leading-6 text-red-700">
          指定されたノートは削除されたか、取得に失敗しました。
        </p>
        <Link
          href="/notes"
          className="mt-4 inline-flex rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
        >
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="note-paper-page">
      <NoteDetailModes initialNote={notebook} />
    </div>
  );
}
