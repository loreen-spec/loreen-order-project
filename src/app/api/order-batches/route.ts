export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const REAL_ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed"; // 오즈키즈 발주 DB

// GET /api/order-batches?name=<제품명> 또는 ?pageId=<노션제품ID>
// 해당 제품의 발주 DB 행을 차수별로 묶어 반환
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId") || "";
  const name = (searchParams.get("name") || "").trim();
  if (!pageId && !name) return NextResponse.json({ batches: [] });

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const MAIN_DB = process.env.NOTION_DATABASE_ID!;

    // 1. 제품 페이지 id 확보 (pageId 우선, 없으면 제품명 검색)
    let productIds: string[] = [];
    if (pageId) {
      productIds = [pageId];
    } else {
      const res: any = await notion.databases.query({
        database_id: MAIN_DB,
        filter: { property: "제품명", title: { contains: name } },
        page_size: 25,
      });
      productIds = (res.results as any[]).map((p) => p.id);
    }
    if (productIds.length === 0) return NextResponse.json({ batches: [] });

    // 2. 발주 DB 행 조회 (관계형 title relation이 제품 id를 포함)
    const filter =
      productIds.length === 1
        ? { property: "관계형 title", relation: { contains: productIds[0] } }
        : { or: productIds.map((id) => ({ property: "관계형 title", relation: { contains: id } })) };

    const rows: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.databases.query({
        database_id: REAL_ORDER_DB,
        filter,
        start_cursor: cursor,
        page_size: 100,
      });
      rows.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    // 색상/사이즈 파싱: "블랙,  :140" → color="블랙", size="140"
    function parseColorSize(raw: string): { color: string; size: string } | null {
      const parts = raw.split(",").map((s) => s.trim().replace(/^:/, "").trim());
      const color = parts[0] ?? "";
      const size = parts[1] ?? "";
      if (!color || !size) return null;
      return { color, size };
    }
    const sizeSort = (a: string, b: string) => {
      const na = parseInt(a), nb = parseInt(b);
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    };

    // 3. 차수별 그룹핑 (발주수량 합산 + 색상×사이즈 표 + 가장 이른 발주일)
    type Agg = {
      batch: string; num: number; qty: number; date: string;
      colorMap: Map<string, Record<string, number>>; sizeSet: Set<string>;
    };
    const map = new Map<string, Agg>();
    for (const row of rows) {
      const p = row.properties;
      const batch =
        p["k.발주차수"]?.select?.name ??
        p["k.발주차수"]?.rich_text?.[0]?.plain_text ??
        "";
      if (!batch) continue;
      const qty = p["g.발주수량"]?.number ?? 0;
      const date = p["a.발주일"]?.date?.start ?? "";
      const num = parseInt(batch.replace(/[^0-9]/g, "")) || 0;
      const csRaw = (p["f.색상/사이즈"]?.rich_text ?? []).map((t: any) => t.plain_text).join("");

      if (!map.has(batch)) {
        map.set(batch, { batch, num, qty: 0, date: "", colorMap: new Map(), sizeSet: new Set() });
      }
      const e = map.get(batch)!;
      e.qty += qty;
      if (date && (!e.date || date < e.date)) e.date = date;

      const parsed = parseColorSize(csRaw);
      if (parsed) {
        e.sizeSet.add(parsed.size);
        if (!e.colorMap.has(parsed.color)) e.colorMap.set(parsed.color, {});
        e.colorMap.get(parsed.color)![parsed.size] = qty;
      }
    }

    const batches = [...map.values()]
      .sort((a, b) => a.num - b.num)
      .map((e) => {
        const sizes = Array.from(e.sizeSet).sort(sizeSort);
        const colorSizeTable = Array.from(e.colorMap.entries()).map(([color, sizesMap]) => ({
          color,
          colorCode: "",
          sizes: sizesMap,
          total: Object.values(sizesMap).reduce((s, v) => s + v, 0),
        }));
        return {
          batch: e.batch,
          batchNum: e.num,
          totalQuantity: e.qty,
          orderDate: e.date,
          sizes,
          colorSizeTable,
        };
      });

    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error("order-batches error:", error?.message ?? error);
    return NextResponse.json({ batches: [], error: error?.message ?? "error" }, { status: 200 });
  }
}
