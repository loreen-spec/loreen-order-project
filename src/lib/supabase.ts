import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ 접두어 있는 것과 없는 것 모두 지원
const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? process.env.SUPABASE_URL  ?? "";
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

// 서버 전용 서비스롤 키 (RLS 우회). 없으면 anon으로 폴백
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabase = createClient(url, key);

// 서버 라우트 전용 — RLS를 우회하여 저장/수정/삭제 보장
export const supabaseAdmin = createClient(url, serviceKey || key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 서비스롤 키가 실제로 설정됐는지 (진단용)
export const hasServiceKey = !!serviceKey;
