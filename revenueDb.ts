/**
 * 매출관리 Supabase DB 연동 (4단계 테이블)
 * - revenue_operating_companies, revenue_projects, revenue_todos, revenue_general_expenses
 */
import { supabase } from './supabase';
import type { OperatingCompany, RevenueProject, RevenueTodo, GeneralExpense } from '@/types';

function companyToRow(c: OperatingCompany, userId: string): Record<string, unknown> {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    opening_date: c.openingDate,
    type: c.type ?? '개인사업자',
    tax_business_names: (c.taxBusinessNames ?? []) as unknown[],
  };
}

function rowToCompany(row: Record<string, unknown>): OperatingCompany {
  return {
    id: String(row.id),
    name: String(row.name),
    openingDate: String(row.opening_date),
    type: (row.type as OperatingCompany['type']) ?? '개인사업자',
    taxBusinessNames: Array.isArray(row.tax_business_names) ? (row.tax_business_names as string[]) : [],
  };
}

export async function fetchRevenueCompanies(userId: string): Promise<OperatingCompany[]> {
  const { data, error } = await supabase.from('revenue_operating_companies').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToCompany(row as Record<string, unknown>));
}

export async function upsertRevenueCompanies(userId: string, list: OperatingCompany[]): Promise<void> {
  if (list.length === 0) return;
  const rows = list.map((c) => companyToRow(c, userId));
  const { error } = await supabase.from('revenue_operating_companies').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

// ─── projects ─────────────────────────────────────────────────────────────
function projectToRow(p: RevenueProject, userId: string): Record<string, unknown> {
  return {
    id: p.id,
    user_id: userId,
    operating_company_id: p.operatingCompanyId || null,
    type: p.type,
    client_name: p.clientName,
    cafe_name: p.cafeName ?? null,
    work_link: p.workLink ?? null,
    payment_amount: p.paymentAmount ?? 0,
    settlement_amount: p.settlementAmount ?? 0,
    tax_invoice: p.taxInvoice ?? '미발행',
    channel: p.channel ?? '크몽',
    round: p.round ?? 1,
    start_date: p.startDate,
    end_date: p.endDate,
    status: p.status ?? '진행중',
    deadline_type: p.deadlineType ?? 'weekday',
    duration: p.duration ?? null,
    fixed_day: p.fixedDay ?? null,
    created_at: p.createdAt ?? new Date().toISOString(),
  };
}

function rowToProject(row: Record<string, unknown>): RevenueProject {
  return {
    id: String(row.id),
    operatingCompanyId: row.operating_company_id != null ? String(row.operating_company_id) : '',
    type: (row.type as RevenueProject['type']) ?? '카페관리',
    clientName: String(row.client_name),
    cafeName: row.cafe_name != null ? String(row.cafe_name) : undefined,
    workLink: row.work_link != null ? String(row.work_link) : undefined,
    paymentAmount: Number(row.payment_amount ?? 0),
    settlementAmount: Number(row.settlement_amount ?? 0),
    taxInvoice: (row.tax_invoice as RevenueProject['taxInvoice']) ?? '미발행',
    channel: String(row.channel ?? '크몽'),
    round: Number(row.round ?? 1),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: (row.status as RevenueProject['status']) ?? '진행중',
    deadlineType: (row.deadline_type as RevenueProject['deadlineType']) ?? 'weekday',
    duration: row.duration != null ? Number(row.duration) : undefined,
    fixedDay: row.fixed_day != null ? Number(row.fixed_day) : undefined,
    createdAt: String(row.created_at ?? ''),
  };
}

export async function fetchRevenueProjects(userId: string): Promise<RevenueProject[]> {
  const { data, error } = await supabase.from('revenue_projects').select('*').eq('user_id', userId).order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToProject(row as Record<string, unknown>));
}

export async function upsertRevenueProjects(userId: string, list: RevenueProject[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('revenue_projects').upsert(list.map((p) => projectToRow(p, userId)), { onConflict: 'id' });
  if (error) throw error;
}

// ─── todos ─────────────────────────────────────────────────────────────────
function todoToRow(t: RevenueTodo, userId: string): Record<string, unknown> {
  return {
    id: t.id,
    user_id: userId,
    text: t.text,
    start_date: t.startDate,
    end_date: t.endDate,
    completed: t.completed ?? false,
  };
}

function rowToTodo(row: Record<string, unknown>): RevenueTodo {
  return {
    id: String(row.id),
    text: String(row.text),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    completed: Boolean(row.completed),
  };
}

export async function fetchRevenueTodos(userId: string): Promise<RevenueTodo[]> {
  const { data, error } = await supabase.from('revenue_todos').select('*').eq('user_id', userId).order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToTodo(row as Record<string, unknown>));
}

export async function upsertRevenueTodos(userId: string, list: RevenueTodo[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('revenue_todos').upsert(list.map((t) => todoToRow(t, userId)), { onConflict: 'id' });
  if (error) throw error;
}

// ─── general expenses ─────────────────────────────────────────────────────
function expenseToRow(e: GeneralExpense, userId: string): Record<string, unknown> {
  return {
    id: e.id,
    user_id: userId,
    date: e.date,
    category: e.category,
    note: e.note,
    amount: e.amount ?? 0,
  };
}

function rowToExpense(row: Record<string, unknown>): GeneralExpense {
  return {
    id: String(row.id),
    date: String(row.date),
    category: (row.category as GeneralExpense['category']) ?? '운영비',
    note: String(row.note ?? ''),
    amount: Number(row.amount ?? 0),
  };
}

export async function fetchRevenueGeneralExpenses(userId: string): Promise<GeneralExpense[]> {
  const { data, error } = await supabase.from('revenue_general_expenses').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToExpense(row as Record<string, unknown>));
}

export async function upsertRevenueGeneralExpenses(userId: string, list: GeneralExpense[]): Promise<void> {
  if (list.length === 0) return;
  const { error } = await supabase.from('revenue_general_expenses').upsert(list.map((e) => expenseToRow(e, userId)), { onConflict: 'id' });
  if (error) throw error;
}
