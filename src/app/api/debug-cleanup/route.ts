export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 중복/찌꺼기 행을 하드 삭제 + 소프트 삭제(_deleted)로 확실히 제거
async function removeRow(id: string) {
  // 1) 하드 삭제 시도
  const { data: hard } = await supabase
    .from("work_orders").delete().eq("id", id).select("id");
  if ((hard?.length ?? 0) > 0) return { id, mode: "hard", ok: true };

  // 2) 소프트 삭제 폴백
  const { data: existing } = await supabase
    .from("work_orders").select("data").eq("id", id).single();
  if (!existing) return { id, mode: "not_found", ok: true };

  const marked = { ...(existing.data ?? {}), _deleted: true };
  const { error } = await supabase
    .from("work_orders")
    .upsert({ id, data: marked, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return { id, mode: "soft", ok: !error, error: error?.message ?? null };
}

export async function GET() {
  const results = [];
  results.push(await removeRow("__approvals__"));        // 찌꺼기 승인 행
  results.push(await removeRow("1783414894303"));         // 로얄코코 중복

  return NextResponse.json({ done: true, results });
}
