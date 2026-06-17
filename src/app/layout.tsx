import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "입고 대시보드 | 제품디자인팀",
  description: "제품 입고 일정 및 발주 현황 관리",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
