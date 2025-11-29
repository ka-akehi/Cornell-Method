"use client";

import { useEffect, useState } from "react";

type BackupItem = {
  file: string;
  path: string;
};

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [log, setLog] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/backups");
    const data = await res.json();
    setBackups(data.backups ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function retry() {
    const res = await fetch("/api/backups/retry", { method: "POST" });
    const data = await res.json();
    setLog(data.log ?? data.message ?? "");
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">バックアップ</h1>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">最新3世代を保持</p>
          </div>
          <button
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700"
            onClick={retry}
          >
            再試行
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-stone-700">
          {backups.map((b) => (
            <li key={b.file} className="flex items-center justify-between">
              <span>{b.file}</span>
              <a
                className="text-amber-600 underline"
                href={`/${b.path}`}
                download
              >
                ダウンロード
              </a>
            </li>
          ))}
          {backups.length === 0 && (
            <li className="text-stone-500">バックアップがありません</li>
          )}
        </ul>
        {log && (
          <pre className="mt-3 rounded bg-stone-50 p-2 text-xs text-stone-500">
            {log}
          </pre>
        )}
      </div>
    </div>
  );
}
