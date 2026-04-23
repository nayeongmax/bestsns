import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'bestsns_guide_seen_v1';

const SECTIONS = [
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect width="48" height="48" rx="14" fill="#EEF2FF"/>
        <rect x="9" y="9" width="30" height="30" rx="8" fill="none" stroke="#6366F1" strokeWidth="2.5"/>
        <circle cx="24" cy="24" r="6" fill="none" stroke="#6366F1" strokeWidth="2.5"/>
        <circle cx="33" cy="15" r="2.2" fill="#6366F1"/>
      </svg>
    ),
    color: 'from-indigo-500 to-purple-600',
    bg: 'bg-indigo-50 border-indigo-100',
    titleColor: 'text-indigo-700',
    tag: '인플루언서 · 브랜드',
    tagColor: 'bg-indigo-100 text-indigo-600',
    title: '마케팅 주문',
    desc: '인스타그램·유튜브·틱톡 등 SNS 계정을 키우고 싶다면',
    detail: '팔로워·구독자·좋아요·조회수 등 다양한 마케팅 서비스를 주문할 수 있어요.',
    badge: null,
    path: '/sns',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect width="48" height="48" rx="14" fill="#FEF2F2"/>
        <rect x="8" y="14" width="32" height="20" rx="5" fill="none" stroke="#EF4444" strokeWidth="2.5"/>
        <polygon points="21,19 21,29 31,24" fill="#EF4444"/>
      </svg>
    ),
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-50 border-red-100',
    titleColor: 'text-red-600',
    tag: '수익화 채널',
    tagColor: 'bg-red-100 text-red-600',
    title: '채널판매',
    desc: '수익화된 유튜브 채널이 필요하다면',
    detail: '운영 중인 유튜브 채널을 사고 팔 수 있어요. 에스크로로 안전하게 거래됩니다.',
    badge: null,
    path: '/channels',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect width="48" height="48" rx="14" fill="#F0FDF4"/>
        <rect x="10" y="16" width="28" height="22" rx="5" fill="none" stroke="#16A34A" strokeWidth="2.5"/>
        <path d="M17 16v-3a7 7 0 0114 0v3" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="24" cy="27" r="2.5" fill="#16A34A"/>
      </svg>
    ),
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 border-green-100',
    titleColor: 'text-green-700',
    tag: '디지털 상품 판매',
    tagColor: 'bg-green-100 text-green-700',
    title: 'N잡스토어',
    desc: '마케팅 서비스·전자책·강의 등을 판매하고 싶다면',
    detail: '나만의 디지털 상품을 등록하고 판매할 수 있어요.',
    badge: '판매자 승인 필요',
    path: '/ebooks',
  },
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10">
        <rect width="48" height="48" rx="14" fill="#FFFBEB"/>
        <rect x="10" y="20" width="28" height="18" rx="5" fill="none" stroke="#D97706" strokeWidth="2.5"/>
        <path d="M17 20v-4a7 7 0 0114 0v4" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M18 30h12M18 34h7" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 border-amber-100',
    titleColor: 'text-amber-700',
    tag: '부업 · 프리랜서',
    tagColor: 'bg-amber-100 text-amber-700',
    title: '누구나알바',
    desc: '부업이나 알바가 필요하다면',
    detail: '다양한 SNS 작업 알바에 지원하고 수익을 올려보세요.',
    badge: '프리랜서 승인 필요',
    path: '/alba',
  },
];

const WelcomeGuideModal: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 pt-6 pb-5 relative">
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors text-xl font-bold leading-none"
            aria-label="닫기"
          >✕</button>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/50 mb-1">BESTSNS Guide</p>
          <h2 className="text-white text-xl sm:text-2xl font-black leading-tight">어떤 서비스가 필요하세요?</h2>
          <p className="text-white/60 text-xs sm:text-sm mt-1 font-medium">목적에 맞는 페이지를 이용해보세요</p>
        </div>

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
          {SECTIONS.map((s) => (
            <a
              key={s.title}
              href={s.path}
              onClick={close}
              className={`rounded-2xl border p-4 flex gap-3 items-start hover:shadow-md transition-shadow cursor-pointer ${s.bg}`}
            >
              <div className="shrink-0 mt-0.5">{s.icon}</div>
              <div className="min-w-0">
                <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full mb-1.5 ${s.tagColor}`}>{s.tag}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-base font-black ${s.titleColor}`}>{s.title}</p>
                  {s.badge && (
                    <span className="text-[10px] font-bold bg-white/80 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                      {s.badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-xs font-bold mt-0.5 leading-snug">{s.desc}</p>
                <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">{s.detail}</p>
              </div>
            </a>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={close}
            className="flex-1 bg-gray-900 text-white font-black py-3 rounded-2xl text-sm hover:bg-gray-700 transition-colors"
          >
            시작하기 →
          </button>
          <button
            onClick={close}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 font-medium whitespace-nowrap"
          >
            다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGuideModal;
