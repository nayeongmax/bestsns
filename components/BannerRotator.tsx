import React, { useEffect, useState } from 'react';
import { fetchActiveBannerAds } from '@/bannerDb';
import type { BannerAd } from '@/types';

interface Props {
  cols?: number;
  mode?: 'sequential' | 'all';
  /** 노출 위치 필터: 'sns' | 'freeboard' */
  location?: 'sns' | 'freeboard';
  /** 배너 높이 (px, 기본 130) */
  height?: number;
  className?: string;
}

const gridClass: Record<number, string> = { 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' };
const ROTATION_KEY = 'banner_rotation_idx';

const EmptySlot: React.FC<{ height: number }> = ({ height }) => (
  <div style={{ height }} className="rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1">
    <span className="text-[15px] font-black text-gray-600 tracking-widest">광고모집중</span>
    <span className="text-[10px] text-gray-500 font-semibold">문의: 관리자에게 연락</span>
  </div>
);

const BannerItem: React.FC<{ ad: BannerAd; height: number }> = ({ ad, height }) => (
  <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
    className="block overflow-hidden rounded-xl hover:opacity-90 transition-opacity"
    title={ad.companyName}>
    <img src={ad.imageUrl} alt={ad.companyName} style={{ height }} className="w-full object-cover object-top block" />
  </a>
);

const BannerRotator: React.FC<Props> = ({ cols = 2, mode = 'sequential', location, height = 130, className = '' }) => {
  const [ads, setAds] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBannerAds()
      .then(all => {
        // 위치 필터: sns/freeboard/both
        const filtered = location
          ? all.filter(b => b.location === location || b.location === 'both')
          : all;
        const sorted = [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        if (mode === 'all') {
          setAds(sorted);
        } else {
          if (sorted.length <= cols) { setAds(sorted); return; }
          const stored = parseInt(localStorage.getItem(ROTATION_KEY) ?? '0', 10);
          const idx = isNaN(stored) ? 0 : stored % sorted.length;
          const picked: BannerAd[] = [];
          for (let i = 0; i < cols; i++) {
            picked.push(sorted[(idx + i) % sorted.length]);
          }
          localStorage.setItem(ROTATION_KEY, String((idx + cols) % sorted.length));
          setAds(picked);
        }
      })
      .catch(err => { console.error('[BannerRotator]', err); setAds([]); })
      .finally(() => setLoading(false));
  }, [cols, mode, location]);

  if (loading) return null;

  const totalCells = mode === 'sequential'
    ? cols
    : Math.ceil(Math.max(ads.length, 1) / cols) * cols;
  const empties = totalCells - ads.length;

  return (
    <div className={`w-full grid gap-2 ${gridClass[cols] ?? 'grid-cols-2'} ${className}`}>
      {ads.map(ad => <BannerItem key={ad.id} ad={ad} height={height} />)}
      {Array.from({ length: empties }).map((_, i) => <EmptySlot key={`empty-${i}`} height={height} />)}
    </div>
  );
};

export default BannerRotator;
