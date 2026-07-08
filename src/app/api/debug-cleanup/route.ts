export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const UUID_APPROVALS = "00000000-0000-0000-0000-000000000001";

// 일회성 정리 + 삭제 가능 여부 검증 (.select()로 실제 삭제 건수 확인)
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. 예전 문자열 ID 찌꺼기 승인 행 삭제
  {
    const { data, error } = await supabase
      .from("work_orders").delete().eq("id", "__approvals__").select("id");
    results["delete___approvals__"] = { count: data?.length ?? 0, error: error?.message ?? null };
  }

  // 2. 로얄코코 중복 1개 삭제
  {
    const { data, error } = await supabase
      .from("work_orders").delete().eq("id", "1783414894303").select("id");
    results["delete_로얄코코중복"] = { count: data?.length ?? 0, error: error?.message ?? null };
  }

  // 3. UUID 승인 행에서 __debug_test__ 키 제거
  {
    const { data } = await supabase
      .from("work_orders").select("data").eq("id", UUID_APPROVALS).single();
    const current: Record<string, boolean> = data?.data ?? {};
    delete current["__debug_test__"];
    const { error } = await supabase
      .from("work_orders")
      .update({ data: current, updated_at: new Date().toISOString() })
      .eq("id", UUID_APPROVALS);
    results["clean___debug_test__"] = { error: error?.message ?? null };
  }

  return NextResponse.json({ done: true, results });
}
