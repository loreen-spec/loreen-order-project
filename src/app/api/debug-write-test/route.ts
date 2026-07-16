export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TEST_ID = "__write_test__";

// work_orders 테이블에서 INSERT/UPDATE/DELETE가 실제로 반영되는지 검사 (임시 행)
export async function GET() {
  const out: Record<string, unknown> = {};

  // 1. INSERT (upsert)
  {
    const { error } = await supabase
      .from("work_orders")
      .upsert({ id: TEST_ID, data: { styleNo: "TEST", v: 1 }, updated_at: new Date().toISOString() });
    const { data } = await supabase.from("work_orders").select("data").eq("id", TEST_ID).single();
    out.insert = { error: error?.message ?? null, persisted: (data?.data as any)?.v ?? null };
  }

  // 2. UPDATE
  {
    const { error } = await supabase
      .from("work_orders")
      .update({ data: { styleNo: "TEST", v: 2 }, updated_at: new Date().toISOString() })
      .eq("id", TEST_ID);
    const { data } = await supabase.from("work_orders").select("data").eq("id", TEST_ID).single();
    out.update = { error: error?.message ?? null, persisted_v: (data?.data as any)?.v ?? null }; // 2면 성공
  }

  // 3. DELETE
  {
    const { data: del, error } = await supabase
      .from("work_orders").delete().eq("id", TEST_ID).select("id");
    const { data: after } = await supabase.from("work_orders").select("id").eq("id", TEST_ID);
    out.delete = {
      error: error?.message ?? null,
      deletedCount: del?.length ?? 0,
      stillExists: (after?.length ?? 0) > 0, // true면 삭제 안 됨
    };
  }

  return NextResponse.json(out);
}
