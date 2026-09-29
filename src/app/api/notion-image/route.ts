export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

async function freshUrl(pageId: string): Promise<string | null> {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  const imgProp = page.properties?.["대표이미지"];
  if (imgProp?.type === "files" && imgProp.files?.length > 0) {
    const f = imgProp.files[0];
    return (f.type === "external" ? f.external?.url : f.file?.url) ?? null;
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId")?.trim();
  const raw = searchParams.get("raw"); // raw=1 → 이미지 바이트 직접 반환 (<img src>로 사용 가능)
  if (!pageId) {
    return raw
      ? new NextResponse("no pageId", { status: 400 })
      : NextResponse.json({ url: null });
  }

  try {
    const url = await freshUrl(pageId);
    if (!raw) return NextResponse.json({ url: url ?? null });

    // raw 모드: 매번 새 서명 URL을 받아 이미지 바이트를 프록시 → 만료/타 컴퓨터 문제 없음
    if (!url) return new NextResponse("no image", { status: 404 });
    const imgRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!imgRes.ok) return new NextResponse("fetch failed", { status: 502 });
    const buf = await imgRes.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return raw
      ? new NextResponse("error", { status: 500 })
      : NextResponse.json({ url: null });
  }
}
