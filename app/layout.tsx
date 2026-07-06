import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-noto", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Rank kitt · AEO, GEO 진단 분석기",
  description: "사이트를 넣으면 AI 검색 노출 상태를 진단하고 채널별 행동전략을 제안합니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${noto.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
