
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SNS_PLATFORMS } from '../constants';
import { SelectedOption, SMMProduct, SMMProvider, UserProfile, SMMOrder, Notice, SMMSource } from '@/types';
import { updateProfile } from '../profileDb';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Props {
  smmProducts: SMMProduct[];
  providers: SMMProvider[];
  user: UserProfile;
  notices: Notice[];
  onOrderComplete: (order: SMMOrder) => void;
  onLogout: () => void;
}

const SNSActivation: React.FC<Props> = ({ smmProducts, providers, user, notices, onOrderComplete, onLogout }) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useConfirm();
  const [selectedPlatform, setSelectedPlatform] = useState('인스타그램');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // App.tsx에서 전달받은 user.points를 사용 (전역 동기화)
  const userPoints = user.points || 0;

  const [mainIdx, setMainIdx] = useState(0);
  const mainSequence = ["대한민국", "SMM 대표 마케팅", "대행사 12,000곳이", "사용하는", "마케팅 원천 사이트", "더베스트SNS"];

  useEffect(() => {
    const mainInterval = setInterval(() => setMainIdx(prev => (prev + 1) % mainSequence.length), 1200);
    return () => clearInterval(mainInterval);
  }, [mainSequence.length]);

  const isGuest = !user.id;
  const activeProviderIds = useMemo(() => new Set(providers.filter(p => !p.isHidden).map(p => p.id)), [providers]);

  // 선택한 플랫폼에 해당하는 상품들 중에서 카테고리 목록 추출 (어드민에서 입력한 카테고리 분류)
  const categoriesForPlatform = useMemo(() => {
    const set = new Set<string>();
    (smmProducts || []).forEach(p => {
      if (p.platform !== selectedPlatform || p.isHidden) return;
      const hasActiveSource = (p.sources || []).some(s => activeProviderIds.has(s.providerId));
      if (!hasActiveSource) return;
      const cat = (p.category || '').trim();
      set.add(cat || '기타');
    });
    const list = Array.from(set).filter(Boolean).sort((a, b) => (a === '기타' ? 1 : 0) - (b === '기타' ? 1 : 0));
    return list.length ? list : [];
  }, [selectedPlatform, smmProducts, activeProviderIds]);

  // 플랫폼 변경 시 카테고리·상품 초기화: 해당 플랫폼의 첫 번째 카테고리 선택
  useEffect(() => {
    if (categoriesForPlatform.length > 0) {
      setSelectedCategory(categoriesForPlatform[0]);
    } else {
      setSelectedCategory('');
    }
    setSelectedProductId('');
  }, [selectedPlatform, categoriesForPlatform]);

  const filteredProducts = useMemo(() => 
    (smmProducts || []).filter(p => {
      const isVisible = !p.isHidden;
      const hasActiveSource = (p.sources || []).some(s => activeProviderIds.has(s.providerId));
      const platformMatch = p.platform === selectedPlatform && isVisible && hasActiveSource;
      if (!platformMatch) return false;
      if (categoriesForPlatform.length === 0) return true;
      const cat = (p.category || '').trim() || '기타';
      return selectedCategory === '' || cat === selectedCategory;
    }),
  [selectedPlatform, selectedCategory, smmProducts, activeProviderIds, categoriesForPlatform]);

  const selectedProduct = useMemo(() => (smmProducts || []).find(p => p.id === selectedProductId), [selectedProductId, smmProducts]);

  const handleAddOption = () => {
    if (isGuest) {
      showConfirm({
        title: '로그인 필요',
        description: '로그인 후 이용 가능합니다. 로그인 페이지로 이동할까요?',
        confirmLabel: '이동',
        cancelLabel: '취소',
        danger: false,
        onConfirm: () => navigate('/login'),
      });
      return;
    }
    if (!selectedProductId || !link || quantity <= 0) return void showAlert({ description: '정보를 모두 입력하세요.' });
    if (!selectedProduct) return;
    const minQ = selectedProduct.minQuantity ?? 0;
    const maxQ = selectedProduct.maxQuantity ?? 999999999;
    if (quantity < minQ) return void showAlert({ description: `최소 주문량 ${minQ.toLocaleString()}개 이상 가능합니다.` });
    if (quantity > maxQ) return void showAlert({ description: `최대 주문량 ${maxQ.toLocaleString()}개 이하로 입력해주세요.` });

    const newOption: SelectedOption = {
      id: Date.now().toString(),
      serviceId: selectedProduct.id,
      serviceName: selectedProduct.name,
      link: link,
      unitPrice: selectedProduct.sellingPrice || 0,
      quantity: quantity,
      totalPrice: Math.floor(quantity * (selectedProduct.sellingPrice || 0)),
    };
    setSelectedOptions([...selectedOptions, newOption]);
    setLink('');
    setQuantity(0);
  };

  const totalOrderAmount = selectedOptions.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const handleOrder = async () => {
    if (isGuest) return navigate('/login');
    if (selectedOptions.length === 0) return void showAlert({ description: '주문할 항목이 없습니다.' });
    if (totalOrderAmount > userPoints) return void showAlert({ description: '보유 포인트가 부족합니다.' });
    
    showConfirm({
      title: '주문 확인',
      description: `총 ${(totalOrderAmount ?? 0).toLocaleString()}P를 결제하고 주문을 접수할까요?`,
      confirmLabel: '결제하기',
      cancelLabel: '취소',
      danger: false,
      onConfirm: () => doOrder(),
    });
  };

  const doOrder = async () => {
    setIsProcessing(true);
    try {
      // 소스별 최소/최대 수량 검증: 실제 주문 시 선택될 소스(bestSource) 기준으로 허용 범위 확인
      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product || !product.sources?.length) continue;
        const validActiveSources = product.sources.filter(s => activeProviderIds.has(s.providerId));
        if (validActiveSources.length === 0) continue;
        const bestSource = [...validActiveSources].sort((a, b) => {
          const costA = a.costPrice ?? 0;
          const costB = b.costPrice ?? 0;
          if (costA !== costB) return costA - costB;
          const timeA = a.estimatedMinutes ?? 999999;
          const timeB = b.estimatedMinutes ?? 999999;
          return timeA - timeB;
        })[0];
        const minQ = bestSource.minQuantity ?? product.minQuantity ?? 0;
        const maxQ = bestSource.maxQuantity ?? product.maxQuantity ?? 999999999;
        if (opt.quantity < minQ || opt.quantity > maxQ) {
          showAlert({ description: `"${product.name}" 주문 수량이 선택된 소스 기준 허용 범위(최소 ${minQ.toLocaleString()}~최대 ${maxQ.toLocaleString()}개)를 벗어났습니다.` });
          setIsProcessing(false);
          return;
        }
      }

      // 포인트 차감 처리 (전역 업데이트 요청)
      const nextPoints = userPoints - totalOrderAmount;
      window.dispatchEvent(new CustomEvent('site-user-update', {
        detail: { ...user, points: nextPoints },
      }));
      updateProfile(user.id, { points: nextPoints }).catch((e) => console.warn('SNS 주문 포인트 차감 DB 반영 실패:', e));

      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product || !product.sources?.length) continue;
        
        const validActiveSources = product.sources.filter(s => activeProviderIds.has(s.providerId));
        if (validActiveSources.length === 0) continue;
        const bestSource = [...validActiveSources].sort((a, b) => {
          const costA = a.costPrice ?? 0;
          const costB = b.costPrice ?? 0;
          if (costA !== costB) return costA - costB;
          const timeA = a.estimatedMinutes ?? 999999;
          const timeB = b.estimatedMinutes ?? 999999;
          return timeA - timeB;
        })[0];
        const provider = providers.find(p => p.id === bestSource.providerId);
        if (!provider) continue;

        const order: SMMOrder = {
          id: `ORD${Date.now()}${Math.floor(Math.random()*100)}`,
          userId: user.id,
          userNickname: user.nickname,
          orderTime: new Date().toLocaleString(),
          platform: product.platform,
          productName: product.name,
          link: opt.link,
          quantity: opt.quantity,
          initialCount: 0,
          remains: opt.quantity,
          providerName: provider.name,
          costPrice: bestSource.costPrice || 0,
          sellingPrice: product.sellingPrice || 0,
          profit: Math.floor(opt.totalPrice - ((bestSource.costPrice || 0) * opt.quantity)),
          status: '준비중',
          externalOrderId: 'PENDING'
        };
        onOrderComplete(order);
      }
      
      window.dispatchEvent(new CustomEvent('user-new-order', { detail: { amount: totalOrderAmount } }));
      showAlert({ description: '성공적으로 주문되었습니다! 마이페이지에서 현황을 확인하세요.' });
      setSelectedOptions([]);
      navigate('/mypage');
    } catch (err) {
      showAlert({ description: '주문 처리 중 오류 발생' });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkLink = () => {
    if (!link.trim()) return void showAlert({ description: '게시물 링크를 입력해주세요.' });
    window.open(link.startsWith('http') ? link : `https://${link}`, '_blank');
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-10 pb-32 px-4 md:px-8">
      <div className="relative overflow-hidden bg-[#050505] rounded-[56px] shadow-2xl min-h-[400px] flex flex-col justify-center items-center border-4 border-white/10 group">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent top-[15%] animate-saber-run shadow-[0_0_30px_#00f2ff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#ff0095] to-transparent top-[45%] animate-saber-run-delay-1 shadow-[0_0_30px_#ff0095,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#004cff] to-transparent top-[80%] animate-saber-run-delay-2 shadow-[0_0_30px_#004cff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#bc00ff] to-transparent top-[30%] animate-saber-run-delay-3 shadow-[0_0_30px_#bc00ff,0_0_10px_#fff]"></div>
        </div>
        
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20">
           <div className="px-10 py-3 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-3">
             <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_#ef4444]"></div>
             <span className="text-[14px] font-black italic tracking-[0.3em] uppercase text-white leading-none">24HR REAL-TIME SYSTEM</span>
           </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center text-center px-6 h-44 justify-center">
           <h1 key={`main-${mainIdx}`} className="text-5xl sm:text-7xl md:text-[100px] font-black text-white italic tracking-tighter animate-punch-in leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
             {mainSequence[mainIdx]}
           </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white rounded-[56px] shadow-sm border border-gray-100 p-10 md:p-14 space-y-14">
            <div>
              <h2 className="text-xl font-black flex items-center gap-4 mb-10 text-gray-900 italic uppercase"><span className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm shadow-xl font-black italic">01</span>플랫폼 선택</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
                {SNS_PLATFORMS.map((p) => (
                  <button key={p.id} onClick={() => { setSelectedPlatform(p.name); setSelectedProductId(''); setSelectedCategory(''); }} className="flex flex-col items-center gap-4 group">
                    <div className={`w-20 h-20 rounded-[36px] flex items-center justify-center transition-all border-4 relative ${selectedPlatform === p.name ? 'border-blue-600 bg-blue-50 shadow-2xl scale-110' : 'border-transparent bg-gray-50'}`}>
                      <img
                        src={p.icon}
                        alt={p.name}
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          const fallback = el.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden absolute inset-0 flex items-center justify-center text-2xl font-black text-gray-400 pointer-events-none" aria-hidden>{p.name[0]}</span>
                    </div>
                    <span className={`text-[13px] font-black italic ${selectedPlatform === p.name ? 'text-blue-600' : 'text-gray-400'}`}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {categoriesForPlatform.length > 0 && (
              <div>
                <h3 className="text-[13px] font-black text-gray-400 uppercase italic px-4 mb-4">카테고리</h3>
                <div className="flex flex-wrap gap-2">
                  {categoriesForPlatform.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setSelectedProductId(''); }}
                      className={`px-6 py-3 rounded-[20px] font-black text-[13px] italic transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-12 pt-12 border-t border-gray-50">
              <div className="space-y-4"><h3 className="text-[13px] font-black text-gray-400 uppercase italic px-4">상품 선택</h3><select className="w-full p-6 bg-gray-50 border-none rounded-[32px] outline-none font-black text-gray-700 shadow-inner focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all cursor-pointer" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}><option value="">서비스를 선택하세요</option>{filteredProducts.map(p => (<option key={p.id} value={p.id}>{p.name} ({(p.sellingPrice ?? 0).toLocaleString()}P)</option>))}</select></div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-4"><h3 className="text-[13px] font-black text-gray-400 uppercase italic px-4">작업 링크</h3><div className="relative"><input type="text" placeholder="https://..." className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" value={link} onChange={(e) => setLink(e.target.value)} /><button onClick={checkLink} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black text-white px-6 py-3 rounded-[20px] font-black text-[11px] hover:bg-blue-600 transition-all">확인 ↗</button></div></div>
                <div className="md:col-span-4 space-y-4"><h3 className="text-[13px] font-black text-gray-400 uppercase italic px-4 truncate">수량</h3><input type="number" placeholder={selectedProduct ? `${(selectedProduct.minQuantity ?? 0).toLocaleString()} ~ ${selectedProduct.maxQuantity != null ? selectedProduct.maxQuantity.toLocaleString() : '제한없음'} (상품 기준)` : '0'} min={selectedProduct?.minQuantity} max={selectedProduct?.maxQuantity ?? undefined} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} /></div>
              </div>
              <button onClick={handleAddOption} className="w-full py-8 bg-blue-600 text-white rounded-[32px] font-black text-2xl hover:bg-black shadow-2xl transition-all italic uppercase tracking-widest active:scale-[0.98]">+ 장바구니 담기</button>
            </div>
          </div>
          <div className="bg-[#f2f8ff] border-2 border-[#d0e5ff] rounded-[64px] p-10 md:p-14 space-y-10 shadow-sm">
            <h3 className="text-xl font-black text-blue-900 italic uppercase flex items-center gap-3"><span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 주문 장바구니</h3>
            <div className="space-y-4">
              {selectedOptions.length === 0 ? (<div className="py-24 text-center text-blue-200 font-black italic border-2 border-dashed border-blue-100 rounded-[40px]">장바구니가 비어 있습니다.</div>) : selectedOptions.map((opt, idx) => (
                <div key={opt.id} className="bg-white rounded-[36px] p-8 flex justify-between items-center shadow-sm border border-blue-50 group hover:border-blue-300 transition-all animate-in slide-in-from-left-4">
                  <div className="flex-1 min-w-0"><span className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">{idx + 1}. Package</span><h4 className="font-black text-gray-900 text-xl truncate mb-1">{opt.serviceName}</h4><p className="text-[11px] font-bold text-gray-400 truncate italic">{opt.link}</p></div>
                  <div className="text-right flex items-center gap-10 pl-6"><div className="space-y-1"><p className="text-[11px] font-black text-gray-300 uppercase italic">{(opt.unitPrice ?? 0).toLocaleString()}P × {(opt.quantity ?? 0).toLocaleString()}</p><p className="text-2xl font-black text-blue-600 italic tracking-tighter">{(opt.totalPrice ?? 0).toLocaleString()}P</p></div><button onClick={() => setSelectedOptions(selectedOptions.filter(o=>o.id!==opt.id))} className="text-red-200 hover:text-red-500 transition-colors font-black text-2xl">✕</button></div>
                </div>
              ))}
            </div>
            {selectedOptions.length > 0 && (
              <div className="pt-10 space-y-8">
                <div className="bg-white/50 backdrop-blur-md rounded-[48px] p-12 flex justify-between items-center border border-white/50 shadow-inner"><span className="text-blue-900 font-black text-xl italic tracking-widest">결제 예정 총 포인트</span><span className="text-5xl font-black text-blue-600 italic tracking-tighter">{(totalOrderAmount ?? 0).toLocaleString()}P</span></div>
                <button onClick={handleOrder} disabled={isProcessing} className={`w-full py-10 rounded-[48px] font-black text-3xl shadow-2xl transition-all uppercase italic tracking-widest flex items-center justify-center gap-4 ${isProcessing ? 'bg-gray-400' : 'bg-black text-white hover:bg-blue-600'}`}>{isProcessing ? '🚀 작업 요청 중...' : '🚀 주문하기'}</button>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8 sticky top-24 h-fit">
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-6">
            <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[12px] tracking-widest px-1">
              <span className="w-1 h-3.5 bg-blue-600 rounded-full"></span> My Wallet
            </h3>
            <div className="bg-[#111827] rounded-[24px] p-6 text-white relative overflow-hidden shadow-xl">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
               <div className="relative z-10 space-y-4">
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-blue-400 uppercase italic tracking-widest">Available Points</p>
                   <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded font-bold text-white/40 uppercase">Real-time sync</span>
                 </div>
                 <h4 className="text-3xl font-black italic tracking-tighter leading-none">
                   {(userPoints ?? 0).toLocaleString()} <span className="text-sm text-gray-500 not-italic uppercase ml-0.5 font-bold">P</span>
                 </h4>
                 <button 
                   onClick={() => isGuest ? navigate('/login') : navigate('/payment/point')} 
                   className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-[13px] font-black shadow-lg hover:bg-white hover:text-blue-600 transition-all uppercase italic tracking-wider"
                 >
                   포인트 충전하기
                 </button>
               </div>
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[12px] tracking-widest">
                 <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span> 공지사항
              </h3>
              <button onClick={() => navigate('/notices')} className="text-[10px] font-black text-gray-400 hover:text-blue-600 transition-all uppercase italic">전체보기 +</button>
            </div>
            <div className="space-y-3.5">
               {notices.filter(n => !n.isHidden).slice(0, 3).map(n => (
                 <div key={n.id} onClick={() => navigate('/notices')} className="p-4 bg-gray-50/50 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-100 group">
                    <p className="text-[13.5px] font-black text-gray-800 truncate mb-0.5 group-hover:text-blue-600">{n.title}</p>
                    <span className="text-[10px] font-bold text-gray-300 uppercase italic">{n.date}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SNSActivation;
