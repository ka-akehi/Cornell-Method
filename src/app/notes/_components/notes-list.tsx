"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NotebookListItem = {
  id: string;
  title: string;
  overview: string;
  noteDate: string;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type Response = {
  page: number;
  totalPages: number;
  totalCount: number;
  data: NotebookListItem[];
};

export default function NotesList() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(page = 1) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(page));
    try {
      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    if (!from || !to) return;
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    const res = await fetch(`/api/notes/export?${params.toString()}`);
    if (!res.ok) {
      setError("エクスポートに失敗しました");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-900">ノート一覧</h1>
          <p className="text-sm text-stone-500">
            タイトル/概要で検索し、日付で絞り込みできます。
          </p>
        </div>
        <Link
          href="/notes/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          新規ノート
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-stone-500">クエリ</label>
          <input
            className="w-full rounded border border-stone-200 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-stone-500">開始日</label>
          <input
            type="date"
            className="rounded border border-stone-200 px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-stone-500">終了日</label>
          <input
            type="date"
            className="rounded border border-stone-200 px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
            onClick={() => load(1)}
          >
            検索
          </button>
          <button
            className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700"
            disabled={!from || !to}
            onClick={handleExport}
          >
            PDF出力
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {loading && <p className="text-sm text-stone-500">読み込み中...</p>}
        <ul className="divide-y divide-stone-100">
          {data?.data.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/notes/${item.id}`}
                    className="text-lg font-semibold text-stone-900 hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {item.overview?.slice(0, 120)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span
                        key={tag.tag.id}
                        className="rounded-full px-2 py-1 text-xs"
                        style={{
                          background: tag.tag.color ?? "#fef3c7",
                          color: "#1f2937",
                        }}
                      >
                        {tag.tag.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-stone-500">
                  {item.noteDate?.slice(0, 10)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
