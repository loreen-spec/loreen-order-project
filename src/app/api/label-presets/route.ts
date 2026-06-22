export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — 전체 프리셋 조회
export async function GET() {
  const { data, error } = await supabase
    .from("label_presets")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — 이미지 업데이트 (id로 upsert)
export async function POST(req: Request) {
  const body = await req.json();
  const { id, group, name, imageData, sortOrder } = body;
  const { error } = await supabase
    .from("label_presets")
    .upsert({ id, group_name: group, name, image_data: imageData ?? null, sort_order: sortOrder ?? 0 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — 프리셋 삭제
export async function DELETE(req: Request) {
  const { id } = await req.json();
  const { error } = await supabase.from("label_presets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
