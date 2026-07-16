export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// work_orders.id는 UUID 타입 — 고정 UUID 사용
const APPROVALS_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/approvals — work_orders 테이블의 특수 행에서 승인 상태 조회
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", APPROVALS_ID)
    .single();

  if (error || !data) {
    return NextResponse.json({});
  }

  return NextResponse.json(data.data ?? {});
}

// POST /api/approvals — { id, checked } 저장
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // 현재 상태 읽기
  const { data: existing } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", APPROVALS_ID)
    .single();

  const current: Record<string, boolean> = existing?.data ?? {};
  current[id] = checked;

  // 삭제 후 삽입 (upsert의 UPDATE가 RLS로 막히는 문제 우회)
  await supabase.from("work_orders").delete().eq("id", APPROVALS_ID);
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: APPROVALS_ID, data: current, updated_at: new Date().toISOString() });

  if (error) {
    console.error("[approvals] POST error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
