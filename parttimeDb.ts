/**
 * 회원 프로필(profiles) Supabase 반영
 * - 포인트, 쿠폰, 닉네임, 전문가/프리랜서 신청 등 변경 시 DB에 저장
 */
import { supabase } from '@/supabase';
import type { UserProfile, Coupon } from '@/types';

function toSnakePayload(partial: Partial<{
  points: number;
  coupons: Coupon[];
  nickname: string;
  profileImage: string;
  email: string;
  phone: string;
  sellerStatus: string;
  sellerApplication: unknown;
  pendingApplication: unknown;
  freelancerStatus: string;
  freelancerApplication: unknown;
  totalPurchaseAmount: number;
  totalSalesAmount: number;
}>) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (partial.points !== undefined) row.points = partial.points;
  if (partial.coupons !== undefined) row.coupons = partial.coupons;
  if (partial.nickname !== undefined) row.nickname = partial.nickname;
  if (partial.profileImage !== undefined) row.profile_image = partial.profileImage;
  if (partial.email !== undefined) row.email = partial.email;
  if (partial.phone !== undefined) row.phone = partial.phone;
  if (partial.sellerStatus !== undefined) row.seller_status = partial.sellerStatus;
  if (partial.sellerApplication !== undefined) row.seller_application = partial.sellerApplication;
  if (partial.pendingApplication !== undefined) row.pending_application = partial.pendingApplication;
  if (partial.freelancerStatus !== undefined) row.freelancer_status = partial.freelancerStatus;
  if (partial.freelancerApplication !== undefined) row.freelancer_application = partial.freelancerApplication;
  if (partial.totalPurchaseAmount !== undefined) row.total_purchase_amount = partial.totalPurchaseAmount;
  if (partial.totalSalesAmount !== undefined) row.total_sales_amount = partial.totalSalesAmount;
  return row;
}

/** 프로필 일부 필드만 DB에 반영 (포인트, 쿠폰, 닉네임, 전문가/프리랜서 신청 등) */
export async function updateProfile(
  userId: string,
  partial: Parameters<typeof toSnakePayload>[0]
): Promise<void> {
  const row = toSnakePayload(partial);
  if (Object.keys(row).length <= 1) return; // updated_at만 있으면 스킵
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}
