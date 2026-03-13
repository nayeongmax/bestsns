import React, { useState, useRef } from 'react';

/* ──────────────── 타입 & 데이터 ──────────────── */
interface QuoteItem {
  service: string;
  description: string;
  quantity: number;
  unitPrice: number;
  duration: string;
}

interface QuoteData {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  industry: string;
  industryImage: string | null;
  items: QuoteItem[];
  notes: string;
}

const SERVICE_OPTIONS = [
  { value: '카페 활성화', label: '카페 활성화', basePrice: 300000, icon: '☕' },
  { value: '블로그 체험단', label: '블로그 체험단', basePrice: 500000, icon: '✍️' },
  { value: '블로그 대행', label: '블로그 대행', basePrice: 800000, icon: '📝' },
  { value: '유튜브 대행', label: '유튜브 대행', basePrice: 1500000, icon: '🎬' },
  { value: '유튜브 활성화', label: '유튜브 활성화', basePrice: 500000, icon: '📺' },
  { value: '인스타 대행', label: '인스타 대행', basePrice: 800000, icon: '📸' },
  { value: '인스타 활성화', label: '인스타 활성화', basePrice: 300000, icon: '💜' },
  { value: '롱폼 제작', label: '롱폼 제작', basePrice: 2000000, icon: '🎞️' },
  { value: '숏폼 제작', label: '숏폼 제작', basePrice: 500000, icon: '⚡' },
  { value: '사이트 제작', label: '사이트 제작', basePrice: 3000000, icon: '🌐' },
  { value: '언론 홍보', label: '언론 홍보', basePrice: 500000, icon: '📰' },
];

const INDUSTRY_OPTIONS = ['뷰티/화장품', '의료/건강', '교육', '요식업', 'IT/스타트업', '부동산', '패션/의류', '금융', '여행/레저', '기타'];

const DURATION_OPTIONS = ['1개월', '3개월', '6개월', '12개월'];

/* ──────────────── 예상 분석 데이터 생성 ──────────────── */
function generateAnalysis(items: QuoteItem[]) {
  const analysis: { label: string; before: string; after: string; growth: string }[] = [];
  for (const item of items) {
    const svc = item.service;
    if (svc.includes('카페')) {
      analysis.push({ label: '카페 일 방문자', before: '50명', after: '500명+', growth: '+900%' });
      analysis.push({ label: '카페 게시글', before: '20개', after: '200개+', growth: '+900%' });
    }
    if (svc.includes('블로그') && svc.includes('체험')) {
      analysis.push({ label: '블로그 체험 리뷰', before: '0건', after: '30건+/월', growth: 'NEW' });
      analysis.push({ label: '키워드 상위 노출', before: '없음', after: '상위 5위 이내', growth: 'TOP5' });
    }
    if (svc.includes('블로그') && svc.includes('대행')) {
      analysis.push({ label: '월 포스팅 수', before: '0건', after: '20건+', growth: 'NEW' });
      analysis.push({ label: '블로그 방문자', before: '100명', after: '3,000명+', growth: '+2,900%' });
    }
    if (svc.includes('유튜브') && svc.includes('대행')) {
      analysis.push({ label: '월 영상 업로드', before: '0건', after: '8건+', growth: 'NEW' });
      analysis.push({ label: '채널 구독자', before: '100명', after: '5,000명+', growth: '+4,900%' });
    }
    if (svc.includes('유튜브') && svc.includes('활성화')) {
      analysis.push({ label: '영상 조회수', before: '100회', after: '10,000회+', growth: '+9,900%' });
    }
    if (svc.includes('인스타') && svc.includes('대행')) {
      analysis.push({ label: '월 게시물', before: '0건', after: '20건+', growth: 'NEW' });
      analysis.push({ label: '인스타 도달률', before: '500명', after: '50,000명+', growth: '+9,900%' });
    }
    if (svc.includes('인스타') && svc.includes('활성화')) {
      analysis.push({ label: '팔로워', before: '200명', after: '5,000명+', growth: '+2,400%' });
    }
    if (svc.includes('롱폼')) {
      analysis.push({ label: '브랜드 영상', before: '0건', after: `${item.quantity}건`, growth: 'NEW' });
    }
    if (svc.includes('숏폼')) {
      analysis.push({ label: '숏폼 콘텐츠', before: '0건', after: `${item.quantity * 4}건+/월`, growth: 'NEW' });
    }
    if (svc.includes('사이트')) {
      analysis.push({ label: '웹사이트 전환율', before: '1.2%', after: '4.5%+', growth: '+275%' });
    }
    if (svc.includes('언론')) {
      analysis.push({ label: '언론 기사 수', before: '0건', after: `${item.quantity * 5}건+`, growth: 'NEW' });
    }
  }
  // 중복 제거
  const unique = analysis.filter((a, i) => analysis.findIndex(b => b.label === a.label) === i);
  return unique.length > 0 ? unique : [
    { label: '예상 유입 증가', before: '-', after: '데이터 분석 중', growth: '-' },
  ];
}

/* ──────────────── 컴포넌트 ──────────────── */
const QuoteBuilder: React.FC = () => {
  const [quote, setQuote] = useState<QuoteData>({
    companyName: '', contactName: '', phone: '', email: '', industry: '',
    industryImage: null, items: [{ service: '카페 활성화', description: '', quantity: 1, unitPrice: 300000, duration: '1개월' }],
    notes: '',
  });
  const [step, setStep] = useState(0); // 0: 정보, 1: 서비스, 2: 미리보기
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const totalAmount = quote.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const updateItem = (idx: number, field: keyof QuoteItem, value: string | number) => {
    setQuote(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'service') {
        const opt = SERVICE_OPTIONS.find(o => o.value === value);
        if (opt) items[idx].unitPrice = opt.basePrice;
      }
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setQuote(prev => ({
      ...prev,
      items: [...prev.items, { service: '카페 활성화', description: '', quantity: 1, unitPrice: 300000, duration: '1개월' }],
    }));
  };

  const removeItem = (idx: number) => {
    if (quote.items.length <= 1) return;
    setQuote(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setQuote(prev => ({ ...prev, industryImage: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    window.print();
  };

  /* ── 스텝 0: 기본 정보 ── */
  const renderInfoStep = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-black">1</span>
        기본 정보
      </h3>
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">업체명 *</label>
          <input type="text" value={quote.companyName} onChange={e => setQuote({ ...quote, companyName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" placeholder="회사/브랜드명 입력" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">담당자명</label>
          <input type="text" value={quote.contactName} onChange={e => setQuote({ ...quote, contactName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" placeholder="담당자 성함" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">연락처</label>
          <input type="tel" value={quote.phone} onChange={e => setQuote({ ...quote, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" placeholder="010-0000-0000" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
          <input type="email" value={quote.email} onChange={e => setQuote({ ...quote, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" placeholder="email@example.com" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">업종</label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map(ind => (
            <button key={ind} onClick={() => setQuote({ ...quote, industry: ind })}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${quote.industry === ind ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-600'}`}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">업종 관련 이미지 (선택)</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-amber-300 transition-colors text-gray-400 hover:text-amber-500">
          {quote.industryImage ? (
            <img src={quote.industryImage} alt="업종 이미지" className="max-h-32 mx-auto rounded-xl object-cover" />
          ) : (
            <div className="text-center">
              <div className="text-3xl mb-2">📷</div>
              <div className="text-sm">클릭하여 이미지 업로드</div>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  /* ── 스텝 1: 서비스 선택 ── */
  const renderServiceStep = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-black">2</span>
        작업 내용
      </h3>

      {quote.items.map((item, idx) => (
        <div key={idx} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4 relative group">
          {quote.items.length > 1 && (
            <button onClick={() => removeItem(idx)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-sm hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100">✕</button>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">서비스</label>
              <select value={item.service} onChange={e => updateItem(idx, 'service', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-white">
                {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">기간</label>
              <select value={item.duration} onChange={e => updateItem(idx, 'duration', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all bg-white">
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">수량</label>
              <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">단가 (원)</label>
              <input type="number" min={0} step={10000} value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">상세 설명</label>
            <textarea value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all resize-none h-20" placeholder="작업 내용을 상세히 입력하세요" />
          </div>
          <div className="text-right text-sm font-bold text-amber-600">
            소계: {(item.unitPrice * item.quantity).toLocaleString()}원
          </div>
        </div>
      ))}

      <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-amber-300 hover:text-amber-500 font-medium transition-all">
        + 서비스 추가
      </button>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">비고 / 추가 요청사항</label>
        <textarea value={quote.notes} onChange={e => setQuote({ ...quote, notes: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all resize-none h-24" placeholder="추가 사항을 입력해 주세요" />
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">총 견적 금액</span>
          <span className="text-2xl font-black text-amber-600">{totalAmount.toLocaleString()}원</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">* VAT 별도</p>
      </div>
    </div>
  );

  /* ── 스텝 2: 미리보기 (인쇄 가능한 견적서) ── */
  const analysis = generateAnalysis(quote.items);

  const renderPreview = () => (
    <div ref={printRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden print:border-none print:rounded-none">
      {/* 견적서 헤더 */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-8 print:p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black mb-1">견 적 서</h2>
            <p className="text-amber-100 text-sm">QUOTATION</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-black">THE BEST 마케팅</div>
            <div className="text-amber-100 text-sm">발행일: {new Date().toLocaleDateString('ko-KR')}</div>
          </div>
        </div>
      </div>

      <div className="p-8 print:p-6 space-y-8">
        {/* 고객 정보 */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 border-b-2 border-amber-400 pb-1 inline-block">수신</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-3"><span className="text-gray-500 w-16">업체명</span><span className="font-medium text-gray-900">{quote.companyName || '-'}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-16">담당자</span><span className="font-medium text-gray-900">{quote.contactName || '-'}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-16">연락처</span><span className="font-medium text-gray-900">{quote.phone || '-'}</span></div>
              <div className="flex gap-3"><span className="text-gray-500 w-16">업종</span><span className="font-medium text-gray-900">{quote.industry || '-'}</span></div>
            </div>
          </div>
          {quote.industryImage && (
            <div className="flex justify-end">
              <img src={quote.industryImage} alt="업종 이미지" className="max-h-32 rounded-xl object-cover border border-gray-200" />
            </div>
          )}
        </div>

        {/* 견적 내역 테이블 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b-2 border-amber-400 pb-1 inline-block mb-4">견적 내역</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left px-4 py-3 font-semibold rounded-tl-xl">No.</th>
                  <th className="text-left px-4 py-3 font-semibold">서비스</th>
                  <th className="text-left px-4 py-3 font-semibold">기간</th>
                  <th className="text-right px-4 py-3 font-semibold">수량</th>
                  <th className="text-right px-4 py-3 font-semibold">단가</th>
                  <th className="text-right px-4 py-3 font-semibold rounded-tr-xl">금액</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.service}</div>
                      {item.description && <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.duration}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.unitPrice.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{(item.unitPrice * item.quantity).toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-amber-50 to-orange-50">
                  <td colSpan={5} className="px-4 py-4 font-bold text-gray-900 text-right rounded-bl-xl">합계 (VAT 별도)</td>
                  <td className="px-4 py-4 text-right font-black text-amber-600 text-lg rounded-br-xl">{totalAmount.toLocaleString()}원</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 예상 성과 분석 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b-2 border-amber-400 pb-1 inline-block mb-4">작업 후 예상 성과 분석</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {analysis.map((a, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-50 to-amber-50/30 rounded-xl p-4 border border-gray-100">
                <div className="text-xs text-gray-500 mb-2 font-semibold">{a.label}</div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400 line-through">{a.before}</div>
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  <div className="text-sm font-bold text-gray-900">{a.after}</div>
                  <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{a.growth}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {quote.notes && (
          <div>
            <h3 className="font-bold text-gray-900 border-b-2 border-amber-400 pb-1 inline-block mb-3">비고</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* 서명란 */}
        <div className="border-t-2 border-gray-100 pt-6 grid sm:grid-cols-2 gap-8">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-8">발행처</p>
            <div className="border-t border-gray-300 pt-2 mx-8">
              <p className="font-bold text-gray-900">THE BEST 마케팅</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-8">수신처</p>
            <div className="border-t border-gray-300 pt-2 mx-8">
              <p className="font-bold text-gray-900">{quote.companyName || '_______________'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFDF7] via-[#FFF8EC] to-white">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/marketing" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-xs">B</div>
            <span className="font-black text-sm">
              <span className="text-amber-600">THE BEST</span> 마케팅
            </span>
          </a>
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={handlePrint} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors print:hidden">
                🖨️ 인쇄 / PDF
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 print:py-0 print:px-0 print:max-w-none">
        {/* 진행 바 */}
        <div className="flex items-center gap-3 mb-10 print:hidden">
          {['기본 정보', '서비스 선택', '견적서 미리보기'].map((label, i) => (
            <React.Fragment key={i}>
              <button onClick={() => setStep(i)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${step === i ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : step > i ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-black">{step > i ? '✓' : i + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < 2 && <div className={`flex-1 h-0.5 rounded-full ${step > i ? 'bg-amber-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-none print:p-0 print:rounded-none">
          {step === 0 && renderInfoStep()}
          {step === 1 && renderServiceStep()}
          {step === 2 && renderPreview()}
        </div>

        {/* 네비게이션 */}
        <div className="flex justify-between mt-8 print:hidden">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
              ← 이전
            </button>
          ) : <a href="/marketing" className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">← 랜딩페이지로</a>}
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              다음 →
            </button>
          ) : (
            <button onClick={handlePrint} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              🖨️ 인쇄 / PDF 저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteBuilder;
