export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

// GET /api/work-orders — 논리 id별 최신 버전만 반환 (append-only 모델)
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const orders: any[] = [];
  for (const row of (data ?? []) as any[]) {
    const d = row.data;
    if (!d) continue;
    // 논리 id: 데이터 내부 id 우선, 없으면 행 id
    const logicalId = d.id ?? row.id;
    if (seen.has(logicalId)) continue; // 이미 최신 버전을 봤으면 스킵
    seen.add(logicalId);
    // 작업지시서 형태 + 삭제표시 없는 것만
    if (typeof d.styleNo === "string" && !d._deleted) orders.push(d);
  }

  return NextResponse.json(orders);
}

// POST /api/work-orders — 저장 (새 행 append)
export async function POST(req: Request) {
  const wo = await req.json();
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: randomUUID(), data: wo, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
