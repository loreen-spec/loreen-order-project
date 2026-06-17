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

    // ② 발주DB에서 이 제품의 1차 발주 행 가져오기
    const orderRes: any = await notion.databases.query({
      database_id: ORDER_DB,
      filter: {
        and: [
          { property: "관계형 title", relation: { contains: productPageId } },
          { property: "k.발주차수", select: { equals: "1차" } },
        ],
      },
      page_size: 100,
    });

    // ③ 색상/사이즈 파싱: ":베이지, :140" → color="베이지", size="140"
    function parseColorSize(raw: string): { color: string; size: string } | null {
      // 콜론 기준으로 분리, 앞뒤 공백·이모지 정리
      const clean = raw.replace(/[^\w가-힣,. :/\-]/g, "").trim();
      // ":컬러, :사이즈" 패턴
      const m = clean.match(/:([^,]+),\s*:(\S+)/);
      if (m) return { color: m[1].trim(), size: m[2].trim() };
      // 콜론 없이 "컬러/사이즈" 패턴
      const m2 = clean.match(/^([^/,]+)[/,]\s*(\S+)/);
      if (m2) return { color: m2[1].trim(), size: m2[2].trim() };
      return null;
    }

    // ④ colorSizeTable 구성
    const colorMap = new Map<string, Record<string, number>>();
    const sizeSet  = new Set<string>();

    for (const row of orderRes.results as any[]) {
      const rp = row.properties;
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
