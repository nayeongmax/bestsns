/**
 * 채널판매 Supabase DB 연동
 * - channel_products (채널 상품), channel_orders (채널 구매 내역)
 */
import { supabase } from './supabase';
import type { ChannelProduct, ChannelOrder } from '@/types';

// ─── channel_products ──────────────────────────────────────────────────
function productToRow(p: ChannelProduct): Record<string, unknown> {
  return {
    id: p.id,
    platform: p.platform ?? '',
    title: p.title,
    category: p.category ?? '',
    subscribers: p.subscribers ?? 0,
    income: p.income ?? 0,
    expense: p.expense ?? 0,
    price: p.price ?? 0,
    thumbnail: p.thumbnail ?? '',
    attached_images: (p.attachedImages ?? []) as unknown[],
    is_sold_out: p.isSoldOut ?? false,
    description: p.description ?? null,
    is_approved: p.isApproved ?? null,
    is_hot: p.isHot ?? null,
    source_link: p.sourceLink ?? null,
    public_link: p.publicLink ?? null,
    seller_id: p.sellerId ?? null,
    seller_nickname: p.sellerNickname ?? null,
    seller_image: p.sellerImage ?? null,
  };
}

function rowToProduct(row: Record<string, unknown>): ChannelProduct {
  return {
    id: String(row.id),
    platform: String(row.platform ?? ''),
    title: String(row.title),
    category: String(row.category ?? ''),
    subscribers: Number(row.subscribers ?? 0),
    income: Number(row.income ?? 0),
    expense: Number(row.expense ?? 0),
    price: Number(row.price ?? 0),
    thumbnail: String(row.thumbnail ?? ''),
    attachedImages: Array.isArray(row.attached_images) ? (row.attached_images as string[]) : undefined,
    isSoldOut: Boolean(row.is_sold_out),
    description: row.description != null ? String(row.description) : undefined,
    isApproved: row.is_approved != null ? Boolean(row.is_approved) : undefined,
    isHot: row.is_hot != null ? Boolean(row.is_hot) : undefined,
    sourceLink: row.source_link != null ? String(row.source_link) : undefined,
    publicLink: row.public_link != null ? String(row.public_link) : undefined,
    sellerId: row.seller_id != null ? String(row.seller_id) : undefined,
    sellerNickname: row.seller_nickname != null ? String(row.seller_nickname) : undefined,
    sellerImage: row.seller_image != null ? String(row.seller_image) : undefined,
  };
}

export async function fetchChannelProducts(): Promise<ChannelProduct[]> {
  const { data, error } = await supabase.from('channel_products').select('*').order('id');
  if (error) throw error;
  return (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>));
}

export async function upsertChannelProduct(p: ChannelProduct): Promise<void> {
  const { error } = await supabase.from('channel_products').upsert(productToRow(p), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertChannelProducts(list: ChannelProduct[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('channel_products').upsert(list.map(productToRow), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteChannelProduct(id: string): Promise<void> {
  const { error } = await supabase.from('channel_products').delete().eq('id', id);
  if (error) throw error;
}

// ─── channel_orders ────────────────────────────────────────────────────
function orderToRow(o: ChannelOrder): Record<string, unknown> {
  return {
    id: o.id,
    user_id: o.userId,
    user_nickname: o.userNickname,
    order_time: o.orderTime,
    product_id: o.productId,
    product_name: o.productName,
    platform: o.platform ?? '',
    price: o.price ?? 0,
    status: o.status ?? '',
    payment_id: o.paymentId ?? null,
    payment_method: o.paymentMethod ?? null,
    payment_log: o.paymentLog ?? null,
  };
}

function rowToOrder(row: Record<string, unknown>): ChannelOrder {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userNickname: String(row.user_nickname),
    orderTime: String(row.order_time),
    productId: String(row.product_id),
    productName: String(row.product_name),
    platform: String(row.platform ?? ''),
    price: Number(row.price ?? 0),
    status: String(row.status ?? ''),
    paymentId: row.payment_id != null ? String(row.payment_id) : undefined,
    paymentMethod: row.payment_method != null ? String(row.payment_method) : undefined,
    paymentLog: row.payment_log != null ? String(row.payment_log) : undefined,
  };
}

export async function fetchChannelOrders(): Promise<ChannelOrder[]> {
  const { data, error } = await supabase.from('channel_orders').select('*').order('order_time', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToOrder(row as Record<string, unknown>));
}

export async function upsertChannelOrder(o: ChannelOrder): Promise<void> {
  const { error } = await supabase.from('channel_orders').upsert(orderToRow(o), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertChannelOrders(list: ChannelOrder[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('channel_orders').upsert(list.map(orderToRow), { onConflict: 'id' });
  if (error) throw error;
}
