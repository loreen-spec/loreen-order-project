export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { oauthClient } from "@/lib/gian/google";

// 구글 동의 후 콜백 → refresh_token 발급받아 안내 페이지로 표시
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const page = (title: string, body: string, color = "#836CE0") => new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title><style>body{font-family:-apple-system,'Malgun Gothic',system-ui,sans-serif;background:#FAF9FC;color:#1E1B2E;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}
    .card{background:#fff;border:1px solid #E9E5F2;border-radius:16px;box-shadow:0 8px 30px rgba(91,68,196,.1);max-width:520px;padding:28px;line-height:1.6}
    h1{font-size:20px;margin:0 0 12px;color:${color}}code,.tok{background:#F4F2FA;border:1px solid #DDD7EC;border-radius:8px;padding:2px 6px;font-size:13px;word-break:break-all}
    .tok{display:block;padding:12px;margin:10px 0;font-size:13px}b{color:${color}}ol{padding-left:20px}li{margin:6px 0}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );

  if (error) return page("연결 취소됨", `<h1>연결이 취소됐어요</h1><p>다시 시도하려면 앱에서 [Gmail 연결하기]를 눌러주세요. (${error})</p>`, "#D97706");
  if (!code) return page("오류", `<h1>코드가 없습니다</h1><p>앱에서 다시 [Gmail 연결하기]를 눌러주세요.</p>`, "#DC2626");

  try {
    const client = oauthClient(url.origin);
    const { tokens } = await client.getToken(code);
    const refresh = tokens.refresh_token;
    if (!refresh) {
      return page("리프레시 토큰 없음",
        `<h1>토큰을 다시 받아야 해요</h1><p>이미 한 번 연결한 계정이면 refresh_token이 안 올 수 있어요. 구글 계정 → 보안 → <b>타사 액세스</b>에서 이 앱 접근을 삭제한 뒤 다시 [Gmail 연결하기] 해주세요.</p>`, "#D97706");
    }
    return page("Gmail 연결 성공",
      `<h1>✅ Gmail 연결 성공!</h1>
      <p>아래 <b>리프레시 토큰</b>을 복사해서 Vercel 환경변수에 넣어주세요:</p>
      <p>Vercel → <b>openhan-gianmate</b> → Settings → Environment Variables → 아래 추가 → Save → Redeploy</p>
      <div class="tok"><b>GMAIL_REFRESH_TOKEN</b><br>${refresh}</div>
      <ol>
        <li>위 값을 <code>GMAIL_REFRESH_TOKEN</code> 으로 저장</li>
        <li>저장 후 재배포되면 정기결제 → 받은 청구서에서 <b>메일 확인</b>이 됩니다</li>
      </ol>
      <p style="font-size:12px;color:#9B94AA">※ 이 토큰은 비밀번호처럼 관리하세요. 읽기 전용 권한이라 메일을 삭제/발송할 수는 없어요.</p>`);
  } catch (e: any) {
    return page("교환 실패", `<h1>토큰 교환 실패</h1><p>${(e.message || "").slice(0, 200)}</p><p>Client ID/Secret과 리다이렉트 URI 설정을 확인해주세요.</p>`, "#DC2626");
  }
}
