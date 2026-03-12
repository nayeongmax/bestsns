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

  if (shown.length === 0) {
    return (
      <div className={`w-full min-h-[90px] rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-[11px] text-gray-300 font-bold uppercase tracking-widest">Advertisement</span>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {shown.map(ad => (
        <a key={ad.id} href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
          className="block w-full rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          title={ad.companyName}>
          <img src={ad.imageUrl} alt={ad.companyName} className="w-full h-auto object-cover block" />
        </a>
      ))}
    </div>
  );
};

export default BannerRotator;
