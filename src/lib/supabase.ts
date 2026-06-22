import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ 접두어 있는 것과 없는 것 모두 지원
const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? process.env.SUPABASE_URL  ?? "";
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, key);
