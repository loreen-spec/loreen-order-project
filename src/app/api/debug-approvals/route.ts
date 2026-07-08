export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const APPROVALS_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  // 1. 현재 승인 행 읽기
  const { data: readData, error: readError } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", APPROVALS_ID)
    .single();

  // 2. 테스트 쓰기 (기존 데이터에 __debug_test__ 추가)
  const current: Record<string, boolean> = readData?.data ?? {};
  current["__debug_test__"] = true;

  const { error: writeError } = await supabase
    .from("work_orders")
    .upsert(
      { id: APPROVALS_ID, data: current, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  // 3. 쓰기 후 다시 읽기
  const { data: afterData, error: afterError } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", APPROVALS_ID)
    .single();

  return NextResponse.json({
    read:  { data: readData?.data ?? null,  error: readError?.message  ?? null },
    write: { error: writeError?.message ?? null },
    after: { data: afterData?.data ?? null, error: afterError?.message ?? null },
  });
}
