export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 임시: work_orders 테이블의 모든 행 요약 조회
export async function GET() {
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    styleNo: row.data?.styleNo ?? "(없음)",
    productName: row.data?.productName ?? "(없음)",
    // 승인 특수행이면 data가 { productId: bool } 형태 → 키 목록 표시
    dataKeys: Object.keys(row.data ?? {}).slice(0, 5),
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ count: rows.length, rows });
}
