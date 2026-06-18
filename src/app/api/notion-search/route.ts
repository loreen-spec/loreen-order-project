export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

// 날짜 필터 없이 전체 제품명 → notionPageId 맵을 반환
export async function GET() {
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

    const allResults: any[] = [];
    let cursor: string | undefined;

    do {
      const res: any = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });
      allResults.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    const getText = (prop: any): string => {
      if (!prop) return "";
      if (prop.type === "title")     return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "rich_text") return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      return "";
    };

    // 품명 → Notion URL 맵
    const map: Record<string, string> = {};
    allResults.forEach((page: any) => {
      const name = getText(page.properties["제품명"])?.trim();
      if (name) {
        map[name] = `https://www.notion.so/${page.id.replace(/-/g, "")}`;
      }
    });

    return NextResponse.json(map);
  } catch (error: any) {
    console.error("notion-search error:", error?.message ?? error);
    return NextResponse.json({}, { status: 200 });
  }
}
