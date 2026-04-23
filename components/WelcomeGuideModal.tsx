import React, { useEffect, useState } from 'react';
import { fetchActivePopup, SitePopup } from '@/popupDb';

const seenKey = (id: string) => `bestsns_popup_seen_${id}`;

const WelcomeGuideModal: React.FC = () => {
  const [popup, setPopup] = useState<SitePopup | null>(null);

  useEffect(() => {
    fetchActivePopup().then((p) => {
      if (!p) return;
      if (localStorage.getItem(seenKey(p.id))) return;
      setPopup(p);
    }).catch(() => {});
  }, []);

  const close = () => {
    if (popup) localStorage.setItem(seenKey(popup.id), '1');
    setPopup(null);
  };

  if (!popup) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 pt-6 pb-5 relative">
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors text-xl font-bold leading-none"
            aria-label="닫기"
          >✕</button>
          <p className="text-[11px] font-black uppercase tracking-widest text-white/50 mb-1">BESTSNS</p>
          <h2 className="text-white text-xl sm:text-2xl font-black leading-tight">{popup.title}</h2>
        </div>

        {/* 이미지 */}
        {popup.imageUrl && (
          <img
            src={popup.imageUrl}
            alt={popup.title}
            className="w-full max-h-64 object-contain bg-gray-50"
          />
        )}

        {/* 본문 */}
        {popup.body && (
          <div className="px-6 py-5">
            <p className="text-gray-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">{popup.body}</p>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={close}
            className="flex-1 bg-gray-900 text-white font-black py-3 rounded-2xl text-sm hover:bg-gray-700 transition-colors"
          >
            확인
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
