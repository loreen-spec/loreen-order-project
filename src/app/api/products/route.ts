import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

    const today = new Date();
    const from = new Date(today); from.setMonth(from.getMonth() - 3);
    const to   = new Date(today); to.setMonth(to.getMonth() + 6);
    const fmt  = (d: Date) => d.toISOString().split("T")[0];

    const allResults: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          and: [
            { property: "입고일", date: { on_or_after: fmt(from) } },
            { property: "입고일", date: { on_or_before: fmt(to) } },
          ],
        },
        sorts: [{ property: "입고일", direction: "ascending" }],
        start_cursor: cursor,
        page_size: 100,
      });
      allResults.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const getText = (prop: any): string => {
      if (!prop) return "";
      if (prop.type === "title")        return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "rich_text")    return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "select")       return prop.select?.name ?? "";
      if (prop.type === "status")       return prop.status?.name ?? "";
      if (prop.type === "date")         return prop.date?.start ?? "";
      if (prop.type === "multi_select") return prop.multi_select?.map((s: any) => s.name).join(", ") ?? "";
      if (prop.type === "people")       return prop.people?.map((pp: any) => pp.name).join(", ") ?? "";
      return "";
    };

    const products = allResults.map((page: any) => {
      const p = page.properties;
      const statusRaw = getText(p["진행상태"]);

      let status = "scheduled";
      if (statusRaw.includes("지연"))                                          status = "delayed";
      else if (statusRaw.includes("입고완료") || statusRaw.includes("완료"))  status = "arrived";
      else if (statusRaw.includes("생산중") || statusRaw.includes("운송") || statusRaw.includes("선적")) status = "in_transit";

      // 입고수량 → 미니멈 수량 → MOQ 순으로 폴백
      const qty =
        (p["입고수량"]?.number ?? null) ??
        (p["미니멈 수량"]?.number ?? null) ??
        (p["MOQ"]?.number ?? null) ??
        0;

      return {
        id: page.id,
        notionPageId: page.id,
        name:          getText(p["제품명"]),
        category:      getText(p["복종"]),
        board:         getText(p["의류/슈즈/잡화"]) || "의류",  // 의류/슈즈/잡화
        vendor:        getText(p["생산공장"]),
        arrivalDate:   getText(p["입고일"]),
        orderQuantity: qty,
        status,
        statusLabel:   statusRaw,
        season:        getText(p["시즌"]),
        brand:         getText(p["브랜드"]),
        team:          getText(p["담당팀"]),
        manager:       getText(p["담당자"]),
        imageUrl:
          page.cover?.external?.url ??
          page.cover?.file?.url ??
          p["대표이미지"]?.files?.[0]?.file?.url ??
          p["대표이미지"]?.files?.[0]?.external?.url,
      };
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("API Error:", error?.message ?? error);
    return NextResponse.json([], { status: 200 });
  }
}
