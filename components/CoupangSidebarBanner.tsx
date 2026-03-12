import React, { useEffect, useRef } from 'react';

/**
 * 쿠팡 파트너스 세로형 사이드바 배너
 * 실제 사용 시 id, trackingCode를 쿠팡 파트너스 계정 값으로 교체하세요.
 *
 * 쿠팡 파트너스: https://partners.coupang.com
 * 배너 코드 발급 위치: 광고관리 → 배너/텍스트 광고 → 코드 복사
 */
const COUPANG_ID = 972069;
const COUPANG_TRACKING = 'AF3446409';
const BANNER_TEMPLATE = 'carousel';
const BANNER_WIDTH = 300;
const BANNER_HEIGHT = 600;

const CoupangSidebarBanner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    if (!COUPANG_ID || !COUPANG_TRACKING) return; // 설정 전에는 플레이스홀더 표시
    initialized.current = true;

    // g.js 중복 로드 방지
    if (!document.querySelector('script[src="https://ads-partners.coupang.com/g.js"]')) {
      const gScript = document.createElement('script');
      gScript.src = 'https://ads-partners.coupang.com/g.js';
      gScript.async = true;
      document.head.appendChild(gScript);
    }

    const initScript = document.createElement('script');
    initScript.text = `
      (function() {
        function init() {
          if (typeof PartnersCoupang !== 'undefined') {
            new PartnersCoupang.G({
              "id": ${COUPANG_ID},
              "template": "${BANNER_TEMPLATE}",
              "trackingCode": "${COUPANG_TRACKING}",
              "width": "${BANNER_WIDTH}",
              "height": "${BANNER_HEIGHT}"
            });
          } else {
            setTimeout(init, 300);
          }
        }
        init();
      })();
    `;
    containerRef.current.appendChild(initScript);
  }, []);

  // 설정 전 플레이스홀더
  if (!COUPANG_ID || !COUPANG_TRACKING) {
    return (
      <div
        className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-center p-4"
        style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
      >
        <img src="https://image6.coupangcdn.com/image/coupang/common/logo_coupang_w350.png" alt="쿠팡" className="w-20 opacity-30" />
        <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
          쿠팡 파트너스<br/>광고 배너
        </p>
        <p className="text-[9px] text-gray-300">
          CoupangSidebarBanner.tsx에<br/>ID·트래킹코드 입력
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ minHeight: BANNER_HEIGHT }} />;
};

export default CoupangSidebarBanner;
