export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json(null);

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DB = process.env.NOTION_DATABASE_ID!;

    // ① 제품DB 검색
    const res: any = await notion.databases.query({
      database_id: DB,
      filter: { property: "제품명", title: { contains: query } },
      page_size: 10,
    });

    if (!res.results.length) return NextResponse.json(null);

    // 정확히 일치하는 것 우선
    const exact = res.results.find((p: any) => {
      const title = p.properties["제품명"]?.title?.map((t: any) => t.plain_text).join("") ?? "";
      return title.trim() === query;
    }) ?? res.results[0];

    const p = exact.properties;
    const productPageId = exact.id;

    const getText = (prop: any): string => {
      if (!prop) return "";
      if (prop.type === "title")      return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "rich_text")  return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "select")     return prop.select?.name ?? "";
      if (prop.type === "status")     return prop.status?.name ?? "";
      return "";
    };

    const season  = p["시즌"]?.multi_select?.[0]?.name ?? "";
    const year    = getText(p["개발년도"]);
    const category = getText(p["복종"]);
    const vendor  = getText(p["생산공장"]);

    let imageUrl: string | undefined;
    const imgProp = p["대표이미지"];
    if (imgProp?.type === "files" && imgProp.files?.length > 0) {
      const f = imgProp.files[0];
      imageUrl = f.type === "external" ? f.external?.url : f.file?.url;
    }

    // ② 발주DB에서 이 제품의 모든 발주 행 가져오기 (차수 필터 없이, 페이지네이션)
    const orderRows: any[] = [];
    let cursor: string | undefined;
    do {
      const orderRes: any = await notion.databases.query({
        database_id: ORDER_DB,
        filter: { property: "관계형 title", relation: { contains: productPageId } },
        start_cursor: cursor,
        page_size: 100,
      });
      orderRows.push(...orderRes.results);
      cursor = orderRes.has_more ? orderRes.next_cursor : undefined;
    } while (cursor);

    // 차수 읽기 (select 또는 rich_text 모두 지원)
    const getBatch = (rp: any): string =>
      rp["k.발주차수"]?.select?.name ??
      rp["k.발주차수"]?.rich_text?.[0]?.plain_text ??
      "";
    const batchNum = (b: string) => parseInt(b.replace(/[^0-9]/g, "")) || 0;

    // 대상 차수 결정: 1차 우선, 없으면 가장 이른 차수
    const availableNums = Array.from(
      new Set(orderRows.map((r) => batchNum(getBatch(r.properties))).filter((n) => n > 0)),
    ).sort((a, b) => a - b);
    const targetNum = availableNums.includes(1) ? 1 : (availableNums[0] ?? 0);

    // ③ 색상/사이즈 파싱: "블랙,  :140" → color="블랙", size="140"
    //    (trim 먼저 → 앞의 콜론 제거 → 다시 trim)
    function parseColorSize(raw: string): { color: string; size: string } | null {
      const parts = raw.split(",").map((s) => s.trim().replace(/^:/, "").trim());
      const color = parts[0] ?? "";
      const size  = parts[1] ?? "";
      if (!color || !size) return null;
      return { color, size };
    }

    // ④ colorSizeTable 구성 (대상 차수 행만)
    const colorMap = new Map<string, Record<string, number>>();
    const sizeSet  = new Set<string>();

    for (const row of orderRows) {
      const rp = row.properties;
      if (batchNum(getBatch(rp)) !== targetNum) continue; // 대상 차수만
      const csRaw = (rp["f.색상/사이즈"]?.rich_text ?? []).map((t: any) => t.plain_text).join("");
      const qty   = rp["g.발주수량"]?.number ?? 0;
      const parsed = parseColorSize(csRaw);
      if (!parsed) continue;

      const { color, size } = parsed;
      sizeSet.add(size);
      if (!colorMap.has(color)) colorMap.set(color, {});
      colorMap.get(color)![size] = qty;
    }

    const sizes = Array.from(sizeSet).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    });

    const colorSizeTable = Array.from(colorMap.entries()).map(([color, sizesMap]) => ({
      color,
      colorCode: "",
      sizes: sizesMap,
      total: Object.values(sizesMap).reduce((s, v) => s + v, 0),
    }));

    const totalQuantity = colorSizeTable.reduce((s, r) => s + r.total, 0);

    return NextResponse.json({
      notionProductId: productPageId.replace(/-/g, ""),
      productName:     getText(p["제품명"]),
      vendor,
      year,
      season,
      category,
      board: getText(p["의류/슈즈/잡화"]),
      imageUrl,
      // 발주수량표 자동완성
      sizes,
      colorSizeTable,
      totalQuantity,
    });
  } catch (e: any) {
    console.error("notion-product-lookup error:", e?.message);
    return NextResponse.json(null);
  }
}
