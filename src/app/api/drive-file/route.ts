export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!fileId) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    // 파일 메타데이터로 mimeType 확인
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&key=${apiKey}&supportsAllDrives=true`,
      { cache: "no-store" }
    );
    if (!metaRes.ok) {
      const err = await metaRes.text();
      return NextResponse.json({ error: `메타 조회 실패: ${err}` }, { status: metaRes.status });
    }
    const meta = await metaRes.json();
    const isGoogleSheet = meta.mimeType === "application/vnd.google-apps.spreadsheet";

    let fileRes: Response;
    if (isGoogleSheet) {
      // Google 스프레드시트 → xlsx 로 export
      fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}&key=${apiKey}`,
        { cache: "no-store" }
      );
    } else {
      // 이미 xlsx/xls 바이너리 파일 → 직접 다운로드
      fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}&supportsAllDrives=true`,
        { cache: "no-store" }
      );
    }

    if (!fileRes.ok) {
      const err = await fileRes.text();
      return NextResponse.json({ error: `파일 다운로드 실패: ${err}` }, { status: fileRes.status });
    }

    const buffer = await fileRes.arrayBuffer();
    const fileName = encodeURIComponent((meta.name ?? "file").replace(/\.[^.]+$/, "") + ".xlsx");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
