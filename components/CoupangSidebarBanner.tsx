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

    const targetContainer = containerRef.current;

    const runCoupang = () => {
      const coupang = (window as any).PartnersCoupang;
      if (!coupang) {
        setTimeout(runCoupang, 300);
        return;
      }

      // body에 새로 추가되는 요소를 감지해 컨테이너로 이동
      const bodyChildrenBefore = new Set(Array.from(document.body.children));

      const bodyObserver = new MutationObserver(() => {
        Array.from(document.body.children).forEach((child) => {
          if (!bodyChildrenBefore.has(child) && child instanceof HTMLElement) {
            targetContainer.appendChild(child);
          }
        });
      });
      bodyObserver.observe(document.body, { childList: true });

      new coupang.G({
        id: COUPANG_ID,
        template: BANNER_TEMPLATE,
        trackingCode: COUPANG_TRACKING,
        width: `${width}`,
        height: `${BANNER_HEIGHT}`,
      });

      // 5초 후 옵저버 해제
      setTimeout(() => bodyObserver.disconnect(), 5000);
    };

    if (!document.querySelector('script[src="https://ads-partners.coupang.com/g.js"]')) {
      const gScript = document.createElement('script');
      gScript.src = 'https://ads-partners.coupang.com/g.js';
      gScript.async = true;
      gScript.onload = runCoupang;
      document.head.appendChild(gScript);
    } else {
      runCoupang();
    }
  }, [width]);

  return (
    <div ref={wrapperRef} className="w-full">
      <div ref={containerRef} style={{ minHeight: width ? BANNER_HEIGHT : 0 }} />
    </div>
  );
};

export default CoupangSidebarBanner;
