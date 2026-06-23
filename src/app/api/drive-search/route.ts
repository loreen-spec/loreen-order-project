export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

// 두 문자열의 유사도 계산 (0~1)
function similarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[\s_\-\.]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // 공통 부분 문자열 비율 (bigram overlap)
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
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
    return NextResponse.json({ error: "Google API key or folder ID not configured" }, { status: 500 });
  }

  try {
    // Google Drive API로 폴더 내 xlsx 파일 목록 조회
    const params = new URLSearchParams({
      key: apiKey,
      q: `'${folderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false`,
      fields: "files(id,name,modifiedTime,size)",
      pageSize: "200",
      orderBy: "modifiedTime desc",
    });

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const files: { id: string; name: string; modifiedTime: string; size?: string }[] =
      data.files ?? [];

    if (!q) {
      // 검색어 없으면 전체 반환
      return NextResponse.json({ files: files.slice(0, 50) });
    }

    // 유사도 계산 후 70% 이상만 반환, 높은 순 정렬
    const THRESHOLD = 0.7;
    const scored = files
      .map((f) => {
        // 확장자 제거 후 비교
        const nameNoExt = f.name.replace(/\.(xlsx?|xls)$/i, "");
        const score = similarity(q, nameNoExt);
        return { ...f, score };
      })
      .filter((f) => f.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ files: scored });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
