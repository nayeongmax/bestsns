import { createClient } from '@supabase/supabase-js'

// process.env 대신 import.meta.env를 써야 합니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 열쇠가 비어있으면 브라우저 콘솔에 경고를 띄우게 설정 (사장님 확인용)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("🚨 슈파베이스 열쇠가 비어있습니다! 네트리파이 설정을 확인하세요.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
