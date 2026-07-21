export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 해당 작업지시서의 현재 데이터 (전체 스캔 없이 직접 조회)
async function getOne(id: string): Promise<any | null> {
  // canonical 행 (id = 작업지시서 id)
  const { data: byId } = await supabaseAdmin
    .from("work_orders").select("data").eq("id", id).maybeSingle();
  if (byId?.data) return byId.data;
  // 폴백: 과거 append 행 (data->>id = id) 중 하나
  const { data: byData } = await supabaseAdmin
    .from("work_orders").select("data").eq("data->>id", id)
    .order("updated_at", { ascending: false }).limit(1);
  return byData && byData.length > 0 ? byData[0].data : null;
}

// DELETE /api/work-orders/[id]
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  await supabaseAdmin.from("work_orders").delete().eq("id", id);
  await supabaseAdmin.from("work_orders").delete().eq("data->>id", id);
  return NextResponse.json({ ok: true });
}

// PATCH /api/work-orders/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const patch = await req.json();
  const id = decodeURIComponent(params.id);

  const existing = await getOne(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...existing, ...patch, id, _ver: Date.now() };
  const { error } = await supabaseAdmin
    .from("work_orders")
    .upsert({ id, data: merged, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
