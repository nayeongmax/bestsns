import React, { useEffect, useState } from 'react';
import { fetchActiveBannerAds } from '@/bannerDb';
import type { BannerAd } from '@/types';

interface Props {
  /** 한 번에 노출할 배너 수 (기본 2) */
  slots?: number;
  className?: string;
}

/** 배열에서 n개를 랜덤하게 뽑는 유틸 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const BannerRotator: React.FC<Props> = ({ slots = 2, className = '' }) => {
  const [shown, setShown] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBannerAds()
      .then(ads => setShown(pickRandom(ads, slots)))
      .catch(() => setShown([]))
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
        <a
          key={ad.id}
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          title={ad.companyName}
        >
          <img
            src={ad.imageUrl}
            alt={ad.companyName}
            className="w-full h-auto object-cover block"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
};

export default BannerRotator;
