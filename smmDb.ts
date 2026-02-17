/**
 * SNS활성화 Supabase DB 연동
 * - smm_orders (주문/결제 내역), smm_providers (공급처), smm_products (마스터상품)
 */
import { supabase } from '@/supabase';
import type { SMMOrder, SMMProvider, SMMProduct, SMMSource } from '@/types';

// ─── smm_providers ─────────────────────────────────────────────────────
function providerToRow(p: SMMProvider): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    api_url: p.apiUrl ?? '',
    is_hidden: p.isHidden ?? false,
  };
}

function rowToProvider(row: Record<string, unknown>): SMMProvider {
  return {
    id: String(row.id),
    name: String(row.name),
    apiUrl: String(row.api_url ?? ''),
    isHidden: Boolean(row.is_hidden),
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
    selling_price: p.sellingPrice ?? 0,
    min_quantity: p.minQuantity ?? 0,
    max_quantity: p.maxQuantity ?? 100000,
    sources: (p.sources ?? []) as unknown[],
    is_hidden: p.isHidden ?? false,
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
  };
}

export async function fetchSmmProducts(): Promise<SMMProduct[]> {
  const { data, error } = await supabase.from('smm_products').select('*').order('id');
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

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
