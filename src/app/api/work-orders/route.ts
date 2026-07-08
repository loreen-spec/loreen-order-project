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

  // 작업지시서 형태(styleNo 문자열 보유)인 행만 반환 — 승인 데이터 등 특수행 제외
  const orders = (data ?? [])
    .map((row: any) => row.data)
    .filter((d: any) => d && typeof d.styleNo === "string");

  return NextResponse.json(orders);
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
