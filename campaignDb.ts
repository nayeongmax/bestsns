/**
 * 쿠폰·마케팅 캠페인 Supabase DB 연동 (2단계 coupon_campaigns)
 */
import { supabase } from '@/supabase';
import type { AutoCouponCampaign } from '@/types';

function campaignToRow(c: AutoCouponCampaign): Record<string, unknown> {
  return {
    id: c.id,
    title: c.title,
    discount: c.discount ?? 0,
    discount_label: c.discountLabel ?? '',
    type: c.type ?? '프로모션 쿠폰',
    expiry_days: c.expiryDays ?? 30,
    color: c.color ?? 'rose',
    target_type: c.targetType ?? 'all',
    is_active: c.isActive ?? true,
  };
}

function rowToCampaign(row: Record<string, unknown>): AutoCouponCampaign {
  return {
    id: String(row.id),
    title: String(row.title),
    discount: Number(row.discount ?? 0),
    discountLabel: String(row.discount_label ?? ''),
    type: String(row.type ?? '프로모션 쿠폰'),
    expiryDays: Number(row.expiry_days ?? 30),
    color: String(row.color ?? 'rose'),
    targetType: (row.target_type as AutoCouponCampaign['targetType']) ?? 'all',
    isActive: Boolean(row.is_active),
  };
}

export async function fetchCouponCampaigns(): Promise<AutoCouponCampaign[]> {
  const { data, error } = await supabase.from('coupon_campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToCampaign(row as Record<string, unknown>));
}

export async function upsertCouponCampaigns(list: AutoCouponCampaign[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('coupon_campaigns').upsert(list.map(campaignToRow), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCouponCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('coupon_campaigns').delete().eq('id', id);
  if (error) throw error;
}
