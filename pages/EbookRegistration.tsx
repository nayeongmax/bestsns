
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EbookProduct, EbookTier, UserProfile, StoreType } from '../types';
import { EBOOK_CATEGORIES, MARKETING_CATEGORIES } from '../constants';

interface Props {
  user: UserProfile;
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
}

const STORE_TABS: { id: StoreType; label: string; icon: string }[] = [
  { id: 'marketing', label: '마케팅', icon: '📢' },
  { id: 'lecture', label: '강의', icon: '🎓' },
  { id: 'consulting', label: '컨설팅', icon: '🤝' },
  { id: 'template', label: '자료·템플릿', icon: '📁' },
  { id: 'ebook', label: '전자책', icon: '📖' },
];

const EbookRegistration: React.FC<Props> = ({ user, setEbooks }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 전달된 상태값 확인 (수정 모드 또는 메인에서 선택한 타입)
  const editingEbook = location.state?.ebook as EbookProduct | undefined;
  const initialStoreTypeFromState = location.state?.selectedStoreType as StoreType | undefined;

  // 모달 상태 추가
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 진입 권한 체크 (URL 직접 입력 차단)
  useEffect(() => {
    if (user.role !== 'admin' && user.sellerStatus !== 'approved') {
      alert('판매자 등록 후 이용 가능합니다.');
      navigate('/mypage', { state: { activeTab: 'seller' }, replace: true });
    }
  }, [user, navigate]);

  // 판매 유형 초기값 설정: 1. 수정중인 상품 정보, 2. 메인에서 클릭한 타입 정보, 3. 기본값 'ebook'
  const [storeType, setStoreType] = useState<StoreType>(
    editingEbook?.storeType || initialStoreTypeFromState || 'ebook'
  );
  
  const [title, setTitle] = useState(editingEbook?.title || '');
  const [category, setCategory] = useState(editingEbook?.category || EBOOK_CATEGORIES[1]);
  const [subCategory, setSubCategory] = useState(editingEbook?.subCategory || '전체');
  
  const [description, setDescription] = useState(editingEbook?.description || '');
  const [index, setIndex] = useState(editingEbook?.index || '');
  const [serviceMethod, setServiceMethod] = useState(editingEbook?.serviceMethod || '');
  const [faqs, setFaqs] = useState<{question: string, answer: string}[]>(editingEbook?.faqs || [
    { question: '', answer: '' }
  ]);
  const [tiers, setTiers] = useState<EbookTier[]>(editingEbook?.tiers || [
    { name: 'LITE', price: 0, description: '', pageCount: 0 }
  ]);
  const [thumbnail, setThumbnail] = useState(editingEbook?.thumbnail || '');
  const [attachedImages, setAttachedImages] = useState<string[]>(editingEbook?.attachedImages || []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  const packageNames = ['LITE', 'STANDARD', 'MASTER'];

  // 이미지 압축 유틸리티
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
          resolve(canvas.toDataURL('image/jpeg', 0.6)); 
        };
      };
    });
  };

  useEffect(() => {
    // 상품 수정이 아닐 때만 카테고리 기본값 자동 조정
    if (!editingEbook) {
      if (storeType === 'marketing') {
        setCategory('블로그');
        setSubCategory('블로그 대행');
      } else {
        setCategory(EBOOK_CATEGORIES[1]);
        setSubCategory('전체');
      }
    }
  }, [storeType, editingEbook]);
  
  const addTier = () => {
    if (tiers.length >= 3) return;
    setTiers([...tiers, { name: packageNames[tiers.length], price: 0, description: '', pageCount: 0 }]);
  };
  
  const removeTier = (idx: number) => {
    const updated = tiers.filter((_, i) => i !== idx).map((t, i) => ({ ...t, name: packageNames[i] }));
    setTiers(updated);
  };
  
  const updateTier = (idx: number, key: keyof EbookTier, val: any) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [key]: val };
    setTiers(updated);
  };

  const handleTierFileChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] as globalThis.Blob | undefined;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        updateTier(idx, 'pdfFile', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'thumb' | 'multi') => {
    const files = e.target.files;
    if (!files) return;
    
    if (target === 'thumb') {
      const compressedThumb = await compressImage(files[0] as File, true);
      setThumbnail(compressedThumb);
    } else {
      const selectedFiles = Array.from(files).slice(0, 10 - attachedImages.length);
      for (const file of selectedFiles) {
        const compressedImg = await compressImage(file as File);
        setAttachedImages(prev => [...prev, compressedImg]);
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

  const addFaq = () => setFaqs([...faqs, { question: '', answer: '' }]);
  const removeFaq = (idx: number) => setFaqs(faqs.filter((_, i) => i !== idx));
  const updateFaq = (idx: number, key: 'question' | 'answer', val: string) => {
    const updated = [...faqs];
    updated[idx][key] = val;
    setFaqs(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumbnail) {
      alert('대표 썸네일 이미지는 필수입니다.');
      return;
    }
    const newEbook: EbookProduct = {
      id: editingEbook?.id || `eb_${Date.now()}`,
      storeType,
      title,
      category,
      subCategory,
      author: user.nickname,
      authorId: user.id,
      thumbnail,
      price: tiers[0].price,
      tiers,
      description,
      index: (storeType === 'template' || storeType === 'ebook') ? index : undefined,
      serviceMethod: (storeType === 'marketing' || storeType === 'lecture' || storeType === 'consulting') ? serviceMethod : undefined,
      faqs: faqs.filter(f => f.question.trim() && f.answer.trim()),
      attachedImages,
      status: 'pending',
      createdAt: editingEbook?.createdAt || new Date().toISOString(),
    };

    setEbooks(prev => {
      const filtered = prev.filter(eb => eb.id !== newEbook.id);
      return [...filtered, newEbook];
    });
    
    // 성공 모달 표시
    setShowSuccessModal(true);
  };

  const handleModalConfirm = () => {
    setShowSuccessModal(false);
    navigate('/ebooks'); // N잡스토어 페이지로 이동
  };

  const isDigitalType = storeType === 'template' || storeType === 'ebook';
  const isServiceType = ['marketing', 'lecture', 'consulting'].includes(storeType);

  return (
    <div className="max-w-7xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-12 px-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          돌아가기
        </button>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter italic uppercase underline decoration-blue-500 underline-offset-8">
           N잡스토어 서비스 등록
        </h2>
        <div className="w-20"></div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-12 lg:p-16 rounded-[60px] shadow-2xl border border-gray-100 space-y-20 mx-4">
        {/* 0. 판매 유형 선택 */}
        <section className="space-y-10">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-lg shadow-blue-100"></div>
             <h3 className="text-2xl font-black text-gray-900 italic">0. 판매 유형을 선택해 주세요</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {STORE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStoreType(tab.id)}
                className={`flex flex-col items-center justify-center p-8 rounded-[32px] border-4 transition-all duration-300 ${
                  storeType === tab.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200'
                  : 'bg-gray-50 border-transparent text-gray-400 hover:bg-white hover:border-gray-100'
                }`}
              >
                <span className="text-3xl mb-3">{tab.icon}</span>
                <span className="font-black italic">{tab.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-10">
          <div className="flex items-center gap-4">
             <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
             <h3 className="text-2xl font-black text-gray-900">1. 상세 분류 및 제목</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <div className="space-y-3">
              <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-2 italic">카테고리 (채널)</label>
              {storeType === 'marketing' ? (
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-700 outline-none text-lg shadow-inner">
                  {Object.keys(MARKETING_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              ) : (
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-700 outline-none text-lg shadow-inner">
                  {EBOOK_CATEGORIES.filter(c => c !== '전체').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
            </div>

            {storeType === 'marketing' && (
              <div className="space-y-3">
                <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-2 italic">상세 서비스 (소분류)</label>
                <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className="w-full p-6 bg-rose-50 border-none rounded-[32px] font-black text-rose-700 outline-none text-lg shadow-inner">
                  {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]?.filter(s => s !== '전체').map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              </div>
            )}

            <div className={`space-y-3 ${storeType === 'marketing' ? 'col-span-1 lg:col-span-1' : 'col-span-1 lg:col-span-2'}`}>
              <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-2 italic">서비스 제목</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${STORE_TABS.find(t=>t.id===storeType)?.label}의 제목을 입력하세요`} className="w-full p-6 bg-gray-50 border-none rounded-[32px] font-black text-gray-800 text-lg shadow-inner outline-none focus:ring-4 focus:ring-blue-50" required />
            </div>
          </div>
        </section>

        <section className="space-y-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
               <h3 className="text-2xl font-black text-gray-900">2. 패키지 및 가격 설정</h3>
            </div>
            {tiers.length < 3 && (
              <button type="button" onClick={addTier} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl">+ 패키지 추가</button>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {tiers.map((tier, idx) => (
              <div key={idx} className="bg-gray-50/50 p-10 rounded-[48px] border-4 border-transparent hover:border-blue-100 transition-all space-y-8 relative group">
                {idx > 0 && <button type="button" onClick={() => removeTier(idx)} className="absolute top-6 right-8 text-red-400 hover:text-red-600 font-black text-sm">삭제</button>}
                <div className="text-center">
                  <span className="inline-block px-8 py-2 bg-blue-600 text-white rounded-full font-black text-sm italic tracking-widest mb-6 shadow-md">{tier.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">판매가(원)</label>
                    <input type="number" value={tier.price} onChange={(e) => updateTier(idx, 'price', Number(e.target.value))} className="w-full p-5 bg-white border-none rounded-2xl font-black text-gray-900 shadow-sm" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">
                      {isDigitalType ? '분량(P)' : '작업일수'}
                    </label>
                    <input type="number" value={tier.pageCount} onChange={(e) => updateTier(idx, 'pageCount', Number(e.target.value))} className="w-full p-5 bg-white border-none rounded-2xl font-black text-gray-900 shadow-sm" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">제공 서비스 상세 (+ 구분)</label>
                  <textarea value={tier.description} onChange={(e) => updateTier(idx, 'description', e.target.value)} rows={4} className="w-full p-5 bg-white border-none rounded-2xl font-bold text-gray-600 text-xs shadow-sm resize-none" placeholder="예: 무제한 피드백 + 강의자료 제공" required />
                </div>
                {isDigitalType && (
                  <div className="pt-6 border-t border-gray-100">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-2 px-2 italic">원본/참고자료 업로드</label>
                    <div className="relative group/file">
                      <input 
                        type="file" 
                        className="opacity-0 absolute inset-0 cursor-pointer z-10" 
                        onChange={(e) => handleTierFileChange(idx, e)}
                      />
                      <div className="w-full py-5 bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-blue-400 text-xs font-black transition-colors group-hover/file:bg-blue-100">
                         <span className="text-xl">📁</span> 
                         <span className="truncate max-w-[200px]">{tier.pdfFile ? '업로드 완료' : '파일 선택 (PDF, ZIP, MP4)'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-12">
          <div className="space-y-3">
             <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-6 italic">서비스 상세 설명</label>
             <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={10} className="w-full p-10 bg-gray-50 border-none rounded-[48px] font-bold text-gray-700 shadow-inner outline-none resize-none leading-relaxed focus:bg-white focus:ring-4 focus:ring-blue-50" required />
          </div>

          {isServiceType && (
            <div className="space-y-3 pt-12">
               <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-6 italic">서비스 제공 방법 및 절차</label>
               <textarea value={serviceMethod} onChange={(e) => setServiceMethod(e.target.value)} rows={8} className="w-full p-10 bg-gray-50 border-none rounded-[48px] font-bold text-gray-700 shadow-inner outline-none resize-none leading-relaxed focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="예: 1. 상담진행 -> 2. 견적서 발송 -> 3. 작업 시작 -> 4. 결과물 전달" required />
            </div>
          )}

          {isDigitalType && (
            <div className="space-y-3 pt-12">
               <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest px-6 italic">커리큘럼 / 구성</label>
               <textarea value={index} onChange={(e) => setIndex(e.target.value)} rows={8} className="w-full p-10 bg-gray-50 border-none rounded-[48px] font-bold text-gray-700 shadow-inner outline-none resize-none leading-relaxed focus:bg-white focus:ring-4 focus:ring-blue-50" required />
            </div>
          )}
        </section>

        <section className="space-y-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <div className="w-1.5 h-8 bg-yellow-400 rounded-full"></div>
               <h3 className="text-2xl font-black text-gray-900">3. 자주 묻는 질문 (FAQ)</h3>
            </div>
            <button type="button" onClick={addFaq} className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-2xl font-black text-sm shadow-xl">+ 질문 추가</button>
          </div>
          <div className="space-y-4">
             {faqs.map((faq, idx) => (
               <div key={idx} className="bg-gray-50 p-8 rounded-[32px] border border-gray-100 space-y-4 relative">
                 <button type="button" onClick={() => removeFaq(idx)} className="absolute top-6 right-8 text-gray-300 hover:text-red-500 font-black">✕</button>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 italic">질문 (Q)</label>
                    <input 
                      value={faq.question} 
                      onChange={(e) => updateFaq(idx, 'question', e.target.value)} 
                      placeholder="자주 묻는 질문을 입력하세요"
                      className="w-full p-4 bg-white border-none rounded-xl font-bold text-gray-800 shadow-sm"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 italic">답변 (A)</label>
                    <textarea 
                      value={faq.answer} 
                      onChange={(e) => updateFaq(idx, 'answer', e.target.value)} 
                      placeholder="질문에 대한 답변을 상세히 입력해 주세요"
                      rows={3}
                      className="w-full p-4 bg-white border-none rounded-xl font-bold text-gray-600 shadow-sm resize-none"
                    />
                 </div>
               </div>
             ))}
          </div>
        </section>

        <section className="space-y-10">
          <div className="flex justify-between items-end px-4">
            <h3 className="text-2xl font-black text-gray-900 italic">4. 미디어 (썸네일 및 상세이미지)</h3>
            <div className="flex gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-black transition-colors">썸네일 등록</button>
              <button type="button" onClick={() => multiFileInputRef.current?.click()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all transition-colors">상세이미지 추가</button>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'thumb')} />
          <input type="file" ref={multiFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFileChange(e, 'multi')} />
          
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-8">
            {thumbnail && (
              <div className="relative aspect-[3/4] rounded-[32px] overflow-hidden border-8 border-blue-500 shadow-2xl group transition-transform hover:scale-105">
                <img src={thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                <button type="button" onClick={() => setThumbnail('')} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white font-black">교체</span></button>
              </div>
            )}
            {attachedImages.map((img, i) => (
              <div key={i} className="relative aspect-[3/4] rounded-[32px] overflow-hidden border border-gray-100 shadow-lg group hover:scale-105 transition-all">
                <img src={img} className="w-full h-full object-cover" alt={`detail-${i}`} />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-4 transition-all">
                   <div className="flex gap-2">
                     <button type="button" onClick={() => moveImage(i, 'up')} className="bg-white text-gray-900 p-2.5 rounded-xl">▲</button>
                     <button type="button" onClick={() => moveImage(i, 'down')} className="bg-white text-gray-900 p-2.5 rounded-xl">▼</button>
                   </div>
                   <button type="button" onClick={() => setAttachedImages(attachedImages.filter((_, idx) => idx !== i))} className="text-red-400 font-black text-sm">삭제</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <button type="submit" className="w-full py-10 bg-gray-900 text-white rounded-[40px] font-black text-3xl hover:bg-blue-600 transition-all shadow-2xl uppercase italic tracking-[0.2em]">
          {editingEbook ? '서비스 정보 수정 완료' : '서비스 등록'}
        </button>
      </form>

      {/* 서비스 등록 완료 안내 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 md:p-12 shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-300 border-4 border-blue-50">
             <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner animate-pulse">📝</div>
             <div className="space-y-4">
                <h3 className="text-2xl font-black text-gray-900 italic">서비스 등록 신청 완료</h3>
                <p className="text-[15px] font-bold text-gray-500 leading-relaxed">
                   정보 일치성과 과도한 광고등을 심사 후<br/>
                   <span className="text-blue-600 font-black">2~3일 이내</span> 서비스 등록이 완료됩니다.
                </p>
             </div>
             <button 
               onClick={handleModalConfirm}
               className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-600 transition-all active:scale-95 uppercase italic tracking-widest"
             >
                확인
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EbookRegistration;
