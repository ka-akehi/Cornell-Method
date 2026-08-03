import Link from "next/link";
import { NoteDetailModes } from "@/modules/notes/ui/components";
import { getNoteDetail } from "@/server/notes/application";

type NoteDetailSearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function NoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<NoteDetailSearchParams>;
}) {
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const notebook = await getNoteDetail(id);

  if (!notebook) {
    return (
      <div className="note-paper-page">
        <section className="note-paper-shell note-paper-content note-paper-detail">
          <div className="note-paper-section min-w-0 !border-t-0 !pt-0">
            <p className="note-paper-kicker">ノート詳細</p>
            <h1 className="note-paper-title text-2xl">ノートが見つかりません</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-muted-ink)]">
              指定されたノートは削除されたか、取得に失敗しました。
            </p>
            <Link
              href="/notes"
              className="mt-5 inline-flex rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50/60"
            >
              一覧へ戻る
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const initialMode =
    typeof mode === "string" && mode === "edit" ? "edit" : "view";

  return (
    <div className="note-paper-page">
      <NoteDetailModes initialNote={notebook} initialMode={initialMode} />
    </div>
  );
}
