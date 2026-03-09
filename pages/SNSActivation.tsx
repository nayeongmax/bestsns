
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SNS_PLATFORMS } from '../constants';
import { SelectedOption, SMMProduct, SMMProvider, UserProfile, SMMOrder, Notice, SMMSource } from '@/types';
import { updateProfile } from '../profileDb';
import { useConfirm } from '@/contexts/ConfirmContext';
import AdBanner from '@/components/AdBanner';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [comments, setComments] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // App.tsx에서 전달받은 user.points를 사용 (전역 동기화)
  const userPoints = user.points || 0;

  const [mainIdx, setMainIdx] = useState(0);
  const mainSequence = ["대한민국", "SMM 대표 마케팅", "대행사 12,000곳이", "사용하는", "마케팅 원천 사이트", "더베스트SNS"];

  useEffect(() => {
    const mainInterval = setInterval(() => setMainIdx(prev => (prev + 1) % mainSequence.length), 1200);
    return () => clearInterval(mainInterval);
  }, [mainSequence.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isCommentProduct = useMemo(() =>
    !!(selectedProduct && (selectedProduct.name.includes('댓글') || (selectedProduct.category || '').includes('댓글'))),
    [selectedProduct]
  );

  const isGuest = !user.id;
  const activeProviderIds = useMemo(() => new Set(providers.filter(p => !p.isHidden).map(p => p.id)), [providers]);

  // 선택한 플랫폼에 해당하는 상품들 중에서 카테고리 목록 추출 (어드민에서 입력한 카테고리 분류)
  const categoriesForPlatform = useMemo(() => {
    const set = new Set<string>();
    (smmProducts || []).forEach(p => {
      if (p.platform !== selectedPlatform || p.isHidden) return;
      const hasActiveSource = (p.sources || []).length === 0 || (p.sources || []).some(s => activeProviderIds.has(s.providerId));
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
    setComments('');
  }, [selectedPlatform, categoriesForPlatform]);

  const filteredProducts = useMemo(() => 
    (smmProducts || []).filter(p => {
      const isVisible = !p.isHidden;
      const hasActiveSource = (p.sources || []).length === 0 || (p.sources || []).some(s => activeProviderIds.has(s.providerId));
      const platformMatch = p.platform === selectedPlatform && isVisible && hasActiveSource;
      if (!platformMatch) return false;
      if (categoriesForPlatform.length === 0) return true;
      const cat = (p.category || '').trim() || '기타';
      return selectedCategory === '' || cat === selectedCategory;
    }),
  [selectedPlatform, selectedCategory, smmProducts, activeProviderIds, categoriesForPlatform]);

  const selectedProduct = useMemo(() => (smmProducts || []).find(p => p.id === selectedProductId), [selectedProductId, smmProducts]);

  // 공통 교집합 수량: 모든 활성 소스의 min 중 최대값 ~ max 중 최소값 (예: A 10~1000, B 20~10000, C 50~100000 → 50~1000)
  const effectiveQuantityRange = useMemo(() => {
    if (!selectedProduct) return { min: 0, max: 999999999 };
    const active = (selectedProduct.sources || []).filter(s => activeProviderIds.has(s.providerId));
    if (active.length === 0) return { min: selectedProduct.minQuantity ?? 0, max: selectedProduct.maxQuantity ?? 999999999 };
    const mins = active.map(s => s.minQuantity ?? selectedProduct.minQuantity ?? 0);
    const maxs = active.map(s => s.maxQuantity ?? selectedProduct.maxQuantity ?? 999999999);
    return { min: Math.max(...mins), max: Math.min(...maxs) };
  }, [selectedProduct, activeProviderIds]);

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
    const { min: minQ, max: maxQ } = effectiveQuantityRange;
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
      ...(isCommentProduct && comments.trim() ? { comments: comments.trim() } : {}),
    };
    setSelectedOptions([...selectedOptions, newOption]);
    setLink('');
    setQuantity(0);
    setComments('');
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
      // 주문 수량 검증: 공통 교집합(모든 소스 교집합) 기준
      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product) continue;
        const active = (product.sources || []).filter(s => activeProviderIds.has(s.providerId));
        const minQ = active.length === 0 ? (product.minQuantity ?? 0) : Math.max(...active.map(s => s.minQuantity ?? product.minQuantity ?? 0));
        const maxQ = active.length === 0 ? (product.maxQuantity ?? 999999999) : Math.min(...active.map(s => s.maxQuantity ?? product.maxQuantity ?? 999999999));
        if (opt.quantity < minQ || opt.quantity > maxQ) {
          showAlert({ description: `"${product.name}" 주문 수량이 허용 범위(최소 ${minQ.toLocaleString()}~최대 ${maxQ.toLocaleString()}개)를 벗어났습니다.` });
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

      let totalRefund = 0;
      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product || !product.sources?.length) continue;

        // 활성화된 공급처 AND 주문 수량이 해당 소스 min~max 범위 내인 것만 선택
        const validActiveSources = product.sources.filter(s => {
          if (!activeProviderIds.has(s.providerId)) return false;
          const srcMin = s.minQuantity ?? product.minQuantity ?? 0;
          const srcMax = s.maxQuantity ?? product.maxQuantity ?? 999999999;
          return opt.quantity >= srcMin && opt.quantity <= srcMax;
        });
        if (validActiveSources.length === 0) continue;

        // 우선순위 순으로 정렬 (가격 낮은 순 → 시간 빠른 순), 순서대로 모두 시도
        const sortedSources = [...validActiveSources].sort((a, b) => {
          const costA = a.costPrice ?? 0;
          const costB = b.costPrice ?? 0;
          if (costA !== costB) return costA - costB;
          return (a.estimatedMinutes ?? 999999) - (b.estimatedMinutes ?? 999999);
        });

        let orderPlaced = false;
        for (const source of sortedSources) {
          const provider = providers.find(p => p.id === source.providerId);
          if (!provider) continue;

          try {
            const resp = await fetch('/.netlify/functions/smm-api', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'submit',
                providerId: source.providerId,
                apiUrl: provider.apiUrl,
                serviceId: source.serviceId,
                link: opt.link,
                quantity: opt.quantity
              })
            });
            const result = await resp.json();
            if (result.status === 'success' && result.orderId) {
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
                costPrice: source.costPrice || 0,
                sellingPrice: product.sellingPrice || 0,
                profit: Math.floor(opt.totalPrice - ((source.costPrice || 0) * opt.quantity)),
                status: '진행중',
                externalOrderId: result.orderId
              };
              onOrderComplete(order);
              orderPlaced = true;
              break;
            } else {
              console.error('[주문실패] serviceId:', source.serviceId, '|', result.message);
            }
          } catch (e) {
            console.error('[주문실패] 네트워크/파싱 오류 - serviceId:', source.serviceId, e);
          }
        }

        // 모든 소스 실패 → 주문취소 내역 저장 + 포인트 환불 예약
        if (!orderPlaced) {
          const fallbackProvider = providers.find(p => p.id === sortedSources[0]?.providerId);
          const canceledOrder: SMMOrder = {
            id: `ORD${Date.now()}${Math.floor(Math.random()*100)}`,
            userId: user.id,
            userNickname: user.nickname,
            orderTime: new Date().toLocaleString(),
            platform: product.platform,
            productName: product.name,
            link: opt.link,
            quantity: opt.quantity,
            initialCount: 0,
            remains: 0,
            providerName: fallbackProvider?.name || '',
            costPrice: sortedSources[0]?.costPrice || 0,
            sellingPrice: product.sellingPrice || 0,
            profit: 0,
            status: '주문취소',
            externalOrderId: 'FAILED'
          };
          onOrderComplete(canceledOrder);
          totalRefund += opt.totalPrice;
        }
      }

      // 실패 항목 포인트 환불
      if (totalRefund > 0) {
        const refundedPoints = nextPoints + totalRefund;
        window.dispatchEvent(new CustomEvent('site-user-update', {
          detail: { ...user, points: refundedPoints },
        }));
        updateProfile(user.id, { points: refundedPoints }).catch(e => console.warn('환불 포인트 DB 반영 실패:', e));
      }

      window.dispatchEvent(new CustomEvent('user-new-order', { detail: { amount: totalOrderAmount - totalRefund } }));
      showAlert({ description: totalRefund > 0
        ? `일부 주문이 모든 공급처에서 실패하여 ${totalRefund.toLocaleString()}P가 환불되었습니다. 마이페이지에서 현황을 확인하세요.`
        : '성공적으로 주문되었습니다! 마이페이지에서 현황을 확인하세요.'
      });
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
    <div className="max-w-[1440px] mx-auto space-y-4 sm:space-y-6 md:space-y-10 pb-24 sm:pb-24 md:pb-32 px-3 sm:px-4 md:px-8">
      <div className="relative overflow-hidden bg-[#050505] rounded-xl sm:rounded-2xl md:rounded-[32px] shadow-2xl min-h-[140px] sm:min-h-[200px] md:min-h-[220px] flex flex-col justify-center items-center border-2 md:border-4 border-white/10 group">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent top-[15%] animate-saber-run shadow-[0_0_30px_#00f2ff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#ff0095] to-transparent top-[45%] animate-saber-run-delay-1 shadow-[0_0_30px_#ff0095,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#004cff] to-transparent top-[80%] animate-saber-run-delay-2 shadow-[0_0_30px_#004cff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#bc00ff] to-transparent top-[30%] animate-saber-run-delay-3 shadow-[0_0_30px_#bc00ff,0_0_10px_#fff]"></div>
        </div>
        
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 md:top-4">
           <div className="px-4 py-1.5 md:px-6 md:py-2 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-2 md:gap-2.5">
             <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_#ef4444]"></div>
             <span className="text-[9px] md:text-[11px] font-black italic tracking-[0.15em] md:tracking-[0.2em] uppercase text-white leading-none">24HR REAL-TIME SYSTEM</span>
           </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center text-center px-3 pt-10 pb-6 sm:pt-12 sm:pb-8 md:pt-14 md:pb-10">
           <h1 key={`main-${mainIdx}`} className="text-2xl sm:text-5xl md:text-6xl font-black text-white italic tracking-tighter animate-punch-in leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
             {mainSequence[mainIdx]}
           </h1>
        </div>
      </div>

      {/* 광고 배너: 히어로 바로 아래 */}
      <AdBanner variant="leaderboard" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 md:gap-10">
        {/* 모바일에서 먼저 보이도록 My Wallet 상단 배치 (order) */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-8 lg:sticky lg:top-24 lg:h-fit order-1 lg:order-2">
          {/* 모바일에서만 상단에 My Wallet 노출 (데스크톱은 아래 동일 블록 사용) */}
          <div className="lg:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] tracking-widest px-1 mb-3">
              <span className="w-1 h-3 bg-blue-600 rounded-full"></span> My Wallet
            </h3>
            <div className="bg-[#111827] rounded-xl p-4 text-white relative overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
              <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase italic tracking-widest">Available Points</p>
                  <p className="text-xl font-black italic tracking-tighter leading-none">{(userPoints ?? 0).toLocaleString()} <span className="text-xs text-gray-500 not-italic font-bold">P</span></p>
                </div>
                <button type="button" onClick={() => isGuest ? navigate('/login') : navigate('/payment/point')} className="bg-blue-600 text-white py-2.5 px-4 rounded-xl text-[12px] font-black shrink-0">
                  충전
                </button>
              </div>
            </div>
          </div>
          <div className="hidden lg:block bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-gray-100 space-y-4 sm:space-y-6">
            <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] sm:text-[12px] tracking-widest px-1">
              <span className="w-1 h-3 sm:h-3.5 bg-blue-600 rounded-full"></span> My Wallet
            </h3>
            <div className="bg-[#111827] rounded-xl sm:rounded-[24px] p-4 sm:p-6 text-white relative overflow-hidden shadow-xl">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
               <div className="relative z-10 space-y-3 sm:space-y-4">
                 <div className="flex justify-between items-center">
                   <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase italic tracking-widest">Available Points</p>
                   <span className="text-[8px] sm:text-[9px] bg-white/10 px-1.5 sm:px-2 py-0.5 rounded font-bold text-white/40 uppercase">Real-time sync</span>
                 </div>
                 <h4 className="text-2xl sm:text-3xl font-black italic tracking-tighter leading-none break-all">{(userPoints ?? 0).toLocaleString()} <span className="text-xs sm:text-sm text-gray-500 not-italic uppercase ml-0.5 font-bold">P</span></h4>
                 <button type="button" onClick={() => isGuest ? navigate('/login') : navigate('/payment/point')} className="w-full bg-blue-600 text-white py-3 sm:py-3.5 rounded-xl text-[12px] sm:text-[13px] font-black shadow-lg hover:bg-white hover:text-blue-600 transition-all uppercase italic tracking-wider">
                   포인트 충전하기
                 </button>
               </div>
            </div>
          </div>
          
          <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[40px] shadow-sm border border-gray-100 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] sm:text-[12px] tracking-widest">
                 <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span> 공지사항
              </h3>
              <button type="button" onClick={() => navigate('/notices')} className="text-[9px] sm:text-[10px] font-black text-gray-400 hover:text-blue-600 transition-all uppercase italic">전체보기 +</button>
            </div>
            <div className="space-y-2.5 sm:space-y-3.5">
               {notices.filter(n => !n.isHidden).slice(0, 3).map(n => (
                 <div key={n.id} onClick={() => navigate('/notices')} className="p-3 sm:p-4 bg-gray-50/50 rounded-xl sm:rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-100 group">
                    <p className="text-[12px] sm:text-[13.5px] font-black text-gray-800 break-words mb-0.5 group-hover:text-blue-600">{n.title}</p>
                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-300 uppercase italic">{n.date}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 md:space-y-10 order-2 lg:order-1">
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[56px] shadow-sm border border-gray-100 p-4 sm:p-5 sm:p-8 md:p-14 space-y-6 sm:space-y-8 md:space-y-14">
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-3 sm:gap-4 mb-4 sm:mb-10 text-gray-900 italic uppercase">
                <span className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm shadow-xl font-black italic shrink-0">01</span>
                플랫폼 선택
              </h2>
              <p className="text-xs text-gray-400 mb-2 md:hidden">← 오른쪽으로 밀어 더 많은 플랫폼 보기</p>
              {/* 모바일~태블릿: 가로 스크롤(로고 잘림 방지용 패딩) / md 이상: 그리드 */}
              <div className="w-full min-w-0 md:overflow-visible">
                <div
                  className="w-full max-w-full min-w-0 flex overflow-x-auto overflow-y-visible gap-2 py-3 px-2 -mx-1 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-3 lg:grid-cols-6 lg:gap-6 md:overflow-visible [&::-webkit-scrollbar]:hidden"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  } as React.CSSProperties}
                >
                  {SNS_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPlatform(p.name); setSelectedProductId(''); setSelectedCategory(''); }}
                      className="flex flex-col items-center gap-1.5 sm:gap-4 group shrink-0 w-12 sm:w-12 md:w-auto md:min-w-0 touch-manipulation select-none flex-shrink-0"
                    >
                    <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-[36px] flex items-center justify-center transition-all border-2 sm:border-4 relative ${selectedPlatform === p.name ? 'border-blue-600 bg-blue-50 shadow-xl sm:shadow-2xl scale-105 sm:scale-110 md:ring-0 md:ring-offset-0 ring-2 ring-blue-600/30 ring-offset-2 ring-offset-white' : 'border-transparent bg-gray-50'}`}>
                      <img
                        src={p.icon}
                        alt={p.name}
                        className="w-6 h-6 sm:w-10 sm:h-10 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          const fallback = el.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden absolute inset-0 flex items-center justify-center text-lg sm:text-2xl font-black text-gray-400 pointer-events-none" aria-hidden>{p.name[0]}</span>
                    </div>
                    <span className={`text-[10px] sm:text-[13px] font-black italic leading-tight text-center break-normal ${selectedPlatform === p.name ? 'text-blue-600' : 'text-gray-400'}`}>{p.name}</span>
                  </button>
                ))}
                </div>
              </div>
            </div>

            {categoriesForPlatform.length > 0 && (
              <div>
                <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4 mb-3 sm:mb-4">카테고리</h3>
                <div className="flex flex-wrap gap-2">
                  {categoriesForPlatform.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setSelectedProductId(''); }}
                      className={`px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-[20px] font-black text-[12px] sm:text-[13px] italic transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-8 sm:space-y-12 pt-8 sm:pt-12 border-t border-gray-50">
              {/* 커스텀 드롭다운 */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4">상품 선택</h3>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    className={`w-full p-4 sm:p-6 bg-gray-50 rounded-2xl sm:rounded-[32px] font-black text-left flex items-center justify-between gap-3 transition-all shadow-inner ${isDropdownOpen ? 'bg-white ring-2 ring-blue-100' : 'hover:bg-gray-100'}`}
                  >
                    <span className={`text-sm sm:text-base truncate ${selectedProductId ? 'text-gray-800' : 'text-gray-400'}`}>
                      {selectedProduct ? `${selectedProduct.name} (${(selectedProduct.sellingPrice ?? 0).toLocaleString()}P)` : '서비스를 선택하세요'}
                    </span>
                    <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl sm:rounded-[24px] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="max-h-72 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <div className="px-6 py-5 text-sm text-gray-400 font-bold text-center">등록된 상품이 없습니다.</div>
                        ) : filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedProductId(p.id); setIsDropdownOpen(false); setComments(''); }}
                            className={`w-full text-left px-5 sm:px-7 py-3.5 sm:py-4 text-sm sm:text-[15px] font-black transition-all flex items-center justify-between gap-4 ${selectedProductId === p.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
                          >
                            <span>{p.name}</span>
                            <span className={`text-[12px] font-black shrink-0 ${selectedProductId === p.id ? 'text-blue-200' : 'text-blue-500'}`}>{(p.sellingPrice ?? 0).toLocaleString()}P</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-8">
                <div className="md:col-span-8 space-y-3 sm:space-y-4">
                  <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4">작업 링크</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:relative">
                    <input type="text" placeholder="https://..." className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm sm:text-base pr-4 sm:pr-24" value={link} onChange={(e) => setLink(e.target.value)} />
                    <button type="button" onClick={checkLink} className="sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 bg-black text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-[20px] font-black text-[11px] hover:bg-blue-600 transition-all shrink-0">확인 ↗</button>
                  </div>
                </div>
                <div className="md:col-span-4 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 px-1 sm:px-4">
                    <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic">수량</h3>
                    {selectedProduct && (
                      <span className="text-[10px] sm:text-[11px] font-bold text-blue-500 italic whitespace-nowrap">
                        최소 {effectiveQuantityRange.min.toLocaleString()} ~ 최대 {effectiveQuantityRange.max < 999999999 ? effectiveQuantityRange.max.toLocaleString() : '제한없음'}
                      </span>
                    )}
                  </div>
                  <input type="number" placeholder="0" min={effectiveQuantityRange.min} max={effectiveQuantityRange.max < 999999999 ? effectiveQuantityRange.max : undefined} className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm sm:text-base" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>
              </div>
              {/* 댓글 섹션: 댓글 상품 선택 시에만 노출 */}
              {isCommentProduct && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3 px-1 sm:px-4">
                    <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic">댓글 내용</h3>
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2.5 py-1 rounded-full italic">1줄에 댓글 1개</span>
                  </div>
                  <textarea
                    placeholder={"댓글 내용을 입력하세요.\n1줄에 댓글 1개씩 작성해 주세요.\n예시)\n안녕하세요 좋은 내용이네요!\n정말 유익한 글 감사합니다."}
                    className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm resize-none leading-relaxed"
                    rows={6}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                  <p className="text-[10px] sm:text-[11px] text-gray-400 font-bold px-1 sm:px-4 italic">
                    ※ 1줄에 댓글 1개 기준으로 작성해주세요. 수량({quantity || 0}개)만큼 댓글이 필요합니다.
                  </p>
                </div>
              )}
              <button type="button" onClick={handleAddOption} className="w-full py-5 sm:py-6 md:py-8 bg-blue-600 text-white rounded-2xl sm:rounded-[32px] font-black text-lg sm:text-xl md:text-2xl hover:bg-black shadow-xl sm:shadow-2xl transition-all italic uppercase tracking-widest active:scale-[0.98]">+ 장바구니 담기</button>
            </div>
          </div>
          <div className="bg-[#f2f8ff] border-2 border-[#d0e5ff] rounded-2xl sm:rounded-[40px] md:rounded-[64px] p-5 sm:p-8 md:p-14 space-y-6 md:space-y-10 shadow-sm">
            <h3 className="text-base sm:text-xl font-black text-blue-900 italic uppercase flex items-center gap-2 sm:gap-3">
              <span className="w-1.5 h-4 sm:h-6 bg-blue-600 rounded-full shrink-0"></span>
              주문 장바구니
            </h3>
            <div className="space-y-4">
              {selectedOptions.length === 0 ? (
                <div className="py-12 sm:py-24 text-center text-blue-200 font-black italic border-2 border-dashed border-blue-100 rounded-2xl sm:rounded-[40px] text-sm sm:text-base">장바구니가 비어 있습니다.</div>
              ) : selectedOptions.map((opt, idx) => (
                <div key={opt.id} className="bg-white rounded-2xl sm:rounded-[36px] p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-sm border border-blue-50 group hover:border-blue-300 transition-all">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">{idx + 1}. Package</span>
                    <h4 className="font-black text-gray-900 text-base sm:text-xl break-words mb-0.5">{opt.serviceName}</h4>
                    <p className="text-[11px] font-bold text-gray-400 break-all italic">{opt.link}</p>
                    {opt.comments && (
                      <p className="text-[10px] font-bold text-orange-400 mt-1 whitespace-pre-line line-clamp-2 italic">💬 {opt.comments}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-10 sm:pl-6 flex-shrink-0">
                    <div className="space-y-0.5 sm:space-y-1">
                      <p className="text-[11px] font-black text-gray-300 uppercase italic break-words">{(opt.unitPrice ?? 0).toLocaleString()}P × {(opt.quantity ?? 0).toLocaleString()}</p>
                      <p className="text-xl sm:text-2xl font-black text-blue-600 italic tracking-tighter break-all">{(opt.totalPrice ?? 0).toLocaleString()}P</p>
                    </div>
                    <button type="button" onClick={() => setSelectedOptions(selectedOptions.filter(o=>o.id!==opt.id))} className="text-red-200 hover:text-red-500 transition-colors font-black text-xl sm:text-2xl p-1 shrink-0" aria-label="삭제">✕</button>
                  </div>
                </div>
              ))}
            </div>
            {selectedOptions.length > 0 && (
              <div className="pt-6 sm:pt-10 space-y-6 sm:space-y-8">
                <div className="bg-white/50 backdrop-blur-md rounded-2xl sm:rounded-[48px] p-6 sm:p-12 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 border border-white/50 shadow-inner">
                  <span className="text-blue-900 font-black text-base sm:text-xl italic tracking-widest break-words">결제 예정 총 포인트</span>
                  <span className="text-3xl sm:text-5xl font-black text-blue-600 italic tracking-tighter break-all">{(totalOrderAmount ?? 0).toLocaleString()}P</span>
                </div>
                <button type="button" onClick={handleOrder} disabled={isProcessing} className={`w-full py-6 sm:py-8 md:py-10 rounded-2xl sm:rounded-[48px] font-black text-xl sm:text-2xl md:text-3xl shadow-xl sm:shadow-2xl transition-all uppercase italic tracking-widest flex items-center justify-center gap-2 sm:gap-4 ${isProcessing ? 'bg-gray-400' : 'bg-black text-white hover:bg-blue-600'}`}>
                  {isProcessing ? '🚀 작업 요청 중...' : '🚀 주문하기'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SNSActivation;
