import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const MAIN_DB = process.env.NOTION_DATABASE_ID!;
  const REAL_ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed";

  // 제품 DB 첫 페이지
  const productRes: any = await notion.databases.query({
    database_id: MAIN_DB,
    filter: {
      or: [
        { property: "진행상태", status: { equals: "생산 요청(국내)" } },
        { property: "진행상태", status: { equals: "생산 요청(해외)" } },
      ],
    },
    page_size: 1,
  });

  const page: any = productRes.results[0];

  // 모든 속성 타입과 값 요약
  const allProps = Object.entries(page?.properties ?? {}).map(([name, val]: any) => ({
    name,
    type: val.type,
    // 값 미리보기
    preview:
      val.type === "title"     ? val.title?.map((t: any) => t.plain_text).join("") :
      val.type === "rich_text" ? val.rich_text?.map((t: any) => t.plain_text).join("") :
      val.type === "select"    ? val.select?.name :
      val.type === "status"    ? val.status?.name :
      val.type === "files"     ? val.files?.map((f: any) => f.type === "external" ? f.external?.url : f.file?.url) :
      val.type === "url"       ? val.url :
      val.type === "number"    ? val.number :
      "(기타)",
  }));

  // 발주 DB 첫 3행
  const orderRes: any = await notion.databases.query({
    database_id: REAL_ORDER_DB,
    page_size: 3,
  });

  const orderRows = orderRes.results.map((row: any) => {
    const p = row.properties;
    return Object.entries(p).map(([name, val]: any) => ({
      name,
      type: val.type,
      preview:
        val.type === "title"     ? val.title?.map((t: any) => t.plain_text).join("") :
        val.type === "rich_text" ? val.rich_text?.map((t: any) => t.plain_text).join("") :
        val.type === "select"    ? val.select?.name :
        val.type === "number"    ? val.number :
        val.type === "relation"  ? val.relation?.map((r: any) => r.id) :
        val.type === "formula"   ? val.formula :
        "(기타)",
    }));
  });

  return NextResponse.json({
    product_cover: page?.cover ?? null,
    product_props: allProps,
    order_rows_props: orderRows,
  }, { headers: { "Content-Type": "application/json" } });
}
