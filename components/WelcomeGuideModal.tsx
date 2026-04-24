import React, { useEffect, useState } from 'react';
import { fetchActivePopup, SitePopup } from '@/popupDb';

const hideUntilKey = (id: string) => `bestsns_popup_hide_until_${id}`;

const WelcomeGuideModal: React.FC = () => {
  const [popup, setPopup] = useState<SitePopup | null>(null);
  const [noShow24h, setNoShow24h] = useState(false);

  useEffect(() => {
    fetchActivePopup().then((p) => {
      if (!p) return;
      // 이전 버전 "영구 숨김" 키 제거 (새로고침마다 팝업이 뜨도록)
      localStorage.removeItem(`bestsns_popup_seen_${p.id}`);
      // 24시간 숨김만 적용
      const hideUntil = localStorage.getItem(hideUntilKey(p.id));
      if (hideUntil && Date.now() < Number(hideUntil)) return;
      setPopup(p);
    }).catch(() => {});
  }, []);

  const close = () => {
    if (popup && noShow24h) {
      localStorage.setItem(hideUntilKey(popup.id), String(Date.now() + 24 * 60 * 60 * 1000));
    }
    setPopup(null);
  };

  if (!popup) return null;

  const hasImage = !!popup.imageUrl;
  const hasBody = !!popup.body?.trim();

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" onClick={close}>
      <div
        className="relative bg-white shadow-2xl overflow-hidden"
        style={{ width: '100%', maxWidth: 420, borderRadius: 4 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 X */}
        <button
          onClick={close}
          className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white text-base font-bold rounded-sm transition-colors"
          aria-label="닫기"
        >✕</button>

        {/* 이미지 */}
        {hasImage && (
          <img
            src={popup.imageUrl}
            alt={popup.title}
            className="w-full block"
            style={{ maxHeight: 480, objectFit: 'cover' }}
          />
        )}

        {/* 제목 + 본문 (이미지 없거나 body 있을 때만) */}
        {(!hasImage || hasBody) && (
          <div className={`px-5 py-4 ${hasImage ? 'border-t border-gray-100' : ''}`}>
            {!hasImage && <p className="font-black text-gray-900 text-base mb-1">{popup.title}</p>}
            {hasBody && <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{popup.body}</p>}
          </div>
        )}

        {/* 하단 바 */}
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noShow24h}
              onChange={e => setNoShow24h(e.target.checked)}
              className="w-3.5 h-3.5 accent-white cursor-pointer"
            />
            <span className="text-gray-300 text-xs">24시간 열지않기</span>
          </label>
          <button
            onClick={close}
            className="text-gray-300 hover:text-white text-xs font-bold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGuideModal;
