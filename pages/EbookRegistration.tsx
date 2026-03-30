
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EbookProduct, EbookTier, UserProfile, StoreType } from '../types';
import { EBOOK_CATEGORIES, MARKETING_CATEGORIES } from '../constants';
import { upsertStoreProduct, upsertStoreProductAdmin } from '../storeDb';

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

  const editingEbook = location.state?.ebook as EbookProduct | undefined;
  const initialStoreTypeFromState = location.state?.selectedStoreType as StoreType | undefined;

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin' && user.sellerStatus !== 'approved') {
      alert('판매자 등록 후 이용 가능합니다.');
      navigate('/mypage', { state: { activeTab: 'seller' }, replace: true });
    }
  }, [user, navigate]);

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

  const compressImage = (file: File, isThumbnail: boolean = false): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = isThumbnail ? 400 : 800;
          const quality = isThumbnail ? 0.5 : 0.45;
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
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
      };
    });
  };

  useEffect(() => {
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
      const selectedFiles = Array.from(files).slice(0, 5 - attachedImages.length);
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

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSaving(true);
    try {
      // 썸네일/이미지 유실 방지: 로컬 상태 업데이트 전에 Supabase에 직접 저장
      if (user.role === 'admin') {
        await upsertStoreProductAdmin(newEbook);
      } else {
        await upsertStoreProduct(newEbook);
      }
    } catch (err) {
      console.warn('상품 Supabase 저장 실패 (로컬에는 저장됨):', err);
    } finally {
      setIsSaving(false);
    }

    setEbooks(prev => {
      const filtered = prev.filter(eb => eb.id !== newEbook.id);
      return [...filtered, newEbook];
    });

    setShowSuccessModal(true);
  };

  const handleModalConfirm = () => {
    setShowSuccessModal(false);
    navigate('/ebooks');
  };

  const isDigitalType = storeType === 'template' || storeType === 'ebook';
  const isServiceType = ['marketing', 'lecture', 'consulting'].includes(storeType);

  return (
    <div className="max-w-4xl mx-auto pb-24 px-4">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-semibold text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          돌아가기
        </button>
        <div className="flex-1" />
        <h2 className="text-xl font-bold text-gray-900">N잡스토어 서비스 등록</h2>
        <div className="flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 섹션 0: 판매 유형 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800 text-base">판매 유형 선택</h3>
            <p className="text-sm text-gray-500 mt-0.5">등록할 서비스의 유형을 선택해 주세요</p>
          </div>
          <div className="p-6">
            <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0" style={{scrollbarWidth: 'none'}}>
              {STORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStoreType(tab.id)}
                  className={`flex flex-col items-center justify-center py-4 px-4 rounded-xl border-2 transition-all duration-200 flex-shrink-0 min-w-[72px] md:flex-shrink md:min-w-0 ${
                    storeType === tab.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <span className="text-2xl mb-2">{tab.icon}</span>
                  <span className="font-semibold text-sm whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 섹션 1: 분류 및 제목 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800 text-base">상세 분류 및 제목</h3>
            <p className="text-sm text-gray-500 mt-0.5">서비스가 속하는 카테고리와 제목을 입력해 주세요</p>
          </div>
          <div className="p-6 space-y-4">
            <div className={`grid gap-4 ${storeType === 'marketing' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">카테고리 (채널)</label>
                {storeType === 'marketing' ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                  >
                    {Object.keys(MARKETING_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                  >
                    {EBOOK_CATEGORIES.filter(c => c !== '전체').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              {storeType === 'marketing' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">상세 서비스 (소분류)</label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-lg font-medium text-rose-700 outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400 transition-all"
                  >
                    {MARKETING_CATEGORIES[category as keyof typeof MARKETING_CATEGORIES]?.filter(s => s !== '전체').map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">서비스 제목</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${STORE_TABS.find(t => t.id === storeType)?.label} 서비스의 제목을 입력하세요`}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* 섹션 2: 패키지 및 가격 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-800 text-base">패키지 및 가격 설정</h3>
              {tiers.length < 3 && (
                <button
                  type="button"
                  onClick={addTier}
                  className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
                >
                  + 패키지 추가
                </button>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 whitespace-nowrap">최대 3개의 가격 패키지를 구성할 수 있습니다</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {tiers.map((tier, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4 relative">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors text-sm font-semibold"
                    >
                      삭제
                    </button>
                  )}
                  <div className="text-center">
                    <span className="inline-block px-5 py-1.5 bg-blue-600 text-white rounded-full font-bold text-xs tracking-wider">
                      {tier.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">판매가 (원)</label>
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) => updateTier(idx, 'price', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500">
                        {isDigitalType ? '분량 (페이지)' : '작업 기간 (일)'}
                      </label>
                      <input
                        type="number"
                        value={tier.pageCount}
                        onChange={(e) => updateTier(idx, 'pageCount', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg font-semibold text-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500">포함 서비스 내용</label>
                    <textarea
                      value={tier.description}
                      onChange={(e) => updateTier(idx, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none leading-relaxed"
                      placeholder="예: 무제한 피드백 + 강의 자료 제공"
                      required
                    />
                  </div>
                  {isDigitalType && (
                    <div className="space-y-1.5 pt-2 border-t border-gray-200">
                      <label className="text-xs font-semibold text-blue-600">원본 / 참고자료 업로드</label>
                      <div className="relative">
                        <input
                          type="file"
                          className="opacity-0 absolute inset-0 cursor-pointer z-10"
                          onChange={(e) => handleTierFileChange(idx, e)}
                        />
                        <div className="w-full py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg flex items-center justify-center gap-2 text-blue-500 text-xs font-semibold hover:bg-blue-100 transition-colors">
                          <span>📁</span>
                          <span>{tier.pdfFile ? '업로드 완료' : 'PDF, ZIP, MP4 파일 선택'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 섹션 3: 서비스 상세 설명 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800 text-base">서비스 상세 설명</h3>
            <p className="text-sm text-gray-500 mt-0.5">서비스의 특징과 제공 내용을 구체적으로 작성해 주세요</p>
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">상세 설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all resize-none leading-relaxed"
                required
              />
            </div>

            {isServiceType && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">서비스 제공 방법 및 절차</label>
                <textarea
                  value={serviceMethod}
                  onChange={(e) => setServiceMethod(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all resize-none leading-relaxed"
                  placeholder="예: 1. 상담 진행 → 2. 견적서 발송 → 3. 작업 시작 → 4. 결과물 전달"
                  required
                />
              </div>
            )}

            {isDigitalType && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">커리큘럼 / 목차 구성</label>
                <textarea
                  value={index}
                  onChange={(e) => setIndex(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all resize-none leading-relaxed"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* 섹션 4: FAQ */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-base">자주 묻는 질문 (FAQ)</h3>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">구매자가 자주 물어보는 내용을 미리 정리해 주세요</p>
            </div>
            <button
              type="button"
              onClick={addFaq}
              className="bg-amber-400 text-gray-900 px-3 md:px-4 py-2 rounded-lg font-semibold text-sm hover:bg-amber-500 transition-colors whitespace-nowrap flex-shrink-0"
            >
              + 질문 추가
            </button>
          </div>
          <div className="p-6 space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeFaq(idx)}
                  className="absolute top-4 right-5 text-gray-400 hover:text-red-500 transition-colors text-sm"
                >
                  ✕
                </button>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">질문 (Q)</label>
                  <input
                    value={faq.question}
                    onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                    placeholder="자주 묻는 질문을 입력하세요"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">답변 (A)</label>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                    placeholder="질문에 대한 답변을 상세히 입력해 주세요"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-600 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 섹션 5: 미디어 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-base">미디어 등록</h3>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">대표 썸네일 1장과 상세 이미지를 최대 5장까지 등록할 수 있습니다</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-800 text-white px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm hover:bg-gray-900 transition-colors whitespace-nowrap"
              >
                썸네일 등록
              </button>
              <button
                type="button"
                onClick={() => multiFileInputRef.current?.click()}
                className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold text-xs md:text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                상세이미지 추가
              </button>
            </div>
          </div>
          <div className="p-6">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'thumb')} />
            <input type="file" ref={multiFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleFileChange(e, 'multi')} />

            {!thumbnail && attachedImages.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center justify-center gap-2 text-gray-400">
                <span className="text-3xl">🖼️</span>
                <p className="text-sm font-medium">썸네일과 상세 이미지를 등록해 주세요</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-6 md:overflow-visible md:pb-0" style={{scrollbarWidth: 'none'}}>
                {thumbnail && (
                  <div className="relative flex-shrink-0 w-24 h-32 md:w-auto md:h-auto md:aspect-[3/4] rounded-xl overflow-hidden border-4 border-blue-500 shadow-md group">
                    <img src={thumbnail} className="w-full h-full object-cover" alt="thumbnail" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button
                        type="button"
                        onClick={() => setThumbnail('')}
                        className="text-white font-semibold text-xs bg-black/50 px-3 py-1.5 rounded-lg"
                      >
                        교체
                      </button>
                    </div>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">대표</span>
                  </div>
                )}
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative flex-shrink-0 w-24 h-32 md:w-auto md:h-auto md:aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 shadow-sm group">
                    <img src={img} className="w-full h-full object-cover" alt={`detail-${i}`} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => moveImage(i, 'up')} className="bg-white text-gray-900 p-1.5 rounded-lg text-xs">◀</button>
                        <button type="button" onClick={() => moveImage(i, 'down')} className="bg-white text-gray-900 p-1.5 rounded-lg text-xs">▶</button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachedImages(attachedImages.filter((_, idx) => idx !== i))}
                        className="text-red-400 font-semibold text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? '저장 중...' : (editingEbook ? '서비스 정보 수정 완료' : '서비스 등록 신청')}
        </button>
      </form>

      {/* 등록 완료 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center space-y-6 border border-gray-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl mx-auto flex items-center justify-center text-3xl">
              📝
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-gray-900">서비스 등록 신청 완료</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                정보 일치성과 광고성 내용 등을 검토한 후,
                <br />
                <span className="text-blue-600 font-semibold">2~3일 이내</span>에 서비스 등록이 완료됩니다.
              </p>
            </div>
            <button
              onClick={handleModalConfirm}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-blue-600 transition-all"
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
