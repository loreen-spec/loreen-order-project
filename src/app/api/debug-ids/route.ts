export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 행 id vs 데이터 내부 id 일치 여부 확인
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, data")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    rowId: row.id,
    dataId: row.data?.id ?? "(none)",
    match: row.id === (row.data?.id ?? null),
    name: row.data?.productName ?? "(없음)",
  }));

  const mismatches = rows.filter((r) => !r.match).length;
  return NextResponse.json(
    { count: rows.length, mismatches, rows },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
