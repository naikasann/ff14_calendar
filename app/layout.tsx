import type { Metadata } from "next";

import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "FF14 PVP・ハウジングカレンダー",
  description:
    "FF14のフロントライン、クリスタルコンフリクト、ハウジング抽選期間をまとめて確認できる非公式カレンダー。",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
