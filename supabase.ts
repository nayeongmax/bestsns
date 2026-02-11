import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 설정이 없습니다. .env 또는 Netlify 환경 변수에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 설정해 주세요.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
