export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authUrl, hasOAuthCreds } from "@/lib/gian/google";

// Gmail 연결 시작 → 구글 동의 화면으로 리다이렉트
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!hasOAuthCreds()) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 를 먼저 Vercel 환경변수에 넣어주세요." },
      { status: 500 }
    );
  }
  return NextResponse.redirect(authUrl(origin));
}
