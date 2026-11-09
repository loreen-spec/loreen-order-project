export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/work-orders/[id] — 특정 작업지시서 조회
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 같은 논리 id 중 최신 버전 찾기
  let best: { data: any; ver: number } | null = null;
  for (const row of (data ?? []) as any[]) {
    const d = row.data;
    if (!d) continue;
    const logicalId = d.id ?? row.id;
    if (logicalId !== id) continue;
    const ver = typeof d._ver === "number" ? d._ver : 0;
    if (!best || ver > best.ver) best = { data: d, ver };
  }

  if (!best) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(best.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
