import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cornell Method Notebook",
  description: "コーネルメソッドノート記録アプリ",
};

const navigationItems = [
  { href: "/notes", label: "ノート一覧" },
  { href: "/notes/new", label: "新規作成" },
  { href: "/backup", label: "バックアップ" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-border bg-surface/95 shadow-sm backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link
                href="/notes"
                className="flex min-w-0 items-center gap-3"
                aria-label="Cornell Method Notebook ノート一覧へ"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-100 text-sm font-semibold text-amber-800"
                  aria-hidden="true"
                >
                  C
                </span>
                <div>
                  <p className="text-sm font-semibold leading-5 text-foreground">
                    Cornell Method Notebook
                  </p>
                  <p className="text-xs leading-4 text-muted-foreground">
                    ローカル学習ノート
                  </p>
                </div>
              </Link>
              <nav
                className="flex max-w-full items-center gap-2 overflow-x-auto text-sm font-medium"
                aria-label="グローバルナビゲーション"
              >
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-md px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
