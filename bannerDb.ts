import { supabase } from './supabase';
import type { BannerAd } from '@/types';

function rowToBanner(row: Record<string, unknown>): BannerAd {
  return {
    id: String(row.id),
    companyName: String(row.company_name ?? ''),
    imageUrl: String(row.image_url ?? ''),
    linkUrl: String(row.link_url ?? ''),
    startDate: String(row.start_date ?? ''),
    endDate: String(row.end_date ?? ''),
    isActive: Boolean(row.is_active),
    displayMode: (row.display_mode === 'fixed' ? 'fixed' : 'random') as 'fixed' | 'random',
    memo: row.memo ? String(row.memo) : undefined,
    createdAt: String(row.created_at ?? ''),
  };
}

function bannerToRow(b: BannerAd): Record<string, unknown> {
  return {
    id: b.id,
    company_name: b.companyName,
    image_url: b.imageUrl,
    link_url: b.linkUrl,
    start_date: b.startDate,
    end_date: b.endDate,
    is_active: b.isActive,
    display_mode: b.displayMode ?? 'random',
    memo: b.memo ?? null,
    created_at: b.createdAt,
  };
}

export async function fetchBannerAds(): Promise<BannerAd[]> {
  const { data, error } = await supabase
    .from('banner_ads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToBanner(row as Record<string, unknown>));
}

/** 오늘 기준 활성화된 배너만 조회 (프론트 노출용) - 날짜 필터는 클라이언트에서 처리 */
export async function fetchActiveBannerAds(): Promise<BannerAd[]> {
  const _d = new Date();
  const today = [_d.getFullYear(), String(_d.getMonth()+1).padStart(2,'0'), String(_d.getDate()).padStart(2,'0')].join('-');
  const { data, error } = await supabase
    .from('banner_ads')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? [])
    .map((row) => rowToBanner(row as Record<string, unknown>))
    .filter(b => b.startDate <= today && b.endDate >= today);
}

export async function upsertBannerAd(banner: BannerAd): Promise<void> {
  const { error } = await supabase
    .from('banner_ads')
    .upsert(bannerToRow(banner), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteBannerAd(id: string): Promise<void> {
  const { error } = await supabase.from('banner_ads').delete().eq('id', id);
  if (error) throw error;
}
