export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/approvals — 전체 확인 상태 조회 → { [product_id]: boolean }
export async function GET() {
  const { data, error } = await supabase
    .from("order_confirmations")
    .select("product_id, confirmed");

  if (error) {
    console.error("[approvals] GET error:", error.message);
    return NextResponse.json({}, { status: 500 });
  }

  const result: Record<string, boolean> = {};
  (data ?? []).forEach((row: { product_id: string; confirmed: boolean }) => {
    result[row.product_id] = row.confirmed;
  });

  return NextResponse.json(result);
}

// POST /api/approvals — { id, checked } 저장
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { error } = await supabase
    .from("order_confirmations")
    .upsert(
      { product_id: id, confirmed: checked, updated_at: new Date().toISOString() },
      { onConflict: "product_id" }
    );

  if (error) {
    console.error("[approvals] POST error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
