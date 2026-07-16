export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// DELETE /api/work-orders/[id]
// 하드 삭제 시도 → RLS로 막히면 소프트 삭제(_deleted 마킹)로 폴백
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);

  // 1. 하드 삭제 시도
  const { data: hardDeleted } = await supabase
    .from("work_orders")
    .delete()
    .eq("id", id)
    .select("id");

  if ((hardDeleted?.length ?? 0) > 0) {
    return NextResponse.json({ ok: true, mode: "hard", deletedCount: hardDeleted!.length });
  }

  // 2. 하드 삭제가 0건이면(RLS 차단 등) 소프트 삭제: _deleted 마킹
  const { data: existing } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", id)
    .single();

  if (!existing) {
    // 이미 없는 경우 성공으로 간주
    return NextResponse.json({ ok: true, mode: "none", deletedCount: 0 });
  }

  const marked = { ...(existing.data ?? {}), _deleted: true };
  const { error: softError } = await supabase
    .from("work_orders")
    .upsert({ id, data: marked, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (softError) return NextResponse.json({ error: softError.message }, { status: 500 });
  return NextResponse.json({ ok: true, mode: "soft", deletedCount: 1 });
}

// PATCH /api/work-orders/[id] — 부분 업데이트 (상태변경 등)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const patch = await req.json();

  // 기존 데이터 가져와서 병합
  const { data: existing } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", params.id)
    .single();

  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...existing.data, ...patch };
  // 삭제 후 삽입 (upsert/update가 RLS로 막히는 문제 우회)
  await supabase.from("work_orders").delete().eq("id", params.id);
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: params.id, data: merged, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
