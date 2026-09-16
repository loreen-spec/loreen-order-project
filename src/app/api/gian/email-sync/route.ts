export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { gmailClient, hasOAuthCreds } from "@/lib/gian/google";
import { extractStatement } from "@/lib/gian/extractServer";
import * as XLSX from "xlsx";

// ── Gmail(OAuth 읽기전용)에서 청구서 메일을 읽어와 구조화 ──────
// GET /api/gian/email-sync?sender=adc&days=45&limit=5
//  env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GEMINI_API_KEY

function getHeader(headers: any[], name: string) {
  const h = (headers || []).find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

// payload 트리를 순회하며 PDF/이미지 첨부 파트를 찾는다
function findAttachmentPart(payload: any): any | null {
  if (!payload) return null;
  // 우선순위: PDF → 엑셀 → 이미지
  const isPdf = (p: any) => /pdf/i.test(p.mimeType || "") || /\.pdf$/i.test(p.filename || "");
  const isExcel = (p: any) => /spreadsheet|excel|ms-excel|officedocument.spreadsheet/i.test(p.mimeType || "") || /\.(xlsx|xls|csv)$/i.test(p.filename || "");
  const isImg = (p: any) => /^image\//i.test(p.mimeType || "");
  const stack = [...(payload.parts || [])];
  let excelFallback: any = null, imgFallback: any = null;
  while (stack.length) {
    const p = stack.shift();
    if (!p) continue;
    if (p.parts) stack.push(...p.parts);
    if (p.body?.attachmentId) {
      if (isPdf(p)) return p;
      if (isExcel(p) && !excelFallback) excelFallback = p;
      if (isImg(p) && !imgFallback) imgFallback = p;
    }
  }
  return excelFallback || imgFallback;
}

function isExcelPart(p: any) {
  return /spreadsheet|excel|ms-excel|officedocument.spreadsheet/i.test(p?.mimeType || "") || /\.(xlsx|xls|csv)$/i.test(p?.filename || "");
}

// 모든 첨부(파일명/타입) 수집 — 진단용
function collectAttachments(payload: any): { filename: string; mimeType: string }[] {
  const out: { filename: string; mimeType: string }[] = [];
  const stack = [...(payload?.parts || [])];
  while (stack.length) {
    const p = stack.shift();
    if (!p) continue;
    if (p.parts) stack.push(...p.parts);
    if (p.body?.attachmentId && p.filename) out.push({ filename: p.filename, mimeType: p.mimeType || "" });
  }
  return out;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const sender = url.searchParams.get("sender") || process.env.GIAN_BILL_SENDER || "";
  const days = Math.min(Number(url.searchParams.get("days")) || 45, 400);
  const after = url.searchParams.get("after") || "";  // YYYY-MM-DD 이후
  const before = url.searchParams.get("before") || ""; // YYYY-MM-DD 이전 (선택 월 제한용)
  const limit = Math.min(Number(url.searchParams.get("limit")) || 5, 25);

  if (!hasOAuthCreds()) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 미설정", needConnect: true }, { status: 400 });
  }
  if (!sender) {
    return NextResponse.json({ error: "발신처(sender)가 필요합니다." }, { status: 400 });
  }

  let gmail: any;
  try {
    gmail = gmailClient(origin);
  } catch (e: any) {
    if (e.message === "NO_REFRESH_TOKEN") {
      return NextResponse.json({ error: "Gmail이 아직 연결되지 않았어요. [Gmail 연결하기]를 눌러주세요.", needConnect: true }, { status: 400 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // 메일 1건 처리 (병렬 실행용)
  async function processMessage(id: string) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = msg.data.payload;
    const headers = payload?.headers || [];
    const att = findAttachmentPart(payload);
    const base = {
      id: getHeader(headers, "Message-ID") || id,
      gmailId: id,
      date: new Date(Number(msg.data.internalDate) || Date.now()).toISOString(),
      subject: getHeader(headers, "Subject") || "(제목 없음)",
      from: getHeader(headers, "From") || "",
    };
    if (!att) {
      const names = collectAttachments(payload).map((a) => a.filename).filter(Boolean).join(", ");
      return { ...base, fileName: names || "(첨부 없음)", statement: null,
        extractError: names ? `PDF/이미지/엑셀이 아닌 첨부(${names})` : "첨부 파일 없음" };
    }
    const attData = await gmail.users.messages.attachments.get({ userId: "me", messageId: id, id: att.body.attachmentId });
    const buf = Buffer.from(attData.data.data, "base64url");
    let statement: any = null, extractError = "";
    try {
      if (isExcelPart(att)) {
        const wb = XLSX.read(buf, { type: "buffer" });
        const chunks: string[] = [];
        for (const name of wb.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
          if (csv.trim()) chunks.push(`[시트: ${name}]\n${csv}`);
        }
        statement = await extractStatement({ text: chunks.join("\n\n").slice(0, 20000) });
      } else {
        statement = await extractStatement({
          imageBase64: buf.toString("base64"),
          mimeType: att.mimeType || (/\.pdf$/i.test(att.filename || "") ? "application/pdf" : "image/jpeg"),
        });
      }
    } catch (e: any) { extractError = e.message || "인식 실패"; }
    return { ...base, fileName: att.filename || "attachment", statement, extractError };
  }

  let bills: any[] = [];
  let matched = 0;
  try {
    let q = `from:(${sender})`;
    if (after) q += ` after:${after.replace(/-/g, "/")}`;
    if (before) q += ` before:${before.replace(/-/g, "/")}`;
    if (!after && !before) q += ` newer_than:${days}d`;
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: limit });
    const ids = (list.data.messages || []).map((m: any) => m.id);
    matched = ids.length;
    // 병렬 처리로 속도 향상
    bills = await Promise.all(ids.map((id: string) => processMessage(id)));
    bills.sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신 먼저
  } catch (e: any) {
    return NextResponse.json({ error: "메일 조회 실패: " + (e.message || "").slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({ bills, matched, sender });
}
