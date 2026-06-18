export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const REAL_ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed"; // 오즈키즈 발주 DB

// globalThis에 저장 → Next.js 핫리로드에서도 캐시 유지
const CACHE_TTL = 5 * 60 * 1000; // 5분
const g = globalThis as any;
if (!g._ordersCache) g._ordersCache = null;
function getCache(): { data: OrderProduct[]; ts: number } | null { return g._ordersCache; }
function setCache(data: OrderProduct[]) { g._ordersCache = { data, ts: Date.now() }; }
function clearCache() { g._ordersCache = null; }

export interface OrderRow {
  id: string;
  colorSize: string;
  quantity: number;
  batch: string;
  orderDate: string;
  productPageId: string;
}

export interface OrderProduct {
  id: string;
  name: string;
  board: string;
  status: string;
  vendor: string;
  arrivalDate: string;
  category: string;
  totalQuantity: number;
  imageUrl?: string;   // 노션 페이지 커버 or 이미지 속성
  latestBatch?: string; // 최신 발주 차수 (예: "3차")
  rows: OrderRow[];
}

const BATCH_SIZE = 10; // Notion OR 필터 성능 최적값

async function queryOrderRows(notion: Client, productIds: string[]): Promise<any[]> {
  if (productIds.length === 0) return [];
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
  return rows;
}

export async function GET() {
  // 서버 캐시 유효하면 즉시 반환
  const cached = getCache();
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }
  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const MAIN_DB = process.env.NOTION_DATABASE_ID!;

    const getText = (prop: any): string => {
      if (!prop) return "";
      if (prop.type === "title")     return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "rich_text") return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      if (prop.type === "select")    return prop.select?.name ?? "";
      if (prop.type === "status")    return prop.status?.name ?? "";
      if (prop.type === "date")      return prop.date?.start ?? "";
      return "";
    };

    // ① 생산 요청 제품 조회
    const productRes: any = await notion.databases.query({
      database_id: MAIN_DB,
      filter: {
        or: [
          { property: "진행상태", status: { equals: "생산 요청(국내)" } },
          { property: "진행상태", status: { equals: "생산 요청(해외)" } },
        ],
      },
      page_size: 100,
    });

    const productMap = new Map<string, Omit<OrderProduct, "rows" | "totalQuantity" | "latestBatch">>();
    for (const page of productRes.results as any[]) {
      const p = page.properties;

      // 대표이미지: "대표이미지" files 속성
      let imageUrl: string | undefined;
      const imgProp = p["대표이미지"];
      if (imgProp?.type === "files" && imgProp.files?.length > 0) {
        const f = imgProp.files[0];
        imageUrl = f.type === "external" ? f.external?.url : f.file?.url;
      }

      // 최신 차수: 제품 DB의 "발주차수_최대" 롤업 (number or formula)
      let latestBatchFromProduct: string | undefined;
      const maxBatchProp = p["발주차수_최대"];
      if (maxBatchProp) {
        let num: number | null = null;
        if (maxBatchProp.type === "number")  num = maxBatchProp.number;
        if (maxBatchProp.type === "rollup")  num = maxBatchProp.rollup?.number ?? null;
        if (maxBatchProp.type === "formula") num = maxBatchProp.formula?.number ?? null;
        if (num !== null && num > 0) latestBatchFromProduct = `${num}차`;
      }

      productMap.set(page.id, {
        id:          page.id,
        name:        getText(p["제품명"]),
        board:       getText(p["의류/슈즈/잡화"]) || "의류",
        status:      getText(p["진행상태"]),
        vendor:      getText(p["생산공장"]),
        arrivalDate: getText(p["입고일"]),
        category:    getText(p["복종"]),
        imageUrl,
        latestBatch: latestBatchFromProduct,
      });
    }

    if (productMap.size === 0) return NextResponse.json([]);

    // ② 10개씩 배치로 나눠 병렬 쿼리
    const productIds = [...productMap.keys()];
    const batches: string[][] = [];
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      batches.push(productIds.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map((batch) => queryOrderRows(notion, batch)));
    const allOrderRows = batchResults.flat();

    // ③ 발주 행 → 제품 매핑
    const rowsByProduct = new Map<string, OrderRow[]>();
    for (const row of allOrderRows) {
      const p = row.properties;
      const relIds: string[] = p["관계형 title"]?.relation?.map((r: any) => r.id) ?? [];
      const productPageId = relIds.find((rid) => productMap.has(rid)) ?? "";
      if (!productPageId) continue;

      if (!rowsByProduct.has(productPageId)) rowsByProduct.set(productPageId, []);
      rowsByProduct.get(productPageId)!.push({
        id:            row.id,
        colorSize:     p["f.색상/사이즈"]?.rich_text?.[0]?.plain_text ?? "",
        quantity:      p["g.발주수량"]?.number ?? 0,
        batch:         p["k.발주차수"]?.select?.name ?? p["k.발주차수"]?.rich_text?.[0]?.plain_text ?? "",
        orderDate:     p["a.발주일"]?.date?.start ?? "",
        productPageId,
      });
    }

    // ④ 조합 및 정렬
    const boardOrder:  Record<string, number> = { 의류: 0, 슈즈: 1, 잡화: 2 };
    const statusOrder: Record<string, number> = { "생산 요청(국내)": 0, "생산 요청(해외)": 1 };

    const result: OrderProduct[] = [...productMap.entries()].map(([id, info]) => {
      const rows = rowsByProduct.get(id) ?? [];

      // 최신 차수: 제품 DB latestBatch 우선, 없으면 발주 행에서 계산
      let latestBatch = info.latestBatch;
      if (!latestBatch) {
        const batchList = rows
          .map((r) => r.batch?.trim())
          .filter(Boolean)
          .map((b) => ({ raw: b, num: parseInt(b!.replace(/[^0-9]/g, "")) || 0 }));
        if (batchList.length > 0)
          latestBatch = batchList.sort((a, b) => b.num - a.num)[0].raw;
      }

      return { ...info, rows, totalQuantity: rows.reduce((s, r) => s + r.quantity, 0), latestBatch };
    });

    result.sort((a, b) => {
      const bo = (boardOrder[a.board] ?? 9) - (boardOrder[b.board] ?? 9);
      return bo !== 0 ? bo : (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    });

    setCache(result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Orders API Error:", error?.message ?? error);
    const stale = getCache();
    if (stale) return NextResponse.json(stale.data); // 에러 시 이전 캐시 반환
    return NextResponse.json([], { status: 200 });
  }
}
