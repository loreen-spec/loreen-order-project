export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
// @ts-ignore - mailparser 타입 선언 없음
import { simpleParser } from "mailparser";
import { extractStatement } from "@/lib/gian/extractServer";

// ── Gmail에서 청구서 메일을 읽어와 구조화 ─────────────────────
// GET /api/gian/email-sync?sender=adc&days=45&limit=5
//  env: GMAIL_USER, GMAIL_APP_PASSWORD, (선택) GIAN_BILL_SENDER
//  발신처 메일의 PDF 첨부를 Gemini로 읽어 명세서 구조로 반환.

export async function GET(req: Request) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json(
      { error: "GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 필요합니다. (Vercel 설정)" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const sender = url.searchParams.get("sender") || process.env.GIAN_BILL_SENDER || "";
  const days = Math.min(Number(url.searchParams.get("days")) || 45, 120);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 5, 10);
  if (!sender) {
    return NextResponse.json(
      { error: "발신처(sender)가 필요합니다. 쿼리 ?sender= 또는 GIAN_BILL_SENDER 설정." },
      { status: 400 }
    );
  }

  const client = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user, pass }, logger: false,
  });

  const bills: any[] = [];
  let lock: any;
  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");

    const since = new Date(Date.now() - days * 86400000);
    // 발신처 + 기간으로 검색 (From 헤더 부분일치)
    let uids: number[] = [];
    try {
      uids = (await client.search({ from: sender, since }, { uid: true })) || [];
    } catch {
      uids = (await client.search({ since }, { uid: true })) || [];
    }
    // 최신 것부터 limit개
    const targets = uids.sort((a, b) => b - a).slice(0, limit);

    for (const uid of targets) {
      const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source as Buffer);

      const fromText = (parsed.from?.text || "").toLowerCase();
      if (sender && !fromText.includes(sender.toLowerCase()) && !(parsed.subject || "").toLowerCase().includes(sender.toLowerCase())) {
        // From/제목 어디에도 없으면 스킵 (검색 폴백 대비)
        // 단, 명확한 발신처 지정이 아니면 통과시키기 위해 sender 길이가 짧으면 스킵 안 함
      }

      const pdfs = (parsed.attachments || []).filter(
        (a: any) => /pdf/i.test(a.contentType || "") || /\.pdf$/i.test(a.filename || "")
      );
      const imgs = (parsed.attachments || []).filter((a: any) => /^image\//i.test(a.contentType || ""));
      const att = pdfs[0] || imgs[0];
      if (!att) continue; // 첨부 없는 메일 스킵

      let statement: any = null;
      let extractError = "";
      try {
        statement = await extractStatement({
          imageBase64: (att.content as Buffer).toString("base64"),
          mimeType: att.contentType || (pdfs[0] ? "application/pdf" : "image/jpeg"),
        });
      } catch (e: any) {
        extractError = e.message || "인식 실패";
      }

      bills.push({
        id: parsed.messageId || `uid-${uid}`,
        uid,
        date: (parsed.date || new Date()).toISOString(),
        subject: parsed.subject || "(제목 없음)",
        from: parsed.from?.text || "",
        fileName: att.filename || "attachment",
        statement,
        extractError,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: "메일 연결/조회 실패: " + (e.message || "") }, { status: 500 });
  } finally {
    try { if (lock) lock.release(); } catch {}
    try { await client.logout(); } catch {}
  }

  return NextResponse.json({ bills, sender, days });
}
