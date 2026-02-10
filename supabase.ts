import { createClient } from '@supabase/supabase-js'

// 환경 변수를 못 읽어올 경우를 대비해 실제 주소를 직접 적어줍니다.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'rknkfzwvsgquxafypkmu';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VvOmiyqwtvX7YzUsHeGkcQ_z2BjDepe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
