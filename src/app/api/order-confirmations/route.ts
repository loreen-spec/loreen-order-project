export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/order-confirmations — 전체 확인 상태 조회
export async function GET() {
  const { data, error } = await supabase
    .from("order_confirmations")
    .select("product_id, confirmed, updated_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/order-confirmations — 확인 상태 저장/업데이트
export async function POST(req: Request) {
  const { productId, confirmed } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const { error } = await supabase
    .from("order_confirmations")
    .upsert(
      { product_id: productId, confirmed, updated_at: new Date().toISOString() },
      { onConflict: "product_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
