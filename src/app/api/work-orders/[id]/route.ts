export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

// 논리 id로 최신 버전 데이터 조회 (JS 필터 — JSON 연산자 쿼리 회피)
async function latestByLogicalId(id: string): Promise<any | null> {
  const { data } = await supabase
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });
  for (const row of (data ?? []) as any[]) {
    const d = row.data;
    if (!d) continue;
    const logicalId = d.id ?? row.id;
    if (logicalId === id) return d; // 최신(첫) 매치
  }
  return null;
}

// DELETE /api/work-orders/[id] — 삭제표시(_deleted) 새 행 append
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const existing = await latestByLogicalId(id);

  // 이미 없으면 성공 처리
  const base = existing ?? { id };
  const marked = { ...base, id: base.id ?? id, _deleted: true };

  const { error } = await supabase
    .from("work_orders")
    .insert({ id: randomUUID(), data: marked, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deletedCount: 1 });
}

// PATCH /api/work-orders/[id] — 부분 업데이트: 병합본을 새 행으로 append
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const patch = await req.json();
  const id = decodeURIComponent(params.id);

  const existing = await latestByLogicalId(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const merged = { ...existing, ...patch, id: existing.id ?? id };
  const { error } = await supabase
    .from("work_orders")
    .insert({ id: randomUUID(), data: merged, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
