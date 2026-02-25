import React from 'react';

export type AdBannerVariant = 'leaderboard' | 'sidebar';

interface AdBannerProps {
  /** 슬롯 구분 (가로 배너 / 사이드바 등) */
  variant?: AdBannerVariant;
  /** 추가 className */
  className?: string;
  /**
   * 실제 광고 코드(구글 애드센스/쿠팡 등)를 넣을 때 사용.
   * slotContent에 iframe/스크립트 결과를 넣으면 됨.
   */
  slotContent?: React.ReactNode;
}

const variantStyles: Record<AdBannerVariant, string> = {
  leaderboard: 'min-h-[90px] md:min-h-[100px] w-full',
  sidebar: 'min-h-[250px] w-full',
};

/**
 * 광고 배너 슬롯. 구글 애드센스·쿠팡 파트너스 등 코드 연동 시 slotContent로 넣으면 됨.
 * 현재는 placeholder만 표시 (실제 코드 연동 시 교체).
 */
const AdBanner: React.FC<AdBannerProps> = ({ variant = 'leaderboard', className = '', slotContent }) => {
  const baseClass = 'rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden';
  const sizeClass = variantStyles[variant];

  return (
    <div className={`${baseClass} ${sizeClass} ${className}`} role="complementary" aria-label="광고">
      {slotContent ?? (
        <div className="text-gray-300 text-xs font-bold uppercase tracking-widest">
          Advertisement
        </div>
      )}
    </div>
  );
};

export default AdBanner;
