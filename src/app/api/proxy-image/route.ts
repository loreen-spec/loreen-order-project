export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";

// 노션 S3 이미지 URL은 1시간 후 만료됨
// 클라이언트에서 직접 만료 URL을 저장하는 대신 서버를 통해 이미지를 가져와서 base64 변환에 쓰임
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "no url" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
