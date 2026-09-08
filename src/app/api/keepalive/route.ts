export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Supabase 무료 플랜은 7일간 요청이 없으면 자동 정지됨.
// Vercel 크론이 하루 한 번 이 엔드포인트를 호출 → 가벼운 조회로 활동을 남겨 정지를 방지.
export async function GET() {
  try {
    const { error } = await supabase.from("work_orders").select("id").limit(1);
    return NextResponse.json(
      { ok: !error, ts: new Date().toISOString(), error: error?.message ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
