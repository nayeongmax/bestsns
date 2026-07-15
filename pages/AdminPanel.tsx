
import React, { useState, useEffect } from 'react';
/**
 * Fixed: Removed .ts extension from import
 */
import { EbookProduct, ChannelProduct, SiteNotification, SMMProvider, SMMProduct, SMMOrder, UserProfile, ChannelOrder, StoreOrder, Coupon, NotificationType, GradeConfig, Review } from '@/types';
import { useConfirm } from '@/contexts/ConfirmContext';
import { fetchChannelOrders } from '../channelDb';
import SnsAdmin from '../components/admin/SnsAdmin.tsx';
import ChannelAdmin from '../components/admin/ChannelAdmin.tsx';
import StoreAdmin from '../components/admin/StoreAdmin.tsx';
import MemberAdmin from '../components/admin/MemberAdmin.tsx';
import MarketingAdmin from '../components/admin/MarketingAdmin.tsx';
import PartTimeAdmin from '../components/admin/PartTimeAdmin.tsx';
import AiConsultAdmin from '../components/admin/AiConsultAdmin.tsx';
import PopupAdmin from '../components/admin/PopupAdmin.tsx';
import { FranchisePlan, FranchiseProduct, DEFAULT_PLANS, fetchFranchisePlans, fetchFranchiseProductsAdmin, upsertFranchisePlans, upsertFranchiseProducts, deleteFranchiseProduct, deleteFranchisePlan } from '../franchiseDb';
import { fetchAlbaBalance, fetchAlbaTransactions, chargeAlbaBalance, fetchAppSettings, saveAppSettings, AlbaBalanceTx } from '../albaBalanceDb';

interface Props {
  user: UserProfile | null;
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  channels: ChannelProduct[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelProduct[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  smmProviders: SMMProvider[];
  setSmmProviders: React.Dispatch<React.SetStateAction<SMMProvider[]>>;
  smmProducts: SMMProduct[];
  setSmmProducts: React.Dispatch<React.SetStateAction<SMMProduct[]>>;
  onDeleteSmmProducts?: (ids: string[]) => void;
  smmOrders: SMMOrder[];
  setSmmOrders: React.Dispatch<React.SetStateAction<SMMOrder[]>>;
  members: UserProfile[];
  setMembers: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  channelOrders: ChannelOrder[];
  setChannelOrders?: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
  storeOrders: StoreOrder[];
  onIssueCoupons?: (targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => void;
  /** 회원 목록(profiles) 다시 불러오기 - 판매자 승인 대기 목록 갱신용 */
  onRefreshMembers?: () => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  gradeConfigs: GradeConfig[];
  setGradeConfigs: React.Dispatch<React.SetStateAction<GradeConfig[]>>;
  reviews?: Review[];
  setReviews?: React.Dispatch<React.SetStateAction<Review[]>>;
  onUpdateUser?: (u: UserProfile) => void;
}

/**
 * Fixed: Added addNotif to component destructuring
 */
const AdminPanel: React.FC<Props> = ({ 
  user, ebooks, setEbooks, channels, setChannels, setNotifications,
  smmProviders, setSmmProviders, smmProducts, setSmmProducts, onDeleteSmmProducts, smmOrders, setSmmOrders,
  members, setMembers, channelOrders, setChannelOrders, storeOrders, onIssueCoupons, onRefreshMembers, addNotif,
  gradeConfigs, setGradeConfigs, reviews = [], setReviews, onUpdateUser
}) => {
  const { showAlert } = useConfirm();
  const ADMIN_STORAGE_KEY = 'admin_logged_in';
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem(ADMIN_STORAGE_KEY));
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'sns' | 'channel' | 'ebook' | 'member' | 'marketing' | 'parttime' | 'aiconsult' | 'popup' | 'franchise'>('sns');

  const panelPassword = (import.meta as any).env?.VITE_ADMIN_PANEL_PASSWORD ?? (import.meta as any).env?.VITE_ADMIN_PASSWORD ?? 'admin123';

  // 회원 및 권한 관리 탭 열 때마다 profiles에서 회원 목록 재조회 → 판매자 승인 대기 반영
  useEffect(() => {
    if (activeTab === 'member' && onRefreshMembers) onRefreshMembers();
  }, [activeTab, onRefreshMembers]);

  // 채널 거래 탭 열 때마다 channel_orders 재조회 → 결제/취소 상태 최신화
  useEffect(() => {
    if (activeTab === 'channel') {
      fetchChannelOrders()
        .then((orders) => setChannelOrders?.(orders))
        .catch((e) => console.warn('채널 주문 재로드 실패:', e));
    }
  }, [activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (panelPassword && password === panelPassword) {
      sessionStorage.setItem(ADMIN_STORAGE_KEY, '1');
      setIsLoggedIn(true);
    } else showAlert({ description: '비밀번호가 올바르지 않습니다.' });
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-32 px-4">
        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-gray-100 text-center">
          <div className="w-20 h-20 bg-gray-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl mb-8">🔐</div>
          <h2 className="text-2xl font-black text-gray-900 mb-8 italic uppercase underline decoration-blue-500">관리자 인증 센터</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 rounded-[24px] text-center font-black outline-none focus:ring-2 focus:ring-blue-50" placeholder="비밀번호를 입력하세요" />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black shadow-xl hover:bg-blue-700 transition-all">로그인</button>
            <p className="text-xs text-gray-500">운영자 전용. .env에 VITE_ADMIN_PASSWORD 설정 시 해당 비밀번호 사용.</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-32 md:space-y-12 md:px-8">

      {/* 모바일 전용: 헤더 타이틀 + 탭 메뉴 섹션 */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="text-xl">🛡️</span>
          <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-1">운영 총괄 대시보드</h2>
        </div>
        <div className="bg-white border-y border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="overflow-x-auto px-3 py-2" style={{WebkitOverflowScrolling: 'touch'}}>
            <div className="flex gap-1 w-max">
              <button onClick={() => setActiveTab('sns')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'sns' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>SNS 활성화</button>
              <button onClick={() => setActiveTab('channel')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'channel' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>채널 거래</button>
              <button onClick={() => setActiveTab('ebook')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'ebook' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}>N잡 스토어</button>
              <button onClick={() => setActiveTab('member')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'member' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400'}`}>회원 관리</button>
              <button onClick={() => setActiveTab('marketing')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'marketing' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-400'}`}>마케팅</button>
              <button onClick={() => setActiveTab('parttime')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'parttime' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400'}`}>누구나알바</button>
              <button onClick={() => setActiveTab('aiconsult')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'aiconsult' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400'}`}>AI 상담</button>
              <button onClick={() => setActiveTab('popup')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'popup' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400'}`}>팝업 관리</button>
              <button onClick={() => setActiveTab('franchise')} className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl font-black text-[11px] transition-all ${activeTab === 'franchise' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400'}`}>🏢 가맹점설정</button>
            </div>
          </div>
        </div>
      </div>

      {/* 데스크톱 전용: 원본 헤더 + 탭 */}
      <div className="hidden md:flex flex-row justify-between items-center bg-white p-5 rounded-[40px] shadow-sm border border-gray-100 gap-6">
         <div className="flex items-center gap-4 px-4">
            <span className="text-3xl">🛡️</span>
            <h2 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">운영 총괄 대시보드</h2>
         </div>
         <div className="w-full overflow-x-auto" style={{WebkitOverflowScrolling: 'touch'}}>
           <div className="flex flex-nowrap items-center gap-2 bg-gray-50 p-2 rounded-[28px] w-max min-w-full">
             <button onClick={() => setActiveTab('sns')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'sns' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>SNS 활성화 관리</button>
             <button onClick={() => setActiveTab('channel')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'channel' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>채널 거래 관리</button>
             <button onClick={() => setActiveTab('ebook')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'ebook' ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>N잡 스토어 관리</button>
             <button onClick={() => setActiveTab('member')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'member' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>회원 및 권한 관리</button>
             <button onClick={() => setActiveTab('marketing')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'marketing' ? 'bg-rose-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>마케팅 캠페인</button>
             <button onClick={() => setActiveTab('parttime')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'parttime' ? 'bg-emerald-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>누구나알바</button>
             <button onClick={() => setActiveTab('aiconsult')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'aiconsult' ? 'bg-purple-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>AI 상담 이력</button>
             <button onClick={() => setActiveTab('popup')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'popup' ? 'bg-orange-500 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>팝업 관리</button>
             <button onClick={() => setActiveTab('franchise')} className={`shrink-0 whitespace-nowrap px-6 py-3 rounded-[22px] font-black text-[13px] transition-all ${activeTab === 'franchise' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}>🏢 가맹점설정</button>
           </div>
         </div>
      </div>

      <main className="min-h-screen px-3 md:px-0 mt-3 md:mt-0">
        {activeTab === 'sns' && (
          <SnsAdmin
            smmProviders={smmProviders} setSmmProviders={setSmmProviders}
            smmProducts={smmProducts} setSmmProducts={setSmmProducts}
            onDeleteSmmProducts={onDeleteSmmProducts}
            smmOrders={smmOrders}
            setSmmOrders={setSmmOrders}
            addNotif={addNotif}
          />
        )}
        {activeTab === 'channel' && <ChannelAdmin channels={channels} setChannels={setChannels} channelOrders={channelOrders} setChannelOrders={setChannelOrders} />}
        {/**
         * Fixed: Passed addNotif down to StoreAdmin
         */}
        {activeTab === 'ebook' && <StoreAdmin ebooks={ebooks} setEbooks={setEbooks} setNotifications={setNotifications} storeOrders={storeOrders} members={members} addNotif={addNotif} />}
        {activeTab === 'member' && (
          <MemberAdmin 
            members={members} 
            setMembers={setMembers} 
            setNotifications={setNotifications}
            smmOrders={smmOrders}
            channelOrders={channelOrders}
            storeOrders={storeOrders}
            ebooks={ebooks}
            setEbooks={setEbooks}
            channels={channels}
            gradeConfigs={gradeConfigs}
            setGradeConfigs={setGradeConfigs}
            reviews={reviews}
            setReviews={setReviews}
            addNotif={addNotif}
            currentUser={user}
            onUpdateUser={onUpdateUser}
            onRefreshMembers={onRefreshMembers}
          />
        )}
        {activeTab === 'marketing' && <MarketingAdmin user={user} members={members} onIssueCoupons={onIssueCoupons} />}
        {activeTab === 'parttime' && <PartTimeAdmin addNotif={addNotif} members={members} />}
        {activeTab === 'aiconsult' && <AiConsultAdmin />}
        {activeTab === 'popup' && <PopupAdmin />}
        {activeTab === 'franchise' && <FranchiseAdmin members={members} />}
      </main>
    </div>
  );
};

/* ══════════════════════════════════════════════
   가맹점설정 관리 (어드민 전용)
══════════════════════════════════════════════ */
type FranchiseAdminSub = 'plans' | 'products' | 'bank' | 'alba';

const discountPct = (price: number, originalPrice: number) =>
  originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;

const FranchiseAdmin: React.FC<{ members: UserProfile[] }> = ({ members }) => {
  const [sub, setSub] = useState<FranchiseAdminSub>('plans');

  // ── 구독플랜 ──
  const [plans, setPlans]         = useState<FranchisePlan[]>([]);
  const [editPlan, setEditPlan]   = useState<FranchisePlan | null>(null);
  const [planForm, setPlanForm]   = useState({ name: '', price: '', originalPrice: '', period: '월', features: '', isActive: true, paymentUrl: '', points: '' });
  const [planSaving, setPlanSaving] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);

  // ── 마케팅상품 ──
  const [products, setProducts]     = useState<FranchiseProduct[]>([]);
  const [editProduct, setEditProduct] = useState<FranchiseProduct | null>(null);
  const [prodForm, setProdForm]     = useState({ name: '', description: '', price: '', originalPrice: '', minQuantity: '1', maxQuantity: '10000', category: '', isHidden: false });
  const [prodSaving, setProdSaving] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);

  // ── 계좌 설정 ──
  const [bankForm, setBankForm]   = useState({ bankName: '', accountNo: '', holder: '' });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved]  = useState(false);

  // ── 알바비 잔액 관리 ──
  const franchiseMembers = members.filter(m => m.isFranchise && m.role !== 'admin');
  const [albaBalances, setAlbaBalances]     = useState<Record<string, number>>({});
  const [albaHistories, setAlbaHistories]   = useState<Record<string, AlbaBalanceTx[]>>({});
  const [albaChargeAmt, setAlbaChargeAmt]   = useState<Record<string, string>>({});
  const [albaChargeDesc, setAlbaChargeDesc] = useState<Record<string, string>>({});
  const [albaCharging, setAlbaCharging]     = useState<Record<string, boolean>>({});
  const [albaShowHistory, setAlbaShowHistory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFranchisePlans().then(setPlans).catch(() => setPlans(DEFAULT_PLANS));
    fetchFranchiseProductsAdmin().then(setProducts).catch(() => setProducts([]));
    fetchAppSettings(['alba_bank_name', 'alba_bank_account', 'alba_bank_holder']).then(s => {
      setBankForm({ bankName: s['alba_bank_name'] ?? '', accountNo: s['alba_bank_account'] ?? '', holder: s['alba_bank_holder'] ?? '' });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (sub !== 'alba') return;
    franchiseMembers.forEach(m => {
      fetchAlbaBalance(m.id).then(bal => setAlbaBalances(prev => ({ ...prev, [m.id]: bal }))).catch(() => {});
    });
  }, [sub, members]);

  const saveBankSettings = async () => {
    setBankSaving(true);
    try {
      await saveAppSettings({
        alba_bank_name:    bankForm.bankName.trim(),
        alba_bank_account: bankForm.accountNo.trim(),
        alba_bank_holder:  bankForm.holder.trim(),
      });
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 2000);
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
    } finally {
      setBankSaving(false);
    }
  };

  const chargeUser = async (userId: string) => {
    const amount = parseInt(albaChargeAmt[userId] || '0', 10);
    if (!amount || amount <= 0) { alert('충전 금액을 입력하세요.'); return; }
    setAlbaCharging(prev => ({ ...prev, [userId]: true }));
    try {
      await chargeAlbaBalance(userId, amount, albaChargeDesc[userId]?.trim() || `관리자 충전`);
      setAlbaBalances(prev => ({ ...prev, [userId]: (prev[userId] ?? 0) + amount }));
      setAlbaChargeAmt(prev => ({ ...prev, [userId]: '' }));
      setAlbaChargeDesc(prev => ({ ...prev, [userId]: '' }));
    } catch (e: any) {
      alert('충전 실패: ' + e.message);
    } finally {
      setAlbaCharging(prev => ({ ...prev, [userId]: false }));
    }
  };

  const loadHistory = async (userId: string) => {
    const showing = !albaShowHistory[userId];
    setAlbaShowHistory(prev => ({ ...prev, [userId]: showing }));
    if (showing && !albaHistories[userId]) {
      const txs = await fetchAlbaTransactions(userId).catch(() => [] as AlbaBalanceTx[]);
      setAlbaHistories(prev => ({ ...prev, [userId]: txs }));
    }
  };

  // ── 플랜 저장 ──
  const openNewPlan = () => {
    setEditPlan(null);
    setPlanForm({ name: '', price: '', originalPrice: '', period: '월', features: '', isActive: true, paymentUrl: '', points: '' });
    setShowPlanForm(true);
  };
  const openEditPlan = (p: FranchisePlan) => {
    setEditPlan(p);
    setPlanForm({ name: p.name, price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : '', period: p.period, features: p.features.join('\n'), isActive: p.isActive, paymentUrl: p.paymentUrl ?? '', points: p.points != null ? String(p.points) : '' });
    setShowPlanForm(true);
  };
  const closePlanForm = () => {
    setEditPlan(null);
    setPlanForm({ name: '', price: '', originalPrice: '', period: '월', features: '', isActive: true, paymentUrl: '', points: '' });
    setShowPlanForm(false);
  };
  const savePlan = async () => {
    if (!planForm.name.trim() || !planForm.price) return;
    setPlanSaving(true);
    const originalPrice = Number(planForm.originalPrice) || 0;
    const parsedPoints = planForm.points.trim() ? Number(planForm.points) : null;
    const plan: FranchisePlan = {
      id: editPlan?.id ?? `plan_${Date.now()}`,
      name: planForm.name.trim(),
      price: Number(planForm.price),
      ...(originalPrice > Number(planForm.price) ? { originalPrice } : {}),
      period: planForm.period,
      features: planForm.features.split('\n').map(s => s.trim()).filter(Boolean),
      isActive: planForm.isActive,
      sortOrder: editPlan?.sortOrder ?? plans.length,
      ...(planForm.paymentUrl.trim() ? { paymentUrl: planForm.paymentUrl.trim() } : {}),
      points: parsedPoints,
    };
    const next = editPlan ? plans.map(p => p.id === editPlan.id ? plan : p) : [...plans, plan];
    await upsertFranchisePlans(next).catch(() => {});
    setPlans(next);
    setShowPlanForm(false);
    setEditPlan(null);
    setPlanSaving(false);
  };
  const deletePlan = async (id: string) => {
    if (!confirm('이 플랜을 삭제할까요?')) return;
    await deleteFranchisePlan(id).catch(() => {});
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  // ── 상품 저장 ──
  const openNewProduct = () => {
    setEditProduct(null);
    setProdForm({ name: '', description: '', price: '', originalPrice: '', minQuantity: '1', maxQuantity: '10000', category: '', isHidden: false });
    setShowProductForm(true);
  };
  const openEditProduct = (p: FranchiseProduct) => {
    setEditProduct(p);
    setProdForm({ name: p.name, description: p.description, price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : '', minQuantity: String(p.minQuantity), maxQuantity: String(p.maxQuantity), category: p.category, isHidden: p.isHidden });
    setShowProductForm(true);
  };
  const closeProductForm = () => {
    setEditProduct(null);
    setProdForm({ name: '', description: '', price: '', originalPrice: '', minQuantity: '1', maxQuantity: '10000', category: '', isHidden: false });
    setShowProductForm(false);
  };
  const saveProduct = async () => {
    if (!prodForm.name.trim()) return;
    setProdSaving(true);
    const originalPrice = Number(prodForm.originalPrice) || 0;
    const price = Number(prodForm.price);
    const product: FranchiseProduct = {
      id: editProduct?.id ?? `fp_${Date.now()}`,
      name: prodForm.name.trim(),
      description: prodForm.description.trim(),
      price,
      ...(originalPrice > price ? { originalPrice } : {}),
      minQuantity: Number(prodForm.minQuantity) || 1,
      maxQuantity: Number(prodForm.maxQuantity) || 10000,
      category: prodForm.category.trim() || '일반',
      isHidden: prodForm.isHidden,
      sortOrder: editProduct?.sortOrder ?? products.length,
    };
    const next = editProduct ? products.map(p => p.id === editProduct.id ? product : p) : [...products, product];
    await upsertFranchiseProducts(next).catch(() => {});
    setProducts(next);
    setShowProductForm(false);
    setEditProduct(null);
    setProdSaving(false);
  };
  const deleteProduct = async (id: string) => {
    if (!confirm('이 상품을 삭제할까요?')) return;
    await deleteFranchiseProduct(id).catch(() => {});
    setProducts(prev => prev.filter(p => p.id !== id));
  };
  const toggleHidden = async (product: FranchiseProduct) => {
    const updated = { ...product, isHidden: !product.isHidden };
    const next = products.map(p => p.id === product.id ? updated : p);
    await upsertFranchiseProducts(next).catch(() => {});
    setProducts(next);
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-indigo-400 bg-white';

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-lg font-black text-gray-900">가맹점 설정</h2>
      {/* 서브탭 */}
      <div className="flex flex-wrap gap-0 border-b border-gray-200">
        {([['plans','구독플랜 관리'],['products','마케팅프로그램 관리'],['bank','계좌 설정'],['alba','알바비 충전관리']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSub(id)}
            className={`px-4 py-2 font-black text-sm border-b-2 transition-all ${sub === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 구독플랜 관리 ── */}
      {sub === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 font-bold">가맹점 구독 플랜을 추가·수정·삭제합니다. 가맹점 구독관리 탭에 표시됩니다.</p>
            <button type="button" onClick={openNewPlan}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors">
              + 플랜 추가
            </button>
          </div>

          {/* 플랜 폼 */}
          {showPlanForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-gray-800">{editPlan ? '플랜 수정' : '새 플랜'}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="플랜명 (예: 기본 플랜)" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
                <input className={inputCls} placeholder="기간 (예: 월)" value={planForm.period} onChange={e => setPlanForm(f => ({ ...f, period: e.target.value }))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="정가 (할인 전, 선택)" type="number" value={planForm.originalPrice} onChange={e => setPlanForm(f => ({ ...f, originalPrice: e.target.value }))} />
                <input className={inputCls} placeholder="판매가 (원) *" type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <textarea className={`${inputCls} resize-none`} rows={4} placeholder="기능 목록 (한 줄에 하나씩)" value={planForm.features} onChange={e => setPlanForm(f => ({ ...f, features: e.target.value }))} />
              <input className={inputCls} placeholder="결제 URL (N잡스토어 상품 링크)" value={planForm.paymentUrl} onChange={e => setPlanForm(f => ({ ...f, paymentUrl: e.target.value }))} />
              <input className={inputCls} placeholder="포인트 (빈칸=무제한, 예: 600000)" type="number" value={planForm.points} onChange={e => setPlanForm(f => ({ ...f, points: e.target.value }))} />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={planForm.isActive} onChange={e => setPlanForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-bold text-gray-700">활성화</span>
                </label>
                <button type="button" onClick={savePlan} disabled={planSaving || !planForm.name.trim() || !planForm.price}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                  {planSaving ? '저장 중...' : '저장'}
                </button>
                <button type="button" onClick={closePlanForm}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-black hover:bg-gray-200 transition-colors">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 플랜 목록 */}
          <div className="grid sm:grid-cols-2 gap-3">
            {plans.map(plan => (
              <div key={plan.id} className={`bg-white border-2 rounded-2xl p-4 space-y-2 ${plan.isActive ? 'border-indigo-100' : 'border-gray-100 opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-black text-gray-900">{plan.name}</span>
                    {!plan.isActive && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded font-black">비활성</span>}
                    {plan.originalPrice && plan.originalPrice > plan.price && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400 font-bold line-through">{plan.originalPrice.toLocaleString()}원</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-black">{discountPct(plan.price, plan.originalPrice)}% 할인</span>
                      </div>
                    )}
                    <p className="text-xl font-black text-indigo-600 mt-0.5">{plan.price.toLocaleString()}원<span className="text-xs text-gray-400 font-bold">/{plan.period}</span></p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => openEditPlan(plan)} className="px-2.5 py-1 rounded-lg text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200">수정</button>
                    <button type="button" onClick={() => deletePlan(plan.id)} className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-50 text-red-500 hover:bg-red-100">삭제</button>
                  </div>
                </div>
                <ul className="space-y-1">
                  {plan.features.map((f, i) => <li key={i} className="text-xs text-gray-600 font-bold flex gap-1.5"><span className="text-emerald-500">✓</span>{f}</li>)}
                </ul>
                {plan.points != null
                  ? <p className="text-[10px] text-indigo-500 font-bold">포인트: {plan.points.toLocaleString()}P</p>
                  : <p className="text-[10px] text-emerald-500 font-bold">포인트: 무제한</p>}
                {plan.paymentUrl && (
                  <p className="text-[10px] text-blue-500 font-bold truncate">🔗 {plan.paymentUrl}</p>
                )}
              </div>
            ))}
          </div>
          {plans.length === 0 && <p className="text-center py-8 text-gray-300 font-bold">등록된 플랜이 없습니다</p>}
        </div>
      )}

      {/* ── 마케팅프로그램 관리 ── */}
      {sub === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 font-bold">가맹점 전용 마케팅프로그램 상품을 관리합니다. 가맹점 마케팅상품 탭에서 주문 가능합니다.</p>
            <button type="button" onClick={openNewProduct}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 transition-colors">
              + 상품 추가
            </button>
          </div>

          {/* 상품 폼 */}
          {showProductForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-black text-gray-800">{editProduct ? '상품 수정' : '새 상품'}</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="상품명 *" value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} />
                <input className={inputCls} placeholder="카테고리 (예: SNS마케팅)" value={prodForm.category} onChange={e => setProdForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="상품 설명" value={prodForm.description} onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="정가 (할인 전, 선택)" type="number" value={prodForm.originalPrice} onChange={e => setProdForm(f => ({ ...f, originalPrice: e.target.value }))} />
                <input className={inputCls} placeholder="판매단가 (원) *" type="number" value={prodForm.price} onChange={e => setProdForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="최소 수량" type="number" value={prodForm.minQuantity} onChange={e => setProdForm(f => ({ ...f, minQuantity: e.target.value }))} />
                <input className={inputCls} placeholder="최대 수량" type="number" value={prodForm.maxQuantity} onChange={e => setProdForm(f => ({ ...f, maxQuantity: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={prodForm.isHidden} onChange={e => setProdForm(f => ({ ...f, isHidden: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-bold text-gray-700">숨김 처리</span>
                </label>
                <button type="button" onClick={saveProduct} disabled={prodSaving || !prodForm.name.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 hover:bg-indigo-700 transition-colors">
                  {prodSaving ? '저장 중...' : '저장'}
                </button>
                <button type="button" onClick={closeProductForm}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-black hover:bg-gray-200 transition-colors">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 상품 목록 */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['상품명','카테고리','단가','수량범위','상태','관리'].map(h => <th key={h} className="px-4 py-3 text-left font-black text-gray-400 uppercase text-[11px] whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(product => (
                  <tr key={product.id} className={`hover:bg-gray-50/50 ${product.isHidden ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-black text-gray-900">{product.name}</p>
                      {product.description && <p className="text-gray-400 text-[11px] truncate max-w-[200px]">{product.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.category}</td>
                    <td className="px-4 py-3">
                      {product.originalPrice && product.originalPrice > product.price ? (
                        <div className="space-y-0.5">
                          <p className="text-gray-400 font-bold line-through text-[10px]">{product.originalPrice.toLocaleString()}원</p>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-gray-800">{product.price.toLocaleString()}원</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-black">{discountPct(product.price, product.originalPrice)}%</span>
                          </div>
                        </div>
                      ) : (
                        <span className="font-black text-gray-800">{product.price.toLocaleString()}원</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{product.minQuantity.toLocaleString()}~{product.maxQuantity.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleHidden(product)}
                        className={`px-2 py-1 rounded-full text-[10px] font-black ${product.isHidden ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                        {product.isHidden ? '숨김' : '표시중'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => openEditProduct(product)} className="px-2.5 py-1 rounded-lg text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200">수정</button>
                        <button type="button" onClick={() => deleteProduct(product.id)} className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-50 text-red-500 hover:bg-red-100">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-gray-300 font-bold">등록된 상품이 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 계좌 설정 ── */}
      {sub === 'bank' && (
        <div className="max-w-md space-y-4">
          <p className="text-xs text-gray-400 font-bold">가맹점 알바비 충전 시 안내할 입금 계좌 정보를 설정합니다. 원고시트 페이지 상단에 표시됩니다.</p>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">은행명</label>
              <input className={inputCls} placeholder="예: 신한은행" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">계좌번호</label>
              <input className={inputCls} placeholder="예: 110-123-456789" value={bankForm.accountNo} onChange={e => setBankForm(f => ({ ...f, accountNo: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">예금주</label>
              <input className={inputCls} placeholder="예: 홍길동" value={bankForm.holder} onChange={e => setBankForm(f => ({ ...f, holder: e.target.value }))} />
            </div>
            <button type="button" onClick={saveBankSettings} disabled={bankSaving}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {bankSaved ? '✓ 저장됨' : bankSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 font-bold">
            💡 게시글 1개당 알바비: <span className="font-black">500원</span> (고정)
          </div>
        </div>
      )}

      {/* ── 알바비 충전관리 ── */}
      {sub === 'alba' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-400 font-bold">
            가맹점 회원의 알바비 잔액을 조회하고 충전합니다. 회원이 계좌이체로 입금하면 관리자가 직접 충전해주세요.
          </p>
          {franchiseMembers.length === 0 ? (
            <p className="text-center py-10 text-gray-300 font-bold text-sm">가맹점 회원이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {franchiseMembers.map(m => {
                const bal = albaBalances[m.id] ?? null;
                const txs = albaHistories[m.id];
                const showHist = albaShowHistory[m.id];
                return (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800">{m.nickname}</p>
                        <p className="text-[11px] text-gray-400 font-bold">{m.email ?? m.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold">잔액</p>
                        <p className={`text-base font-black ${bal !== null && bal > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {bal !== null ? `${bal.toLocaleString()}원` : '—'}
                        </p>
                      </div>
                      {/* 충전 입력 */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          min={500}
                          step={500}
                          placeholder="충전 금액 (원)"
                          value={albaChargeAmt[m.id] ?? ''}
                          onChange={e => setAlbaChargeAmt(prev => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-36 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-indigo-400"
                        />
                        <input
                          type="text"
                          placeholder="메모 (선택)"
                          value={albaChargeDesc[m.id] ?? ''}
                          onChange={e => setAlbaChargeDesc(prev => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={() => chargeUser(m.id)}
                          disabled={!!albaCharging[m.id]}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {albaCharging[m.id] ? '충전 중...' : '충전'}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadHistory(m.id)}
                          className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 font-black text-xs hover:bg-gray-200 transition-colors whitespace-nowrap"
                        >
                          {showHist ? '내역 숨기기' : '내역'}
                        </button>
                      </div>
                    </div>
                    {/* 거래 내역 */}
                    {showHist && (
                      <div className="border-t border-gray-100 bg-gray-50 max-h-48 overflow-y-auto">
                        {!txs ? (
                          <p className="text-center py-3 text-xs text-gray-400 font-bold">불러오는 중...</p>
                        ) : txs.length === 0 ? (
                          <p className="text-center py-3 text-xs text-gray-400 font-bold">거래 내역 없음</p>
                        ) : txs.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-100 last:border-0">
                            <div>
                              <p className="text-xs font-black text-gray-700">{tx.description || (tx.type === 'charge' ? '충전' : '사용')}</p>
                              <p className="text-[10px] text-gray-400 font-bold">{tx.createdAt.slice(0, 16).replace('T', ' ')}</p>
                            </div>
                            <span className={`text-sm font-black ${tx.type === 'charge' ? 'text-blue-600' : 'text-red-500'}`}>
                              {tx.type === 'charge' ? '+' : '-'}{tx.amount.toLocaleString()}원
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
