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
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
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
  } catch {
    // fall through to localStorage
  }

  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(LS_PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchisePlan[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    await supabase
      .from('franchise_plans')
      .upsert(plans.map(planToRow), { onConflict: 'id' });
  } catch {
    // ignore silently
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

    if (!error && data) {
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

    if (!error && data) {
      return data.map((row) => rowToProduct(row as Record<string, unknown>));
    }
  } catch {
    // fall through to localStorage
  }

  // Fallback: localStorage (all products, including hidden)
  try {
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FranchiseProduct[];
      if (Array.isArray(parsed)) return parsed;
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
    await supabase
      .from('franchise_products')
      .upsert(products.map(productToRow), { onConflict: 'id' });
  } catch {
    // ignore silently
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
