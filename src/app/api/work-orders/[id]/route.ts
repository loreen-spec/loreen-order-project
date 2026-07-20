export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 논리 id로 최신 버전 데이터 조회 (_ver 최대)
async function latestByLogicalId(id: string): Promise<any | null> {
  const { data } = await supabaseAdmin
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });
  let best: any = null;
  let bestVer = -1;
  for (const row of (data ?? []) as any[]) {
    const d = row.data;
    if (!d) continue;
    if ((d.id ?? row.id) !== id) continue;
    const ver = typeof d._ver === "number" ? d._ver : 0;
    if (ver > bestVer) { bestVer = ver; best = d; }
  }
  return best;
}

// 논리 id의 모든 행 삭제 (canonical + 과거 append 잔여행)
async function deleteAllForLogicalId(id: string) {
  await supabaseAdmin.from("work_orders").delete().eq("id", id);       // canonical
  await supabaseAdmin.from("work_orders").delete().eq("data->>id", id); // 잔여 append 행
}

// DELETE /api/work-orders/[id]
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  await deleteAllForLogicalId(id);
  return NextResponse.json({ ok: true });
}

// PATCH /api/work-orders/[id] — 부분 업데이트 (단일 행 upsert)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const patch = await req.json();
  const id = decodeURIComponent(params.id);

  const existing = await latestByLogicalId(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...existing, ...patch, id: existing.id ?? id, _ver: Date.now() };

  // 과거 append 잔여행 정리 후 canonical 행으로 저장
  await supabaseAdmin.from("work_orders").delete().eq("data->>id", id);
  const { error } = await supabaseAdmin
    .from("work_orders")
    .upsert({ id, data: merged, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
