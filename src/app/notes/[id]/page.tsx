import { NoteEditor } from "../_components/note-editor";

async function getNotebook(id: string) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const url = base.startsWith("http") ? base : `https://${base}`;
  const res = await fetch(`${url}/api/notes/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function NoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const notebook = await getNotebook(params.id);
  if (!notebook) {
    return <div className="text-sm text-red-600">ノートが見つかりませんでした。</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">ノート編集</h1>
      <NoteEditor
        mode="edit"
        initial={{
          id: notebook.id,
          title: notebook.title,
          overview: notebook.overview ?? "",
          summary: notebook.summary ?? "",
          noteDate: notebook.noteDate?.slice(0, 10),
          tags: notebook.tags?.map((t: any) => ({
            id: t.tag.id,
            name: t.tag.name,
            color: t.tag.color,
          })),
          cues: notebook.cueCards ?? [],
          notes:
            notebook.noteCards?.map((n: any) => ({
              ...n,
              cueIds: n.links?.map((l: any) => l.cueCardId) ?? [],
            })) ?? [],
        }}
        draft={{
          isDraft: notebook.draftState?.isDraft ?? true,
          version: notebook.draftState?.version ?? 0,
          autosaveVersion: notebook.draftState?.autosaveVersion ?? 0,
          hiddenNotes: notebook.draftState?.hiddenNotes ?? [],
        }}
      />
    </div>
  );
}
