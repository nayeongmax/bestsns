/**
 * N잡스토어 / 구매자·판매자 워크페이스 Supabase DB 연동
 * - store_products (상품), store_orders (주문), reviews (리뷰), order_buyer_flags (구매확정/리뷰/다운로드)
 *
 * DB 마이그레이션 (store_orders 테이블에 결제 수단/로그 컬럼 추가):
 *   ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_method text;
 *   ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_log text;
 */
import { supabase } from './supabase';
import type { EbookProduct, EbookTier, StoreOrder, Review, StoreType } from '@/types';

// ─── store_products (N잡 상품) ────────────────────────────────────────
function productToRow(p: EbookProduct): Record<string, unknown> {
  return {
    id: p.id,
    store_type: p.storeType ?? 'ebook',
    title: p.title,
    category: p.category,
    sub_category: p.subCategory ?? '',
    author: p.author,
    author_id: p.authorId,
    thumbnail: p.thumbnail ?? '',
    price: p.price ?? 0,
    tiers: (p.tiers ?? []) as unknown[],
    description: p.description ?? null,
    index_text: p.index ?? null,
    service_method: p.serviceMethod ?? null,
    faqs: (p.faqs ?? []) as unknown[],
    attached_images: (p.attachedImages ?? []) as unknown[],
    status: p.status ?? 'pending',
    created_at: p.createdAt ?? new Date().toISOString(),
    is_paused: p.isPaused ?? false,
    is_prime: p.isPrime ?? false,
    is_hot: p.isHot ?? false,
    is_new: p.isNew ?? false,
    is_secret: p.isSecret ?? false,
    rejection_reason: p.rejectionReason ?? null,
    snapshot: p.snapshot ?? null,
  };
}

function rowToProduct(row: Record<string, unknown>): EbookProduct {
  return {
    id: String(row.id),
    storeType: (row.store_type as StoreType) ?? 'ebook',
    title: String(row.title),
    category: String(row.category),
    subCategory: String(row.sub_category ?? ''),
    author: String(row.author),
    authorId: String(row.author_id ?? ''),
    thumbnail: String(row.thumbnail ?? ''),
    price: Number(row.price ?? 0),
    tiers: (Array.isArray(row.tiers) ? row.tiers : []) as EbookTier[],
    description: row.description != null ? String(row.description) : '',
    index: row.index_text != null ? String(row.index_text) : undefined,
    serviceMethod: row.service_method != null ? String(row.service_method) : undefined,
    faqs: Array.isArray(row.faqs) ? (row.faqs as { question: string; answer: string }[]) : undefined,
    attachedImages: Array.isArray(row.attached_images) ? (row.attached_images as string[]) : undefined,
    status: (row.status as EbookProduct['status']) ?? 'pending',
    createdAt: String(row.created_at ?? ''),
    isPaused: Boolean(row.is_paused),
    isPrime: Boolean(row.is_prime),
    isHot: Boolean(row.is_hot),
    isNew: Boolean(row.is_new),
    isSecret: Boolean(row.is_secret),
    rejectionReason: row.rejection_reason != null ? String(row.rejection_reason) : undefined,
    snapshot: row.snapshot as EbookProduct['snapshot'] | undefined,
  };
}

export async function fetchStoreProducts(): Promise<EbookProduct[]> {
  const { data, error } = await supabase.from('store_products').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

/** 일반 사용자용: 비밀 상품(is_secret=true) 및 미승인 상품 제외 */
export async function fetchPublicStoreProducts(): Promise<EbookProduct[]> {
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('is_secret', false)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

export async function upsertStoreProduct(p: EbookProduct): Promise<void> {
  const { error } = await supabase.from('store_products').upsert(productToRow(p), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertStoreProducts(list: EbookProduct[]): Promise<void> {
  if (list.length === 0) return;
  // 상품별 개별 저장 — 일괄 전송 시 base64 이미지로 인해 payload 한도 초과 방지
  for (const p of list) {
    const { error } = await supabase.from('store_products').upsert(productToRow(p), { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function deleteStoreProduct(id: string): Promise<void> {
  const { error } = await supabase.from('store_products').delete().eq('id', id);
  if (error) throw error;
}

// ─── 어드민 전용: store-admin Netlify 함수(service_role)를 통한 DB 접근 ──────
// RLS 적용 후 anon key로는 비밀 상품에 접근이 제한되므로 어드민 작업은 이 함수들을 사용합니다.

const STORE_ADMIN_URL = '/.netlify/functions/store-admin';

function getAdminKey(): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PANEL_PASSWORD
    ?? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PASSWORD
    ?? '';
}

async function storeAdminGet(resource: string): Promise<unknown[]> {
  const res = await fetch(`${STORE_ADMIN_URL}?resource=${resource}`, {
    headers: { 'x-admin-key': getAdminKey() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function storeAdminPost(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(STORE_ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': getAdminKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

/** 어드민 전용: 비밀 상품 포함 전체 상품 목록 조회 */
export async function fetchStoreProductsAdmin(): Promise<EbookProduct[]> {
  const data = await storeAdminGet('products');
  return data.map((row) => rowToProduct(row as Record<string, unknown>));
}

/** 어드민 전용: 단일 상품 upsert (비밀 상품 토글 등) */
export async function upsertStoreProductAdmin(p: EbookProduct): Promise<void> {
  await storeAdminPost({ action: 'upsertProduct', product: productToRow(p) });
}

/** 어드민 전용: 복수 상품 upsert */
export async function upsertStoreProductsAdmin(list: EbookProduct[]): Promise<void> {
  if (list.length === 0) return;
  await storeAdminPost({ action: 'upsertProducts', products: list.map(productToRow) });
}

/** 어드민 전용: 상품 삭제 */
export async function deleteStoreProductAdmin(id: string): Promise<void> {
  await storeAdminPost({ action: 'deleteProduct', id });
}

// ─── store_orders ─────────────────────────────────────────────────────
function orderToRow(o: StoreOrder): Record<string, unknown> {
  return {
    id: o.id,
    user_id: o.userId,
    user_nickname: o.userNickname,
    seller_nickname: o.sellerNickname,
    order_time: o.orderTime,
    confirmed_at: o.confirmedAt ?? null,
    product_id: o.productId,
    product_name: o.productName,
    tier_name: o.tierName ?? null,
    price: o.price ?? 0,
    store_type: o.storeType ?? 'ebook',
    status: o.status,
    payment_id: o.paymentId ?? null,
    payment_method: o.paymentMethod ?? null,
    payment_log: o.paymentLog ?? null,
    receipt_url: o.receiptUrl ?? null,
    downloaded_at: o.downloadedAt ?? null,
    buyer_tax_info: o.buyerTaxInfo ?? null,
    review_id: o.reviewId ?? null,
  };
}

function rowToOrder(row: Record<string, unknown>): StoreOrder {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userNickname: String(row.user_nickname),
    sellerNickname: String(row.seller_nickname),
    orderTime: String(row.order_time),
    confirmedAt: row.confirmed_at != null ? String(row.confirmed_at) : undefined,
    productId: String(row.product_id),
    productName: String(row.product_name),
    tierName: String(row.tier_name ?? ''),
    price: Number(row.price ?? 0),
    storeType: (row.store_type as StoreType) ?? 'ebook',
    status: (row.status as StoreOrder['status']) ?? '결제완료',
    paymentId: row.payment_id != null ? String(row.payment_id) : undefined,
    paymentMethod: row.payment_method != null ? String(row.payment_method) : undefined,
    paymentLog: row.payment_log != null ? String(row.payment_log) : undefined,
    receiptUrl: row.receipt_url != null ? String(row.receipt_url) : undefined,
    downloadedAt: row.downloaded_at != null ? String(row.downloaded_at) : undefined,
    buyerTaxInfo: row.buyer_tax_info != null ? String(row.buyer_tax_info) : undefined,
    reviewId: row.review_id != null ? String(row.review_id) : undefined,
  };
}

export async function fetchStoreOrders(): Promise<StoreOrder[]> {
  const { data, error } = await supabase.from('store_orders').select('*').order('order_time', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as Record<string, unknown>));
}

export async function upsertStoreOrder(o: StoreOrder): Promise<void> {
  const { error } = await supabase.from('store_orders').upsert(orderToRow(o), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertStoreOrders(list: StoreOrder[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('store_orders').upsert(list.map(orderToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── reviews ──────────────────────────────────────────────────────────
function reviewToRow(r: Review): Record<string, unknown> {
  return {
    id: r.id,
    product_id: r.productId,
    user_id: r.userId,
    author: r.author,
    rating: r.rating ?? 5,
    content: r.content ?? null,
    date: r.date ?? '',
    reply: r.reply ?? null,
    reply_date: r.replyDate ?? null,
  };
}

function rowToReview(row: Record<string, unknown>): Review {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    userId: String(row.user_id),
    author: String(row.author),
    rating: Number(row.rating ?? 5),
    content: String(row.content ?? ''),
    date: String(row.date ?? ''),
    reply: row.reply != null ? String(row.reply) : undefined,
    replyDate: row.reply_date != null ? String(row.reply_date) : undefined,
  };
}

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToReview(row as Record<string, unknown>));
}

export async function upsertReview(r: Review): Promise<void> {
  const { error } = await supabase.from('reviews').upsert(reviewToRow(r), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertReviews(list: Review[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('reviews').upsert(list.map(reviewToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── order_buyer_flags (구매확정/리뷰/다운로드 시작) ────────────────────
export interface OrderBuyerFlag {
  orderId: string;
  orderType: string;
  confirmedAt: string | null;
  reviewedAt: string | null;
  downloadStartedAt: string | null;
}

export async function fetchOrderBuyerFlags(userId: string): Promise<OrderBuyerFlag[]> {
  const { data, error } = await supabase.from('order_buyer_flags').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    orderId: String(row.order_id),
    orderType: String(row.order_type ?? 'store'),
    confirmedAt: row.confirmed_at != null ? new Date(row.confirmed_at as string).toISOString() : null,
    reviewedAt: row.reviewed_at != null ? new Date(row.reviewed_at as string).toISOString() : null,
    downloadStartedAt: row.download_started_at != null ? new Date(row.download_started_at as string).toISOString() : null,
  }));
}

function flagId(orderId: string, userId: string, orderType: string): string {
  return `obf_${orderType}_${orderId}_${userId}`.replace(/\s/g, '_');
}

export async function upsertOrderBuyerFlag(
  orderId: string,
  userId: string,
  orderType: string,
  updates: { confirmedAt?: string | null; reviewedAt?: string | null; downloadStartedAt?: string | null }
): Promise<void> {
  const id = flagId(orderId, userId, orderType);
  const { data: existing } = await supabase.from('order_buyer_flags').select('confirmed_at, reviewed_at, download_started_at').eq('id', id).maybeSingle();
  const row = {
    id,
    order_id: orderId,
    user_id: userId,
    order_type: orderType,
    confirmed_at: updates.confirmedAt !== undefined ? updates.confirmedAt : (existing?.confirmed_at ?? null),
    reviewed_at: updates.reviewedAt !== undefined ? updates.reviewedAt : (existing?.reviewed_at ?? null),
    download_started_at: updates.downloadStartedAt !== undefined ? updates.downloadStartedAt : (existing?.download_started_at ?? null),
  };
  const { error } = await supabase.from('order_buyer_flags').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

// ─── seller_withdrawal_batches (판매자 출금 신청) ──────────────────────
export interface SellerWithdrawalBatch {
  id: string;
  userId: string;
  confirmedDate: string;
  amount: number;
  grossAmount: number;
  status: '지급 예정' | '지급 완료';
  orderIds: string[];
  productName?: string;
}

export async function fetchSellerWithdrawalBatches(userId: string): Promise<SellerWithdrawalBatch[]> {
  const { data, error } = await supabase.from('seller_withdrawal_batches').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    userId: String(row.user_id),
    confirmedDate: String(row.confirmed_date),
    amount: Number(row.amount ?? 0),
    grossAmount: Number(row.gross_amount ?? 0),
    status: (row.status as '지급 예정' | '지급 완료') ?? '지급 예정',
    orderIds: Array.isArray(row.order_ids) ? (row.order_ids as string[]) : [],
    productName: row.product_name != null ? String(row.product_name) : undefined,
  }));
}

export async function addSellerWithdrawalBatch(batch: Omit<SellerWithdrawalBatch, 'id'>): Promise<string> {
  const id = `swb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('seller_withdrawal_batches').insert({
    id,
    user_id: batch.userId,
    confirmed_date: batch.confirmedDate,
    amount: batch.amount,
    gross_amount: batch.grossAmount,
    status: batch.status,
    order_ids: batch.orderIds,
    product_name: batch.productName ?? null,
  });
  if (error) throw error;
  return id;
}
