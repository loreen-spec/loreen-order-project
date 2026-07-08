export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // 1. 테이블 읽기 테스트
  const { data: readData, error: readError } = await supabase
    .from("order_confirmations")
    .select("*");

  // 2. 테스트 쓰기
  const { error: writeError } = await supabase
    .from("order_confirmations")
    .upsert(
      { product_id: "__debug_test__", confirmed: true, updated_at: new Date().toISOString() },
      { onConflict: "product_id" }
    );

  // 3. 쓰기 후 다시 읽기
  const { data: afterData, error: afterError } = await supabase
    .from("order_confirmations")
    .select("*");

  return NextResponse.json({
    read:  { data: readData,  error: readError?.message  ?? null },
    write: { error: writeError?.message ?? null },
    after: { data: afterData, error: afterError?.message ?? null },
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "NOT SET",
  });
}
