export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId")?.trim();
  if (!pageId) return NextResponse.json({ url: null });

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const page: any = await notion.pages.retrieve({ page_id: pageId });
    const imgProp = page.properties?.["대표이미지"];
    if (imgProp?.type === "files" && imgProp.files?.length > 0) {
      const f = imgProp.files[0];
      const url = f.type === "external" ? f.external?.url : f.file?.url;
      return NextResponse.json({ url: url ?? null });
    }
    return NextResponse.json({ url: null });
  } catch {
    return NextResponse.json({ url: null });
  }
}
