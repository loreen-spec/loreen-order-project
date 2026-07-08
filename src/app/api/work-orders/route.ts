export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 발주확인 승인 상태를 저장하는 특수 행 ID (작업지시서 목록에서 제외)
const APPROVALS_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/work-orders — 전체 작업지시서 조회 (최신순)
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("data")
    .neq("id", APPROVALS_ID)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.map((row: any) => row.data));
}

// POST /api/work-orders — 저장 (insert or upsert)
export async function POST(req: Request) {
  const wo = await req.json();
  const { error } = await supabase
    .from("work_orders")
    .upsert({ id: wo.id, data: wo, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
