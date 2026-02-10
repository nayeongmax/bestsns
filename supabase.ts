import { createClient } from '@supabase/supabase-js'

// 1. 환경 변수 읽어오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. 만약 변수가 비어있다면 아예 실행을 막고 경고를 띄웁니다.
if (!supabaseUrl || supabaseUrl === 'undefined') {
  throw new Error("🚨 슈파베이스 URL 주소가 없습니다! 네트리파이 설정을 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
