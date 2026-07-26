import Link from "next/link";
import type { ReactNode } from "react";

type AppChromeProps = {
  children: ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="app-chrome-header sticky top-0 z-10">
        <div className="app-chrome-inner">
          <Link
            href="/notes"
            className="app-chrome-brand"
            aria-label="Cornell Method Notebook ノート一覧へ"
          >
            <span
              className="app-chrome-brand-mark"
              aria-hidden="true"
            >
              C
            </span>
            <div className="app-chrome-brand-copy">
              <p className="app-chrome-brand-title">
                Cornell Method Notebook
              </p>
              <p className="app-chrome-brand-subtitle">
                ローカル学習ノート
              </p>
            </div>
          </Link>
          <div className="flex min-w-0 items-center justify-end gap-4">
            <nav
              className="app-chrome-nav flex-1"
              aria-label="グローバルナビゲーション"
            >
              <Link
                href="/notes"
                className="app-chrome-nav-link"
              >
                ノート一覧
              </Link>
              <Link
                href="/notes/new"
                className="app-chrome-nav-link"
              >
                新規作成
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
