import { UserProfile, GradeConfig } from '../types';

/** 회원의 등급 계산 (수동 지정 우선, 없으면 판매액/구매액 기준) */
export function getUserGrade(user: UserProfile | null | undefined, configs: GradeConfig[]): GradeConfig | null {
  if (!user || !configs?.length) return null;
  if (user.manualGrade) {
    const manual = configs.find(g => g.name === user.manualGrade);
    if (manual) return manual;
  }
  const isSeller = user.sellerStatus === 'approved';
  const sales = user.totalSalesAmount || 0;
  const purchase = user.totalPurchaseAmount || 0;

  const sorted = [...configs].sort((a, b) => b.sortOrder - a.sortOrder);
  for (const g of sorted) {
    const forSeller = (g.target === 'seller' || g.target === 'both') && isSeller && g.minSales > 0 && sales >= g.minSales;
    const forBuyer = (g.target === 'buyer' || g.target === 'both') && g.minPurchase > 0 && purchase >= g.minPurchase;
    if (forSeller || forBuyer) return g;
  }
  return null;
}
