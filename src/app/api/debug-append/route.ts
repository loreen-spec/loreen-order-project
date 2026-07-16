export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

const LID = "__append_test__";

async function latest(id: string) {
  const { data } = await supabase.from("work_orders")
    .select("id, data, updated_at").order("updated_at", { ascending: false });
  for (const row of (data ?? []) as any[]) {
    const d = row.data; if (!d) continue;
    if ((d.id ?? row.id) === id) return d;
  }
  return null;
}

export async function GET() {
  const out: Record<string, unknown> = {};

  const i1 = await supabase.from("work_orders")
    .insert({ id: randomUUID(), data: { id: LID, styleNo: "AT", v: 1 }, updated_at: new Date().toISOString() });
  out.insert1 = i1.error?.message ?? "ok";

  const i2 = await supabase.from("work_orders")
    .insert({ id: randomUUID(), data: { id: LID, styleNo: "AT", v: 2 }, updated_at: new Date().toISOString() });
  out.insert2_update = i2.error?.message ?? "ok";

  out.latestV_shouldBe2 = (await latest(LID))?.v ?? null;

  const i3 = await supabase.from("work_orders")
    .insert({ id: randomUUID(), data: { id: LID, styleNo: "AT", v: 2, _deleted: true }, updated_at: new Date().toISOString() });
  out.insert3_delete = i3.error?.message ?? "ok";

  const afterDel = await latest(LID);
  out.afterDelete_deleted_shouldBeTrue = afterDel?._deleted ?? null;

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
