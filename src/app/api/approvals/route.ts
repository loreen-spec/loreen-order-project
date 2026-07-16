export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

const LEGACY_APPROVALS_ID = "00000000-0000-0000-0000-000000000001";

// 최신 승인 맵 조회 (append-only)
async function latestApprovals(): Promise<Record<string, boolean>> {
  const { data } = await supabase
    .from("work_orders")
    .select("data, updated_at")
    .eq("data->>_kind", "approvals")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) return data[0].data?.map ?? {};

  // 폴백: 예전 고정 행
  const { data: legacy } = await supabase
    .from("work_orders")
    .select("data")
    .eq("id", LEGACY_APPROVALS_ID)
    .limit(1);
  if (legacy && legacy.length > 0) {
    const d = legacy[0].data ?? {};
    // 예전 형식은 { productId: bool } 자체가 맵
    const { _kind, map, ...rest } = d as any;
    return map ?? rest;
  }
  return {};
}

// GET /api/approvals — 최신 승인 맵
export async function GET() {
  const map = await latestApprovals();
  return NextResponse.json(map);
}

// POST /api/approvals — { id, checked } → 새 행 append
export async function POST(req: Request) {
  const { id, checked } = await req.json();
  if (!id || typeof checked !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const current = await latestApprovals();
  current[id] = checked;

  const { error } = await supabase
    .from("work_orders")
    .insert({
      id: randomUUID(),
      data: { _kind: "approvals", map: current },
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[approvals] POST error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
