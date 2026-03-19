
import React, { useState, useRef, useMemo } from 'react';
/**
 * Fixed: Removed .ts extension from import
 */
import { ChannelProduct, ChannelOrder } from '@/types';
import { CHANNEL_CATEGORIES } from '../../constants.tsx';
import { deleteChannelProduct, upsertChannelOrder } from '../../channelDb';
import { supabase } from '../../supabase';
import { useConfirm } from '@/contexts/ConfirmContext';


interface Props {
  channels: ChannelProduct[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelProduct[]>>;
  channelOrders: ChannelOrder[];
  setChannelOrders?: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
}

const ChannelAdmin: React.FC<Props> = ({ channels, setChannels, channelOrders, setChannelOrders }) => {
  const { showConfirm, showAlert } = useConfirm();
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'order'>('manage');
  const [editingChannel, setEditingChannel] = useState<ChannelProduct | null>(null);
  const [isRegisteringChannel, setIsRegisteringChannel] = useState(false);
  
  // 주문/계약 현황용 필터 상태
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('전체 상태');
  const [orderMonthFilter, setOrderMonthFilter] = useState('전체 기간');
  
  // 결제 상세 모달 상태
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<ChannelOrder | null>(null);
  // 환불 처리 중인 주문 ID
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);

  const [thumbnail, setThumbnail] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  
  const [tempDescription, setTempDescription] = useState('');
  const [isApprovedTemp, setIsApprovedTemp] = useState(false);
  const [isHotTemp, setIsHotTemp] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, isThumbnail: boolean = false): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = isThumbnail ? 600 : 1200; 
          let width = img.width;
          let height = img.height;
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); 
        };
      };
    });
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'thumb' | 'multi') => {
    const files = e.target.files;
    if (!files) return;

    if (type === 'thumb') {
      const compressed = await compressImage(files[0] as File, true);
      setThumbnail(compressed);
    } else {
      const remaining = 10 - attachedImages.length;
      if (remaining <= 0) {
        showAlert({ description: '상세 이미지는 최대 10장까지만 가능합니다.' });
        return;
      }
      const selectedFiles = Array.from(files).slice(0, remaining) as File[];
      for (const file of selectedFiles) {
        const compressed = await compressImage(file);
        setAttachedImages(prev => [...prev, compressed]);
      }
    }
    e.target.value = '';
  };

  const moveImage = (idx: number, direction: 'up' | 'down') => {
    const newImages = [...attachedImages];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newImages.length) return;
    [newImages[idx], newImages[targetIdx]] = [newImages[targetIdx], newImages[idx]];
    setAttachedImages(newImages);
  };

  const startEditChannel = (ch: ChannelProduct | null) => {
    if (ch) {
      setEditingChannel(ch);
      setThumbnail(ch.thumbnail);
      setAttachedImages(ch.attachedImages || []);
      setTempDescription(ch.description || '');
      setIsApprovedTemp(ch.isApproved || false);
      setIsHotTemp(ch.isHot || false);
      setIsRegisteringChannel(false);
    } else {
      setEditingChannel(null);
      setThumbnail('');
      setAttachedImages([]);
      setTempDescription('');
      setIsApprovedTemp(false);
      setIsHotTemp(false);
      setIsRegisteringChannel(true);
    }
  };

  const handleSaveChannel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!thumbnail) return void showAlert({ description: '대표 썸네일을 등록해주세요.' });

    const formData = new FormData(e.currentTarget);
    const newCh: ChannelProduct = {
      id: editingChannel?.id || `c${Date.now()}`,
      platform: formData.get('platform') as string,
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      subscribers: Number(formData.get('subscribers')),
      income: Number(formData.get('income')),
      expense: Number(formData.get('expense')),
      price: Number(formData.get('price')),
      thumbnail: thumbnail,
      attachedImages: attachedImages,
      isSoldOut: editingChannel?.isSoldOut || false,
      description: tempDescription,
      isApproved: isApprovedTemp,
      isHot: isHotTemp,
      sourceLink: formData.get('sourceLink') as string,
      publicLink: formData.get('publicLink') as string,
    };
    setChannels(prev => editingChannel ? prev.map(c => c.id === editingChannel.id ? newCh : c) : [...prev, newCh]);
    setEditingChannel(null);
    setIsRegisteringChannel(false);
    showAlert({ description: '채널 정보가 성공적으로 저장되었습니다.' });
  };

  // --- 거래 현황 데이터 가공 및 필터링 ---
  
  // 가용한 월 목록 추출 (중복 제거)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    channelOrders.forEach(o => {
      if (o.orderTime) {
        const month = o.orderTime.substring(0, 7); // "YYYY-MM"
        months.add(month);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [channelOrders]);

  const filteredOrders = useMemo(() => {
    return channelOrders.filter(o => {
      const q = orderSearchQuery.toLowerCase();
      const matchSearch = 
        o.id.toLowerCase().includes(q) || 
        o.userId.toLowerCase().includes(q) || 
        o.userNickname.toLowerCase().includes(q) || 
        o.productName.toLowerCase().includes(q) ||
        (o.paymentId || '').toLowerCase().includes(q);
      
      const matchStatus = orderStatusFilter === '전체 상태' || o.status === orderStatusFilter;
      const matchMonth = orderMonthFilter === '전체 기간' || (o.orderTime && o.orderTime.startsWith(orderMonthFilter));
      
      return matchSearch && matchStatus && matchMonth;
    });
  }, [channelOrders, orderSearchQuery, orderStatusFilter, orderMonthFilter]);

  const handleRefund = (order: ChannelOrder) => {
    if (!order.paymentId) {
      showAlert({ description: '결제 ID가 없어 환불할 수 없습니다.' });
      return;
    }
    showConfirm({
      title: '결제 취소 (환불)',
      description: `[${order.productName}] 결제를 취소하시겠습니까?\n환불 금액: ₩${order.price.toLocaleString()}`,
      confirmLabel: '환불하기',
      cancelLabel: '취소',
      danger: true,
      onConfirm: async () => {
        setRefundingOrderId(order.id);
        try {
          const res = await fetch('/.netlify/functions/portone-refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: order.paymentId, reason: '관리자 환불 처리' }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as any).error || `환불 실패 (HTTP ${res.status})`);
          }
          const updatedOrder: ChannelOrder = { ...order, status: 'refunded' };
          await upsertChannelOrder(updatedOrder);
          // orders 테이블도 환불 상태로 동기화 (payment_id 기준)
          if (order.paymentId) {
            await supabase.from('orders').update({ status: '환불완료' }).eq('payment_id', order.paymentId);
          }
          setChannelOrders?.(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
          showAlert({ description: '환불이 완료되었습니다.' });
        } catch (e: any) {
          showAlert({ description: `환불 실패: ${e.message}` });
        } finally {
          setRefundingOrderId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="bg-gray-900 p-1.5 rounded-[24px] flex gap-1 w-fit mx-4 shadow-xl">
        {[
          { id: 'manage', label: '🛠️ 채널 인벤토리 관리', icon: '📦' },
          { id: 'order', label: '📊 채널 거래 계약 현황', icon: '📈' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { setActiveSubTab(tab.id as any); setEditingChannel(null); setIsRegisteringChannel(false); }}
            className={`px-8 py-3.5 rounded-[20px] text-[13px] font-black transition-all ${activeSubTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'manage' ? (
        <>
          {(editingChannel || isRegisteringChannel) ? (
            <div className="bg-white p-10 md:p-16 rounded-[60px] shadow-2xl border border-gray-100">
              <div className="flex justify-between items-center mb-10 pb-8 border-b border-gray-100">
                <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter underline decoration-blue-500 underline-offset-8">
                   {editingChannel ? '💎 매물 정보 상세 수정' : '💎 새로운 채널 매물 등록'}
                </h3>
                <button onClick={() => { setEditingChannel(null); setIsRegisteringChannel(false); }} className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl font-black text-xl hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">✕</button>
              </div>
              
              <form onSubmit={handleSaveChannel} className="space-y-14">
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 border-b border-gray-50 pb-12">
                    <div className="lg:col-span-4 space-y-4">
                       <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest px-2">대표 썸네일 이미지</label>
                       <div 
                        onClick={() => thumbInputRef.current?.click()}
                        className="relative aspect-square bg-gray-50 rounded-[40px] border-4 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all overflow-hidden group shadow-inner"
                       >
                          {thumbnail ? (
                            <img src={thumbnail} className="w-full h-full object-cover" alt="thumb" />
                          ) : (
                            <div className="text-center space-y-2">
                               <span className="text-4xl">📸</span>
                               <p className="text-xs font-black text-gray-400 italic">이미지를 업로드하려면 클릭하세요</p>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                             <span className="text-white font-black text-sm italic">이미지 교체 ↺</span>
                          </div>
                       </div>
                       <input type="file" ref={thumbInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageFile(e, 'thumb')} />
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                       <div className="flex justify-between items-end px-2">
                          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest">상세 인증샷/이미지 ({attachedImages.length}/10)</label>
                          <button 
                            type="button" 
                            onClick={() => multiInputRef.current?.click()}
                            className="bg-gray-900 text-white px-6 py-2 rounded-xl text-[11px] font-black shadow-lg hover:bg-blue-600 transition-all uppercase italic"
                          >
                            + 다중 이미지 추가
                          </button>
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 bg-gray-50 p-6 rounded-[40px] shadow-inner min-h-[200px]">
                          {attachedImages.length === 0 ? (
                            <div className="col-span-full flex items-center justify-center opacity-30 italic font-black text-gray-400">등록된 상세 이미지가 없습니다.</div>
                          ) : attachedImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-100 shadow-md group bg-white">
                               <img src={img} className="w-full h-full object-cover" alt={`detail-${idx}`} />
                               <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all">
                                  <div className="flex gap-1">
                                     <button type="button" onClick={() => moveImage(idx, 'up')} className="p-1.5 bg-white text-gray-900 rounded-lg hover:bg-blue-50 disabled:opacity-30" disabled={idx === 0}>▲</button>
                                     <button type="button" onClick={() => moveImage(idx, 'down')} className="p-1.5 bg-white text-gray-900 rounded-lg hover:bg-blue-50 disabled:opacity-30" disabled={idx === attachedImages.length - 1}>▼</button>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-400 font-black text-[10px] uppercase italic underline underline-offset-2"
                                  >
                                    삭제하기
                                  </button>
                               </div>
                               <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded italic">#{idx + 1}</div>
                            </div>
                          ))}
                       </div>
                       <input type="file" ref={multiInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleImageFile(e, 'multi')} />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">채널 플랫폼 구분</label>
                      <select name="platform" defaultValue={editingChannel?.platform} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-700 outline-none shadow-inner cursor-pointer focus:ring-4 focus:ring-blue-50 transition-all">
                        <option>YouTube</option><option>TikTok</option><option>Instagram</option><option>Twitter</option><option>Telegram</option><option>Facebook</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">매물 카테고리</label>
                      <select name="category" defaultValue={editingChannel?.category} className="w-full p-5 bg-gray-50 border-none rounded-[24px] font-black text-gray-700 outline-none shadow-inner cursor-pointer focus:ring-4 focus:ring-blue-50 transition-all">
                        {CHANNEL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-blue-500 px-2 italic">원천 공급처 링크 (관리자 전용)</label>
                      <input name="sourceLink" defaultValue={editingChannel?.sourceLink} placeholder="https://..." className="w-full p-5 bg-blue-50/30 border-none rounded-[24px] font-bold text-blue-700 shadow-inner outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-green-500 px-2 italic">채널 공개 URL (사용자 노출용)</label>
                      <input name="publicLink" defaultValue={editingChannel?.publicLink} placeholder="https://..." className="w-full p-5 bg-green-50/30 border-none rounded-[24px] font-bold text-green-700 shadow-inner outline-none focus:ring-4 focus:ring-green-100 transition-all" />
                    </div>
                 </div>

                 <div className="space-y-3">
                   <label className="text-[11px] font-black text-gray-400 px-2 uppercase italic tracking-widest">매물 상품 타이틀</label>
                   <input name="title" defaultValue={editingChannel?.title} placeholder="판매 시 노출될 채널 이름을 입력하세요" className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-800 text-lg shadow-inner outline-none focus:ring-4 focus:ring-blue-50" required />
                 </div>

                 <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">최종 판매가(원)</label><input type="number" name="price" defaultValue={editingChannel?.price} className="w-full p-5 bg-gray-50 rounded-[24px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" required /></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">총 구독자수</label><input type="number" name="subscribers" defaultValue={editingChannel?.subscribers} className="w-full p-5 bg-gray-50 rounded-[24px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" /></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">월평균 수입($)</label><input type="number" name="income" defaultValue={editingChannel?.income} className="w-full p-5 bg-gray-50 rounded-[24px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" /></div>
                    <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 px-2 italic uppercase">월평균 지출($)</label><input type="number" name="expense" defaultValue={editingChannel?.expense} className="w-full p-5 bg-gray-50 rounded-[24px] font-black text-gray-700 shadow-inner outline-none focus:bg-white" /></div>
                 </div>

                 <div className="space-y-3">
                   <label className="text-[11px] font-black text-gray-400 px-2 uppercase italic tracking-widest">상세 분석 및 거래 조건 가이드</label>
                   <textarea value={tempDescription} onChange={e => setTempDescription(e.target.value)} rows={8} placeholder="수익 구조, 성장 이력, 소유권 이전 절차 등을 명확하게 기술해 주세요." className="w-full p-10 bg-gray-50 border-none rounded-[48px] font-bold text-gray-700 shadow-inner resize-none outline-none focus:ring-4 focus:ring-blue-100 transition-all leading-relaxed no-scrollbar" />
                 </div>

                 <div className="bg-gray-50 p-10 rounded-[48px] flex flex-col md:flex-row gap-12 border-2 border-dashed border-gray-100">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-4 transition-all flex items-center justify-center ${isApprovedTemp ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-gray-200'}`}>
                        {isApprovedTemp && <span className="text-white text-sm">✓</span>}
                      </div>
                      <input type="checkbox" checked={isApprovedTemp} onChange={e => setIsApprovedTemp(e.target.checked)} className="hidden" />
                      <span className={`text-[15px] font-black italic tracking-tight transition-colors ${isApprovedTemp ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>공식 수익창출 승인 채널</span>
                    </label>

                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-8 h-8 rounded-xl border-4 transition-all flex items-center justify-center ${isHotTemp ? 'bg-red-50 border-red-500 shadow-lg' : 'bg-white border-gray-200'}`}>
                        {isHotTemp && <span className="text-white text-sm">✓</span>}
                      </div>
                      <input type="checkbox" checked={isHotTemp} onChange={e => setIsHotTemp(e.target.checked)} className="hidden" />
                      <span className={`text-[15px] font-black italic tracking-tight transition-colors ${isHotTemp ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>HOT 프리미엄 매물 추천</span>
                    </label>
                 </div>

                 <button type="submit" className="w-full py-10 bg-gray-900 text-white rounded-[50px] font-black text-3xl shadow-2xl hover:bg-blue-600 transition-all italic tracking-[0.2em] uppercase active:scale-[0.98]">
                    매물 정보 등록 및 최적화 완료 💾
                 </button>
              </form>
            </div>
          ) : (
            <div className="space-y-10">
              <div className="flex justify-between items-center px-6">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-12">채널 매물 통합 관리 센터</h3>
                  <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.3em]">현재 등록된 실시간 매물 현황 ({channels.length}개)</p>
                </div>
                <button onClick={() => startEditChannel(null)} className="bg-blue-600 text-white px-10 py-4 rounded-[24px] font-black text-sm shadow-xl hover:bg-black transition-all italic tracking-widest uppercase">+ 신규 채널 매물 등록</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {channels.map(ch => (
                  <div key={ch.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 group hover:-translate-y-2 transition-all relative">
                     <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                        <img src={ch.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="thumb" />
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                           {ch.isApproved && (<span className="bg-[#FFD600] text-gray-900 text-[10px] font-black px-2.5 py-0.5 rounded-lg italic uppercase shadow-md">승인채널</span>)}
                           {ch.isHot && (<span className="bg-[#FF4D4D] text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg italic uppercase shadow-md">HOT</span>)}
                        </div>
                        {ch.isSoldOut && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10"><span className="text-white text-sm font-black italic border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl uppercase">판매완료</span></div>}
                     </div>
                     <div className="p-6">
                        <div className="flex justify-between items-center mb-3">
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full italic uppercase">{ch.platform}</span>
                           <span className="text-[9px] font-bold text-gray-300">#번호.{ch.id.slice(-4).toUpperCase()}</span>
                        </div>
                        <h3 className="font-black text-gray-900 mb-6 line-clamp-2 h-10 text-[15px] leading-tight group-hover:text-blue-600 transition-colors">{ch.title}</h3>
                        
                        <div className="flex justify-between items-end border-t border-gray-50 pt-4 mb-6">
                           <div className="flex flex-col"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest italic mb-1">구독자</span><span className="text-[13px] font-black text-gray-700">{ch.subscribers.toLocaleString()}명</span></div>
                           <div className="flex flex-col items-end"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest italic mb-1">매매가</span><span className="text-lg font-black text-blue-600 italic tracking-tighter">₩{(ch.price / 10000).toLocaleString()}만</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => startEditChannel(ch)} className="py-3 bg-gray-900 text-white rounded-2xl font-black text-[11px] hover:bg-blue-600 transition-all shadow-sm italic uppercase tracking-tighter">수정하기</button>
                           <button onClick={() => setChannels(prev => prev.map(c => c.id === ch.id ? {...c, isSoldOut: !c.isSoldOut} : c))} className={`py-3 rounded-2xl font-black text-[11px] text-white shadow-sm transition-all italic uppercase tracking-tighter ${ch.isSoldOut ? 'bg-green-500' : 'bg-orange-500'}`}>
                              {ch.isSoldOut ? '판매중 전환' : '판매완료 처리'}
                           </button>
                        </div>
                     </div>
                     <button 
                      onClick={() => {
                        showConfirm({
                          title: '채널 삭제',
                          description: '정말 삭제하시겠습니까?',
                          dangerLine: '삭제 후에는 복구할 수 없습니다.',
                          confirmLabel: '삭제하기',
                          cancelLabel: '취소',
                          danger: true,
                          onConfirm: async () => {
                            try {
                              await deleteChannelProduct(ch.id);
                              setChannels(prev => prev.filter(c => c.id !== ch.id));
                            } catch (e) {
                              console.error(e);
                              showAlert({ description: '삭제에 실패했습니다.' });
                            }
                          },
                        });
                      }}
                      className="absolute -top-2 -right-2 w-10 h-10 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 flex items-center justify-center font-black z-20"
                     >
                       ✕
                     </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
           <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6 flex-1 w-full">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl shadow-inner">📺</div>
                 <div>
                    <h3 className="text-2xl font-black text-gray-900 italic uppercase tracking-tighter">채널 매매 거래 관리 시스템</h3>
                    <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest leading-none">모든 채널 거래 건에 대한 진행 상태 및 계약 추적</p>
                 </div>
                 
                 <div className="flex-1 max-w-2xl flex gap-3 ml-6">
                    <div className="relative flex-1">
                       <input 
                          type="text" 
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="주문번호, 결제ID, 닉네임, 채널명..." 
                          className="w-full pl-10 pr-6 py-4 bg-gray-50 border-none rounded-full font-bold text-[14px] shadow-inner outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                       />
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
                    </div>

                    {/* 월별 필터 추가 (요청 사항) */}
                    <select 
                       value={orderMonthFilter}
                       onChange={(e) => setOrderMonthFilter(e.target.value)}
                       className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer"
                    >
                       <option>전체 기간</option>
                       {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <select
                       value={orderStatusFilter}
                       onChange={(e) => setOrderStatusFilter(e.target.value)}
                       className="px-6 py-4 bg-gray-50 border-none rounded-full font-black text-[13px] shadow-inner outline-none cursor-pointer"
                    >
                       <option>전체 상태</option>
                       <option>입금대기</option>
                       <option>양도진행중</option>
                       <option>완료</option>
                       <option value="refunded">환불완료</option>
                    </select>
                    
                    <button onClick={() => { setOrderSearchQuery(''); setOrderStatusFilter('전체 상태'); setOrderMonthFilter('전체 기간'); }} className="px-5 py-4 bg-gray-100 text-gray-400 rounded-full font-black text-[11px] hover:bg-gray-200 uppercase shrink-0">Reset</button>
                 </div>
              </div>
              
              <div className="bg-[#F8F9FF] border border-indigo-100 px-8 py-4 rounded-[28px] text-center shadow-sm shrink-0">
                 <span className="text-[11px] font-black text-indigo-400 uppercase italic block mb-1">
                   {orderMonthFilter === '전체 기간' ? '총 누적 실적' : `${orderMonthFilter} 실적`}
                 </span>
                 <span className="text-3xl font-black text-indigo-600 italic tracking-tighter">{filteredOrders.length.toLocaleString()} <span className="text-sm not-italic font-bold ml-1">건</span></span>
              </div>
           </div>

           <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest italic">
                       <tr>
                          <th className="px-8 py-5">계약일시 / ID</th>
                          <th className="px-8 py-5">구매 희망자</th>
                          <th className="px-8 py-5">채널 매물 정보</th>
                          <th className="px-8 py-5">구매자 계정</th>
                          <th className="px-8 py-5">결제 정보 (자동수집)</th>
                          <th className="px-8 py-5 text-right">최종 매매가</th>
                          <th className="px-8 py-5 text-center">진행 상태</th>
                          <th className="px-8 py-5 text-center">결제취소</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredOrders.length === 0 ? (
                         <tr><td colSpan={8} className="py-32 text-center text-gray-300 font-black italic text-lg">기록된 거래 내역이 존재하지 않습니다.</td></tr>
                       ) : filteredOrders.map(o => (
                         <tr key={o.id} className="hover:bg-indigo-50/20 transition-all group">
                           <td className="px-8 py-6">
                              <p className="text-[13px] font-black text-gray-800">{o.orderTime ? new Date(o.orderTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</p>
                              <p className="text-[10px] text-indigo-500 font-bold mt-0.5">#{o.id}</p>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-[13px] font-black text-gray-900">@{o.userId}</p>
                              <p className="text-[10px] text-gray-400 font-bold">{o.userNickname}</p>
                           </td>
                           <td className="px-8 py-6">
                              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-[4px] text-[9px] font-black italic uppercase">{o.platform}</span>
                              <p className="text-[13px] font-black text-gray-900 mt-1 truncate max-w-[250px]">{o.productName}</p>
                           </td>
                           <td className="px-8 py-6">
                              {o.buyerAccount ? (
                                <span className="text-[13px] font-black text-gray-900">{o.buyerAccount}</span>
                              ) : (
                                <span className="text-[11px] text-gray-300 italic font-bold">-</span>
                              )}
                           </td>
                           <td className="px-8 py-6">
                              {o.paymentId ? (
                                <div className="space-y-1">
                                   <button
                                      onClick={() => setSelectedOrderForPayment(o)}
                                      className="text-[12px] font-black text-blue-600 hover:underline underline-offset-4 decoration-2 decoration-blue-200 block"
                                   >
                                      {o.paymentId}
                                   </button>
                                   <div className="flex gap-1.5">
                                      <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black italic">{o.paymentMethod}</span>
                                      <span className="text-[10px] text-gray-400 font-bold italic truncate max-w-[120px]">{o.paymentLog}</span>
                                   </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-gray-300 italic font-bold">결제 정보 없음</span>
                              )}
                           </td>
                           <td className="px-8 py-6 text-right font-black text-lg italic text-gray-900">₩{o.price.toLocaleString()}</td>
                           <td className="px-8 py-6 text-center">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic shadow-sm transition-all ${
                                o.status === '완료' ? 'bg-green-500 text-white' :
                                o.status === '양도진행중' ? 'bg-indigo-600 text-white animate-pulse' :
                                o.status === 'refunded' ? 'bg-red-100 text-red-500' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                                {o.status === 'refunded' ? '환불완료' : o.status}
                              </span>
                           </td>
                           <td className="px-8 py-6 text-center">
                              {o.status !== 'refunded' && o.paymentId ? (
                                <button
                                  onClick={() => handleRefund(o)}
                                  disabled={refundingOrderId === o.id}
                                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-[11px] font-black hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {refundingOrderId === o.id ? '처리중...' : '결제취소'}
                                </button>
                              ) : (
                                <span className="text-[11px] text-gray-300 italic">-</span>
                              )}
                           </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* 결제 상세 모달 */}
      {selectedOrderForPayment && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[48px] p-10 shadow-2xl space-y-10 animate-in zoom-in-95 relative overflow-hidden border-4 border-indigo-50">
              <div className="flex justify-between items-center">
                 <h4 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-indigo-200 underline-offset-8 px-2">Payment Details</h4>
                 <button onClick={() => setSelectedOrderForPayment(null)} className="text-gray-300 hover:text-gray-900 font-black text-2xl transition-colors">✕</button>
              </div>

              <div className="space-y-6">
                 <div className="bg-gray-50 p-6 rounded-[32px] space-y-4 border border-gray-100">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-gray-400 uppercase italic">PortOne Transaction ID</p>
                       <p className="text-xl font-black text-indigo-600 tracking-tight">{selectedOrderForPayment.paymentId}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase italic">Method</p>
                          <p className="font-black text-gray-800 italic uppercase">{selectedOrderForPayment.paymentMethod}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase italic">Currency</p>
                          <p className="font-black text-gray-800">KRW (₩)</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3 px-4">
                    <h5 className="text-[12px] font-black text-gray-400 uppercase tracking-widest italic">Gateway Log:</h5>
                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-[13px] font-bold text-indigo-900 leading-relaxed italic">
                       {selectedOrderForPayment.paymentLog}
                    </div>
                 </div>

                 <div className="bg-[#F9FAFB] p-6 rounded-[32px] space-y-3">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-black text-gray-400 uppercase italic tracking-widest">Amount Paid</span>
                       <span className={`text-2xl font-black italic tracking-tighter ${selectedOrderForPayment.status === 'refunded' ? 'text-red-400 line-through' : 'text-gray-900'}`}>₩{selectedOrderForPayment.price.toLocaleString()}</span>
                    </div>
                    {selectedOrderForPayment.status === 'refunded' ? (
                      <div className="flex justify-between items-center text-[11px] font-bold text-red-500">
                         <span className="uppercase italic tracking-widest">Gateway Status</span>
                         <span className="font-black italic uppercase">CANCELLED & REFUNDED ✕</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[11px] font-bold text-green-500">
                         <span className="uppercase italic tracking-widest">Gateway Status</span>
                         <span className="font-black italic uppercase">PAID & VERIFIED ✓</span>
                      </div>
                    )}
                 </div>
              </div>

              <button 
                 onClick={() => setSelectedOrderForPayment(null)}
                 className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-lg hover:bg-indigo-600 transition-all shadow-xl italic tracking-widest active:scale-95"
              >
                 확인 완료
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChannelAdmin;
