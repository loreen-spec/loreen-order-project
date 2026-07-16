export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

// 모든 행 조회
async function allRows() {
  const { data } = await supabase
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []) as any[];
}

// 논리 id별 최신 버전 (GET과 동일 로직)
function dedup(rows: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows) {
    const d = row.data; if (!d) continue;
    const lid = d.id ?? row.id;
    if (seen.has(lid)) continue;
    seen.add(lid);
    if (typeof d.styleNo === "string" && !d._deleted) out.push({ lid, name: d.productName, approved: d.directorApproved ?? false });
  }
  return out;
}

export async function GET() {
  const rows0 = await allRows();
  const list0 = dedup(rows0);
  const target = list0[0];
  if (!target) return NextResponse.json({ error: "no work order" }, { headers: { "Cache-Control": "no-store" } });

  // target의 최신 데이터
  let existing: any = null;
  for (const row of rows0) {
    const d = row.data; if (!d) continue;
    if ((d.id ?? row.id) === target.lid) { existing = d; break; }
  }
  const before = existing?.directorApproved ?? false;

  // 승인 토글 append (toggleApproval과 동일)
  const merged = { ...existing, directorApproved: !before, status: !before ? "completed" : "pending_confirm", id: existing.id ?? target.lid };
  const ins = await supabase.from("work_orders")
    .insert({ id: randomUUID(), data: merged, updated_at: new Date().toISOString() });

  // 다시 조회
  const rows1 = await allRows();
  const list1 = dedup(rows1);
  const after = list1.find((x) => x.lid === target.lid)?.approved ?? null;

  // 롤백 (원상복구)
  await supabase.from("work_orders")
    .insert({ id: randomUUID(), data: { ...merged, directorApproved: before, status: existing?.status ?? "draft" }, updated_at: new Date().toISOString() });

  return NextResponse.json({
    target: target.name,
    logicalId: target.lid,
    before,
    insertError: ins.error?.message ?? null,
    after_shouldBe: !before,
    after_actual: after,
    rowCountForThisId: rows0.filter((r) => (r.data?.id ?? r.id) === target.lid).length,
    totalRows: rows0.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
