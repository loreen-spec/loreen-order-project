import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "openhan GianMate",
  description: "거래명세서를 하이웍스 기안서로 자동 작성",
};

export default function GianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
