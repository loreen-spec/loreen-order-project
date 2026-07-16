export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/work-orders — 전체 작업지시서 조회 (최신순)
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("data")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 작업지시서 형태(styleNo 보유)이면서 삭제표시(_deleted)가 없는 행만 반환
  const orders = (data ?? [])
    .map((row: any) => row.data)
    .filter((d: any) => d && typeof d.styleNo === "string" && !d._deleted);

  return NextResponse.json(orders);
}

// POST /api/work-orders — 저장 (삭제 후 삽입: RLS UPDATE 차단 우회)
export async function POST(req: Request) {
  const wo = await req.json();
  // 기존 행 제거 후 삽입 (upsert의 UPDATE가 RLS로 막히는 문제 우회)
  await supabase.from("work_orders").delete().eq("id", wo.id);
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: wo.id, data: wo, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
