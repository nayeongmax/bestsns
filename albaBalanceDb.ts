import { supabase } from './supabase';

export interface AlbaBalanceTx {
  id: string;
  userId: string;
  type: 'charge' | 'usage';
  amount: number;
  description?: string;
  taskId?: string;
  createdAt: string;
}

export async function fetchAlbaBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('alba_balance_transactions')
    .select('type, amount')
    .eq('user_id', userId);
  return (data ?? []).reduce(
    (sum, tx) => sum + (tx.type === 'charge' ? tx.amount : -tx.amount),
    0,
  );
}

export async function fetchAlbaTransactions(userId: string): Promise<AlbaBalanceTx[]> {
  const { data } = await supabase
    .from('alba_balance_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type as 'charge' | 'usage',
    amount: r.amount,
    description: r.description,
    taskId: r.task_id,
    createdAt: r.created_at,
  }));
}

export async function chargeAlbaBalance(
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  const { error } = await supabase.from('alba_balance_transactions').insert({
    id: `ab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    type: 'charge',
    amount,
    description: description || `관리자 충전 (${amount.toLocaleString()}원)`,
  });
  if (error) throw new Error(error.message);
}

// ─── App-wide settings (bank account etc.) ────────────────────────────────────

export async function fetchAppSettings(keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value').in('key', keys);
  const result: Record<string, string> = {};
  (data ?? []).forEach((r: { key: string; value: string }) => {
    result[r.key] = r.value ?? '';
  });
  return result;
}

export async function saveAppSettings(settings: Record<string, string>): Promise<void> {
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
