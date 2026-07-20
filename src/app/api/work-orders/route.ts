export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/work-orders — 논리 id별 최신 버전만 반환
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 논리 id별로 _ver(없으면 0)이 가장 큰 행을 최신으로 선택 — 과거 append 잔여행 안전 처리
  const latest = new Map<string, { data: any; ver: number }>();
  for (const row of (data ?? []) as any[]) {
    const d = row.data;
    if (!d) continue;
    const logicalId = d.id ?? row.id;
    const ver = typeof d._ver === "number" ? d._ver : 0;
    const cur = latest.get(logicalId);
    if (!cur || ver > cur.ver) latest.set(logicalId, { data: d, ver });
  }

  const orders: any[] = [];
  for (const [logicalId, { data: d }] of latest) {
    if (logicalId === "__write_test__" || logicalId === "__append_test__") continue;
    if (d.styleNo === "TEST" || d.styleNo === "AT") continue;
    if (typeof d.styleNo === "string" && !d._deleted) orders.push(d);
  }

  return NextResponse.json(orders, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

// POST /api/work-orders — 저장 (단일 행 upsert, id = 작업지시서 id)
export async function POST(req: Request) {
  const wo = await req.json();
  const { error } = await supabaseAdmin
    .from("work_orders")
    .upsert(
      { id: wo.id, data: { ...wo, _ver: Date.now() }, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
