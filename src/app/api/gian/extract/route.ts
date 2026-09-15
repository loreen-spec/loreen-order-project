export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { extractStatement } from "@/lib/gian/extractServer";

// 거래명세서 → 구조화 데이터 추출
// 입력: { imageBase64, mimeType }  (사진/캡쳐/PDF)  또는  { text }  (엑셀·붙여넣기)
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { imageBase64, mimeType = "image/jpeg", text } = body;
  if (!imageBase64 && !text)
    return NextResponse.json({ error: "이미지 또는 텍스트가 필요합니다." }, { status: 400 });

  try {
    const statement = await extractStatement({ imageBase64, mimeType, text });
    return NextResponse.json({ statement });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "추출 오류" }, { status: 500 });
  }
}
