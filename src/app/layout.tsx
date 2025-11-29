import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cornell Method Notebook",
  description: "コーネルメソッドノート記録アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-100 text-stone-900`}
      >
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-400/80 shadow" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Cornell Notes
                  </p>
                  <p className="text-sm font-semibold text-stone-700">
                    コーネルメソッド
                  </p>
                </div>
              </div>
              <nav className="flex items-center gap-4 text-sm font-medium text-stone-700">
                <a className="hover:text-amber-600" href="/notes">
                  ノート一覧
                </a>
                <a className="hover:text-amber-600" href="/notes/new">
                  新規作成
                </a>
                <a className="hover:text-amber-600" href="/tasks/review">
                  復習タスク
                </a>
                <a className="hover:text-amber-600" href="/notes/backup">
                  バックアップ
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
