import type { Metadata } from "next";
import { AppChrome } from "./_components/app-chrome";
import "./globals.css";

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
      <body className="app-body antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
