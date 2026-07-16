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

  // 논리 id별로 버전(_ver)이 가장 큰 행을 최신으로 선택 (updated_at 정렬 흔들림 방지)
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
    // 진단용 찌꺼기 제외
    if (logicalId === "__write_test__" || logicalId === "__append_test__") continue;
    if (d.styleNo === "TEST" || d.styleNo === "AT") continue;
    // 작업지시서 형태 + 삭제표시 없는 것만
    if (typeof d.styleNo === "string" && !d._deleted) orders.push(d);
  }

  return NextResponse.json(orders, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

// POST /api/work-orders — 저장 (새 행 append)
export async function POST(req: Request) {
  const wo = await req.json();
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: randomUUID(), data: { ...wo, _ver: Date.now() }, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
