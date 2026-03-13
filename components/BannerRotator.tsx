import React, { useEffect, useState } from 'react';
import { fetchActiveBannerAds } from '@/bannerDb';
import type { BannerAd } from '@/types';

interface Props {
  cols?: number;
  /**
   * 'sequential' (SNS): cols개씩 순차 로테이션, 새로고침마다 다음 배너로 이동
   * 'all' (자유게시판): 전체 배너를 고정 순서로 표시
   */
  mode?: 'sequential' | 'all';
  className?: string;
}

const gridClass: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3' };

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

const ROTATION_KEY = 'banner_rotation_idx';

const BannerRotator: React.FC<Props> = ({ cols = 2, mode = 'sequential', className = '' }) => {
  const [ads, setAds] = useState<BannerAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBannerAds()
      .then(all => {
        // 등록일 기준 안정적 정렬
        const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        if (mode === 'all') {
          // 자유게시판: 전체 고정 표시
          setAds(sorted);
        } else {
          // SNS sequential: 배너 수가 cols 이하면 그냥 전부 표시
          if (sorted.length <= cols) {
            setAds(sorted);
            return;
          }
          // cols개씩 순차 로테이션 (localStorage로 인덱스 유지)
          const stored = parseInt(localStorage.getItem(ROTATION_KEY) ?? '0', 10);
          const idx = isNaN(stored) ? 0 : stored % sorted.length;
          const picked: BannerAd[] = [];
          for (let i = 0; i < cols; i++) {
            picked.push(sorted[(idx + i) % sorted.length]);
          }
          // 다음 로드 때 쓸 인덱스 저장
          localStorage.setItem(ROTATION_KEY, String((idx + cols) % sorted.length));
          setAds(picked);
        }
      })
      .catch(err => { console.error('[BannerRotator] 배너 조회 실패:', err); setAds([]); })
      .finally(() => setLoading(false));
  }, [cols, mode]);

  if (loading) return null;

  // sequential: 항상 cols칸 / all: 행이 꽉 차도록 (빈 자리 채움)
  const totalCells = mode === 'sequential'
    ? cols
    : Math.ceil(Math.max(ads.length, 1) / cols) * cols;
  const empties = totalCells - ads.length;

  return (
    <div className={`w-full grid gap-2 ${gridClass[cols] ?? 'grid-cols-2'} ${className}`}>
      {ads.map(ad => <BannerItem key={ad.id} ad={ad} />)}
      {Array.from({ length: empties }).map((_, i) => <EmptySlot key={`empty-${i}`} />)}
    </div>
  );
};

export default BannerRotator;
