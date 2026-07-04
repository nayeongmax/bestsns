import { supabase } from './supabase';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FranchisePlan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: string;
  features: string[];
  isActive: boolean;
  sortOrder: number;
  paymentUrl?: string;
  points?: number | null; // null = unlimited
}

export interface FranchiseProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  minQuantity: number;
  maxQuantity: number;
  category: string;
  isHidden: boolean;
  sortOrder: number;
}

// ─── Default Plans ────────────────────────────────────────────────────────────

export const DEFAULT_PLANS: FranchisePlan[] = [
  {
    id: 'basic',
    name: '기본 플랜',
    price: 39000,
    period: '월',
    features: ['매출관리', '원고시트', '원고수집기', '마케팅상품 주문', '카카오톡 기본 지원'],
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'premium',
    name: '프리미엄 플랜',
    price: 79000,
    period: '월',
    features: [
      '기본 플랜 전체 포함',
      '우선 지원 (당일 응답)',
      '맞춤 원고 컨설팅 월 2회',
      '월 1회 전략 미팅 (30분)',
    ],
    isActive: true,
    sortOrder: 1,
  },
];

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToPlan(row: Record<string, unknown>): FranchisePlan {
  const originalPrice = row.original_price != null ? Number(row.original_price) : undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    price: Number(row.price ?? 0),
    ...(originalPrice ? { originalPrice } : {}),
    period: String(row.period ?? '월'),
    features: Array.isArray(row.features)
      ? row.features.map((f: unknown) => (typeof f === 'string' ? f : String(f ?? '')))
      : [],
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    ...(row.payment_url ? { paymentUrl: String(row.payment_url) } : {}),
    points: row.points != null ? Number(row.points) : null,
  };
}

function planToRow(plan: FranchisePlan): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    original_price: plan.originalPrice ?? null,
    period: plan.period,
    features: plan.features,
    is_active: plan.isActive,
    sort_order: plan.sortOrder,
    payment_url: plan.paymentUrl ?? null,
    points: plan.points ?? null,
  };
}

function rowToProduct(row: Record<string, unknown>): FranchiseProduct {
  const originalPrice = row.original_price != null ? Number(row.original_price) : undefined;
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: Number(row.price ?? 0),
    ...(originalPrice ? { originalPrice } : {}),
    minQuantity: Number(row.min_quantity ?? 1),
    maxQuantity: Number(row.max_quantity ?? 1),
    category: String(row.category ?? ''),
    isHidden: Boolean(row.is_hidden),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function productToRow(product: FranchiseProduct): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    original_price: product.originalPrice ?? null,
    min_quantity: product.minQuantity,
    max_quantity: product.maxQuantity,
    category: product.category,
    is_hidden: product.isHidden,
    sort_order: product.sortOrder,
  };
}

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const LS_PLANS_KEY = 'franchise_plans_v1';
const LS_PRODUCTS_KEY = 'franchise_products_v1';

// ─── Plans functions ──────────────────────────────────────────────────────────

export async function fetchFranchisePlans(): Promise<FranchisePlan[]> {
  try {
    const { data, error } = await supabase
      .from('franchise_plans')
      .select('*')
      .order('sort_order');

    if (!error && data && data.length > 0) {
      return data.map((row) => rowToPlan(row as Record<string, unknown>));
    }
    if (error) console.error('[franchise_plans] fetch error:', error.message);
  } catch (e) {
    console.error('[franchise_plans] fetch exception:', e);
  }

  // Fallback: localStorage — and auto-restore to Supabase if it was empty
  try {
    const raw = localStorage.getItem(LS_PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchisePlan[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Supabase was empty → push localStorage data back up
        supabase
          .from('franchise_plans')
          .upsert(parsed.map(planToRow), { onConflict: 'id' })
          .then(({ error: e }) => { if (e) console.error('[franchise_plans] restore error:', e.message); })
          .catch((e) => console.error('[franchise_plans] restore exception:', e));
        return parsed;
      }
    }
  } catch {
    // fall through to defaults
  }

  return DEFAULT_PLANS;
}

export async function upsertFranchisePlans(plans: FranchisePlan[]): Promise<void> {
  // Always persist to localStorage
  try {
    localStorage.setItem(LS_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // ignore storage errors
  }

  // Best-effort Supabase upsert
  try {
    const { error } = await supabase
      .from('franchise_plans')
      .upsert(plans.map(planToRow), { onConflict: 'id' });
    if (error) console.error('[franchise_plans] upsert error:', error.message);
  } catch (e) {
    console.error('[franchise_plans] upsert exception:', e);
  }
}

// ─── Products functions ───────────────────────────────────────────────────────

export async function fetchFranchiseProducts(): Promise<FranchiseProduct[]> {
  try {
    const { data, error } = await supabase
      .from('franchise_products')
      .select('*')
      .eq('is_hidden', false)
      .order('sort_order');

    if (!error && data && data.length > 0) {
      return data.map((row) => rowToProduct(row as Record<string, unknown>));
    }
  } catch {
    // fall through to localStorage
  }

  // Fallback: localStorage (return only non-hidden products)
  try {
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchiseProduct[];
      if (Array.isArray(parsed)) {
        return parsed.filter((p) => !p.isHidden);
      }
    }
  } catch {
    // fall through
  }

  return [];
}

export async function fetchFranchiseProductsAdmin(): Promise<FranchiseProduct[]> {
  try {
    const { data, error } = await supabase
      .from('franchise_products')
      .select('*')
      .order('sort_order');

    if (!error && data && data.length > 0) {
      return data.map((row) => rowToProduct(row as Record<string, unknown>));
    }
    if (error) console.error('[franchise_products] fetch error:', error.message);
  } catch (e) {
    console.error('[franchise_products] fetch exception:', e);
  }

  // Fallback: localStorage (all products, including hidden) — auto-restore to Supabase if it was empty
  try {
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchiseProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Supabase was empty → push localStorage data back up
        supabase
          .from('franchise_products')
          .upsert(parsed.map(productToRow), { onConflict: 'id' })
          .then(({ error: e }) => { if (e) console.error('[franchise_products] restore error:', e.message); })
          .catch((e) => console.error('[franchise_products] restore exception:', e));
        return parsed;
      }
    }
  } catch {
    // fall through
  }

  return [];
}

export async function upsertFranchiseProducts(products: FranchiseProduct[]): Promise<void> {
  // Always persist to localStorage
  try {
    // Merge with existing hidden products so we don't lose them on a public save
    let existing: FranchiseProduct[] = [];
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchiseProduct[];
      if (Array.isArray(parsed)) existing = parsed;
    }
    const incomingIds = new Set(products.map((p) => p.id));
    const kept = existing.filter((p) => !incomingIds.has(p.id));
    localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify([...kept, ...products]));
  } catch {
    // ignore storage errors
  }

  // Best-effort Supabase upsert
  try {
    const { error } = await supabase
      .from('franchise_products')
      .upsert(products.map(productToRow), { onConflict: 'id' });
    if (error) console.error('[franchise_products] upsert error:', error.message);
  } catch (e) {
    console.error('[franchise_products] upsert exception:', e);
  }
}

export async function deleteFranchiseProduct(id: string): Promise<void> {
  // Remove from localStorage
  try {
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchiseProduct[];
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          LS_PRODUCTS_KEY,
          JSON.stringify(parsed.filter((p) => p.id !== id))
        );
      }
    }
  } catch {
    // ignore storage errors
  }

  // Best-effort Supabase delete
  try {
    await supabase.from('franchise_products').delete().eq('id', id);
  } catch {
    // ignore silently
  }
}

// ─── 포인트 사용량 ────────────────────────────────────────────────────────────

// 가맹점 마케팅 주문으로 차감된 총 포인트 (취소 제외)
export async function fetchFranchisePointsUsed(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('smm_orders')
      .select('selling_price')
      .eq('user_id', userId)
      .eq('provider_name', '가맹점주문')
      .neq('status', 'cancelled');
    if (error) return 0;
    return (data ?? []).reduce((sum, row) => sum + Number(row.selling_price ?? 0), 0);
  } catch {
    return 0;
  }
}
