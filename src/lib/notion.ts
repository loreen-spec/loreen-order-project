import { Client } from "@notionhq/client";
import type { Product, Comment } from "@/types";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

function getText(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title": return prop.title.map((t: any) => t.plain_text).join("");
    case "rich_text": return prop.rich_text.map((t: any) => t.plain_text).join("");
    case "select": return prop.select?.name ?? "";
    case "status": return prop.status?.name ?? "";
    case "number": return String(prop.number ?? "");
    case "date": return prop.date?.start ?? "";
    case "multi_select": return prop.multi_select.map((s: any) => s.name).join(", ");
    case "people": return prop.people.map((p: any) => p.name).join(", ");
    default: return "";
  }
}

function getNumber(prop: any): number {
  if (!prop) return 0;
  return prop.number ?? 0;
}

// 오즈키즈 제품DB 진행상태 → 내부 상태 매핑
function mapStatus(statusName: string): Product["status"] {
  if (!statusName) return "scheduled";
  if (statusName.includes("지연")) return "delayed";
  if (statusName.includes("입고완료") || statusName.includes("완료")) return "arrived";
  if (statusName.includes("생산중") || statusName.includes("운송") || statusName.includes("선적")) return "in_transit";
  return "scheduled";
}

export async function fetchProducts(): Promise<Product[]> {
  const allResults: any[] = [];
  let cursor: string | undefined;

  // 전체 페이지네이션으로 모두 가져오기
  do {
    const response: any = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: { property: "입고일", date: { is_not_empty: true } },
      sorts: [{ property: "입고일", direction: "ascending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    allResults.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return allResults.map((page: any) => {
    const p = page.properties;
    const statusRaw = getText(p["진행상태"]);

    return {
      id: page.id,
      notionPageId: page.id,
      name: getText(p["제품명"]),
      category: getText(p["복종"]),                   // 상의/하의/세트 등
      vendor: getText(p["생산공장"]),                  // 공장=업체
      arrivalDate: getText(p["입고일"]),
      orderQuantity: getNumber(p["입고수량"]) || getNumber(p["미니멈 수량"]) || getNumber(p["MOQ"]),
      status: mapStatus(statusRaw),
      statusLabel: statusRaw,                          // 원본 노션 상태명도 보존
      season: getText(p["시즌"]),
      notes: getText(p["판매분석"]),
      imageUrl: page.cover?.external?.url ?? page.cover?.file?.url
               ?? (p["대표이미지"]?.files?.[0]?.file?.url)
               ?? (p["대표이미지"]?.files?.[0]?.external?.url),
      brand: getText(p["브랜드"]),
      team: getText(p["담당팀"]),
      manager: getText(p["담당자"]),
    } as Product;
  });
}

export async function addCommentToNotion(pageId: string, comment: string, author: string): Promise<void> {
  await notion.comments.create({
    parent: { page_id: pageId },
    rich_text: [{ type: "text", text: { content: `[${author}] ${comment}` } }],
  });
}

export async function fetchComments(pageId: string): Promise<Comment[]> {
  const response = await notion.comments.list({ block_id: pageId });
  return (response.results as any[]).map((c) => ({
    id: c.id,
    author: c.created_by?.name ?? "Unknown",
    body: c.rich_text.map((t: any) => t.plain_text).join(""),
    createdAt: c.created_time,
  }));
}
