export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { gmailClient, hasOAuthCreds } from "@/lib/gian/google";
import { extractStatement } from "@/lib/gian/extractServer";

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
  const parts = payload.parts || [];
  // 우선 PDF
  const isPdf = (p: any) => /pdf/i.test(p.mimeType || "") || /\.pdf$/i.test(p.filename || "");
  const isImg = (p: any) => /^image\//i.test(p.mimeType || "");
  const stack = [...parts];
  let imgFallback: any = null;
  while (stack.length) {
    const p = stack.shift();
    if (!p) continue;
    if (p.parts) stack.push(...p.parts);
    if (p.body?.attachmentId) {
      if (isPdf(p)) return p;
      if (isImg(p) && !imgFallback) imgFallback = p;
    }
  }
  return imgFallback;
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const sender = url.searchParams.get("sender") || process.env.GIAN_BILL_SENDER || "";
  const days = Math.min(Number(url.searchParams.get("days")) || 45, 120);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 5, 10);

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

  const bills: any[] = [];
  try {
    const q = `from:(${sender}) has:attachment newer_than:${days}d`;
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: limit });
    const ids = (list.data.messages || []).map((m: any) => m.id);

    for (const id of ids) {
      const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const payload = msg.data.payload;
      const headers = payload?.headers || [];
      const att = findAttachmentPart(payload);
      if (!att) continue;

      const attData = await gmail.users.messages.attachments.get({
        userId: "me", messageId: id, id: att.body.attachmentId,
      });
      const base64 = Buffer.from(attData.data.data, "base64url").toString("base64");

      let statement: any = null;
      let extractError = "";
      try {
        statement = await extractStatement({
          imageBase64: base64,
          mimeType: att.mimeType || (/\.pdf$/i.test(att.filename || "") ? "application/pdf" : "image/jpeg"),
        });
      } catch (e: any) {
        extractError = e.message || "인식 실패";
      }

      bills.push({
        id: getHeader(headers, "Message-ID") || id,
        gmailId: id,
        date: new Date(Number(msg.data.internalDate) || Date.now()).toISOString(),
        subject: getHeader(headers, "Subject") || "(제목 없음)",
        from: getHeader(headers, "From") || "",
        fileName: att.filename || "attachment",
        statement,
        extractError,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "메일 조회 실패: " + (e.message || "").slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({ bills, sender, days });
}
