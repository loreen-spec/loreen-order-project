export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

// 두 문자열의 유사도 계산 (0~1) — bigram overlap
function similarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[\s_\-\.()（）]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // 포함 관계면 높은 점수
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

  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: `'${folderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`,
      fields: "files(id,name,modifiedTime,size)",
      pageSize: "200",
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Drive API 오류: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const files: { id: string; name: string; modifiedTime: string; size?: string }[] =
      data.files ?? [];

    if (!q) {
      return NextResponse.json({ files: files.slice(0, 100) });
    }

    // 유사도 40% 이상, 높은 순 정렬
    const THRESHOLD = 0.4;
    const scored = files
      .map((f) => {
        const nameNoExt = f.name.replace(/\.(xlsx?|xls)$/i, "");
        const score = similarity(q, nameNoExt);
        return { ...f, score };
      })
      .filter((f) => f.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ files: scored, total: files.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
