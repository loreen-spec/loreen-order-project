export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// DELETE /api/work-orders/[id]
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from("work_orders")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
  const { error } = await supabase
    .from("work_orders")
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
