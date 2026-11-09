export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// 작업지시서 자동입력 크롬 확장프로그램 전용 API
// - 노션 키는 서버에만 있고, 확장프로그램은 구글 로그인 토큰만 보냄
// - @openhan.kr 구글 계정만 허용

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const ALLOWED_DOMAIN = "openhan.kr";
const ORDER_DB = "55e81c37-6fcd-4d22-bca0-94560cd96eed";

// 노션 담당자 이름(로린/써니 등) → 작업지시서에 쓰는 한글 이름
const MANAGER_MAP: Record<string, string> = {
  "로린": "박정은", "loreen": "박정은",
  "써니": "김진선", "sunny": "김진선",
  "실버": "박가은", "silver": "박가은",
  "안나": "임은영", "anna": "임은영",
  "제시카": "유가현", "jessica": "유가현",
};

// 구글 액세스 토큰 → 회사 이메일 확인
async function verifyUser(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const info = await res.json();
  const email = String(info.email ?? "").toLowerCase();
  if (String(info.email_verified) !== "true") return null;
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return null;
  // 확장프로그램용 클라이언트 ID를 지정해두면 그 앱에서 받은 토큰만 허용
  const clientId = process.env.SHEET_AUTOFILL_CLIENT_ID;
  if (clientId && info.azp !== clientId && info.aud !== clientId) return null;
  return email;
}

const getText = (prop: any): string => {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
    case "rich_text":
      return prop[prop.type]?.map((t: any) => t.plain_text).join("") ?? "";
    case "select":
    case "status":
      return prop[prop.type]?.name ?? "";
    case "multi_select":
      return prop.multi_select?.[0]?.name ?? "";
    case "people":
      return prop.people?.[0]?.name ?? "";
    default:
      return "";
  }
};

export async function GET(req: Request) {
  const email = await verifyUser(req);
  if (!email) {
    return NextResponse.json({ error: `@${ALLOWED_DOMAIN} 구글 계정으로 로그인해주세요` }, { status: 401 });
  }

  const query = new URL(req.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ email });

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DB = process.env.NOTION_DATABASE_ID!;

    // ① 제품DB: 정확히 같은 이름 → 없으면 포함하는 이름
    const search = (title: any) =>
      notion.databases.query({ database_id: DB, filter: { property: "제품명", title }, page_size: 25 }) as any;
    let results: any[] = (await search({ equals: query })).results;
    if (!results.length) {
      const similar: any[] = (await search({ contains: query })).results;
      const names = Array.from(new Set(similar.map((pg) => getText(pg.properties["제품명"]).trim())));
      if (names.length !== 1) return NextResponse.json({ email, candidates: names.slice(0, 10) });
      results = similar;
    }

    // 같은 이름 중복 페이지는 발주 연결이 많은 쪽 우선
    const score = (pg: any) =>
      (pg.properties["발주DB 롤업용"]?.relation?.length ?? 0) * 10 + (getText(pg.properties["생산공장"]) ? 1 : 0);
    const page = [...results].sort((a, b) => score(b) - score(a))[0];
    const p = page.properties;

    const managerRaw = getText(p["담당자"]).trim();
    const manager = MANAGER_MAP[managerRaw.toLowerCase()] ?? MANAGER_MAP[managerRaw] ?? managerRaw;

    // ② 발주DB: 이 제품의 모든 발주 행 (차수 전부)
    const rows: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion.databases.query({
        database_id: ORDER_DB,
        filter: { property: "관계형 title", relation: { contains: page.id } },
        start_cursor: cursor,
        page_size: 100,
      });
      rows.push(...res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);

    // "민트, :100" → 민트 / 100
    const orders = rows
      .map((row) => {
        const rp = row.properties;
        const [color = "", size = ""] = getText(rp["f.색상/사이즈"])
          .split(",")
          .map((s) => s.trim().replace(/^:/, "").trim());
        if (!color || !size) return null;
        return {
          color,
          size,
          qty: rp["g.발주수량"]?.number ?? 0,
          round: getText(rp["k.발주차수"]) || "차수 없음",
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      email,
      product: {
        name: getText(p["제품명"]),
        url: page.url,
        manager,
        managerRaw,
        factory: getText(p["생산공장"]),
        orders,
      },
    });
  } catch (e: any) {
    console.error("sheet-autofill error:", e?.message);
    return NextResponse.json({ error: "노션에서 불러오지 못했어요: " + (e?.message ?? "") }, { status: 500 });
  }
}
