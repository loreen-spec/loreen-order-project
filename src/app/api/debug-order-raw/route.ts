export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed";

// GET /api/debug-order-raw?name=<제품명>
// 발주 DB 원본 값을 그대로 보여줌 (색상/사이즈 파싱 포맷 확인용)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "name required" });

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DB = process.env.NOTION_DATABASE_ID!;

    const prodRes: any = await notion.databases.query({
      database_id: DB,
      filter: { property: "제품명", title: { contains: name } },
      page_size: 5,
    });
    if (!prodRes.results.length) return NextResponse.json({ error: "product not found", name });

    const pageId = prodRes.results[0].id;

    const orderRes: any = await notion.databases.query({
      database_id: ORDER_DB,
      filter: { property: "관계형 title", relation: { contains: pageId } },
      page_size: 15,
    });

    const rows = (orderRes.results as any[]).map((r) => {
      const rp = r.properties;
      return {
        batch_select: rp["k.발주차수"]?.select?.name ?? null,
        batch_richtext: rp["k.발주차수"]?.rich_text?.[0]?.plain_text ?? null,
        colorSize_raw: (rp["f.색상/사이즈"]?.rich_text ?? []).map((t: any) => t.plain_text).join(""),
        colorSize_type: rp["f.색상/사이즈"]?.type ?? null,
        qty: rp["g.발주수량"]?.number ?? null,
      };
    });

    // f.색상/사이즈 속성이 rich_text가 아닐 수도 있으니 전체 속성 키도 표시
    const allKeys = Object.keys((orderRes.results[0]?.properties) ?? {});

    return NextResponse.json({ product: name, pageId, count: orderRes.results.length, allKeys, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" });
  }
}
