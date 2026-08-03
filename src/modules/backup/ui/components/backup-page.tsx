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
    <div className="space-y-6">
      <div className="app-page-header flex flex-col gap-4 border-b border-[var(--app-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent-deep)]">
            Backup
          </p>
          <h1 className="text-2xl font-semibold text-[var(--app-ink)]">
            バックアップ
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--app-muted-ink)]">
            SQLite DB の手動バックアップを作成し、最新バックアップを確認します。
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/notes"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition hover:bg-[var(--app-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)] sm:w-auto"
          >
            ノート一覧へ
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--app-accent-deep)] bg-[var(--app-accent-deep)] px-4 py-2 text-sm font-semibold text-[var(--app-paper-surface)] shadow-sm transition hover:border-[var(--app-accent-deep)] hover:bg-[var(--app-accent-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)] disabled:cursor-not-allowed disabled:border-[var(--app-line)] disabled:bg-[var(--app-line)] disabled:text-[var(--app-muted-ink)] sm:w-auto"
            onClick={handleCreateBackup}
            disabled={creating || loading}
          >
            {creating ? "作成中..." : "バックアップ作成"}
          </button>
        </div>
      </div>

      {success && (
        <div
          role="status"
          className="rounded-md border border-[var(--app-line)] border-l-2 border-l-[var(--app-accent)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-accent-deep)]"
        >
          {success}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--app-line)] border-l-2 border-l-[var(--paper-danger)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--paper-danger)]"
        >
          {error}
        </div>
      )}

      <section className="rounded-md border border-[var(--app-line)] bg-[var(--app-paper-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--app-line)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">
              最新バックアップ
            </h2>
            <p className="mt-1 text-xs text-[var(--app-muted-ink)]">
              最新3世代を保持します。
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--app-line)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition hover:border-[var(--app-line-strong)] hover:bg-[var(--app-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)] disabled:cursor-not-allowed disabled:text-[var(--app-muted-ink)] sm:w-auto"
            onClick={() => void loadBackups()}
            disabled={loading || creating}
          >
            一覧更新
          </button>
        </div>

        {loading && (
          <div className="px-4 py-8 text-sm text-[var(--app-muted-ink)] sm:px-5">
            バックアップ一覧を読み込み中...
          </div>
        )}

        {isEmpty && (
          <div className="px-4 py-10 text-center sm:px-5">
            <p className="text-sm font-medium text-[var(--app-ink)]">
              バックアップはまだありません。
            </p>
            <p className="mt-1 text-sm text-[var(--app-muted-ink)]">
              バックアップ作成から現在の SQLite DB を保存できます。
            </p>
          </div>
        )}

        {!loading && backups.length > 0 && (
          <div className="divide-y divide-[var(--app-line)]">
            {backups.map((backup) => (
              <article key={backup.file} className="min-w-0 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="break-all text-sm font-semibold text-[var(--app-ink)]">
                      {backup.file}
                    </h3>
                    <p className="mt-1 break-all text-xs leading-5 text-[var(--app-muted-ink)]">
                      {backup.path}
                    </p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-sm font-medium text-[var(--app-muted-ink)] sm:text-right">
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
