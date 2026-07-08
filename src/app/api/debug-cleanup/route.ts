export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const UUID_APPROVALS = "00000000-0000-0000-0000-000000000001";

// 일회성 정리: 찌꺼기 행 + 디버그 키 + 로얄코코 중복 제거
export async function GET() {
  const results: Record<string, string> = {};

  // 1. 예전 문자열 ID 찌꺼기 승인 행 삭제
  {
    const { error } = await supabase.from("work_orders").delete().eq("id", "__approvals__");
    results["delete __approvals__"] = error ? error.message : "ok";
  }

  // 2. UUID 승인 행에서 __debug_test__ 키 제거
  {
    const { data } = await supabase
      .from("work_orders")
      .select("data")
      .eq("id", UUID_APPROVALS)
      .single();
    const current: Record<string, boolean> = data?.data ?? {};
    delete current["__debug_test__"];
    const { error } = await supabase
      .from("work_orders")
      .update({ data: current, updated_at: new Date().toISOString() })
      .eq("id", UUID_APPROVALS);
    results["clean __debug_test__"] = error ? error.message : "ok";
  }

  // 3. 로얄코코 중복 1개 삭제 (id 1783414894303)
  {
    const { error } = await supabase.from("work_orders").delete().eq("id", "1783414894303");
    results["delete 로얄코코 중복"] = error ? error.message : "ok";
  }

  return NextResponse.json({ done: true, results });
}
