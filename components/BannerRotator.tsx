import React, { useEffect, useState } from 'react';
import { fetchActiveBannerAds } from '@/bannerDb';
import type { BannerAd } from '@/types';

interface Props {
  slots?: number;
  className?: string;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

const EmptySlot: React.FC = () => (
  <div className="flex-1 min-w-0 h-[100px] rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
    <span className="text-[11px] font-black text-gray-400 tracking-widest">광고모집중</span>
    <span className="text-[9px] text-gray-300">문의: 관리자에게 연락</span>
  </div>
);

const BannerRotator: React.FC<Props> = ({ slots = 2, className = '' }) => {
  const [shown, setShown] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBannerAds()
      .then(ads => setShown(pickRandom(ads, slots)))
      .catch(err => { console.error('[BannerRotator] 배너 조회 실패:', err); setShown([]); })
      .finally(() => setLoading(false));
  }, [slots]);

  if (loading) return null;

  const empties = slots - shown.length;

  return (
    <div className={`w-full flex flex-row gap-2 ${className}`}>
      {shown.map(ad => (
        <a key={ad.id} href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
          className="flex-1 min-w-0 overflow-hidden rounded-xl hover:opacity-90 transition-opacity"
          title={ad.companyName}>
          <img src={ad.imageUrl} alt={ad.companyName} className="w-full h-[100px] object-cover block" />
        </a>
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
    </div>
  );
};

export default BannerRotator;
