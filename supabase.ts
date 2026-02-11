import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rknkfzwvsgquxafypkmu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VvOmiyqwtvX7YzUsHeGkcQ_z2BjDepe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
