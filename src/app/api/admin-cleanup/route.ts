export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 누적된 append 잔여행 청소 — 논리 id별 최신 1건만 canonical로 남김
export async function GET() {
  // 페이지네이션으로 전체 행 수집
  const rows: any[] = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("work_orders")
      .select("id, data, updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  // 논리 id별 최신(_ver 최대) 데이터 선정
  const latest = new Map<string, { data: any; ver: number }>();
  for (const row of rows) {
    const d = row.data; if (!d) continue;
    const lid = d.id ?? row.id;
    const ver = typeof d._ver === "number" ? d._ver : 0;
    const cur = latest.get(lid);
    if (!cur || ver >= cur.ver) latest.set(lid, { data: d, ver });
  }

  // canonical 보정 (id = 논리 id) upsert
  let promoted = 0;
  for (const [lid, { data: d }] of latest) {
    if (lid.startsWith("__")) continue; // 승인행 등 특수 id는 건드리지 않음
    const canonical = { ...d, id: lid };
    const { error } = await supabaseAdmin
      .from("work_orders")
      .upsert({ id: lid, data: canonical, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (!error) promoted++;
  }

  // canonical(=논리 id)이 아닌 잔여행 삭제
  const deleteIds = rows
    .map((r) => r.id)
    .filter((rid) => {
      const d = rows.find((x) => x.id === rid)?.data;
      const lid = d?.id ?? rid;
      if (lid.startsWith("__")) return false;
      return rid !== lid; // 행 id가 논리 id와 다르면 append 잔여행
    });

  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += 100) {
    const chunk = deleteIds.slice(i, i + 100);
    const { data: del } = await supabaseAdmin.from("work_orders").delete().in("id", chunk).select("id");
    deleted += del?.length ?? 0;
  }

  return NextResponse.json(
    { totalRows: rows.length, logicalIds: latest.size, promoted, deleted },
    { headers: { "Cache-Control": "no-store" } }
  );
}
