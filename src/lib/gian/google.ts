import { google } from "googleapis";

// ── Gmail OAuth (읽기 전용) 헬퍼 ─────────────────────────────
// env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, (선택)GOOGLE_REDIRECT_URI, GMAIL_REFRESH_TOKEN

export const GMAIL_SCOPE = ["https://www.googleapis.com/auth/gmail.readonly"];

export function redirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/gian/gmail-callback`;
}

export function hasOAuthCreds() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient(origin: string) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 환경변수가 필요합니다.");
  return new google.auth.OAuth2(id, secret, redirectUri(origin));
}

export function authUrl(origin: string) {
  return oauthClient(origin).generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // refresh_token 확실히 받기
    scope: GMAIL_SCOPE,
  });
}

export function gmailClient(origin: string) {
  const refresh = process.env.GMAIL_REFRESH_TOKEN;
  if (!refresh) throw new Error("NO_REFRESH_TOKEN");
  const client = oauthClient(origin);
  client.setCredentials({ refresh_token: refresh });
  return google.gmail({ version: "v1", auth: client });
}
