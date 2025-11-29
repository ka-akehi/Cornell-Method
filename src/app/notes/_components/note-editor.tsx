/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { NoteCard, CueCard, Tag } from "../types";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type NotebookForm = {
  id?: string;
  title: string;
  overview: string;
  summary: string;
  noteDate: string;
  tags: Tag[];
  cues: CueCard[];
  notes: NoteCard[];
};

type DraftMeta = {
  isDraft: boolean;
  version: number;
  autosaveVersion: number;
  hiddenNotes?: unknown;
};

type Props = {
  initial?: Partial<NotebookForm>;
  draft?: Partial<DraftMeta>;
  mode: "create" | "edit";
};

const emptyForm: NotebookForm = {
  title: "",
  overview: "",
  summary: "",
  noteDate: format(new Date(), "yyyy-MM-dd"),
  tags: [],
  cues: [],
  notes: [],
};

export function NoteEditor({ initial, draft, mode }: Props) {
  const [form, setForm] = useState<NotebookForm>({ ...emptyForm, ...initial });
  const [draftMeta, setDraftMeta] = useState<DraftMeta>({
    isDraft: true,
    version: draft?.version ?? 0,
    autosaveVersion: draft?.autosaveVersion ?? 0,
    hiddenNotes: draft?.hiddenNotes ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const payload = useMemo(
    () => ({
      notebook: form,
      draft: draftMeta,
    }),
    [form, draftMeta],
  );

  useEffect(() => {
    if (saving || conflict) return;
    const handle = setTimeout(() => {
      void autosave();
    }, 3000);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, draftMeta]);

  async function autosave() {
    if (mode === "create") return;
    setAutosaveError(null);
    try {
      const res = await fetch(`/api/notes/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebook: form,
          draft: draftMeta,
          draftOnly: true,
        }),
      });
      if (res.status === 409) {
        setConflict(true);
        return;
      }
      if (!res.ok) {
        setAutosaveError("自動保存に失敗しました");
        return;
      }
      const data = await res.json();
      setDraftMeta((prev) => ({
        ...prev,
        autosaveVersion: prev.autosaveVersion + 1,
        draftUpdatedAt: new Date(),
        isDraft: true,
      }));
    } catch (e) {
      setAutosaveError("自動保存に失敗しました");
    }
  }

  async function save() {
    setSaving(true);
    setAutosaveError(null);
    setConflict(false);
    const endpoint = mode === "create" ? "/api/notes" : `/api/notes/${form.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      notebook: form,
      draft: draftMeta,
      draftOnly: false,
    };
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        setConflict(true);
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setAutosaveError(text || "保存に失敗しました");
        return;
      }
      const data = await res.json();
      setForm((prev) => ({ ...prev, id: data.id ?? prev.id }));
      setDraftMeta({
        isDraft: false,
        version: draftMeta.version + 1,
        autosaveVersion: 0,
      });
    } finally {
      setSaving(false);
    }
  }

  function reorderCues(ids: string[]) {
    const sorted = ids
      .map((id) => form.cues.find((c) => c.id === id)!)
      .filter(Boolean)
      .map((cue, index) => ({ ...cue, order: index }));
    setForm((prev) => ({ ...prev, cues: sorted }));
  }

  function reorderNotes(ids: string[]) {
    const sorted = ids
      .map((id) => form.notes.find((n) => n.id === id)!)
      .filter(Boolean)
      .map((note, index) => ({ ...note, order: index }));
    setForm((prev) => ({ ...prev, notes: sorted }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-stone-500">タイトル</label>
            <input
              className="rounded-lg border border-stone-200 px-3 py-2 focus:border-amber-400 focus:outline-none"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-stone-500">概要</label>
              <textarea
                className="min-h-[80px] rounded-lg border border-stone-200 px-3 py-2 focus:border-amber-400 focus:outline-none"
                value={form.overview}
                onChange={(e) => setForm({ ...form, overview: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-stone-500">日付</label>
              <input
                type="date"
                className="rounded-lg border border-stone-200 px-3 py-2 focus:border-amber-400 focus:outline-none"
                value={form.noteDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setForm({ ...form, noteDate: e.target.value })}
              />
            </div>
          </div>
          <TagInput
            tags={form.tags}
            onChange={(tags) => setForm({ ...form, tags })}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[0.32fr_0.68fr]">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-600">
                キーワード / 質問
              </h2>
              <button
                className="rounded-lg bg-stone-900 px-3 py-1 text-sm text-white"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    cues: [
                      ...prev.cues,
                      {
                        id: crypto.randomUUID(),
                        marker: `Q${prev.cues.length + 1}`,
                        content: "",
                        order: prev.cues.length,
                      },
                    ],
                  }))
                }
              >
                追加
              </button>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = form.cues.findIndex((c) => c.id === active.id);
                const newIndex = form.cues.findIndex((c) => c.id === over.id);
                const reordered = arrayMove(form.cues, oldIndex, newIndex).map(
                  (cue, idx) => ({ ...cue, order: idx }),
                );
                setForm((prev) => ({ ...prev, cues: reordered }));
              }}
            >
              <SortableContext
                items={form.cues.map((c) => c.id!)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-3 space-y-3">
                  {form.cues.map((cue) => (
                    <CueCardItem
                      key={cue.id}
                      cue={cue}
                      onChange={(next) =>
                        setForm((prev) => ({
                          ...prev,
                          cues: prev.cues.map((c) =>
                            c.id === cue.id ? { ...c, ...next } : c,
                          ),
                        }))
                      }
                      onRemove={() =>
                        setForm((prev) => ({
                          ...prev,
                          cues: prev.cues.filter((c) => c.id !== cue.id),
                        }))
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-600">ノート</h2>
              <button
                className="rounded-lg bg-amber-500 px-3 py-1 text-sm text-white"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    notes: [
                      ...prev.notes,
                      {
                        id: crypto.randomUUID(),
                        content: "",
                        order: prev.notes.length,
                        isHidden: false,
                        cueIds: [],
                      },
                    ],
                  }))
                }
              >
                追加
              </button>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = form.notes.findIndex((c) => c.id === active.id);
                const newIndex = form.notes.findIndex((c) => c.id === over.id);
                const reordered = arrayMove(form.notes, oldIndex, newIndex).map(
                  (note, idx) => ({ ...note, order: idx }),
                );
                setForm((prev) => ({ ...prev, notes: reordered }));
              }}
            >
              <SortableContext
                items={form.notes.map((n) => n.id!)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-3 space-y-3">
                  {form.notes.map((note) => (
                    <NoteCardItem
                      key={note.id}
                      note={note}
                      cues={form.cues}
                      onChange={(next) =>
                        setForm((prev) => ({
                          ...prev,
                          notes: prev.notes.map((n) =>
                            n.id === note.id ? { ...n, ...next } : n,
                          ),
                        }))
                      }
                      onRemove={() =>
                        setForm((prev) => ({
                          ...prev,
                          notes: prev.notes.filter((n) => n.id !== note.id),
                        }))
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-600">
            サマリー & 次のアクション
          </h2>
        </div>
        <div className="mt-3">
          <div data-color-mode="light">
            <MDEditor
              value={form.summary}
              preview="edit"
              height={240}
              onChange={(v) => setForm({ ...form, summary: v ?? "" })}
            />
          </div>
        </div>
      </div>

      {conflict && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          最新の内容と競合しました。再読み込みしてください。
        </div>
      )}
      {autosaveError && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{autosaveError}</span>
          <button
            className="rounded border border-amber-300 px-3 py-1 text-amber-700"
            onClick={() => autosave()}
          >
            再試行
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => save()}
          className="rounded-lg bg-stone-900 px-4 py-2 text-white"
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

function TagInput({
  tags,
  onChange,
}: {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const name = input.trim();
    if (!name || tags.some((t) => t.name === name) || tags.length >= 12) return;
    onChange([...tags, { id: crypto.randomUUID(), name, color: "#f59e0b" }]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-stone-500">タグ（最大12件）</label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id ?? tag.name}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800"
          >
            {tag.name}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-amber-600"
              aria-label={`${tag.name}を削除`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 focus:border-amber-400 focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700"
          onClick={addTag}
        >
          追加
        </button>
      </div>
    </div>
  );
}

function CueCardItem({
  cue,
  onChange,
  onRemove,
}: {
  cue: CueCard;
  onChange: (next: Partial<CueCard>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <input
          className="w-24 rounded border border-stone-200 px-2 py-1 text-sm"
          value={cue.marker}
          onChange={(e) => onChange({ marker: e.target.value })}
        />
        <button
          className="text-sm text-red-500"
          onClick={onRemove}
          aria-label="削除"
        >
          削除
        </button>
      </div>
      <textarea
        className="mt-2 w-full rounded border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        value={cue.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="キーワード / 質問"
      />
    </li>
  );
}

function NoteCardItem({
  note,
  cues,
  onChange,
  onRemove,
}: {
  note: NoteCard;
  cues: CueCard[];
  onChange: (next: Partial<NoteCard>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>ノートカード</span>
        <button className="text-red-500" onClick={onRemove} aria-label="削除">
          削除
        </button>
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {cues.map((cue) => {
            const checked = note.cueIds?.includes(cue.id!);
            return (
              <label
                key={cue.id}
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...(note.cueIds ?? []), cue.id!]
                      : (note.cueIds ?? []).filter((id) => id !== cue.id);
                    onChange({ cueIds: next });
                  }}
                />
                {cue.marker}
              </label>
            );
          })}
        </div>
        <div data-color-mode="light">
          <MDEditor
            value={note.content}
            preview="edit"
            height={180}
            onChange={(v) => onChange({ content: v ?? "" })}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={note.isHidden}
            onChange={(e) => onChange({ isHidden: e.target.checked })}
          />
          閲覧モードで非表示
        </label>
      </div>
    </li>
  );
}
