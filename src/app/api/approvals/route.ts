export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const APPROVALS_ID = "00000000-0000-0000-0000-000000000001";

async function readMap(): Promise<Record<string, boolean>> {
  const { data } = await supabaseAdmin
    .from("work_orders")
    .select("data")
    .eq("id", APPROVALS_ID)
    .maybeSingle();
  const d: any = data?.data;
  if (!d) return {};
  return d.map ?? (d._kind ? {} : d); // 신규: {map}, 구버전: 맵 자체
}

// GET /api/approvals — 발주확인 체크 맵
export async function GET() {
  const map = await readMap();
  return NextResponse.json(map, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/approvals — { id, checked }
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const map = await readMap();
  map[id] = checked;

  const { error } = await supabaseAdmin
    .from("work_orders")
    .upsert(
      { id: APPROVALS_ID, data: { _kind: "approvals", map }, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
