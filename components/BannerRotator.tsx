import React, { useEffect, useState } from 'react';
import { fetchActiveBannerAds } from '@/bannerDb';
import type { BannerAd } from '@/types';

interface Props {
  /** 한 줄에 보여줄 배너 수 (기본 2) */
  cols?: number;
  /** true면 전체 배너를 모두 표시 (자유게시판), false면 cols개만 표시 (SNS) */
  showAll?: boolean;
  className?: string;
}

const gridClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

const EmptySlot: React.FC = () => (
  <div className="h-[130px] rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5">
    <span className="text-[16px] font-black text-gray-600 tracking-widest">광고모집중</span>
    <span className="text-[11px] text-gray-500 font-semibold">문의: 관리자에게 연락</span>
  </div>
);

const BannerItem: React.FC<{ ad: BannerAd }> = ({ ad }) => (
  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
    className="block overflow-hidden rounded-xl bg-black hover:opacity-90 transition-opacity"
    title={ad.companyName}>
    <img src={ad.imageUrl} alt={ad.companyName} className="w-full h-[130px] object-contain block" />
  </a>
);

const BannerRotator: React.FC<Props> = ({ cols = 2, showAll = false, className = '' }) => {
  const [ads, setAds] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBannerAds()
      .then(all => {
        const fixed = all.filter(b => b.displayMode === 'fixed');
        const random = [...all.filter(b => b.displayMode !== 'fixed')].sort(() => Math.random() - 0.5);

        if (showAll) {
          // 자유게시판: 전체 표시 (고정 먼저, 랜덤 뒤)
          setAds([...fixed, ...random]);
        } else {
          // SNS: cols개만 표시 (고정 우선, 부족하면 랜덤으로 채움)
          const picked = [...fixed];
          const remaining = cols - fixed.length;
          if (remaining > 0) picked.push(...random.slice(0, remaining));
          setAds(picked.slice(0, cols));
        }
      })
      .catch(err => { console.error('[BannerRotator] 배너 조회 실패:', err); setAds([]); })
      .finally(() => setLoading(false));
  }, [cols, showAll]);

  if (loading) return null;

  // 마지막 줄을 채울 빈 슬롯 수 계산
  const totalCells = showAll
    ? (ads.length === 0 ? cols : Math.ceil(ads.length / cols) * cols)
    : cols;
  const empties = totalCells - ads.length;

  return (
    <div className={`w-full grid gap-2 ${gridClass[cols] ?? 'grid-cols-2'} ${className}`}>
      {ads.map(ad => <BannerItem key={ad.id} ad={ad} />)}
      {Array.from({ length: empties }).map((_, i) => <EmptySlot key={`empty-${i}`} />)}
    </div>
  );
};

export default BannerRotator;
