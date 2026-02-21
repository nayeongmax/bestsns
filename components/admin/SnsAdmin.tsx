import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SMMProvider, SMMProduct, SMMSource, SMMOrder } from '@/types';
import { SNS_PLATFORMS } from '../../constants.tsx';

interface Props {
  smmProviders: SMMProvider[];
  setSmmProviders: React.Dispatch<React.SetStateAction<SMMProvider[]>>;
  smmProducts: SMMProduct[];
  setSmmProducts: React.Dispatch<React.SetStateAction<SMMProduct[]>>;
  smmOrders: SMMOrder[];
}

type SnsTab = 'provider' | 'manage' | 'list' | 'order';
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const SnsAdmin: React.FC<Props> = ({ smmProviders, setSmmProviders, smmProducts, setSmmProducts, smmOrders }) => {
  const [activeTab, setActiveTab] = useState<SnsTab>('list');
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>(localStorage.getItem('smm_last_sync_full') || '미실행');

  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({ id: '', name: '', apiUrl: '' });

  const initialProductState: SMMProduct = {
    id: '', name: '', platform: '인스타그램', category: '', sellingPrice: 0, minQuantity: 10, maxQuantity: 100000, sources: []
  };
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<SMMProduct>(initialProductState);
  
  const [tempSource, setTempSource] = useState<SMMSource>({ providerId: '', serviceId: '', costPrice: 0, estimatedMinutes: undefined });
  const [editingSourceIdx, setEditingSourceIdx] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('전체 플랫폼');
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('전체 상태');
  const [orderMonthFilter, setOrderMonthFilter] = useState('전체 기간');

  const activeProviderIds = useMemo(() => 
    new Set(smmProviders.filter(p => !p.isHidden).map(p => p.id)), 
  [smmProviders]);

  // --- Netlify Functions 원가 동기화 (JS 버전) ---
  const handleBatchSync = useCallback(async (isAuto = false) => {
    if (syncStatus === 'syncing' || smmProviders.length === 0) return;
    
    setSyncStatus('syncing');
    try {
      // PHP 주소 대신 Netlify Function 주소 사용
      const response = await fetch('/.netlify/functions/smm-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: smmProviders })
      });
      const result = await response.json();

      if (result.status === 'success') {
        const latestRates = result.data;
        setSmmProducts(prevProducts => prevProducts.map(prod => ({
          ...prod,
          sources: (prod.sources || []).map(src => {
            const newPrice = latestRates[src.providerId]?.[src.serviceId];
            return newPrice ? { ...src, costPrice: newPrice } : src;
          })
        })));
        const now = new Date();
        const timeStr = now.toLocaleString();
        setLastSyncTime(timeStr);
        localStorage.setItem('smm_last_sync_full', timeStr);
        setSyncStatus('success');
        if(!isAuto) alert('모든 연결 소스의 원가 동기화가 완료되었습니다.');
      }
    } catch (err) {
      setSyncStatus('error');
      console.error("동기화 실패:", err);
      alert('동기화 처리 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  }, [smmProviders, syncStatus, setSmmProducts]);

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      if (now.getMinutes() === 0 && [8, 13, 18].includes(now.getHours())) {
        handleBatchSync(true);
      }
    };
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [handleBatchSync]);

  const fetchSinglePrice = async () => {
    if (!tempSource.providerId || !tempSource.serviceId) return alert('공급처와 서비스 ID를 입력하세요.');
    const provider = smmProviders.find(p => p.id === tempSource.providerId);
    if (!provider) return;

    setIsFetchingSingle(true);
    try {
      // PHP 주소 대신 Netlify Function 주소 사용 (GET 방식)
      const response = await fetch(`/.netlify/functions/smm-api?providerId=${provider.id}&serviceId=${tempSource.serviceId}&apiUrl=${encodeURIComponent(provider.apiUrl)}`);
      const result = await response.json();
      if (result.status === 'success') {
        setTempSource(prev => ({ ...prev, costPrice: result.price }));
      } else {
        throw new Error(result.message || "API Error");
      }
    } catch (error) {
      console.error("조회 실패:", error);
      alert('공급처 API에 접근할 수 없습니다. Netlify 환경 변수 설정을 확인하세요.');
    } finally {
      setIsFetchingSingle(false);
    }
  };

  const handleSaveProvider = () => {
    if(!providerForm.id || !providerForm.name || !providerForm.apiUrl) return alert('모든 정보를 입력하세요.');
    if (editingProviderId) {
      setSmmProviders(prev => prev.map(p => p.id === editingProviderId ? { ...p, ...providerForm } : p));
      setEditingProviderId(null);
    } else {
      if (smmProviders.some(p => p.id === providerForm.id)) return alert('이미 존재하는 공급처 ID입니다.');
      setSmmProviders(prev => [...prev, { ...providerForm, isHidden: false }]);
    }
    setProviderForm({ id: '', name: '', apiUrl: '' });
  };

  const startEditProvider = (p: SMMProvider) => {
    setProviderForm({ id: p.id, name: p.name, apiUrl: p.apiUrl });
    setEditingProviderId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProvider = (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setSmmProviders(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleSaveProduct = () => {
    if (!productForm.name || (productForm.sources || []).length === 0) return alert('상품명과 최소 하나 이상의 소스 연결이 필요합니다.');
    setSmmProducts(prev => {
      const sameKey = (i: SMMProduct) =>
        i.platform === productForm.platform &&
        i.name === productForm.name &&
        (i.category || '') === (productForm.category || '');
      const toMerge = prev.filter(sameKey);
      const mergedSources: SMMSource[] = [];
      const seen = new Set<string>();
      [...toMerge.flatMap(i => i.sources || []), ...(productForm.sources || [])].forEach(src => {
        const key = `${src.providerId}:${src.serviceId}`;
        if (seen.has(key)) return;
        seen.add(key);
        mergedSources.push(src);
      });
      const filtered = prev.filter(i => !sameKey(i));
      const finalProduct = { ...productForm, id: editingProductId || toMerge[0]?.id || `prod_${Date.now()}`, sources: mergedSources };
      return [...filtered, finalProduct];
    });
    setProductForm(initialProductState);
    setEditingProductId(null);
    setActiveTab('list');
    alert('마스터 상품 통합 데이터 저장이 완료되었습니다. 기존 소스가 모두 유지되었습니다.');
  };

  const handleAddOrUpdateSource = () => {
    if (!tempSource.providerId || !tempSource.serviceId) return alert('공급처와 서비스 ID를 입력하세요.');
    if (editingSourceIdx !== null) {
      const updated = [...productForm.sources];
      updated[editingSourceIdx] = { ...tempSource };
      setProductForm({ ...productForm, sources: updated });
      setEditingSourceIdx(null);
    } else {
      setProductForm({ ...productForm, sources: [...productForm.sources, { ...tempSource }] });
    }
    setTempSource({ providerId: '', serviceId: '', costPrice: 0, estimatedMinutes: undefined });
  };

  const startEditProduct = (p: SMMProduct) => {
    setEditingProductId(p.id);
    setProductForm({ ...p, sources: [...(p.sources || [])] });
    setActiveTab('manage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpand = (id: string) => {
    setExpandedProductIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    smmOrders.forEach(o => {
      if (o.orderTime) {
        const month = o.orderTime.substring(0, 7);
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [smmOrders]);

  const filteredOrders = useMemo(() => {
    return smmOrders.filter(o => {
      const q = orderSearch.toLowerCase();
      const matchSearch = 
        o.id.toLowerCase().includes(q) || 
        o.userId.toLowerCase().includes(q) || 
        o.userNickname.toLowerCase().includes(q) || 
        o.productName.toLowerCase().includes(q);
      const matchPlatform = filterPlatform === '전체 플랫폼' || o.platform === filterPlatform;
      const matchStatus = orderStatusFilter === '전체 상태' || o.status === orderStatusFilter;
      const matchMonth = orderMonthFilter === '전체 기간' || (o.orderTime && o.orderTime.startsWith(orderMonthFilter));
      
      return matchSearch && matchPlatform && matchStatus && matchMonth;
    });
  }, [smmOrders, orderSearch, filterPlatform, orderStatusFilter, orderMonthFilter]);

  const orderStats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.sellingPrice * o.quantity), 0);
    const totalProfit = filteredOrders.reduce((sum, o) => sum + o.profit, 0);
    return { count: filteredOrders.length, revenue: totalRevenue, profit: totalProfit };
  }, [filteredOrders]);

  const groupedInventory = useMemo(() => {
    const map = new Map<string, SMMProduct>();
    smmProducts.filter(p => {
      const matchSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchPlatform = filterPlatform === '전체 플랫폼' || p.platform === filterPlatform;
      return matchSearch && matchPlatform;
    }).forEach(p => {
      const key = `${p.platform}_${p.name}_${p.category || ''}`;
      if (!map.has(key)) map.set(key, JSON.parse(JSON.stringify(p)));
      else {
        const existing = map.get(key)!;
        (p.sources || []).forEach(newSrc => {
          if (!existing.sources.find(s => s.providerId === newSrc.providerId && s.serviceId === newSrc.serviceId)) existing.sources.push(newSrc);
        });
      }
    });
    return Array.from(map.values());
  }, [smmProducts, searchQuery, filterPlatform]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white border-2 border-blue-50 p-8 rounded-[48px] shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-all">
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest italic mb-2">Total Orders ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-gray-900 italic tracking-tighter">{orderStats.count.toLocaleString()}</span>
               <span className="text-lg font-bold text-gray-300">건</span>
            </div>
         </div>
         <div className="bg-white border-2 border-blue-50 p-8 rounded-[48px] shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-all">
            <span className="text-[11px] font-black text-green-500 uppercase tracking-widest italic mb-2">Total Revenue ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black text-gray-900 italic tracking-tighter">{orderStats.revenue.toLocaleString()}</span>
               <span className="text-lg font-bold text-gray-300">P</span>
            </div>
         </div>
         <div className="bg-gray-900 p-8 rounded-[48px] shadow-2xl flex flex-col justify-between text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
            <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest italic mb-2 relative z-10">Real-time Net Profit ({orderMonthFilter})</span>
            <div className="flex items-baseline gap-2 relative z-10">
               <span className="text-4xl font-black text-blue-400 italic tracking-tighter">{orderStats.profit.toLocaleString()}</span>
               <span className="text-lg font-bold text-blue-900">P</span>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px]"></div>
         </div>
      </div>

      <div className="bg-gray-900 p-2.5 rounded-[40px] flex gap-2 shadow-2xl">
        {[
          { id: 'provider', label: '📡 공급처 시스템 설정' },
          { id: 'manage', label: '🛠️ 마스터 상품 등록' },
          { id: 'list', label: '📋 통합 상품 인벤토리' },
          { id: 'order', label: '📈 주문 성과 분석' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { setActiveTab(tab.id as any); if(tab.id !== 'manage') setEditingProductId(null); }}
            className={`flex-1 py-5 rounded-[28px] font-black text-[15px] transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'provider' && (
        <div className="space-y-12 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-12 md:p-16 rounded-[60px] shadow-sm border border-gray-100 space-y-12">
             <h3 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8">공급처(Provider) 신규 시스템 등록</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">공급처 ID (Key매칭용)</label>
                 <input value={providerForm.id} onChange={e => setProviderForm({...providerForm, id: e.target.value})} placeholder="p1, p2 등" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" disabled={!!editingProviderId} />
              </div>
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">공급처 별칭</label>
                 <input value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} placeholder="예: JAP 메인서버" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" />
              </div>
              <div className="space-y-3">
                 <label className="text-[11px] font-black text-gray-400 px-4 uppercase italic">API URL</label>
                 <input value={providerForm.apiUrl} onChange={e => setProviderForm({...providerForm, apiUrl: e.target.value})} placeholder="https://api-endpoint.com" className="w-full p-6 bg-gray-50 rounded-[32px] font-black outline-none shadow-inner" />
              </div>
            </div>
            <button onClick={handleSaveProvider} className="w-full py-8 bg-gray-900 text-white rounded-[40px] font-black text-xl hover:bg-blue-600 transition-all uppercase italic">
              {editingProviderId ? '공급처 정보 업데이트' : '신규 공급처 시스템 등록하기'}
            </button>
          </div>
          <div className="space-y-6 px-4">
             <h4 className="text-xl font-black text-gray-900 italic uppercase">시스템 등록 공급처 목록 ({smmProviders.length})</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {smmProviders.map(p => (
                  <div key={p.id} className={`bg-white p-8 rounded-[40px] shadow-sm border-2 transition-all group ${p.isHidden ? 'grayscale opacity-50 bg-gray-50 border-gray-300' : 'border-gray-100 hover:border-blue-200'}`}>
                     <div className="flex justify-between items-start mb-6">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase italic ${p.isHidden ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>ID: {p.id}</span>
                        <div className="flex gap-2">
                           {!p.isHidden && <button onClick={() => startEditProvider(p)} className="text-gray-300 hover:text-blue-500 font-black text-sm">수정</button>}
                           <button onClick={() => handleDeleteProvider(p.id)} className="text-gray-300 hover:text-red-500 font-black text-sm">삭제</button>
                        </div>
                     </div>
                     <h5 className="text-2xl font-black text-gray-900 mb-2 italic">{p.name}</h5>
                     <p className="text-[11px] font-bold text-gray-400 truncate opacity-60 mb-6">{p.apiUrl}</p>
                     <button onClick={() => setSmmProviders(prev => prev.map(item => item.id === p.id ? { ...item, isHidden: !item.isHidden } : item))} className={`w-full py-3 rounded-2xl font-black text-[11px] transition-all italic uppercase ${p.isHidden ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-900 text-white'}`}>
                        {p.isHidden ? '⚠️ 시스템 중지됨 (재가동)' : '현재 정상 운영 중 (중지)'}
                     </button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-white p-12 md:p-20 rounded-[80px] shadow-sm border border-gray-100 space-y-20 animate-in zoom-in-95">
           <div className="flex justify-between items-center pb-10 border-b border-gray-100">
             <h3 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-[16px]">
               <span className="mr-4">💎</span>마스터 상품 통합 데이터 등록
             </h3>
             {editingProductId && <button onClick={() => { setEditingProductId(null); setProductForm(initialProductState); }} className="text-sm font-black text-gray-400 hover:text-red-500">취소</button>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
             <div className="lg:col-span-6 space-y-12">
                <div className="space-y-8">
                   <div className="space-y-3">
                     <label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">사용자 노출 상품명</label>
                     <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="예: 한국인 팔로워" className="w-full p-8 bg-gray-50 border-none rounded-[40px] font-black text-2xl shadow-inner outline-none focus:ring-4 focus:ring-blue-50" />
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">대상 플랫폼</label><select value={productForm.platform} onChange={e => setProductForm({...productForm, platform: e.target.value})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black text-lg shadow-inner outline-none">{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">카테고리 분류</label><input value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} placeholder="팔로워" className="w-full p-6 bg-gray-50 rounded-[32px] font-black text-lg shadow-inner outline-none" /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">최소 주문량 (Min)</label><input type="number" value={productForm.minQuantity} onChange={e => setProductForm({...productForm, minQuantity: Number(e.target.value)})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black shadow-inner outline-none text-right px-10" /></div>
                      <div className="space-y-3"><label className="text-[12px] font-black text-gray-400 px-6 uppercase italic">최대 주문량 (Max)</label><input type="number" value={productForm.maxQuantity} onChange={e => setProductForm({...productForm, maxQuantity: Number(e.target.value)})} className="w-full p-6 bg-gray-50 rounded-[32px] font-black shadow-inner outline-none text-right px-10" /></div>
                   </div>
                   <div className="bg-[#F0F7FF] p-10 rounded-[56px] border-2 border-blue-100 flex flex-col gap-6 shadow-sm overflow-hidden">
                      <label className="text-[12px] font-black text-blue-500 px-4 uppercase italic block tracking-widest leading-none">최종 판매 단가 (1개 기준 Point)</label>
                      <div className="flex items-center gap-6 w-full">
                         <input type="number" value={productForm.sellingPrice || ''} onChange={e => setProductForm({...productForm, sellingPrice: Number(e.target.value)})} className="flex-1 min-0 p-8 bg-white rounded-[32px] font-black text-4xl text-blue-600 shadow-sm text-right outline-none ring-4 ring-blue-50/50" />
                         <span className="text-3xl font-black text-blue-300 italic shrink-0">P</span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-6 space-y-10">
                <div className="bg-[#0f172a] p-12 rounded-[64px] shadow-2xl space-y-12 text-white relative overflow-hidden">
                   <div className="relative z-10">
                      <h4 className="text-xl font-black italic uppercase tracking-[0.2em] text-blue-400 mb-10 flex items-center gap-4">
                         <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_15px_#3b82f6]"></span>
                         공급처 소스 매핑 및 원가 통제 센터
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase px-2 italic tracking-widest">공급처 선택</label>
                            <select value={tempSource.providerId} onChange={e => setTempSource({...tempSource, providerId: e.target.value})} className="w-full p-5 bg-white/5 rounded-[24px] font-black text-white outline-none border border-white/10 text-[15px] focus:ring-2 focus:ring-blue-500/50">
                               <option value="" className="text-black">공급처 선택</option>
                               {smmProviders.map(p => <option key={p.id} value={p.id} className="text-black">{p.name}</option>)}
                            </select>
                         </div>
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase px-2 italic tracking-widest">공급처 서비스 ID</label>
                            <div className="grid grid-cols-[1.4fr_0.6fr] gap-2">
                               <input 
                                 value={tempSource.serviceId} 
                                 onChange={e => setTempSource({...tempSource, serviceId: e.target.value})} 
                                 placeholder="ID 입력" 
                                 className="w-full p-5 bg-white/5 rounded-[24px] font-black text-white outline-none border border-white/10 text-[15px] focus:border-blue-500/50" 
                               />
                               <button 
                                 onClick={fetchSinglePrice} 
                                 disabled={isFetchingSingle} 
                                 className="w-full bg-blue-600 rounded-[20px] text-[13px] font-black hover:bg-blue-500 transition-all shrink-0 shadow-lg active:scale-95 disabled:bg-gray-700"
                               >
                                 {isFetchingSingle ? '⏳' : '조회'}
                               </button>
                            </div>
                         </div>
                      </div>
                      <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
                         <div className="flex items-center gap-8 flex-wrap">
                            <div className="space-y-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">실시간 원가 정보</span>
                               <div className="flex items-baseline gap-3">
                                  <input type="number" value={tempSource.costPrice || 0} onChange={e => setTempSource({...tempSource, costPrice: Number(e.target.value)})} className="bg-transparent text-5xl font-black text-green-400 italic outline-none w-32 border-b border-white/10" />
                                  <span className="text-2xl font-black text-green-400/30 italic">P</span>
                               </div>
                            </div>
                            <div className="space-y-1">
                               <span className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">예상 소요(분, 선택)</span>
                               <input type="number" min={0} placeholder="분" value={tempSource.estimatedMinutes ?? ''} onChange={e => setTempSource({...tempSource, estimatedMinutes: e.target.value === '' ? undefined : Number(e.target.value)})} className="bg-transparent text-2xl font-black text-white italic outline-none w-20 border-b border-white/10" />
                            </div>
                         </div>
                         <button onClick={handleAddOrUpdateSource} className="w-full md:w-auto px-10 py-6 bg-white text-[#0f172a] rounded-[28px] font-black text-[15px] hover:bg-blue-400 transition-all uppercase italic shadow-2xl">
                            {editingSourceIdx !== null ? '소스 수정 완료' : '+ 리스트에 추가'}
                         </button>
                      </div>
                   </div>
                   <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none"></div>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 no-scrollbar border-t border-gray-50 pt-4">
                   <p className="text-[11px] font-black text-gray-400 uppercase italic px-4 mb-2">현재 연결된 다중 소스 목록 ({productForm.sources.length})</p>
                   {productForm.sources.map((s, idx) => (
                     <div key={`${s.providerId}_${s.serviceId}_${idx}`} className="flex items-center justify-between p-6 bg-gray-50 rounded-[32px] border border-gray-100 group transition-all hover:border-blue-200">
                        <div className="flex items-center gap-6">
                           <span className="bg-gray-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase italic tracking-tighter">{s.providerId}</span>
                           <div>
                              <p className="font-black text-gray-800 text-sm">Service ID: <span className="text-blue-600">#{s.serviceId}</span></p>
                              <p className="text-[11px] font-bold text-gray-400 italic">원가: {s.costPrice.toLocaleString()}P{s.estimatedMinutes != null ? ` · ${s.estimatedMinutes}분` : ''}</p>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setEditingSourceIdx(idx); setTempSource({...s}); }} className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black text-blue-500 shadow-sm border border-gray-100 hover:bg-blue-50">수정</button>
                           <button onClick={() => setProductForm({...productForm, sources: productForm.sources.filter((_, i) => i !== idx)})} className="bg-white px-3 py-1.5 rounded-lg text-[10px] font-black text-red-300 shadow-sm border border-gray-100 hover:text-red-500">✕</button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
          <button onClick={handleSaveProduct} className="w-full py-12 bg-gray-900 text-white rounded-[50px] font-black text-4xl shadow-2xl hover:bg-blue-600 transition-all italic tracking-[0.3em] uppercase">마스터 상품 통합 데이터 저장 완료 💾</button>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-10 animate-in fade-in max-w-[1600px] mx-auto">
           <div className="bg-white p-10 rounded-[56px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-10">
              <h3 className="text-3xl font-black text-gray-900 italic uppercase underline decoration-blue-500 underline-offset-8 px-6">통합 상품 인벤토리 리얼타임 대시보드</h3>
              <div className="flex gap-4 bg-gray-50 p-2 rounded-[32px] shadow-inner">
                 <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="p-4 bg-white border-none rounded-[24px] font-black text-sm shadow-sm outline-none cursor-pointer">
                    <option>전체 플랫폼</option>{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                 </select>
                 <div className="relative">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="상품명 검색..." className="pl-8 pr-16 py-4 bg-white border-none rounded-[24px] font-bold text-[15px] shadow-sm outline-none w-80" />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300">🔍</span>
                 </div>
              </div>
           </div>
           <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest italic">
                       <tr>
                          <th className="px-10 py-6">플랫폼</th>
                          <th className="px-10 py-6">노출 상품명 / 연결 ID</th>
                          <th className="px-10 py-6">카테고리</th>
                          <th className="px-10 py-6">주문수량(Min/Max)</th>
                          <th className="px-10 py-6 text-right">최종 판매가</th>
                          <th className="px-10 py-6 text-center">관리 / 소스</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {groupedInventory.length === 0 ? (
                         <tr><td colSpan={6} className="py-40 text-center text-gray-300 font-black italic">등록된 상품이 없습니다.</td></tr>
                       ) : groupedInventory.map(p => {
                         const allSourcesDisabled = p.sources.every(s => !activeProviderIds.has(s.providerId));
                         return (
                           <React.Fragment key={p.id}>
                             <tr className={`transition-all hover:bg-blue-50/30 ${expandedProductIds.includes(p.id) ? 'bg-blue-50/50' : ''} ${allSourcesDisabled ? 'grayscale opacity-40 bg-gray-50' : ''}`}>
                                <td className="px-10 py-8"><span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase italic tracking-tighter shadow-md ${allSourcesDisabled ? 'bg-gray-400 text-white' : 'bg-blue-600 text-white'}`}>{p.platform}</span></td>
                                <td className="px-10 py-8"><div className="flex items-center gap-3"><p className="font-black text-gray-900 text-xl italic tracking-tight">{p.name}</p>{allSourcesDisabled && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded font-black italic shadow-sm uppercase animate-pulse">공급중단</span>}</div><div className="flex flex-wrap gap-1 mt-2">{p.sources.map((s, si) => (<span key={si} className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${activeProviderIds.has(s.providerId) ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-red-50 text-red-500 border-red-100'}`}>#{s.serviceId}</span>))}</div></td>
                                <td className="px-10 py-8"><span className="text-sm font-black text-gray-500 uppercase italic tracking-widest">{p.category}</span></td>
                                <td className="px-10 py-8"><p className="text-[13px] font-black text-gray-600 italic">{p.minQuantity.toLocaleString()} ~ {p.maxQuantity.toLocaleString()}</p></td>
                                <td className="px-10 py-8 text-right"><p className="text-2xl font-black text-blue-600 italic tracking-tighter">{p.sellingPrice.toLocaleString()}<span className="text-sm not-italic opacity-40 ml-1">P</span></p></td>
                                <td className="px-10 py-8 text-center"><div className="flex justify-center gap-3"><button onClick={() => toggleExpand(p.id)} className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all shadow-sm ${expandedProductIds.includes(p.id) ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{expandedProductIds.includes(p.id) ? '상세 닫기 ▲' : `소스(${p.sources.length}) ▼`}</button><button onClick={() => startEditProduct(p)} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black hover:bg-black transition-all shadow-md italic">그룹수정</button><button onClick={() => { if(window.confirm('정말 삭제하시겠습니까?')) setSmmProducts(prev => prev.filter(i => !(i.platform === p.platform && i.name === p.name && (i.category || '') === (p.category || '')))); }} className="text-red-200 hover:text-red-500 font-black text-xl px-2">✕</button></div></td>
                             </tr>
                             {expandedProductIds.includes(p.id) && (
                               <tr className="bg-gray-50/50 animate-in slide-in-from-top-2 duration-300">
                                 <td colSpan={6} className="px-12 py-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                       {p.sources.map((src, sidx) => {
                                         const provider = smmProviders.find(sp => sp.id === src.providerId);
                                         const isProviderDisabled = provider?.isHidden;
                                         const margin = p.sellingPrice - src.costPrice;
                                         return (
                                           <div key={`${src.providerId}_${src.serviceId}_${sidx}`} className={`bg-white border rounded-[32px] p-8 shadow-sm flex flex-col gap-6 transition-all ${isProviderDisabled ? 'grayscale opacity-50 border-red-200 bg-red-50/20' : 'border-gray-100 hover:border-blue-200'}`}>
                                              <div className="flex justify-between items-start"><div><span className={`px-3 py-1 rounded-lg text-[9px] font-black italic uppercase tracking-widest ${isProviderDisabled ? 'bg-gray-400 text-white' : 'bg-gray-900 text-white'}`}>{src.providerId}</span><h5 className="font-black text-gray-900 text-lg mt-2 italic">{provider?.name || '공급처 미확인'}{isProviderDisabled && <span className="ml-2 text-red-500 text-[10px] font-black">(잠김)</span>}</h5></div><div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic mb-1">Service ID</p><p className={`text-2xl font-black ${isProviderDisabled ? 'text-gray-400' : 'text-blue-600'}`}>#{src.serviceId}</p></div></div>
                                              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-50"><div className="space-y-1"><p className="text-[10px] font-black text-gray-400 uppercase italic">원가</p><p className={`text-lg font-black italic ${isProviderDisabled ? 'text-gray-400' : 'text-green-500'}`}>{src.costPrice.toLocaleString()}P</p></div><div className="space-y-1 text-right"><p className="text-[10px] font-black text-gray-400 uppercase italic">마진</p><p className={`text-lg font-black italic ${isProviderDisabled ? 'text-gray-300' : (margin > 0 ? 'text-blue-500' : 'text-red-500')}`}>{margin.toLocaleString()}P</p></div></div>
                                           </div>
                                         );
                                       })}
                                    </div>
                                 </td>
                               </tr>
                             )}
                           </React.Fragment>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'order' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                 <div className="relative">
                    <input 
                       type="text" 
                       value={orderSearch}
                       onChange={e => setOrderSearch(e.target.value)}
                       placeholder="주문번호, 닉네임, 상품명..." 
                       className="w-full pl-10 pr-4 py-4 bg-gray-50 border-none rounded-full font-bold text-sm shadow-inner outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
                 </div>
                 
                 <select value={orderMonthFilter} onChange={e => setOrderMonthFilter(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 기간</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                 </select>

                 <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 플랫폼</option>{SNS_PLATFORMS.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                 </select>

                 <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)} className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer">
                    <option>전체 상태</option><option>준비중</option><option>진행중</option><option>작업완료</option>
                 </select>
              </div>
              <button onClick={() => { setOrderSearch(''); setFilterPlatform('전체 플랫폼'); setOrderStatusFilter('전체 상태'); setOrderMonthFilter('전체 기간'); }} className="px-6 py-4 bg-gray-100 text-gray-400 rounded-full font-black text-[11px] hover:bg-gray-200 transition-all uppercase italic shrink-0">Reset</button>
           </div>

           <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest italic">
                       <tr>
                          <th className="px-8 py-5">일시 / 주문ID</th>
                          <th className="px-8 py-5">플랫폼 / 구매자</th>
                          <th className="px-8 py-5">구매 상품 / 공급처</th>
                          <th className="px-8 py-5">작업 링크</th>
                          <th className="px-8 py-5 text-center">작업량 상세</th>
                          <th className="px-8 py-5 text-right">포인트 / 수익</th>
                          <th className="px-8 py-5 text-center">상태</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredOrders.length === 0 ? (
                         <tr><td colSpan={7} className="py-40 text-center text-gray-300 font-black italic text-lg">기록된 주문 데이터가 없습니다.</td></tr>
                       ) : filteredOrders.map(o => (
                         <tr key={o.id} className="hover:bg-blue-50/20 transition-all group">
                            <td className="px-8 py-6">
                               <p className="text-[12px] font-black text-gray-800">{o.orderTime}</p>
                               <p className="text-[10px] text-blue-500 font-bold mt-1">#{o.id}</p>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                     <img src={SNS_PLATFORMS.find(p => p.name === o.platform)?.icon} className="w-5 h-5 object-contain" alt="p" />
                                  </div>
                                  <div>
                                     <p className="text-[13px] font-black text-gray-900">{o.userNickname}</p>
                                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">@{o.userId}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <p className="text-[13px] font-black text-gray-900 truncate max-w-[180px]">{o.productName}</p>
                               <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase italic tracking-widest">{o.providerName} Server</p>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-2">
                                  <a href={o.link.startsWith('http') ? o.link : `https://${o.link}`} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-400 hover:text-blue-600 underline truncate max-w-[200px] italic">
                                     {o.link}
                                  </a>
                                  <button onClick={() => { navigator.clipboard.writeText(o.link); alert('링크가 복사되었습니다.'); }} className="p-1.5 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">📋</button>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <p className="text-[13px] font-black text-gray-900 italic">총 주문: {o.quantity.toLocaleString()}</p>
                               <p className="text-[9.5px] font-bold text-gray-400 mt-1.5 uppercase flex justify-center gap-2">
                                  <span>최초 {o.initialCount?.toLocaleString() || 0}</span>
                                  <span className="opacity-20">|</span>
                                  <span className="text-red-400">잔량 {o.remains?.toLocaleString() || 0}</span>
                               </p>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <p className="text-[15px] font-black text-gray-900 italic">{(o.sellingPrice * o.quantity).toLocaleString()}P</p>
                               <p className="text-[11px] font-black text-blue-500 mt-1">+{o.profit.toLocaleString()} Profit</p>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic shadow-sm transition-all ${
                                 o.status === '작업완료' ? 'bg-green-500 text-white' : 
                                 o.status === '진행중' ? 'bg-blue-600 text-white animate-pulse' : 
                                 'bg-gray-100 text-gray-400'
                               }`}>
                                 {o.status}
                               </span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SnsAdmin;
