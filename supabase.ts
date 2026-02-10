
import { createClient } from '@supabase/supabase-js';

// Access variables via process.env (mapped in vite.config.ts) to avoid import.meta issues
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// 설정값이 누락되었을 경우를 대비한 안전 장치
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase 설정이 감지되지 않았습니다. Netlify 환경 변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)를 설정해 주세요.");
}

const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey);
