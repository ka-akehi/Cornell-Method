"use client";

import { useEffect, useState } from "react";

type Task = {
  notebookId: string;
  reviewStatus: number;
  firstReviewAt: string;
  secondReviewAt: string;
  notebook: {
    id: string;
    title: string;
    noteDate: string;
    tags: { tag: { id: string; name: string; color: string | null } }[];
  };
};

export default function ReviewTasksPage() {
  const [tab, setTab] = useState<"day" | "week">("day");
  const [tasks, setTasks] = useState<Task[]>([]);

  async function load(type: "day" | "week") {
    const res = await fetch(`/api/review-tasks?type=${type}`);
    const data = await res.json();
    setTasks(data);
  }

  useEffect(() => {
    void load(tab);
  }, [tab]);

  async function complete(task: Task) {
    await fetch("/api/review-tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notebookId: task.notebookId,
        status: tab === "day" ? 1 : 2,
      }),
    });
    await load(tab);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">復習タスク</h1>
      <div className="flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm ${
            tab === "day" ? "bg-stone-900 text-white" : "bg-white text-stone-700"
          }`}
          onClick={() => setTab("day")}
        >
          1日後
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm ${
            tab === "week" ? "bg-stone-900 text-white" : "bg-white text-stone-700"
          }`}
          onClick={() => setTab("week")}
        >
          1週間後
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <ul className="divide-y divide-stone-100">
          {tasks.map((task) => (
            <li key={task.notebookId} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-semibold text-stone-900">
                  {task.notebook.title}
                </div>
                <div className="text-xs text-stone-500">
                  作成日: {task.notebook.noteDate?.slice(0, 10)}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.notebook.tags.map((tag) => (
                    <span
                      key={tag.tag.id}
                      className="rounded-full px-2 py-1 text-[11px]"
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
              <button
                className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700"
                onClick={() => complete(task)}
              >
                完了
              </button>
            </li>
          ))}
          {tasks.length === 0 && (
            <li className="py-6 text-center text-sm text-stone-500">
              タスクはありません
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
