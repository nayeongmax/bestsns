/**
 * SNS활성화 Supabase DB 연동
 * - smm_orders (주문/결제 내역), smm_providers (공급처), smm_products (마스터상품)
 * - smm_provider_stats (공급처별 성공률 통계)
 */
import { supabase } from './supabase';
import type { SMMOrder, SMMProvider, SMMProduct, SMMSource, SMMReview, SMMProviderStats } from '@/types';

// ─── smm_providers ─────────────────────────────────────────────────────
function providerToRow(p: SMMProvider): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    api_url: p.apiUrl ?? '',
    is_hidden: p.isHidden ?? false,
    priority: p.priority ?? 99,
  };
}

function rowToProvider(row: Record<string, unknown>): SMMProvider {
  return {
    id: String(row.id),
    name: String(row.name),
    apiUrl: String(row.api_url ?? ''),
    isHidden: Boolean(row.is_hidden),
    priority: row.priority != null ? Number(row.priority) : 99,
  };
}

export async function fetchSmmProviders(): Promise<SMMProvider[]> {
  const { data, error } = await supabase.from('smm_providers').select('*').order('id');
  if (error) throw error;
  return (data ?? []).map((row) => rowToProvider(row as Record<string, unknown>));
}

export async function upsertSmmProviders(list: SMMProvider[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('smm_providers').upsert(list.map(providerToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── smm_products ───────────────────────────────────────────────────────
function productToRow(p: SMMProduct): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    platform: p.platform ?? '',
    category: p.category ?? '',
    selling_price: Number(p.sellingPrice ?? 0),
    min_quantity: p.minQuantity ?? 0,
    max_quantity: p.maxQuantity ?? 100000,
    sources: (p.sources ?? []) as unknown[],
    is_hidden: p.isHidden ?? false,
    sort_order: p.sortOrder ?? 9999,
  };
}

function rowToProduct(row: Record<string, unknown>): SMMProduct {
  return {
    id: String(row.id),
    name: String(row.name),
    platform: String(row.platform ?? ''),
    category: String(row.category ?? ''),
    sellingPrice: Number(row.selling_price ?? 0),
    minQuantity: Number(row.min_quantity ?? 0),
    maxQuantity: Number(row.max_quantity ?? 100000),
    sources: Array.isArray(row.sources) ? (row.sources as SMMSource[]) : [],
    isHidden: Boolean(row.is_hidden),
    sortOrder: row.sort_order != null ? Number(row.sort_order) : 9999,
  };
}

export async function fetchSmmProducts(): Promise<SMMProduct[]> {
  const { data, error } = await supabase.from('smm_products').select('*').order('sort_order', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

/** 일반 사용자용: 숨김 처리된 상품(is_hidden=true) 제외 */
export async function fetchPublicSmmProducts(): Promise<SMMProduct[]> {
  const { data, error } = await supabase
    .from('smm_products')
    .select('*')
    .eq('is_hidden', false)
    .order('sort_order', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

/** 지정한 id의 상품을 DB에서 즉시 삭제 (삭제 버튼 클릭 시 호출) */
export async function deleteSmmProductsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('smm_products').delete().in('id', ids);
  if (error) throw error;
}

/** 상품 목록을 DB에 upsert (삭제는 handleDeleteSmmProducts → deleteSmmProductsByIds로 처리) */
export async function upsertSmmProducts(list: SMMProduct[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('smm_products').upsert(list.map(productToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── smm_orders ─────────────────────────────────────────────────────────
function orderToRow(o: SMMOrder): Record<string, unknown> {
  return {
    id: o.id,
    user_id: o.userId,
    user_nickname: o.userNickname ?? '',
    order_time: o.orderTime,
    platform: o.platform ?? '',
    product_name: o.productName ?? '',
    link: o.link ?? null,
    quantity: o.quantity ?? 1,
    initial_count: o.initialCount ?? null,
    remains: o.remains ?? null,
    provider_name: o.providerName ?? null,
    cost_price: o.costPrice ?? 0,
    selling_price: o.sellingPrice ?? 0,
    profit: o.profit ?? 0,
    status: o.status ?? '',
    external_order_id: o.externalOrderId ?? null,
  };
}

function rowToOrder(row: Record<string, unknown>): SMMOrder {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userNickname: String(row.user_nickname ?? ''),
    orderTime: String(row.order_time),
    platform: String(row.platform ?? ''),
    productName: String(row.product_name ?? ''),
    link: String(row.link ?? ''),
    quantity: Number(row.quantity ?? 1),
    initialCount: Number(row.initial_count ?? 0),
    remains: Number(row.remains ?? 0),
    providerName: String(row.provider_name ?? ''),
    costPrice: Number(row.cost_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    profit: Number(row.profit ?? 0),
    status: String(row.status ?? ''),
    externalOrderId: String(row.external_order_id ?? ''),
  };
}

export async function fetchSmmOrders(): Promise<SMMOrder[]> {
  const { data, error } = await supabase.from('smm_orders').select('*').order('order_time', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as Record<string, unknown>));
}

export async function upsertSmmOrder(o: SMMOrder): Promise<void> {
  const { error } = await supabase.from('smm_orders').upsert(orderToRow(o), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertSmmOrders(list: SMMOrder[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('smm_orders').upsert(list.map(orderToRow), { onConflict: 'id' });
  if (error) throw error;
}

// ─── smm_reviews ─────────────────────────────────────────────────────────
function rowToReview(row: Record<string, unknown>): SMMReview {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userNickname: String(row.user_nickname ?? ''),
    productName: String(row.product_name ?? ''),
    platform: String(row.platform ?? ''),
    rating: Number(row.rating ?? 5),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function fetchSmmReviews(): Promise<SMMReview[]> {
  const { data, error } = await supabase
    .from('smm_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => rowToReview(row as Record<string, unknown>));
}

export async function insertSmmReview(review: Omit<SMMReview, 'id' | 'createdAt'>): Promise<void> {
  const { error } = await supabase.from('smm_reviews').insert({
    user_id: review.userId,
    user_nickname: review.userNickname,
    product_name: review.productName,
    platform: review.platform,
    rating: review.rating,
    content: review.content,
  });
  if (error) throw error;
}

// ─── 어드민 전용: smm-admin Netlify 함수(service_role)를 통한 DB 접근 ──────
// RLS 적용 후 anon key로는 접근이 제한되므로 어드민 작업은 이 함수들을 사용합니다.

const SMM_ADMIN_URL = '/.netlify/functions/smm-admin';

function getAdminKey(): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PANEL_PASSWORD
    ?? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PASSWORD
    ?? '';
}

async function smmAdminGet(resource: string): Promise<unknown[]> {
  const res = await fetch(`${SMM_ADMIN_URL}?resource=${resource}`, {
    headers: { 'x-admin-key': getAdminKey() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function smmAdminPost(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(SMM_ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': getAdminKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchSmmOrdersAdmin(): Promise<SMMOrder[]> {
  const data = await smmAdminGet('orders');
  return data.map((row) => rowToOrder(row as Record<string, unknown>));
}

export async function upsertSmmOrderAdmin(o: SMMOrder): Promise<void> {
  await smmAdminPost({ action: 'upsertOrder', order: orderToRow(o) });
}

export async function upsertSmmOrdersAdmin(list: SMMOrder[]): Promise<void> {
  if (list.length === 0) return;
  await smmAdminPost({ action: 'upsertOrders', orders: list.map(orderToRow) });
}

export async function fetchSmmProvidersAdmin(): Promise<SMMProvider[]> {
  const data = await smmAdminGet('providers');
  return data.map((row) => rowToProvider(row as Record<string, unknown>));
}

export async function upsertSmmProvidersAdmin(list: SMMProvider[]): Promise<void> {
  if (list.length === 0) return;
  await smmAdminPost({ action: 'upsertProviders', providers: list.map(providerToRow) });
}

export async function upsertSmmProductsAdmin(list: SMMProduct[]): Promise<void> {
  if (list.length === 0) return;
  await smmAdminPost({ action: 'upsertProducts', products: list.map(productToRow) });
}

export async function deleteSmmProductsByIdsAdmin(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await smmAdminPost({ action: 'deleteProducts', ids });
}

// ─── smm_provider_stats ─────────────────────────────────────────────────
function rowToProviderStats(row: Record<string, unknown>): SMMProviderStats {
  return {
    id: String(row.id),
    totalAttempts: Number(row.total_attempts ?? 0),
    successCount: Number(row.success_count ?? 0),
    failCount: Number(row.fail_count ?? 0),
    successRate: Number(row.success_rate ?? 100),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : undefined,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : undefined,
    lastFailAt: row.last_fail_at ? String(row.last_fail_at) : undefined,
    autoDisabled: Boolean(row.auto_disabled),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/** 공급처별 통계 전체 조회 (어드민) */
export async function fetchSmmProviderStatsAdmin(): Promise<SMMProviderStats[]> {
  const data = await smmAdminGet('providerStats');
  return data.map((row) => rowToProviderStats(row as Record<string, unknown>));
}

/** 주문 시도 결과를 통계에 기록 (anon 클라이언트 → smm-admin 경유) */
export async function recordProviderAttemptAdmin(providerId: string, success: boolean): Promise<void> {
  await smmAdminPost({ action: 'recordProviderAttempt', providerId, success });
}
