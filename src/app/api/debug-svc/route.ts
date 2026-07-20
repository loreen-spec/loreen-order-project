export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin, hasServiceKey } from "@/lib/supabase";

const TID = "__svc_test__";

// 서비스롤 키 적용 여부 + 수정/삭제 실제 반영 검사
export async function GET() {
  const out: Record<string, unknown> = { hasServiceKey };

  await supabaseAdmin.from("work_orders").delete().eq("id", TID);
  await supabaseAdmin.from("work_orders").insert({ id: TID, data: { styleNo: "SVC", v: 1 }, updated_at: new Date().toISOString() });
  const u = await supabaseAdmin.from("work_orders").update({ data: { styleNo: "SVC", v: 2 }, updated_at: new Date().toISOString() }).eq("id", TID);
  const { data: after } = await supabaseAdmin.from("work_orders").select("data").eq("id", TID).maybeSingle();
  out.updateError = u.error?.message ?? null;
  out.updatePersisted_shouldBe2 = (after?.data as any)?.v ?? null;
  const d = await supabaseAdmin.from("work_orders").delete().eq("id", TID).select("id");
  const { data: gone } = await supabaseAdmin.from("work_orders").select("id").eq("id", TID);
  out.deleteWorked_shouldBeTrue = (gone?.length ?? 0) === 0;

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
