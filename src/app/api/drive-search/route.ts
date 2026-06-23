export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

function similarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[\s_\-\.()（）]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.9;

  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let intersection = 0;
  ba.forEach((g) => { if (bb.has(g)) intersection++; });
  return (2 * intersection) / (ba.size + bb.size);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const apiKey = process.env.GOOGLE_API_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!apiKey || !folderId) {
    return NextResponse.json({ error: "환경변수 미설정: GOOGLE_API_KEY 또는 GOOGLE_DRIVE_FOLDER_ID" }, { status: 500 });
  }

  // 공유 드라이브(Shared Drive) 포함 검색을 위한 파라미터
  const params = new URLSearchParams({
    key: apiKey,
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,modifiedTime,size,mimeType)",
    pageSize: "200",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Drive API 오류 (${res.status}): ${err}` }, { status: res.status });
    }

    const data = await res.json();
    // xlsx/xls 만 필터
    const all: { id: string; name: string; modifiedTime: string; size?: string; mimeType?: string }[] =
      (data.files ?? []).filter((f: { mimeType?: string; name?: string }) =>
        f.mimeType?.includes("spreadsheet") ||
        f.mimeType?.includes("excel") ||
        /\.(xlsx?|xls)$/i.test(f.name ?? "")
      );

    if (!q) {
      return NextResponse.json({ files: all.slice(0, 100), total: all.length });
    }

    const THRESHOLD = 0.4;
    const scored = all
      .map((f) => {
        const nameNoExt = f.name.replace(/\.(xlsx?|xls)$/i, "");
        const score = similarity(q, nameNoExt);
        return { ...f, score };
      })
      .filter((f) => f.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ files: scored, total: all.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
