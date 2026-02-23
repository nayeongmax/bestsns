import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
if (!hasSupabase && import.meta.env.DEV) {
  console.warn(
    '[Supabase] .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 넣으면 DB 연동됩니다. 프로젝트 루트에 .env 파일을 만들고 .env.example을 참고해 주세요.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
);

/** DB 연동 가능 여부 (env 설정 시 true) */
export const isSupabaseConfigured = (): boolean => hasSupabase;

/** Supabase 프로젝트 URL (Edge Function 호출 등에 사용) */
export const getSupabaseUrl = (): string => supabaseUrl || '';
