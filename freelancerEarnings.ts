import type { FreelancerEarningEntry } from '../types';

const BALANCE_KEY = (userId: string) => `freelancer_earnings_v1_${userId}`;
const HISTORY_KEY = (userId: string) => `freelancer_earnings_history_v1_${userId}`;

export const MIN_WITHDRAW = 5000;

export function getFreelancerBalance(userId: string): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY(userId));
    return raw ? Math.max(0, Number(raw)) : 0;
  } catch {
    return 0;
  }
}

export function setFreelancerBalance(userId: string, amount: number): void {
  const value = Math.max(0, Math.round(amount));
  localStorage.setItem(BALANCE_KEY(userId), String(value));
}

export function addFreelancerEarning(userId: string, amount: number, label: string): number {
  const cur = getFreelancerBalance(userId);
  const next = cur + Math.max(0, Math.round(amount));
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'task',
    amount,
    label,
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return next;
}

export function getFreelancerHistory(userId: string): FreelancerEarningEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 출금: 수익통장에서 차감하고 출금 내역 추가. 실제 포인트 반영은 호출측에서 onUpdateUser로 처리. */
export function withdrawFreelancerEarnings(userId: string, amount: number): { success: boolean; newBalance: number } {
  const cur = getFreelancerBalance(userId);
  if (amount < MIN_WITHDRAW || amount > cur) {
    return { success: false, newBalance: cur };
  }
  const next = cur - amount;
  setFreelancerBalance(userId, next);
  const entry: FreelancerEarningEntry = {
    id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'withdraw',
    amount: -amount,
    label: '출금',
    at: new Date().toISOString(),
  };
  const history = getFreelancerHistory(userId);
  localStorage.setItem(HISTORY_KEY(userId), JSON.stringify([entry, ...history].slice(0, 100)));
  return { success: true, newBalance: next };
}
