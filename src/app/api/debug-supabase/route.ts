export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수 존재 여부 확인
  if (!url || url === "여기에_붙여넣기") {
    return NextResponse.json({ ok: false, reason: "SUPABASE_URL 환경변수 없음" });
  }
  if (!key || key === "여기에_붙여넣기") {
    return NextResponse.json({ ok: false, reason: "SUPABASE_ANON_KEY 환경변수 없음" });
  }

  // 실제 Supabase 연결 테스트
  try {
    const res = await fetch(`${url}/rest/v1/work_orders?limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const body = await res.text();

    if (res.ok) {
      return NextResponse.json({ ok: true, status: res.status, rowCount: JSON.parse(body).length });
    } else {
      return NextResponse.json({ ok: false, status: res.status, body });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e.message });
  }
}
