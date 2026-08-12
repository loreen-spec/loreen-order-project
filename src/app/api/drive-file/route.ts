export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// 공개(링크 뷰어) 구글시트를 docs.google.com 공개 export로 받기.
// API 키 불필요 + 용량 한도 없음(수동 다운로드와 동일 경로). 비공개면 HTML(로그인)이 와서 null 반환.
async function fetchPublicSheetXlsx(fileId: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
      { redirect: "follow", cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (/text\/html/i.test(ct)) return null; // 비공개 → 로그인/권한 페이지
    const buf = await res.arrayBuffer();
    // xlsx(zip) 매직넘버 'PK' 확인
    const head = new Uint8Array(buf.slice(0, 2));
    if (head[0] !== 0x50 || head[1] !== 0x4b) return null;
    return buf;
  } catch {
    return null;
  }
}

// 큰 구글시트는 export(약 10MB) 한도에 걸리므로 Sheets API로 셀 값을 직접 읽어 xlsx로 조립
async function buildXlsxFromSheetsApi(fileId: string, apiKey: string): Promise<ArrayBuffer> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?key=${apiKey}&fields=${encodeURIComponent("sheets.properties(title,gridProperties(rowCount,columnCount))")}`,
    { cache: "no-store" }
  );
  if (!metaRes.ok) throw new Error(`Sheets 메타 조회 실패: ${await metaRes.text()}`);
  const meta = await metaRes.json();
  const sheets: any[] = meta.sheets ?? [];
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const title: string = s.properties?.title ?? "Sheet";
    const rowCount = Math.min(s.properties?.gridProperties?.rowCount ?? 1000, 5000);
    const range = `'${title.replace(/'/g, "''")}'!A1:Z${rowCount}`;
    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
      { cache: "no-store" }
    );
    const rows: any[][] = valRes.ok ? ((await valRes.json()).values ?? []) : [];
    const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
    // 시트명 31자 제한
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31) || "Sheet");
  }
  if (!wb.SheetNames.length) throw new Error("시트를 찾지 못했습니다");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!fileId) return NextResponse.json({ error: "id required" }, { status: 400 });

  // 0) 공개 구글시트 → docs.google.com 공개 export (API 키·용량제한 없음). 큰 시트도 링크로 처리.
  const publicBuf = await fetchPublicSheetXlsx(fileId);
  if (publicBuf) {
    return new NextResponse(publicBuf, {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("sheet")}.xlsx`,
      },
    });
  }

  if (!apiKey) return NextResponse.json({ error: "구글시트를 읽지 못했습니다. 시트를 '링크가 있는 모든 사용자 - 뷰어'로 공유했는지 확인해주세요." }, { status: 502 });

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

    let buffer: ArrayBuffer;
    if (isGoogleSheet) {
      // 1) 우선 xlsx export 시도
      const exp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}&key=${apiKey}`,
        { cache: "no-store" }
      );
      if (exp.ok) {
        buffer = await exp.arrayBuffer();
      } else {
        // 2) 용량 초과 등으로 export 실패 → Sheets API로 셀 값 직접 읽어 조립
        try {
          buffer = await buildXlsxFromSheetsApi(fileId, apiKey);
        } catch (e) {
          const err = await exp.text().catch(() => "");
          return NextResponse.json(
            { error: `구글시트를 읽지 못했습니다. (export: ${err.slice(0, 120)} / sheets: ${String(e)})` },
            { status: 502 }
          );
        }
      }
    } else {
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}&supportsAllDrives=true`,
        { cache: "no-store" }
      );
      if (!fileRes.ok) {
        const err = await fileRes.text();
        return NextResponse.json({ error: `파일 다운로드 실패: ${err}` }, { status: fileRes.status });
      }
      buffer = await fileRes.arrayBuffer();
    }

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
