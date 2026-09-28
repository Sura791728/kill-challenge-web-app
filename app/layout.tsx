import type { Metadata } from "next";
import "./globals.css";
import "./control.css";

export const metadata: Metadata = {
  title: "キルチャレ管理 | VALORANT・APEX",
  description: "自分用のパネル・ポイント・倍率でキルチャレを管理し、OBSへ同期",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
