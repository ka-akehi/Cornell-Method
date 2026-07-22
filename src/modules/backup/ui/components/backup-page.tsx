"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BackupEntryDto } from "@/modules/backup/contracts";
import { createBackup, fetchBackups } from "@/modules/backup/remote";

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function BackupPage() {
  const [backups, setBackups] = useState<BackupEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const backupsRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);

  const loadBackups = useCallback(async () => {
    const requestId = ++backupsRequestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const nextBackups = await fetchBackups();

      if (requestId !== backupsRequestIdRef.current) return;
      setBackups(nextBackups);
    } catch (caught) {
      if (requestId !== backupsRequestIdRef.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "バックアップ一覧の取得に失敗しました。",
      );
    } finally {
      if (requestId === backupsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadBackups();

    return () => {
      isMountedRef.current = false;
      backupsRequestIdRef.current += 1;
    };
  }, [loadBackups]);

  async function handleCreateBackup() {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const json = await createBackup();
      if (!isMountedRef.current) return;

      setSuccess(`${json.backup.file} を作成しました。`);
      await loadBackups();
    } catch (caught) {
      if (!isMountedRef.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "バックアップの作成に失敗しました。",
      );
    } finally {
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  }

  const isEmpty = !loading && backups.length === 0;

  return (
    <div className="space-y-5">
      <div className="app-page-header flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Backup</p>
          <h1 className="text-2xl font-semibold text-foreground">
            バックアップ
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            SQLite DB の手動バックアップを作成し、最新バックアップを確認します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/notes"
            className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            ノート一覧へ
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-stone-300"
            onClick={handleCreateBackup}
            disabled={creating || loading}
          >
            {creating ? "作成中..." : "バックアップ作成"}
          </button>
        </div>
      </div>

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              最新バックアップ
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              最新3世代を保持します。
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:text-muted-foreground"
            onClick={() => void loadBackups()}
            disabled={loading || creating}
          >
            一覧更新
          </button>
        </div>

        {loading && (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            バックアップ一覧を読み込み中...
          </div>
        )}

        {isEmpty && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              バックアップはまだありません。
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              バックアップ作成から現在の SQLite DB を保存できます。
            </p>
          </div>
        )}

        {!loading && backups.length > 0 && (
          <div className="divide-y divide-border">
            {backups.map((backup) => (
              <article key={backup.file} className="min-w-0 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {backup.file}
                    </h3>
                    <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                      {backup.path}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-muted-foreground">
                    {formatCreatedAt(backup.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
