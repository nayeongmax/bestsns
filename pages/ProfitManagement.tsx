
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, StoreOrder } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';

interface WithdrawalBatch {
  id: string;
  confirmedDate: string; 
  amount: number; 
  grossAmount: number; 
  status: '지급 예정' | '지급 완료';
  orderIds: string[];
  productName?: string; 
}

interface Props {
  user: UserProfile;
  storeOrders: StoreOrder[];
}

const ProfitManagement: React.FC<Props> = ({ user, storeOrders }) => {
  const navigate = useNavigate();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [withdrawalStep, setWithdrawalStep] = useState<'ready' | 'success'>('ready');
  const [showReceiptOrder, setShowReceiptOrder] = useState<any | null>(null);
  const [showSettlementGuideModal, setShowSettlementGuideModal] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'withdrawals' | 'invoices'>('withdrawals');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'전체' | '지급 완료' | '지급 예정' | '신청 가능'>('전체');
  const [monthFilter, setMonthFilter] = useState<string>('전체 기간');
  const [chartTab, setChartTab] = useState<'daily' | 'monthly'>('daily');

  // 계좌 정보 등록 여부 확인
  const isBankInfoRegistered = useMemo(() => {
    const bankName = user.sellerApplication?.bankInfo?.bankName?.trim();
    const accountNo = user.sellerApplication?.bankInfo?.accountNo?.trim();
    return !!(bankName && accountNo);
  }, [user.sellerApplication]);

  const calculateDetailedProfit = (price: number) => {
    let tierDetails = { t1: 0, t2: 0, t3: 0 };
    let serviceFeeBase = 0;

    if (price <= 500000) {
      serviceFeeBase = price * 0.13;
      tierDetails.t1 = serviceFeeBase;
    } else if (price <= 2000000) {
      tierDetails.t1 = 500000 * 0.13;
      tierDetails.t2 = (price - 500000) * 0.07;
      serviceFeeBase = tierDetails.t1 + tierDetails.t2;
    } else {
      tierDetails.t1 = 500000 * 0.13;
      tierDetails.t2 = 1500000 * 0.07;
      tierDetails.t3 = (price - 2000000) * 0.02;
      serviceFeeBase = tierDetails.t1 + tierDetails.t2 + tierDetails.t3;
    }

    const platformFee = Math.floor(serviceFeeBase);
    const pgFee = Math.floor(price * 0.033);
    const vatOnFee = Math.floor((platformFee + pgFee) * 0.1);
    const totalDeduction = platformFee + pgFee + vatOnFee;
    return { platformFee, pgFee, vatOnFee, totalDeduction, netProfit: price - totalDeduction, tierDetails };
  };

  const allMyOrders = useMemo(() => {
    return storeOrders
      .filter(o => o.sellerNickname === user.nickname)
      .sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [storeOrders, user.nickname]);

  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalBatch[]>(() => {
    const saved = localStorage.getItem(`withdrawal_history_v21_${user.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const confirmedOrders = useMemo(() => allMyOrders.filter(o => o.status === '구매확정'), [allMyOrders]);
  
  const stats = useMemo(() => {
    const withdrawnBatchIds = withdrawalHistory.filter(w => w.status === '지급 완료').flatMap(w => w.orderIds);
    const pendingBatchIds = withdrawalHistory.filter(w => w.status === '지급 예정').flatMap(w => w.orderIds);

    const withdrawnOrders = confirmedOrders.filter(o => withdrawnBatchIds.includes(o.id));
    const pendingOrders = confirmedOrders.filter(o => pendingBatchIds.includes(o.id));
    const availableOrders = confirmedOrders.filter(o => !withdrawnBatchIds.includes(o.id) && !pendingBatchIds.includes(o.id));

    const withdrawnPrice = withdrawnOrders.reduce((sum, o) => sum + o.price, 0);
    const pendingPrice = pendingOrders.reduce((sum, o) => sum + o.price, 0);
    const availablePrice = availableOrders.reduce((sum, o) => sum + o.price, 0);
    const cumulativePrice = withdrawnPrice + pendingPrice + availablePrice;

    return { withdrawnPrice, pendingPrice, availablePrice, cumulativePrice, availableOrders };
  }, [confirmedOrders, withdrawalHistory]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    confirmedOrders.forEach(o => { if(o.confirmedAt) months.add(o.confirmedAt.substring(0, 7).replace('.', '-')); });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [confirmedOrders]);

  const chartData = useMemo(() => {
    if (chartTab === 'daily') {
      const data = [];
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const searchStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        const daySales = confirmedOrders.filter(o => o.confirmedAt?.startsWith(searchStr)).reduce((sum, o) => sum + o.price, 0);
        data.push({ name: `${d.getMonth() + 1}/${d.getDate()}`, 금액: daySales });
      }
      return data;
    } else {
      const data = [];
      const year = new Date().getFullYear();
      for (let m = 0; m < 12; m++) {
        const prefix = `${year}.${String(m + 1).padStart(2, '0')}`;
        const monthSales = confirmedOrders.filter(o => o.confirmedAt?.startsWith(prefix)).reduce((sum, o) => sum + o.price, 0);
        data.push({ name: `${m + 1}월`, 금액: monthSales });
      }
      return data;
    }
  }, [confirmedOrders, chartTab]);

  const monthlyInvoices = useMemo(() => {
    const groups: Record<string, { sales: number, profit: number, fee: number, orders: StoreOrder[] }> = {};
    confirmedOrders.forEach(o => {
      if (!o.confirmedAt) return;
      const month = o.confirmedAt.substring(0, 7).replace('.', '년 ') + '월';
      if (!groups[month]) groups[month] = { sales: 0, profit: 0, fee: 0, orders: [] };
      const { totalDeduction, netProfit } = calculateDetailedProfit(o.price);
      groups[month].sales += o.price;
      groups[month].profit += netProfit;
      groups[month].fee += totalDeduction;
      groups[month].orders.push(o);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [confirmedOrders]);

  const handleApplyWithdrawal = () => {
    const netToWithdraw = stats.availableOrders.reduce((sum, o) => sum + calculateDetailedProfit(o.price).netProfit, 0);
    if (netToWithdraw === 0) return alert('신청 가능한 확정 수익금이 없습니다.');
    if (!isBankInfoRegistered) return alert('계좌 정보가 등록되어 있지 않습니다. 계정 정보 관리에서 계좌를 등록해 주세요.');

    const newBatch: WithdrawalBatch = {
      id: `W-${Date.now()}`,
      confirmedDate: new Date().toLocaleString(),
      amount: netToWithdraw,
      grossAmount: stats.availablePrice,
      status: '지급 예정',
      orderIds: stats.availableOrders.map(o => o.id),
      productName: stats.availableOrders.length === 1 ? stats.availableOrders[0].productName : `${stats.availableOrders[0].productName} 외 ${stats.availableOrders.length-1}건`
    };
    setWithdrawalHistory(prev => [newBatch, ...prev]);
    setWithdrawalStep('success');
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-32 space-y-10 px-4 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 gap-8">
        <div className="space-y-3 w-full lg:w-auto text-center lg:text-left">
           <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">수익 관리</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
           <div className="text-right shrink-0">
              <p className="text-[11px] font-black text-gray-400 uppercase italic leading-none mb-1">실제 출금 가능 순수익</p>
              <h3 className="text-4xl font-black text-blue-600 italic tracking-tighter">₩ {stats.availableOrders.reduce((sum, o) => sum + calculateDetailedProfit(o.price).netProfit, 0).toLocaleString()}</h3>
           </div>
           <button onClick={() => { if(stats.availablePrice > 0) setShowApplyModal(true); else alert('신청 가능한 금액이 없습니다.'); }} className="w-full sm:w-auto bg-gray-900 text-white px-12 py-5 rounded-[24px] font-black text-[15px] shadow-2xl hover:bg-blue-600 transition-all italic uppercase tracking-widest active:scale-95">수익금 출금 신청 🚀</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 relative group overflow-hidden"><p className="text-[11px] font-black text-gray-400 uppercase italic mb-3">누적판매액 (확정기준)</p><h4 className="text-3xl font-black text-gray-900 italic tracking-tighter">₩{stats.cumulativePrice.toLocaleString()}</h4></div>
        <div className="bg-gray-50 p-8 rounded-[48px] border border-gray-200"><p className="text-[11px] font-black text-gray-400 uppercase italic mb-3">지급완료 (판매금액)</p><h4 className="text-3xl font-black text-gray-400 italic tracking-tighter">₩{stats.withdrawnPrice.toLocaleString()}</h4></div>
        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 group hover:border-orange-100 transition-all"><p className="text-[11px] font-black text-orange-400 uppercase italic mb-3">지급예정 (구매확정+신청O)</p><h4 className="text-3xl font-black text-gray-900 italic tracking-tighter">₩{stats.pendingPrice.toLocaleString()}</h4></div>
        <div className="bg-blue-600 p-8 rounded-[48px] shadow-2xl text-white relative overflow-hidden"><p className="text-[11px] font-black text-blue-200 uppercase italic mb-3">신청가능 (구매확정+신청X)</p><h4 className="text-4xl font-black italic tracking-tighter">₩{stats.availablePrice.toLocaleString()}</h4></div>
      </div>

      <div className="bg-white p-10 rounded-[64px] border border-gray-100 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-4">
           <div><h3 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-200 underline-offset-4">수수료 분석 리포트</h3><p className="text-[11px] font-bold text-gray-400 uppercase mt-1 italic">구매 확정 일자 기준 매출 분석 그래프</p></div>
           <div className="flex p-1.5 bg-gray-100 rounded-full shadow-inner border border-gray-200/50">
              <button onClick={() => setChartTab('daily')} className={`px-10 py-3 rounded-full text-[12px] font-black transition-all ${chartTab === 'daily' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}>일별</button>
              <button onClick={() => setChartTab('monthly')} className={`px-10 py-3 rounded-full text-[12px] font-black transition-all ${chartTab === 'monthly' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400'}`}>월별</button>
           </div>
        </div>
        <div className="h-[400px] w-full pt-10 px-4">
          <ResponsiveContainer width="100%" height="100%">
            {chartTab === 'daily' ? (
              <AreaChart data={chartData}>
                <defs><linearGradient id="colorAmount" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }} />
                <Tooltip formatter={(val: number) => [`₩${val.toLocaleString()}`, '확정 금액']} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                <Area type="monotone" dataKey="금액" stroke="#3b82f6" strokeWidth={5} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }} />
                <Tooltip cursor={{ fill: '#f8fafc', radius: 12 }} formatter={(val: number) => [`₩${val.toLocaleString()}`, '월간 확정']} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 900 }} />
                <Bar dataKey="금액" radius={[12, 12, 0, 0]}>{chartData.map((_, index) => (<Cell key={`cell-${index}`} fill={index === new Date().getMonth() ? '#3b82f6' : '#e2e8f0'} />))}</Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-6">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4">
            <div className="flex bg-white p-2 rounded-[32px] border border-gray-100 shadow-sm w-fit">
               <button onClick={() => setActiveBottomTab('withdrawals')} className={`px-10 py-4 rounded-[24px] text-[15px] font-black transition-all ${activeBottomTab === 'withdrawals' ? 'bg-gray-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>📜 출금 신청 히스토리</button>
               <button onClick={() => setActiveBottomTab('invoices')} className={`px-10 py-4 rounded-[24px] text-[15px] font-black transition-all ${activeBottomTab === 'invoices' ? 'bg-gray-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>🧾 월별 수수료 매출 증빙</button>
            </div>
            <div className="flex gap-2">
               <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-6 py-4 bg-white border border-gray-100 rounded-2xl font-black text-sm shadow-sm outline-none cursor-pointer">
                  <option>전체 기간</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
               </select>
               <button onClick={() => setShowSettlementGuideModal(true)} className="bg-blue-50 text-blue-600 px-8 py-4 rounded-[24px] text-[14px] font-black italic hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100">정산 정책 안내 ⓘ</button>
            </div>
         </div>

         <div className="bg-white rounded-[60px] shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
            {activeBottomTab === 'withdrawals' ? (
              <div className="flex flex-col">
                <div className="p-10 bg-gray-50/30 border-b border-gray-100 flex gap-4 overflow-x-auto no-scrollbar">
                  {['전체', '신청 가능', '지급 예정', '지급 완료'].map(f => (
                    <button key={f} onClick={() => setWithdrawalFilter(f as any)} className={`px-8 py-3 rounded-full text-[13px] font-black transition-all border shrink-0 ${withdrawalFilter === f ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-gray-400 border-gray-200'}`}>{f}</button>
                  ))}
                </div>
                
                <div className="px-10 py-5 bg-gray-50 border-b border-gray-100 flex items-center text-[11px] font-black text-gray-400 italic">
                  <div className="w-[12%] text-center">진행상태</div>
                  <div className="flex-1 px-10">상품정보 및 주문 고유번호</div>
                  <div className="w-[15%] text-right">판매 금액</div>
                  <div className="w-[18%] text-center">구매 확정 일시</div>
                  <div className="w-[15%] text-right">실제 정산 순수익</div>
                </div>

                <div className="divide-y divide-gray-50">
                  {(() => {
                    const items: any[] = confirmedOrders.map(o => {
                        const historyItem = withdrawalHistory.find(w => w.orderIds.includes(o.id));
                        return {
                            ...o,
                            dataType: historyItem ? 'history' : 'can',
                            statusLabel: historyItem ? historyItem.status : '신청 가능',
                        };
                    });

                    let filtered = items;
                    if (withdrawalFilter !== '전체') {
                        filtered = items.filter(it => it.statusLabel === withdrawalFilter);
                    }
                    if (monthFilter !== '전체 기간') {
                        filtered = filtered.filter(it => it.confirmedAt?.startsWith(monthFilter.replace('-', '.')));
                    }

                    filtered.sort((a,b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());

                    if (filtered.length === 0) return <div className="py-40 text-center text-gray-300 font-black italic text-xl uppercase tracking-widest opacity-50">조회된 정산 내역이 없습니다.</div>;

                    return filtered.map((item, idx) => {
                      const isCan = item.dataType === 'can';
                      const statusColor = isCan ? 'bg-orange-50 text-orange-500' : (item.statusLabel === '지급 완료' ? 'bg-green-50 text-green-500' : 'bg-blue-600 text-white animate-pulse');
                      
                      return (
                        <div key={idx} className="p-10 flex items-center hover:bg-gray-50/50 transition-all group">
                          <div className="w-[12%] flex justify-center">
                            <span className={`w-28 text-center py-2.5 rounded-xl text-[11px] font-black italic uppercase shadow-sm ${statusColor}`}>{item.statusLabel}</span>
                          </div>
                          <div className="flex-1 px-10 min-w-0">
                            <p className="text-[15px] text-gray-900 font-black mb-1 italic tracking-tight underline underline-offset-4 decoration-gray-900">#{item.id}</p>
                            <h4 className="text-[17px] font-black text-gray-800 truncate group-hover:text-blue-600 transition-colors italic">{item.productName}</h4>
                          </div>
                          <div className="w-[15%] text-right"><p className="text-[15px] font-black text-gray-400 italic">₩{item.price.toLocaleString()}</p></div>
                          <div className="w-[18%] text-center"><p className="text-[13px] font-bold text-gray-400 italic">{item.confirmedAt}</p></div>
                          <div className="w-[15%] text-right">
                            <div onClick={() => setShowReceiptOrder(item)} className="cursor-pointer bg-blue-50/30 px-6 py-4 rounded-[24px] border border-transparent hover:border-blue-200 hover:bg-white transition-all shadow-sm">
                               <p className="text-[10px] font-black text-blue-400 uppercase italic text-right mb-1">정산 영수증 ⓘ</p>
                               <p className="text-2xl font-black text-blue-600 italic tracking-tighter text-right">₩{calculateDetailedProfit(item.price).netProfit.toLocaleString()}원</p>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                 {monthlyInvoices.length === 0 ? (
                    <div className="py-40 text-center text-gray-300 font-black italic text-xl opacity-50">확정된 매출 데이터가 없습니다.</div>
                 ) : monthlyInvoices.map(([month, data]) => (
                   <div key={month} className="p-10 flex flex-col lg:flex-row justify-between items-center hover:bg-gray-50/50 transition-all gap-8">
                      <div className="flex items-center gap-16 w-full lg:w-auto">
                        <div className="bg-gray-900 text-white w-28 h-28 rounded-3xl flex flex-col items-center justify-center shadow-2xl shrink-0 border-4 border-white">
                           <span className="text-[10px] font-black uppercase opacity-50">{month.split('년')[0]}</span>
                           <span className="text-3xl font-black italic tracking-tighter">{month.split('년')[1].trim()}</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[19px] font-black text-gray-800 mb-1 italic">수수료 세금계산서 발행 합계 <span className="text-rose-500 text-3xl ml-3 tracking-tighter">₩{data.fee.toLocaleString()}원</span></p>
                          <div className="flex gap-6 text-[13px] font-bold text-gray-400 italic">
                            <span>해당 월 확정 매출: ₩{data.sales.toLocaleString()}</span>
                            <span className="opacity-20">|</span>
                            <span>정산 순수익 합계: ₩{data.profit.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end w-full lg:max-w-xl">
                        {data.orders.map(o => (
                          <button key={o.id} onClick={() => setShowReceiptOrder(o)} className="px-5 py-2.5 bg-white border border-gray-100 text-gray-900 rounded-2xl text-[12px] font-black hover:bg-rose-500 hover:text-white transition-all shadow-sm italic">
                            #{o.id.slice(-8)} | ₩{o.price.toLocaleString()}
                          </button>
                        ))}
                      </div>
                   </div>
                 ))}
              </div>
            )}
         </div>
      </div>

      {/* 모달: 정산 정책 안내 (레이아웃 개편 및 250만 원 예시 포함) */}
      {showSettlementGuideModal && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-4xl rounded-[64px] p-12 lg:p-16 shadow-2xl space-y-12 border-8 border-blue-50 overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="text-center space-y-3">
                 <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">수익금 정산 정책 가이드</h3>
              </div>
              <div className="space-y-12">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-8 rounded-[40px] text-center space-y-3 shadow-inner"><span className="text-4xl">🏢</span><p className="text-[13px] font-black text-gray-400 uppercase italic leading-none">플랫폼 이용료</p><p className="text-2xl font-black text-gray-800 italic">2% ~ 13%</p></div>
                    <div className="bg-gray-50 p-8 rounded-[40px] text-center space-y-3 shadow-inner"><span className="text-4xl">💳</span><p className="text-[13px] font-black text-gray-400 uppercase italic leading-none">전자결제수수료</p><p className="text-2xl font-black text-gray-800 italic">3.3% 고정</p></div>
                    <div className="bg-gray-50 p-8 rounded-[40px] text-center space-y-3 shadow-inner"><span className="text-4xl">🏛️</span><p className="text-[13px] font-black text-gray-400 uppercase italic leading-none">수수료 부가세</p><p className="text-2xl font-black text-gray-800 italic">10%</p></div>
                 </div>
                 
                 <div className="space-y-12">
                    <div className="bg-[#fcfdff] border-4 border-blue-50 rounded-[48px] p-12 shadow-sm">
                        <h5 className="text-3xl font-black text-gray-900 italic mb-8 pb-4 border-b border-dashed border-blue-100">예시 1: 500,000원 상품 판매 시</h5>
                        <div className="space-y-6 font-mono text-[18px]">
                           <div className="flex justify-between items-center text-gray-600"><span>• 플랫폼 이용료 (1구간 13% 단일 적용)</span><span className="font-black text-rose-500">- ₩65,000</span></div>
                           <div className="flex justify-between items-center text-gray-600"><span>• PG 결제망 시스템 수수료 (3.3%)</span><span className="font-black text-rose-500">- ₩16,500</span></div>
                           <div className="flex justify-between items-center text-gray-600"><span>• 공제 수수료액에 대한 부가세 (10%)</span><span className="font-black text-rose-500">- ₩8,150</span></div>
                           <div className="pt-8 mt-6 border-t-4 border-double border-gray-100 flex justify-between items-baseline"><span className="text-blue-500 font-black text-2xl uppercase">최종 통장 실 입금액</span><span className="text-6xl font-black text-blue-600 tracking-tighter">₩410,350</span></div>
                        </div>
                    </div>
                    
                    <div className="bg-[#fcfdff] border-4 border-rose-50 rounded-[48px] p-12 shadow-sm">
                        <h5 className="text-3xl font-black text-gray-900 italic mb-8 pb-4 border-b border-dashed border-rose-100">예시 2: 2,500,000원 상품 판매 시</h5>
                        <div className="space-y-6 font-mono text-[18px]">
                           <div className="bg-gray-50/50 p-8 rounded-3xl space-y-4 mb-4 border border-gray-100">
                             <p className="text-[16px] font-black text-gray-400 uppercase italic tracking-widest border-b border-gray-200 pb-2">• 누적 매출 구간별 이용료 계산식</p>
                             <div className="flex justify-between text-lg font-black text-gray-700 italic"><span>1구간 (~50만): 50만 * 13%</span><span>65,000원</span></div>
                             <div className="flex justify-between text-lg font-black text-gray-700 italic"><span>2구간 (50~200만): 150만 * 7%</span><span>105,000원</span></div>
                             <div className="flex justify-between text-lg font-black text-gray-700 italic"><span>3구간 (200만~): 50만 * 2%</span><span>10,000원</span></div>
                           </div>
                           <div className="flex justify-between items-center text-gray-600"><span>• 플랫폼 이용료 합계</span><span className="font-black text-rose-500">- ₩180,000</span></div>
                           <div className="flex justify-between items-center text-gray-600"><span>• PG 결제망 시스템 수수료 (3.3%)</span><span className="font-black text-rose-500">- ₩82,500</span></div>
                           <div className="flex justify-between items-center text-gray-600"><span>• 공제 수수료액에 대한 부가세 (10%)</span><span className="font-black text-rose-500">- ₩26,250</span></div>
                           <div className="pt-8 mt-6 border-t-4 border-double border-gray-100 flex justify-between items-baseline"><span className="text-blue-500 font-black text-2xl uppercase">최종 통장 실 입금액</span><span className="text-6xl font-black text-blue-600 tracking-tighter">₩2,211,250</span></div>
                        </div>
                    </div>
                 </div>
              </div>
              <button onClick={() => setShowSettlementGuideModal(false)} className="w-full py-8 bg-gray-900 text-white rounded-[40px] font-black text-2xl shadow-xl hover:bg-blue-600 transition-all uppercase italic">내용을 모두 확인했습니다</button>
           </div>
        </div>
      )}

      {/* 모달: 상세 정산 영수증 (디자인 통일 및 잘림 방지) */}
      {showReceiptOrder && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[64px] p-16 shadow-2xl relative overflow-hidden border-8 border-orange-50 animate-in zoom-in-95">
              <div className="text-center space-y-6 mb-12">
                 <h4 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-orange-500 underline-offset-8">정산 상세 내역</h4>
                 <p className="text-[14px] font-black text-gray-400 uppercase tracking-[0.4em]">주문 고유 번호: {showReceiptOrder.id}</p>
              </div>
              <div className="space-y-10">
                 <div className="bg-gradient-to-b from-gray-50/80 to-white p-12 rounded-[56px] space-y-10 relative shadow-2xl border border-gray-100">
                    <div className="space-y-8 font-black text-gray-700 italic">
                       {(() => {
                         const { platformFee, pgFee, vatOnFee, totalDeduction, netProfit, tierDetails } = calculateDetailedProfit(showReceiptOrder.price || 0);
                         return (
                           <>
                             <div className="flex justify-between items-center text-xl">
                                <span>판매 금액 (VAT포함)</span>
                                <span className="text-gray-900 text-3xl tracking-tighter">₩{(showReceiptOrder.price || 0).toLocaleString()}</span>
                             </div>
                             
                             <div className="space-y-4 border-y border-dashed border-gray-300 py-10">
                                <p className="text-[12px] font-black text-purple-400 uppercase italic mb-2 tracking-widest">• 상세 공제 항목</p>
                                {tierDetails.t1 > 0 && <div className="flex justify-between text-lg text-gray-500"><span>1구간 이용료 (13%)</span><span>₩{tierDetails.t1.toLocaleString()}</span></div>}
                                {tierDetails.t2 > 0 && <div className="flex justify-between text-lg text-gray-500"><span>2구간 이용료 (7%)</span><span>₩{tierDetails.t2.toLocaleString()}</span></div>}
                                {tierDetails.t3 > 0 && <div className="flex justify-between text-lg text-gray-500"><span>3구간 이용료 (2%)</span><span>₩{tierDetails.t3.toLocaleString()}</span></div>}
                                <div className="flex justify-between items-center text-lg pt-4"><span>전자결제 대행 수수료 (3.3%)</span><span>₩{pgFee.toLocaleString()}</span></div>
                                <div className="flex justify-between items-center text-lg"><span>수수료 부가세 (10%)</span><span>₩{vatOnFee.toLocaleString()}</span></div>
                             </div>

                             <div className="flex justify-between items-center">
                                <span className="text-lg font-black text-rose-500 uppercase tracking-widest">총 수수료 공제 합계</span>
                                <span className="text-3xl font-black text-rose-500 tracking-tighter">- ₩{totalDeduction.toLocaleString()}</span>
                             </div>
                             
                             <div className="pt-10 border-t-8 border-double border-gray-100 flex justify-between items-center bg-blue-50/40 -mx-12 px-12 py-12 rounded-b-[56px]">
                                <span className="text-blue-600 font-black text-2xl whitespace-nowrap">최종 정산 순수익</span>
                                <span className="text-5xl font-black text-blue-600 tracking-tight whitespace-nowrap">₩{netProfit.toLocaleString()}</span>
                             </div>
                           </>
                         );
                       })()}
                    </div>
                 </div>
                 <p className="text-[12px] text-gray-300 font-black text-center italic tracking-widest uppercase">데이터 확정 일시: {showReceiptOrder.confirmedAt || showReceiptOrder.orderTime}</p>
              </div>
              <button onClick={() => setShowReceiptOrder(null)} className="w-full py-8 bg-gray-900 text-white rounded-[32px] font-black text-2xl hover:bg-orange-600 transition-all shadow-xl mt-12 italic uppercase tracking-widest">확인 완료</button>
           </div>
        </div>
      )}

      {/* 모달: 출금 신청 팝업 (버튼 활성화 조건 추가) */}
      {showApplyModal && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[56px] p-12 shadow-2xl border-8 border-blue-50 animate-in zoom-in-95">
              {withdrawalStep === 'ready' ? (
                <div className="space-y-10">
                   <div className="text-center space-y-3">
                      <h3 className="text-3xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">최종 출금 신청 확인</h3>
                      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest italic">TheBestSns Professional Settlement Center</p>
                   </div>
                   
                   <div className="bg-gray-50 p-8 rounded-[40px] space-y-6 shadow-inner">
                      <div className="flex justify-between items-center border-b border-gray-200/50 pb-4">
                        <span className="text-[13px] font-black text-gray-400 italic uppercase">총 확정 판매 금액</span>
                        <span className="text-xl font-black text-gray-500 italic">₩{stats.availablePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-[14px] font-black text-blue-500 italic uppercase">실제 통장 입금액 (순수익)</span>
                          <p className="text-[10px] text-gray-400 font-bold">* 모든 수수료 공제 완료</p>
                        </div>
                        <span className="text-5xl font-black text-blue-600 italic tracking-tighter">₩{stats.availableOrders.reduce((sum, o) => sum + calculateDetailedProfit(o.price).netProfit, 0).toLocaleString()}</span>
                      </div>
                   </div>

                   <div className={`p-8 rounded-[36px] border shadow-sm space-y-4 transition-all ${isBankInfoRegistered ? 'bg-blue-50/50 border-blue-100' : 'bg-red-50/50 border-red-100'}`}>
                      <p className={`text-[11px] font-black uppercase italic ${isBankInfoRegistered ? 'text-blue-400' : 'text-red-400'}`}>
                        {isBankInfoRegistered ? '입금 계좌 정보 (실시간 대기)' : '⚠️ 계좌 정보가 없습니다'}
                      </p>
                      {isBankInfoRegistered ? (
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm border border-blue-50">🏦</div>
                           <div>
                             <p className="font-black text-gray-900 text-xl italic tracking-tight">{user.sellerApplication?.bankInfo?.bankName}</p>
                             <p className="text-2xl font-black text-gray-800 tracking-tighter">{user.sellerApplication?.bankInfo?.accountNo}</p>
                           </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                           <p className="text-sm font-bold text-red-600 leading-relaxed italic">
                             수수료 정산 및 입금을 위해 계좌 정보 등록이 필수입니다.<br/>
                             [계정 및 정보 관리 &gt; 전문가 정보] 탭에서 등록해 주세요.
                           </p>
                           <button onClick={() => { setShowApplyModal(false); navigate('/mypage', { state: { activeTab: 'settings' } }); }} className="text-xs font-black text-red-500 underline underline-offset-4">계좌 등록하러 가기 →</button>
                        </div>
                      )}
                   </div>

                   <div className="flex gap-4">
                      <button onClick={() => setShowApplyModal(false)} className="flex-1 py-7 bg-gray-100 text-gray-400 rounded-[32px] font-black text-xl hover:bg-gray-200 transition-all italic uppercase">취소</button>
                      <button 
                        onClick={handleApplyWithdrawal} 
                        disabled={!isBankInfoRegistered}
                        className={`flex-[2] py-7 rounded-[32px] font-black text-xl shadow-2xl transition-all italic uppercase active:scale-95 ${isBankInfoRegistered ? 'bg-blue-600 text-white hover:bg-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                      >
                        {isBankInfoRegistered ? '정산 신청 완료 🚀' : '계좌 정보 필요'}
                      </button>
                   </div>
                </div>
              ) : (
                <div className="text-center space-y-12 py-10 animate-in slide-in-from-bottom-8 duration-700">
                   <div className="w-32 h-32 bg-blue-50 text-blue-600 rounded-[48px] flex items-center justify-center text-7xl mx-auto shadow-inner transform -rotate-12">✨</div>
                   <div className="space-y-4"><h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">신청 완료!</h3><p className="text-[17px] font-bold text-gray-500 leading-relaxed italic">수익금 정산 요청이 정상 전송되었습니다.<br/><span className="text-blue-600 font-black">오늘 오후 6시 이전 </span> 신청 건은 익일 오전 중 지급됩니다.</p></div>
                   <button onClick={() => { setShowApplyModal(false); setWithdrawalStep('ready'); setWithdrawalFilter('지급 예정'); }} className="w-full py-8 bg-gray-900 text-white rounded-[32px] font-black text-2xl shadow-xl hover:bg-blue-600 transition-all uppercase italic">확인했습니다</button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default ProfitManagement;
