
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChannelProduct, WishlistItem, ChannelReview } from '@/types';

interface Props {
  channels: ChannelProduct[];
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  channelReviews?: ChannelReview[];
}

const NEGATIVE_KEYWORDS = ['사기', '환불', '가짜', '허위', '불량', '최악', '쓰레기', '불만', '실망', '형편없', '별로', '노출', '속임', '차단', '신고', '폰지', '다단계'];

const ChannelSales: React.FC<Props> = ({ channels, wishlist, onToggleWishlist, channelReviews = [] }) => {
  const [activePlatform, setActivePlatform] = useState('전체');
  const [showOnlyApproved, setShowOnlyApproved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('전체');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minIncome, setMinIncome] = useState('');
  const [maxIncome, setMaxIncome] = useState('');

  const isWishlisted = (id: string) => wishlist.some(w => w.data.id === id);

  const STATIC_CHANNEL_REVIEWS = [
    { id: 'fr1', author: 'junho_media', rating: 5, content: '처음 이용해봤는데 정말 만족스러웠어요. 구독자 수 그대로 이전되었고 수익창출도 유지됩니다. 친절한 안내 덕분에 걱정 없이 진행했습니다!' },
    { id: 'fr2', author: 'minjee_v', rating: 5, content: '구매 후 설명대로 월 수익이 잘 나오고 있어요. 인수인계 과정도 꼼꼼하게 도와주셔서 초보자도 어렵지 않았습니다. 강력 추천합니다!' },
    { id: 'fr3', author: 'game_kr99', rating: 4, content: '가격 대비 구독자 퀄리티가 좋고 활성 구독자 비율도 높네요. 이전 과정도 빠르게 완료되어 만족합니다.' },
    { id: 'fr4', author: 'biz_invest_lee', rating: 5, content: '기대 이상이었어요. 기존 콘텐츠 퀄리티도 높고 구독자 충성도가 대단하더라고요. 재구매 의사 있습니다!' },
    { id: 'fr5', author: 'foodie_park', rating: 5, content: '인수 후 바로 운영 시작했는데 상태가 정말 좋았어요. 애드센스 연동도 문제없이 됐고 판매자분도 인계 후 궁금한 점 친절히 답변해주셨어요.' },
    { id: 'fr6', author: 'sports_fan_choi', rating: 4, content: '매매 처음이라 걱정했는데 에스크로 방식이라 안심하고 진행했어요. 설명과 동일하게 좋은 상태여서 만족합니다.' },
    { id: 'fr7', author: 'life_creator_kim', rating: 5, content: '이미 팬층이 형성되어 있어서 첫 영상 업로드부터 반응이 좋았어요. 정말 좋은 투자였어요. 채널 매매는 여기가 최고입니다.' },
    { id: 'fr8', author: 'news_info_yoo', rating: 5, content: '수익 데이터 검증도 꼼꼼하게 해주셔서 신뢰가 갔고 실제로 수익도 꾸준히 나오고 있어요. 채널 매매 망설이시는 분들께 강추!' },
    { id: 'fr9', author: 'humor_content_oh', rating: 4, content: '조회수가 생각보다 잘 나와요. 구독자도 꾸준히 늘고 있고요. 처음엔 반신반의했는데 이렇게 잘 될 줄 몰랐네요. 다음에도 이용할게요!' },
    { id: 'fr10', author: 'tiktok_pro_shin', rating: 5, content: '팔로워 수 변동 없이 완벽히 이전됐고 기존 영상 조회수도 유지되네요. 빠른 처리와 친절한 응대에 감사드려요. 최고의 플랫폼입니다!' },
    { id: 'fr11', author: 'jinwoo_yt82', rating: 5, content: '다른 데서 카톡으로 구매했다가 바로 채널 막혀서 돈만 날렸어요.. 여기서 다시 구매했는데 에스크로라 안전하고 채널도 멀쩡히 이전됐습니다. 처음부터 여기 올 걸 그랬네요.' },
    { id: 'fr12', author: 'soyeon_yt', rating: 5, content: '생각보다 훨씬 빠르게 이전이 완료됐고 구글 계정 연동도 문제없었어요. 채널 히스토리도 깔끔하게 유지돼서 아주 만족합니다.' },
    { id: 'fr13', author: 'kwon_media22', rating: 5, content: '에스크로 덕분에 안전하게 거래할 수 있었어요. 판매자와의 소통도 원활했고 약속한 수익 조건도 그대로였습니다.' },
    { id: 'fr14', author: 'hanbit_studio', rating: 4, content: '구독자 이탈 없이 이전 완료됐어요. 초기 셋업이 좀 복잡할 줄 알았는데 가이드가 친절해서 혼자서도 충분했습니다.' },
    { id: 'fr15', author: 'travel_log_kim', rating: 5, content: '여행 채널 인수했는데 기존 팬들이 신규 영상에도 반응을 잘 해줘서 처음부터 탄력받아서 좋았어요. 정말 좋은 선택이었습니다.' },
    { id: 'fr16', author: 'digitalpark_jh', rating: 5, content: '채널 상태가 설명 그대로였고 수익창출 상태도 이상 없었어요. 처음 채널 매매 도전해봤는데 여기가 딱 맞는 플랫폼이네요.' },
    { id: 'fr17', author: 'yt_investor_ryu', rating: 5, content: '투자 관점에서 접근했는데 ROI가 예상보다 훨씬 빠르게 나오고 있어요. 채널 퀄리티도 높고 운영 노하우 전수도 해주셔서 감사했습니다.' },
    { id: 'fr18', author: 'creator_base_ko', rating: 4, content: '매매 전 채널 감사 자료를 꼼꼼히 제공해 주셔서 믿고 진행할 수 있었어요. 인수 후 이상 없이 운영 중입니다.' },
    { id: 'fr19', author: 'media_flip_ahn', rating: 5, content: '여러 플랫폼 채널을 거래해봤는데 여기가 제일 프로세스가 명확하고 안전해요. 서류 처리도 빠르고 매우 만족합니다.' },
    { id: 'fr20', author: 'sns_grow_chae', rating: 5, content: '처음에 가격이 걱정됐는데 구독자 단가로 계산해보니 오히려 합리적이었어요. 인수 후 수익도 바로 났고 계속 성장하고 있어요.' },
    { id: 'fr21', author: 'yt_biz_hong', rating: 5, content: '판매자가 채널 운영 팁까지 공유해줬어요. 단순 매매가 아니라 노하우까지 전달받을 수 있어서 정말 값어치 있는 거래였습니다.' },
    { id: 'fr22', author: 'channel_pro_yim', rating: 4, content: '에스크로 시스템 덕분에 처음 매매임에도 불구하고 심리적으로 안정되게 진행할 수 있었어요. 다음에도 이용할 의향 있습니다.' },
    { id: 'fr23', author: 'startup_tube_woo', rating: 5, content: '스타트업 홍보용 채널이 필요해서 구매했는데 기존 구독자들이 새 콘텐츠에도 반응이 좋아서 마케팅 효과를 바로 볼 수 있었어요.' },
    { id: 'fr24', author: 'byeong_create', rating: 5, content: '구매 확정 후 이틀 만에 채널 이전이 완료됐어요. 빠른 처리 덕분에 예정된 업로드 일정을 맞출 수 있었습니다. 적극 추천해요!' },
    { id: 'fr25', author: 'insta_flip_nam', rating: 4, content: '인스타그램 채널 구매했는데 팔로워 이탈 없이 완벽하게 이전됐어요. 기존 게시물 통계도 그대로 유지돼서 광고 단가에 영향이 없었습니다.' },
    { id: 'fr26', author: 'yt_lab_seo', rating: 5, content: '여러 번 거래해봤지만 이 플랫폼이 제일 신뢰가 가요. 분쟁 발생 시에도 에스크로로 보호받을 수 있다는 점이 큰 장점입니다.' },
    { id: 'fr27', author: 'content_flip_jeon', rating: 5, content: '수익창출 중인 채널을 인수했는데 첫 달부터 수익이 발생했어요. 채널 상태가 설명과 100% 일치해서 믿을 수 있는 곳이라고 느꼈습니다.' },
    { id: 'fr28', author: 'media_asset_oh', rating: 5, content: '채널을 자산으로 생각하는 분들께 강추합니다. 장기 투자 관점에서 정말 좋은 선택이었고, 플랫폼의 전문성과 안전한 거래 방식에 만족합니다.' },
  ];

  const [reviewSlideIdx, setReviewSlideIdx] = useState(0);
  const reviewSliderPaused = useRef(false);

  const maskNickname = (name: string) => {
    if (!name || name.length <= 1) return '익명';
    if (name.length <= 3) return name[0] + '**';
    if (name.length <= 6) return name.slice(0, 2) + '***';
    return name.slice(0, 3) + '***';
  };

  // DB 리뷰: 별점 4점 이상 + 악성 키워드 없는 것만 표시
  const filteredDbReviews = useMemo(() => {
    return channelReviews
      .filter(r => {
        if (r.rating < 4) return false;
        const text = r.content.toLowerCase();
        return !NEGATIVE_KEYWORDS.some(kw => text.includes(kw));
      })
      .map(r => ({
        id: r.id,
        author: r.userNickname,
        rating: r.rating,
        content: r.content,
      }));
  }, [channelReviews]);

  const CHANNEL_REVIEWS = useMemo(
    () => [...filteredDbReviews, ...STATIC_CHANNEL_REVIEWS],
    [filteredDbReviews]
  );

  useEffect(() => {
    if (CHANNEL_REVIEWS.length <= 1) return;
    const timer = setInterval(() => {
      if (!reviewSliderPaused.current) {
        setReviewSlideIdx(prev => (prev + 1) % CHANNEL_REVIEWS.length);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const filteredChannels = channels.filter(ch => {
    const matchesPlatform = activePlatform === '전체' || ch.platform === activePlatform;
    const matchesApproved = showOnlyApproved ? ch.isApproved : true;
    const matchesSearch = ch.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTopic = selectedTopic === '전체' || ch.category === selectedTopic;
    const numSubs = ch.subscribers || 0;
    const numPrice = ch.price || 0;
    const numIncome = ch.income || 0;
    const matchesSubs = (!minSubs || numSubs >= Number(minSubs)) && (!maxSubs || numSubs <= Number(maxSubs));
    const matchesPrice = (!minPrice || numPrice >= Number(minPrice)) && (!maxPrice || numPrice <= Number(maxPrice));
    const matchesIncome = (!minIncome || numIncome >= Number(minIncome)) && (!maxIncome || numIncome <= Number(maxIncome));
    return matchesPlatform && matchesApproved && matchesSearch && matchesTopic && matchesSubs && matchesPrice && matchesIncome;
  });

  const topics = ['전체', '게임', '비즈니스', '뷰티/패션', '음식/맛집', '정보/뉴스', '스포츠', '유머/엔터', '라이프스타일', '기타'];

  return (
    <div className="max-w-6xl mx-auto pb-20 sm:pb-24 px-3 sm:px-4 md:px-6">
      {/* 모바일/태블릿 전용: 헤더 + 간단 필터 + 목록형 */}
      <section className="lg:hidden bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 mb-4 sm:mb-6 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">채널판매</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">원하는 채널을 검색하고 구매해보세요</p>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex overflow-x-auto gap-2 pb-1 sm:flex-wrap sm:justify-start [&::-webkit-scrollbar]:h-0" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {['전체', 'YouTube', 'TikTok', 'Twitter', 'Instagram', 'Facebook', 'Telegram'].map((p) => (
              <button key={p} onClick={() => setActivePlatform(p)} className={`shrink-0 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-[13px] font-bold transition-all border ${activePlatform === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-200'}`}>{p}</button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="채널명으로 검색" className="flex-1 min-w-0 p-3 sm:p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-medium text-gray-800 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="p-3 sm:p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-600 text-sm outline-none focus:ring-2 focus:ring-blue-200 sm:w-40">
              <option value="전체">주제 선택</option>
              {topics.filter(t => t !== '전체').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowOnlyApproved(!showOnlyApproved)} className={`shrink-0 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm border transition-all ${showOnlyApproved ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {showOnlyApproved && '✓ '}수익창출
            </button>
          </div>
        </div>
      </section>

      {/* 데스크톱 전용: 원래 필터 + 그리드 카드 */}
      <div className="hidden lg:block bg-white p-6 md:p-10 rounded-3xl md:rounded-[40px] shadow-sm mb-8 md:mb-12 border border-gray-100">
        <div className="flex overflow-x-auto gap-2 pb-2 flex-wrap justify-center gap-2">
          {['전체', 'YouTube', 'TikTok', 'Twitter', 'Instagram', 'Facebook', 'Telegram'].map((p) => (
            <button key={p} onClick={() => setActivePlatform(p)} className={`shrink-0 px-6 py-2 rounded-full text-[13px] font-black transition-all border-2 ${activePlatform === p ? 'bg-gray-900 text-white border-gray-900 shadow-md scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}>{p}</button>
          ))}
        </div>
        <div className="max-w-5xl mx-auto space-y-4 mt-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="채널명으로 검색" className="flex-[2] p-4 bg-gray-50 border border-transparent rounded-2xl outline-none font-bold text-gray-700 text-[15px] focus:bg-white focus:border-blue-500 transition-all shadow-inner" />
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="flex-1 p-4 bg-gray-50 border border-transparent rounded-2xl outline-none font-bold text-gray-500 cursor-pointer shadow-inner text-[15px] focus:bg-white">
              <option value="전체">주제 선택</option>
              {topics.filter(t => t !== '전체').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowOnlyApproved(!showOnlyApproved)} className={`flex-1 p-4 rounded-2xl font-black text-[15px] transition-all border flex items-center justify-center gap-2 shadow-sm ${showOnlyApproved ? 'bg-gray-900 text-white border-gray-900 scale-105' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {showOnlyApproved && <span className="text-blue-400">✓</span>} 수익창출
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-4 border-t border-gray-50">
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Subs</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minSubs} onChange={(e) => setMinSubs(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Price</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
            <div className="flex items-center gap-3 sm:col-span-2 md:col-span-1"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Inc.</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minIncome} onChange={(e) => setMinIncome(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxIncome} onChange={(e) => setMaxIncome(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
          </div>
        </div>
      </div>

      {/* 이용 후기 섹션 */}
      {(() => {
        const rawAvg = CHANNEL_REVIEWS.length > 0
          ? Math.round((CHANNEL_REVIEWS.reduce((sum, r) => sum + r.rating, 0) / CHANNEL_REVIEWS.length) * 10) / 10
          : 0;
        const avgRating = Math.max(rawAvg, 4.9);
        return (
          <div className="mt-6 sm:mt-8 md:mt-10 mb-6 sm:mb-8 md:mb-10 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-8 md:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
              <h2 className="text-base sm:text-xl font-black text-gray-900 italic uppercase flex items-center gap-2 sm:gap-3">
                <span className="w-1.5 h-4 sm:h-6 bg-yellow-400 rounded-full shrink-0"></span>
                이용 후기
                <span className="text-xs sm:text-sm font-black text-gray-300 normal-case italic">({CHANNEL_REVIEWS.length}개)</span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`text-base sm:text-lg ${n <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-lg sm:text-2xl font-black text-yellow-500 italic">{avgRating}</span>
                <span className="text-[10px] sm:text-xs font-black text-gray-300 italic">/5.0</span>
              </div>
            </div>
            <div
              className="relative"
              onMouseEnter={() => { reviewSliderPaused.current = true; }}
              onMouseLeave={() => { reviewSliderPaused.current = false; }}
            >
              <div className="overflow-hidden rounded-2xl" style={{ height: '152px' }}>
                <div
                  className="flex flex-col transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateY(-${reviewSlideIdx * 152}px)` }}
                >
                  {CHANNEL_REVIEWS.map((rev) => (
                    <div
                      key={rev.id}
                      className="w-full shrink-0 bg-gray-50 rounded-2xl p-4 sm:p-5 border border-transparent flex flex-col gap-1.5"
                      style={{ height: '152px' }}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[12px] sm:text-sm font-black text-gray-800">{maskNickname(rev.author)}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} className={`text-base ${n <= rev.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-[12px] sm:text-sm font-bold text-gray-600 leading-relaxed line-clamp-4">{rev.content}</p>
                    </div>
                  ))}
                </div>
              </div>
              {CHANNEL_REVIEWS.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {CHANNEL_REVIEWS.slice(0, 10).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewSlideIdx(i)}
                      className={`rounded-full transition-all duration-300 ${i === reviewSlideIdx % 10 ? 'w-5 h-2 bg-yellow-400' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`}
                      aria-label={`${i + 1}번 리뷰`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 모바일/태블릿: 목록형 */}
      <div className="lg:hidden space-y-2 sm:space-y-3 max-h-[calc(100vh-16rem)] sm:max-h-[75vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {filteredChannels.length === 0 ? (
          <div className="py-16 sm:py-24 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold text-sm sm:text-base">조건에 맞는 채널이 없습니다.</p>
          </div>
        ) : filteredChannels.map((ch) => (
          <div key={ch.id} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-gray-200 transition-all flex items-stretch min-h-[100px] sm:min-h-[120px]">
            <Link
              to={ch.isSoldOut ? '#' : `/channels/${ch.id}`}
              onClick={(e) => ch.isSoldOut && e.preventDefault()}
              className={`flex flex-1 min-w-0 items-center gap-3 sm:gap-4 p-3 sm:p-4 ${ch.isSoldOut ? 'cursor-default' : ''}`}
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                <img src={ch.thumbnail} className={`w-full h-full object-cover ${!ch.isSoldOut && 'group-hover:opacity-95'}`} alt="" />
                {ch.isSoldOut && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-[10px] font-black uppercase">완료</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{ch.platform}</span>
                  {ch.isApproved && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">승인</span>}
                  {ch.isHot && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">HOT</span>}
                </div>
                <h3 className={`font-bold text-gray-900 mt-0.5 line-clamp-2 text-sm sm:text-base leading-snug ${!ch.isSoldOut && 'hover:text-blue-600'}`}>{ch.title}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>구독 {ch.subscribers.toLocaleString()}명</span>
                  <span className="font-bold text-blue-600">₩{ch.price.toLocaleString()}</span>
                </div>
              </div>
            </Link>
            <div className="flex items-center pr-3 sm:pr-4 py-3 flex-shrink-0">
              <button
                onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'channel', data: ch }); }}
                className={`p-2.5 rounded-full transition-all ${isWishlisted(ch.id) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:text-red-500'}`}
                aria-label="찜하기"
              >
                <svg className="w-4 h-4" fill={isWishlisted(ch.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 그리드 카드 */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8 px-1 sm:px-2">
        {filteredChannels.length === 0 ? (
          <div className="col-span-full py-24 md:py-32 text-center bg-white rounded-3xl md:rounded-[40px] border-2 border-dashed border-gray-100">
            <p className="text-gray-300 font-black italic text-lg px-4">조건에 맞는 채널이 없습니다.</p>
          </div>
        ) : filteredChannels.map((ch) => (
          <div key={ch.id} className="bg-white rounded-2xl md:rounded-[24px] overflow-hidden shadow-sm group border border-gray-100 relative transition-all hover:-translate-y-2 hover:shadow-xl">
            <Link
              to={ch.isSoldOut ? '#' : `/channels/${ch.id}`}
              onClick={(e) => ch.isSoldOut && e.preventDefault()}
              className={`block ${ch.isSoldOut ? 'cursor-default' : ''}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <img src={ch.thumbnail} className={`w-full h-full object-cover transition-transform duration-700 ${!ch.isSoldOut && 'group-hover:scale-110'}`} alt={ch.title} />
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {ch.isApproved && (
                    <span className="bg-[#FFD600] text-gray-900 text-[11px] font-black px-2.5 py-0.5 rounded-lg italic uppercase tracking-tighter flex items-center justify-center shadow-md">승인채널</span>
                  )}
                  {ch.isHot && (
                    <span className="bg-[#FF4D4D] text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg italic uppercase tracking-widest flex items-center justify-center shadow-md">HOT</span>
                  )}
                </div>
                {ch.isSoldOut && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <span className="text-white text-sm font-black italic tracking-widest border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl uppercase">판매완료</span>
                  </div>
                )}
              </div>
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-widest italic">{ch.platform}</span>
                  <span className="text-[9px] font-bold text-gray-300">#CH.{ch.id.slice(-4).toUpperCase()}</span>
                </div>
                <h3 className={`font-black text-gray-900 mb-6 h-10 line-clamp-2 leading-tight transition-colors text-[15px] ${!ch.isSoldOut && 'group-hover:text-blue-600'}`}>{ch.title}</h3>
                <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                  <div className="flex flex-col"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">Subscribers</span><span className="text-[12px] font-black text-gray-700">{ch.subscribers.toLocaleString()}명</span></div>
                  <div className="flex flex-col items-end"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">Price</span><span className="text-xl font-black text-blue-600 italic tracking-tighter">₩{ch.price.toLocaleString()}</span></div>
                </div>
              </div>
            </Link>
            <button onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'channel', data: ch }); }} className={`absolute top-4 right-4 p-2.5 rounded-full transition-all shadow-md active:scale-90 z-20 ${isWishlisted(ch.id) ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-100' : 'bg-white/80 backdrop-blur-md text-gray-400 hover:text-red-500'}`}><svg className="w-4 h-4" fill={isWishlisted(ch.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></button>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ChannelSales;
