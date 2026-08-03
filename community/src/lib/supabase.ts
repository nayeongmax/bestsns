import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY ?? '';

const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

/** Supabase 연동 여부. false 이면 localStorage 데모 모드로 동작 */
export const isSupabaseConfigured = (): boolean => hasSupabase;
