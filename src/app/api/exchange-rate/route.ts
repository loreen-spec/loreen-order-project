export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1시간 캐시

import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 무료 환율 API (인증 불필요)
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const krw = data?.usd?.krw;
    if (!krw) throw new Error("KRW rate not found");
    return NextResponse.json({ usdToKrw: krw });
  } catch {
    // fallback: 고정 환율
    return NextResponse.json({ usdToKrw: 1380, fallback: true });
  }
}
