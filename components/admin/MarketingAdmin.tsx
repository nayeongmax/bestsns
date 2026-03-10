import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserProfile, Coupon, AutoCouponCampaign } from '@/types';
import { fetchCouponCampaigns, upsertCouponCampaigns, deleteCouponCampaign } from '../../campaignDb';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Props {
  user: UserProfile | null;
  members: UserProfile[];
  onIssueCoupons?: (targetIds: string[], couponData: Omit<Coupon, 'id' | 'status'>) => void;
}

type TargetType = 'all' | 'buyer' | 'seller';
type IssuanceMode = 'manual' | 'auto';

const MarketingAdmin: React.FC<Props> = ({ user, members, onIssueCoupons }) => {
  const { showConfirm, showAlert } = useConfirm();
  const [targetFilter, setTargetFilter] = useState<TargetType>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const campaignDbLoaded = useRef(false);

  const [issuanceMode, setIssuanceMode] = useState<IssuanceMode>('manual');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<AutoCouponCampaign[]>([]);

  // Supabase 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCouponCampaigns();
        if (!cancelled) {
          setCampaigns(list);
          campaignDbLoaded.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('쿠폰 캠페인 DB 로드 실패:', err);
          campaignDbLoaded.current = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Supabase 저장 (변경 시)
  useEffect(() => {
    if (!campaignDbLoaded.current) return;
    upsertCouponCampaigns(campaigns).catch((err) => console.warn('coupon_campaigns 저장:', err));
  }, [campaigns]);

  // 쿠폰 폼 상태
  const [couponForm, setCouponForm] = useState({
    title: '',
    discount: 5000,
    discountLabel: '5,000원',
    type: '프로모션 쿠폰',
    expiryDays: 30,
    color: 'rose'
  });

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = (m.nickname || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.id || '').toLowerCase().includes(searchQuery.toLowerCase());
      let matchTarget = true;
      if (targetFilter === 'buyer') matchTarget = m.sellerStatus !== 'approved';
      else if (targetFilter === 'seller') matchTarget = m.sellerStatus === 'approved';
      return matchSearch && matchTarget;
    });
  }, [members, searchQuery, targetFilter]);

  const toggleSelect = (id: string) => {
    if (isAllSelected) setIsAllSelected(false);
    setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleIssueCoupon = () => {
    if (!couponForm.title) return void showAlert({ description: '쿠폰 제목을 입력해주세요.' });
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + couponForm.expiryDays);
    const expiryStr = expiryDate.toISOString().split('T')[0];

    if (issuanceMode === 'auto') {
      let updatedCampaigns: AutoCouponCampaign[];
      
      if (editingCampaignId) {
        updatedCampaigns = campaigns.map(c => 
          c.id === editingCampaignId 
          ? { ...c, ...couponForm, targetType: targetFilter } 
          : c
        );
        showAlert({ description: '캠페인 정보가 업데이트되었습니다.' });
      } else {
        const newCampaign: AutoCouponCampaign = {
          id: `CAMP_${Date.now()}`,
          ...couponForm,
          targetType: targetFilter,
          isActive: true
        };
        updatedCampaigns = [...campaigns, newCampaign];
        showAlert({ description: '자동 발행(웰컴형) 캠페인이 활성화되었습니다.' });
      }

      setCampaigns(updatedCampaigns);
      resetForm();
      return;
    }

    // 수동 발행 로직 (이력을 아래 리스트에 추가)
    const targetIds = isAllSelected ? filteredMembers.map(m => m.id) : selectedMemberIds;
    if (targetIds.length === 0) return void showAlert({ description: '발행 대상을 선택해주세요.' });

    setIsProcessing(true);

    if (onIssueCoupons) {
      onIssueCoupons(targetIds, {
        title: couponForm.title,
        discount: couponForm.discount,
        discountLabel: couponForm.discountLabel,
        type: couponForm.type,
        expiry: expiryStr,
        color: couponForm.color
      });
    }

    // 수동 발행도 히스토리에 기록 (isActive: false로 일회성임을 표시)
    const manualHistory: AutoCouponCampaign = {
      id: `BLAST_${Date.now()}`,
      ...couponForm,
      targetType: targetFilter,
      isActive: false // 수동 발행은 '진행중'이 아닌 '완료된 히스토리'로 간주
    };
    
    const nextCampaigns = [manualHistory, ...campaigns];
    setCampaigns(nextCampaigns);

    setTimeout(() => {
      setIsProcessing(false);
      resetForm();
      showAlert({ description: `${targetIds.length}명의 회원에게 쿠폰 발행 및 알림 발송이 완료되었습니다.` });
    }, 500);
  };

  const resetForm = () => {
    setCouponForm({
      title: '',
      discount: 5000,
      discountLabel: '5,000원',
      type: '프로모션 쿠폰',
      expiryDays: 30,
      color: 'rose'
    });
    setSelectedMemberIds([]);
    setIsAllSelected(false);
    setEditingCampaignId(null);
  };

  const startEditCampaign = (camp: AutoCouponCampaign) => {
    if (!camp.isActive && camp.id.startsWith('BLAST')) {
      showAlert({ description: '수동 발행 이력은 수정할 수 없습니다. 설정을 복사하여 새로 발행해 주세요.' });
      return;
    }
    setEditingCampaignId(camp.id);
    setCouponForm({
      title: camp.title,
      discount: camp.discount,
      discountLabel: camp.discountLabel,
      type: camp.type || '프로모션 쿠폰',
      expiryDays: camp.expiryDays,
      color: camp.color
    });
    setTargetFilter(camp.targetType);
    setIssuanceMode('auto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reuseCampaign = (camp: AutoCouponCampaign) => {
    setEditingCampaignId(null);
    setCouponForm({
      title: `${camp.title} (복사)`,
      discount: camp.discount,
      discountLabel: camp.discountLabel,
      type: camp.type || '프로모션 쿠폰',
      expiryDays: camp.expiryDays,
      color: camp.color
    });
    setTargetFilter(camp.targetType);
    setIssuanceMode(camp.isActive ? 'auto' : 'manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCampaign = (id: string) => {
    showConfirm({
      title: '캠페인 삭제',
      description: '해당 캠페인/이력을 리스트에서 삭제하시겠습니까?',
      confirmLabel: '삭제하기',
      cancelLabel: '취소',
      danger: true,
      onConfirm: () => {
        deleteCouponCampaign(id).catch((err) => console.warn('캠페인 삭제 실패:', err));
        setCampaigns(prev => prev.filter(c => c.id !== id));
        if (editingCampaignId === id) resetForm();
      },
    });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-4">
        <div>
          <h3 className="text-2xl font-black text-gray-900 italic uppercase underline decoration-rose-500 underline-offset-8">쿠폰 및 마케팅 캠페인 관제</h3>
          <p className="text-[11px] font-bold text-gray-400 mt-4 uppercase tracking-widest italic">Advanced Coupon Marketing Engine</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 p-4">
        <div className="lg:col-span-5 bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[800px]">
           <div className="p-8 border-b border-gray-50 space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="text-lg font-black text-gray-900 italic uppercase flex items-center gap-2">
                    <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px] not-italic">1</span>
                    대상 선정
                  </h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase italic mt-1">발행 대상을 정교하게 필터링하세요</p>
                </div>
              </div>

              {issuanceMode === 'auto' ? (
                <div className="bg-rose-50 p-8 rounded-[32px] border-2 border-dashed border-rose-200 text-center space-y-4 animate-in zoom-in-95">
                   <div className="text-4xl">🤖</div>
                   <h5 className="font-black text-rose-600 italic">자동 발행 모드 활성화 중</h5>
                   <p className="text-[12px] font-bold text-rose-400 leading-relaxed">
                     자동 발행 모드에서는 개별 대상 선정이 필요 없습니다.<br/>
                     <span className="text-rose-700 underline decoration-2 underline-offset-4">회원가입 및 로그인 조건</span>에 맞는 유저에게<br/>시스템이 즉시 지급합니다.
                   </p>
                   {editingCampaignId && (
                     <p className="text-[11px] bg-white p-2 rounded-lg text-rose-500 font-black italic">
                       현재 ID: {editingCampaignId} 수정 중
                     </p>
                   )}
                </div>
              ) : (
                <>
                  <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
                     {[ { id: 'all', label: '전체 회원' }, { id: 'buyer', label: '구매자(전문가X)' }, { id: 'seller', label: '판매자(전문가O)' } ].map(btn => (
                       <button 
                        key={btn.id}
                        onClick={() => { setTargetFilter(btn.id as TargetType); setSelectedMemberIds([]); setIsAllSelected(false); }}
                        className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all ${targetFilter === btn.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                       >
                         {btn.label}
                       </button>
                     ))}
                  </div>

                  <div className="flex items-center gap-3">
                     <div className="relative flex-1">
                        <input 
                          type="text" 
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="이름 또는 ID로 검색..." 
                          className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-sm shadow-inner outline-none focus:ring-4 focus:ring-rose-100 transition-all"
                        />
                     </div>
                     <button 
                      onClick={() => { setIsAllSelected(!isAllSelected); setSelectedMemberIds([]); }}
                      className={`px-4 py-4 rounded-2xl text-[11px] font-black transition-all ${isAllSelected ? 'bg-rose-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                     >
                       {isAllSelected ? '전체 해제' : '전체 선택'}
                     </button>
                  </div>
                </>
              )}
           </div>

           {issuanceMode !== 'auto' && (
             <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar bg-gray-50/30">
                {isAllSelected ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
                     <div className="w-20 h-20 bg-rose-500 text-white rounded-3xl flex items-center justify-center text-3xl shadow-2xl animate-bounce">🎯</div>
                     <h5 className="text-lg font-black text-gray-900 italic">조건에 맞는 {filteredMembers.length}명 전체 타겟팅</h5>
                  </div>
                ) : (
                  filteredMembers.map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => toggleSelect(m.id)} 
                      className={`flex items-center gap-4 p-4 rounded-[24px] cursor-pointer transition-all border-2 ${
                        selectedMemberIds.includes(m.id) 
                        ? 'bg-white border-rose-500 shadow-xl scale-[1.02]' 
                        : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedMemberIds.includes(m.id) 
                        ? 'bg-rose-500 border-rose-500 text-white text-[10px] font-black' 
                        : 'border-gray-200 bg-white'
                      }`}>
                        {selectedMemberIds.includes(m.id) && '✓'}
                      </div>
                      <img src={m.profileImage} className="w-10 h-10 rounded-full object-cover border border-gray-100" alt="p" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-gray-900 text-[14px] truncate">{m.nickname}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded italic uppercase ${m.sellerStatus === 'approved' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {m.sellerStatus === 'approved' ? 'Seller' : 'Buyer'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
             </div>
           )}
        </div>

        <div className="lg:col-span-7 bg-gray-900 rounded-[48px] p-10 text-white space-y-8 shadow-2xl flex flex-col h-[800px] relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-[100px]"></div>
           
           <div className="space-y-10 flex-1 overflow-y-auto no-scrollbar relative z-10">
              <div className="space-y-6">
                <h4 className="text-xl font-black italic uppercase flex items-center gap-2">
                  <span className="w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] not-italic">2</span>
                  쿠폰 디자인 및 스펙
                </h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-rose-400 uppercase italic px-2">쿠폰 공식 명칭</label>
                    <input 
                      value={couponForm.title} 
                      onChange={e => setCouponForm({...couponForm, title: e.target.value})} 
                      placeholder="예: 가입 축하 5,000원 웰컴 쿠폰" 
                      className="w-full p-6 bg-white/5 border border-white/10 rounded-3xl text-white font-black text-xl outline-none focus:border-rose-500 transition-all shadow-inner" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-400 uppercase italic px-2">할인액(원)</label>
                        <input type="number" value={couponForm.discount} onChange={e => setCouponForm({...couponForm, discount: Number(e.target.value)})} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-lg" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-400 uppercase italic px-2">디스플레이 라벨</label>
                        <input value={couponForm.discountLabel} onChange={e => setCouponForm({...couponForm, discountLabel: e.target.value})} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-lg" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-rose-400 uppercase italic px-2">쿠폰 유효기간</label>
                    <div className="flex flex-wrap gap-2">
                       {[ { d: 7, l: '7일' }, { d: 30, l: '30일' }, { d: 365, l: '1년' }, { d: 3650, l: '무제한' } ].map(btn => (
                         <button 
                          key={btn.d}
                          onClick={() => setCouponForm({...couponForm, expiryDays: btn.d})}
                          className={`px-5 py-2.5 rounded-xl text-[11px] font-black transition-all border-2 ${couponForm.expiryDays === btn.d ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400'}`}
                         >
                           {btn.l}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="text-[10px] font-black text-rose-400 uppercase italic px-2">테마 색상</label>
                    <div className="flex gap-4">
                        {[ 'blue', 'rose', 'green', 'purple', 'gray' ].map(c => (
                          <button 
                            key={c}
                            onClick={() => setCouponForm({...couponForm, color: c})}
                            className={`w-12 h-12 rounded-2xl border-4 transition-all ${couponForm.color === c ? 'border-white scale-110 shadow-xl' : 'border-transparent opacity-40'} ${
                              c === 'blue' ? 'bg-blue-500' : c === 'rose' ? 'bg-rose-500' : c === 'green' ? 'bg-green-500' : c === 'purple' ? 'bg-purple-500' : 'bg-gray-500'
                            }`}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-10 border-t border-white/10">
                <h4 className="text-xl font-black italic uppercase flex items-center gap-2">
                  <span className="w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] not-italic">3</span>
                  발행 방식 설정
                </h4>

                <div className="grid grid-cols-2 gap-6">
                   <div 
                    onClick={() => { setIssuanceMode('manual'); setEditingCampaignId(null); }}
                    className={`p-6 rounded-[32px] border-4 cursor-pointer transition-all ${issuanceMode === 'manual' ? 'bg-white/10 border-rose-500 shadow-xl' : 'bg-white/5 border-transparent opacity-50'}`}
                   >
                      <h5 className="font-black text-[15px] mb-1">수동 즉시 발행</h5>
                      <p className="text-[11px] font-bold text-gray-400">지금 즉시 선택 대상에게 일회성 발송 및 알림을 전송합니다.</p>
                   </div>
                   
                   <div 
                    onClick={() => setIssuanceMode('auto')}
                    className={`p-6 rounded-[32px] border-4 cursor-pointer transition-all ${issuanceMode === 'auto' ? 'bg-white/10 border-rose-500 shadow-xl' : 'bg-white/5 border-transparent opacity-50'}`}
                   >
                      <h5 className="font-black text-[15px] mb-1">자동 발행 (웰컴형)</h5>
                      <p className="text-[11px] font-bold text-gray-400">신규 가입 시 조건에 맞는 유저에게 자동 지급합니다.</p>
                   </div>
                </div>
              </div>
           </div>

           <div className="pt-8 border-t border-white/10 bg-gray-900 sticky bottom-0">
             <button 
              onClick={handleIssueCoupon} 
              disabled={isProcessing}
              className={`w-full py-8 rounded-[40px] font-black text-2xl transition-all shadow-2xl uppercase italic tracking-widest ${
                isProcessing ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-white hover:text-rose-600'
              }`}
             >
                {isProcessing ? '처리 중...' : editingCampaignId ? '✨ 캠페인 업데이트 저장' : (issuanceMode === 'manual' ? '🚀 선택 대상 수동 발행 시작' : '✨ 자동 발행 캠페인 활성화')}
             </button>
             {editingCampaignId && (
               <button onClick={resetForm} className="w-full mt-4 text-gray-400 font-bold text-xs uppercase italic hover:text-white">편집 취소</button>
             )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[48px] p-10 shadow-sm border border-gray-100 space-y-8 mx-4">
         <div className="flex justify-between items-center px-4">
            <h4 className="text-xl font-black text-gray-900 italic uppercase">운영 중인 캠페인 및 쿠폰 발행 이력</h4>
            <span className="text-[11px] font-bold text-gray-400 italic uppercase tracking-widest">Campaign & Blast History</span>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
                 <p className="text-gray-300 font-black italic">활성화된 캠페인이 없습니다.</p>
              </div>
            ) : campaigns.map((camp) => (
              <div key={camp.id} className={`bg-white p-8 rounded-[36px] border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden ${editingCampaignId === camp.id ? 'ring-4 ring-rose-500 border-rose-500' : 'border-gray-100'}`}>
                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 border-gray-100 shadow-inner ${
                      camp.color === 'rose' ? 'bg-rose-50 text-rose-600' : 
                      camp.color === 'blue' ? 'bg-blue-50 text-blue-600' : 
                      camp.color === 'green' ? 'bg-green-50 text-green-600' : 
                      camp.color === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                    }`}>
                       <span className="text-lg font-black italic leading-none">{camp.discountLabel}</span>
                       <span className="text-[8px] font-black uppercase mt-1">OFF</span>
                    </div>
                    <div className="flex gap-3">
                       {camp.isActive && (
                         <button onClick={() => startEditCampaign(camp)} className="text-[10px] font-black text-rose-500 hover:underline">편집</button>
                       )}
                       <button onClick={() => reuseCampaign(camp)} className="text-[10px] font-black text-blue-500 hover:underline">복사</button>
                       <button onClick={() => deleteCampaign(camp.id)} className="text-[10px] font-black text-gray-300 hover:text-red-500">삭제</button>
                    </div>
                 </div>
                 
                 <div className="space-y-1">
                    <h5 className="font-black text-gray-900 text-[16px] truncate italic">{camp.title}</h5>
                    <p className="text-[11px] font-bold text-gray-400 uppercase italic">
                       {camp.targetType === 'all' ? '전체회원' : camp.targetType === 'buyer' ? '구매자전용' : '판매자전용'} / 유효: {camp.expiryDays}일
                    </p>
                 </div>

                 <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-50">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black italic shadow-sm border ${camp.isActive ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      {camp.isActive ? 'AUTO CAMPAIGN' : 'MANUAL BLAST'}
                    </span>
                    <span className="text-[10px] text-gray-300 font-bold italic">ID: {camp.id.split('_')[0]}</span>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default MarketingAdmin;
