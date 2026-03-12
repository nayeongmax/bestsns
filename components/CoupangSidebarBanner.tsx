import React, { useEffect, useRef, useState } from 'react';

const COUPANG_ID = 972069;
const COUPANG_TRACKING = 'AF3446409';
const BANNER_TEMPLATE = 'carousel';
const BANNER_HEIGHT = 600;

const CoupangSidebarBanner: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [width, setWidth] = useState(0);

  // 실제 컨테이너 폭 측정 (월렛과 동일한 너비)
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // 폭이 확정된 뒤 쿠팡 스크립트 삽입
  useEffect(() => {
    if (!width || initialized.current || !containerRef.current) return;
    initialized.current = true;

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
              "width": "${width}",
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
  }, [width]);

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={containerRef} style={{ minHeight: width ? BANNER_HEIGHT : 0 }} />
    </div>
  );
};

export default CoupangSidebarBanner;
