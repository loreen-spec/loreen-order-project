export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// work_orders 원본 행 요약 (삭제 반영 여부 확인용)
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    rowId: row.id,
    dataId: row.data?.id ?? "(none)",
    idMatch: row.id === (row.data?.id ?? null),
    productName: row.data?.productName ?? "(없음)",
    _deleted: row.data?._deleted ?? false,
  }));

  return NextResponse.json({ count: rows.length, rows });
}
