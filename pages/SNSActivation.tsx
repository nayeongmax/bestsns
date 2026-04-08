
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const MOCK_REVIEWS: import('@/types').SMMReview[] = [
  { id: 'm01', userId: 'mock', userNickname: '(주)미도**', rating: 5, platform: '인스타그램', productName: '팔로워 1,000명', content: '주문 후 2시간도 안 됐는데 완료됐어요! 팔로워도 안 빠지고 너무 만족스럽습니다. 다음에도 이용할게요.', createdAt: '2025-10-12' },
  { id: 'm02', userId: 'mock', userNickname: 'GREEN***', rating: 5, platform: '유튜브', productName: '구독자 500명', content: '채널 초반에 구독자 수가 너무 적어서 신뢰도가 떨어졌는데 이용 후 광고 단가도 올라가고 자연 유입도 늘었어요. 완전 추천!', createdAt: '2025-10-18' },
  { id: 'm03', userId: 'mock', userNickname: '스마트**', rating: 4, platform: '틱톡', productName: '좋아요 2,000개', content: '처리 속도가 빠르고 품질이 좋습니다. 다음에는 팔로워도 주문해볼 생각입니다. 고객센터 응대도 친절해요.', createdAt: '2025-10-25' },
  { id: 'm04', userId: 'mock', userNickname: 'ADMA***', rating: 5, platform: '인스타그램', productName: '좋아요 500개', content: '게시물 노출이 확실히 늘었어요! 탐색 탭에도 뜨기 시작했고 자연 반응도 생겨서 너무 좋습니다.', createdAt: '2025-11-02' },
  { id: 'm05', userId: 'mock', userNickname: '(주)한강**', rating: 5, platform: '유튜브', productName: '조회수 10,000회', content: '알고리즘 타는 데 확실히 도움이 됐습니다. 영상 올린 지 3일 만에 유입이 폭발적으로 늘었어요. 재구매 의사 100%!', createdAt: '2025-11-08' },
  { id: 'm06', userId: 'mock', userNickname: 'DIGI****', rating: 5, platform: '트위터', productName: '팔로워 300명', content: '빠른 처리에 감동받았어요. 트위터 마케팅 처음 해보는데 이 사이트 덕분에 자신감이 생겼습니다.', createdAt: '2025-11-14' },
  { id: 'm07', userId: 'mock', userNickname: '브랜드**', rating: 4, platform: '페이스북', productName: '페이지 좋아요 1,000개', content: '페이스북 페이지 신뢰도가 많이 높아졌어요. 광고 효율도 올라가서 이중으로 이득 봤습니다.', createdAt: '2025-11-20' },
  { id: 'm08', userId: 'mock', userNickname: 'MEDIA***', rating: 5, platform: '인스타그램', productName: '릴스 조회수 5,000회', content: '릴스 처음 시작했는데 알고리즘 진입이 너무 어려웠어요. 여기서 조회수 올리고 나서 자연 조회수가 10만을 넘겼어요!', createdAt: '2025-11-26' },
  { id: 'm09', userId: 'mock', userNickname: '마케팅**', rating: 5, platform: '유튜브', productName: '좋아요 1,000개', content: '영상 퀄리티는 좋은데 초반 반응이 없어서 고민이었는데 여기서 도움받고 구독자가 꾸준히 늘고 있어요.', createdAt: '2025-12-03' },
  { id: 'm10', userId: 'mock', userNickname: 'VIRAL***', rating: 5, platform: '틱톡', productName: '팔로워 2,000명', content: '틱톡 팔로워 2천 주문했는데 하루 만에 완료! 팔로워 수 늘고 나서 팔로우 신청도 자연적으로 많이 들어와요.', createdAt: '2025-12-09' },
  { id: 'm11', userId: 'mock', userNickname: '온라인**', rating: 4, platform: '인스타그램', productName: '스토리 뷰 3,000회', content: '스토리 반응율이 올라가서 DM 문의도 늘었어요. 쇼핑몰 운영하는 분들께 강력 추천합니다!', createdAt: '2025-12-15' },
  { id: 'm12', userId: 'mock', userNickname: '김사장**', rating: 5, platform: '유튜브', productName: '구독자 1,000명', content: '수익화 기준 달성하는 데 정말 큰 도움이 됐어요. 1,000명 채우고 나서 수익화 신청했고 통과됐습니다. 감사해요!', createdAt: '2025-12-22' },
  { id: 'm13', userId: 'mock', userNickname: 'SMART***', rating: 5, platform: '인스타그램', productName: '팔로워 5,000명', content: '인플루언서 첫 단계인 5천 팔로워 달성! 협찬 문의도 들어오기 시작했습니다. 사이트 믿고 맡겨도 됩니다.', createdAt: '2025-12-28' },
  { id: 'm14', userId: 'mock', userNickname: '(주)파란**', rating: 5, platform: '틱톡', productName: '조회수 50,000회', content: '바이럴 영상 만들고 초반 조회수가 필요했는데 여기서 해결했습니다. 결국 100만뷰 영상 만들었어요!', createdAt: '2026-01-04' },
  { id: 'm15', userId: 'mock', userNickname: '박대표**', rating: 4, platform: '페이스북', productName: '게시물 좋아요 500개', content: '페이스북은 요즘 유기적 도달이 너무 낮아서 힘들었는데 이걸로 보완하니 훨씬 낫네요. 만족스럽습니다.', createdAt: '2026-01-10' },
  { id: 'm16', userId: 'mock', userNickname: 'GROW****', rating: 5, platform: '인스타그램', productName: '팔로워 10,000명', content: '1만 팔로워 달성 기념으로 후기 남겨요! 처음에 반신반의했는데 품질이 정말 좋아서 놀랐습니다. 계속 이용할게요.', createdAt: '2026-01-17' },
  { id: 'm17', userId: 'mock', userNickname: 'SNS전문**', rating: 4, platform: '유튜브', productName: '조회수 5,000회', content: '처음엔 반신반의했지만 조회수 올라가고 나서 알고리즘 유입이 실제로 늘었어요. 만족스럽게 잘 이용하고 있습니다!', createdAt: '2026-01-23' },
  { id: 'm18', userId: 'mock', userNickname: '이팀장**', rating: 5, platform: '트위터', productName: '리트윗 1,000회', content: '캠페인 바이럴에 활용했어요. 트위터 트렌드에도 올라가고 언론에서도 주목해줬습니다. 대박 효과!', createdAt: '2026-01-30' },
  { id: 'm19', userId: 'mock', userNickname: 'REACH***', rating: 5, platform: '인스타그램', productName: '좋아요 1,000개', content: '인스타 운영 3년 됐는데 이 서비스 알고 나서 성장 속도가 완전히 달라졌어요. 정말 효과적입니다.', createdAt: '2026-02-05' },
  { id: 'm20', userId: 'mock', userNickname: '(주)빛나**', rating: 5, platform: '틱톡', productName: '팔로워 5,000명', content: '틱톡 크리에이터 도전 중인데 이 서비스 덕분에 브랜드 협업 제안이 왔어요. 정말 감사합니다!', createdAt: '2026-02-11' },
  { id: 'm21', userId: 'mock', userNickname: '콘텐츠**', rating: 4, platform: '유튜브', productName: '댓글 100개', content: '댓글 주문은 처음이었는데 자연스러운 내용들이라 콘텐츠 퀄리티 올라간 느낌이에요. 좋습니다!', createdAt: '2026-02-17' },
  { id: 'm22', userId: 'mock', userNickname: 'BOOST***', rating: 5, platform: '인스타그램', productName: '팔로워 2,000명', content: '소상공인인데 인스타 마케팅으로 매출이 정말 많이 늘었어요. 팔로워 늘리고 나서 방문 손님도 많아졌습니다.', createdAt: '2026-02-23' },
  { id: 'm23', userId: 'mock', userNickname: '최마케**', rating: 5, platform: '유튜브', productName: '구독자 2,000명', content: '교육 채널 운영 중인데 구독자 늘리고 나서 강의 수강 신청도 많아졌어요. 교육 사업에도 효과 만점!', createdAt: '2026-03-01' },
  { id: 'm24', userId: 'mock', userNickname: 'TREND***', rating: 5, platform: '틱톡', productName: '좋아요 10,000개', content: '경쟁이 치열한 틱톡에서 초반에 반응 만들기가 너무 어려웠는데 여기서 해결했습니다. 알고리즘 완전 탔어요!', createdAt: '2026-03-05' },
  { id: 'm25', userId: 'mock', userNickname: '(주)나래**', rating: 4, platform: '인스타그램', productName: '릴스 좋아요 2,000개', content: '릴스 좋아요 올리고 나서 도달률이 3배 늘었어요. 브랜드 계정 운영하시는 분들께 추천드립니다.', createdAt: '2026-03-08' },
  { id: 'm26', userId: 'mock', userNickname: '소상공**', rating: 5, platform: '유튜브', productName: '조회수 50,000회', content: '신규 채널인데 알고리즘 진입이 너무 힘들었어요. 여기서 조회수 올리고 나서 인기 동영상에 등록됐습니다!', createdAt: '2026-03-12' },
  { id: 'm27', userId: 'mock', userNickname: 'CLICK***', rating: 5, platform: '인스타그램', productName: '팔로워 500명', content: '가격 대비 효과가 정말 좋아요. 팔로워 품질도 좋고 이탈률도 낮아요. 작은 금액으로 큰 효과 봤습니다.', createdAt: '2026-03-16' },
  { id: 'm28', userId: 'mock', userNickname: '정사장**', rating: 5, platform: '틱톡', productName: '팔로워 1,000명', content: '처음에 의심했는데 친구 추천으로 이용해봤어요. 결과가 너무 좋아서 주변에도 적극 추천하고 있습니다.', createdAt: '2026-03-19' },
  { id: 'm29', userId: 'mock', userNickname: 'FLUX****', rating: 4, platform: '페이스북', productName: '그룹 멤버 500명', content: '커뮤니티 초반 활성화에 큰 도움이 됐어요. 멤버가 늘고 나서 자연 가입도 꾸준히 이어지고 있습니다.', createdAt: '2026-03-23' },
  { id: 'm30', userId: 'mock', userNickname: '(주)드림**', rating: 5, platform: '인스타그램', productName: '팔로워 3,000명', content: '패션 계정 운영 중인데 팔로워 늘고 협찬 제안이 쏟아지네요! 이 사이트 덕분에 협업이 성사됐습니다.', createdAt: '2026-03-27' },
];

const NEGATIVE_KEYWORDS = ['사기', '환불', '가짜', '허위', '불량', '최악', '쓰레기', '불만', '실망', '형편없', '별로', '노출', '속임', '차단', '신고', '폰지', '다단계'];

import { useNavigate, Link } from 'react-router-dom';
import { SNS_PLATFORMS } from '../constants';
import { SelectedOption, SMMProduct, SMMProvider, UserProfile, SMMOrder, Notice, SMMSource, SMMReview } from '@/types';
import { updateProfile } from '../profileDb';
import { fetchSmmReviews, insertSmmReview, recordProviderAttemptAdmin } from '../smmDb';
import { useConfirm } from '@/contexts/ConfirmContext';
import AdBanner from '@/components/AdBanner';
import CoupangSidebarBanner from '@/components/CoupangSidebarBanner';
import BannerRotator from '@/components/BannerRotator';

interface Props {
  smmProducts: SMMProduct[];
  providers: SMMProvider[];
  user: UserProfile;
  notices: Notice[];
  onOrderComplete: (order: SMMOrder) => void;
  onLogout: () => void;
}

const SNSActivation: React.FC<Props> = ({ smmProducts, providers, user, notices, onOrderComplete, onLogout }) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useConfirm();
  const [selectedPlatform, setSelectedPlatform] = useState('인스타그램');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [comments, setComments] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 리뷰 섹션 상태
  const [smmReviews, setSmmReviews] = useState<SMMReview[]>([]);
  const [myReviewRating, setMyReviewRating] = useState(5);
  const [myReviewContent, setMyReviewContent] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [myReviewPlatform, setMyReviewPlatform] = useState('인스타그램');
  const [reviewSlideIdx, setReviewSlideIdx] = useState(0);
  const reviewSliderPaused = useRef(false);

  // App.tsx에서 전달받은 user.points(크레딧)를 사용 (전역 동기화)
  const userPoints = user.points || 0;

  const [mainIdx, setMainIdx] = useState(0);
  const mainSequence = ["대한민국", "SMM 대표 마케팅", "대행사 12,000곳이", "사용하는", "마케팅 원천 사이트", "BESTSNS"];

  useEffect(() => {
    const mainInterval = setInterval(() => setMainIdx(prev => (prev + 1) % mainSequence.length), 1200);
    return () => clearInterval(mainInterval);
  }, [mainSequence.length]);

  useEffect(() => {
    fetchSmmReviews().then(setSmmReviews).catch(() => {});
  }, []);

  const allReviewsForSlider = useMemo(() => {
    return [...MOCK_REVIEWS, ...smmReviews].filter(r => {
      if (r.rating <= 3) return false;
      const text = r.content.toLowerCase();
      if (NEGATIVE_KEYWORDS.some(kw => text.includes(kw))) return false;
      return true;
    });
  }, [smmReviews]);

  const goToReviewSlide = useCallback((idx: number) => {
    setReviewSlideIdx(idx < 0 ? allReviewsForSlider.length - 1 : idx >= allReviewsForSlider.length ? 0 : idx);
  }, [allReviewsForSlider.length]);

  useEffect(() => {
    if (allReviewsForSlider.length <= 1) return;
    const timer = setInterval(() => {
      if (!reviewSliderPaused.current) {
        setReviewSlideIdx(prev => (prev + 1) % allReviewsForSlider.length);
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [allReviewsForSlider.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isGuest = !user.id;
  const activeProviderIds = useMemo(() => new Set(providers.filter(p => !p.isHidden).map(p => p.id)), [providers]);

  // 선택한 플랫폼에 해당하는 상품들 중에서 카테고리 목록 추출 (어드민에서 입력한 카테고리 분류)
  const categoriesForPlatform = useMemo(() => {
    const set = new Set<string>();
    (smmProducts || []).forEach(p => {
      if (p.platform !== selectedPlatform || p.isHidden) return;
      const hasActiveSource = (p.sources || []).length === 0 || (p.sources || []).some(s => activeProviderIds.has(s.providerId));
      if (!hasActiveSource) return;
      const cat = (p.category || '').trim();
      set.add(cat || '기타');
    });
    const list = Array.from(set).filter(Boolean).sort((a, b) => (a === '기타' ? 1 : 0) - (b === '기타' ? 1 : 0));
    return list.length ? list : [];
  }, [selectedPlatform, smmProducts, activeProviderIds]);

  // 플랫폼 변경 시 카테고리·상품 초기화: 해당 플랫폼의 첫 번째 카테고리 선택
  useEffect(() => {
    if (categoriesForPlatform.length > 0) {
      setSelectedCategory(categoriesForPlatform[0]);
    } else {
      setSelectedCategory('');
    }
    setSelectedProductId('');
    setComments('');
  }, [selectedPlatform, categoriesForPlatform]);

  const filteredProducts = useMemo(() =>
    (smmProducts || []).filter(p => {
      const isVisible = !p.isHidden;
      const hasActiveSource = (p.sources || []).length === 0 || (p.sources || []).some(s => activeProviderIds.has(s.providerId));
      const platformMatch = p.platform === selectedPlatform && isVisible && hasActiveSource;
      if (!platformMatch) return false;
      if (categoriesForPlatform.length === 0) return true;
      const cat = (p.category || '').trim() || '기타';
      return selectedCategory === '' || cat === selectedCategory;
    }).sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
  [selectedPlatform, selectedCategory, smmProducts, activeProviderIds, categoriesForPlatform]);

  const selectedProduct = useMemo(() => (smmProducts || []).find(p => p.id === selectedProductId), [selectedProductId, smmProducts]);

  const isCommentProduct = useMemo(() =>
    !!(selectedProduct && (selectedProduct.name.includes('댓글') || (selectedProduct.category || '').includes('댓글'))),
    [selectedProduct]
  );

  const isCustomProduct = useMemo(() =>
    !!(selectedProduct && selectedProduct.name.includes('커스텀')),
    [selectedProduct]
  );

  // 합집합 수량: 모든 활성 소스 중 가장 낮은 min ~ 가장 높은 max (예: A 10~100000, B 10~1000000 → 10~1000000)
  // 주문 수량에 맞는 소스를 자동 선택하므로 소스 중 하나라도 커버 가능하면 주문 허용
  const effectiveQuantityRange = useMemo(() => {
    if (!selectedProduct) return { min: 0, max: 999999999 };
    const active = (selectedProduct.sources || []).filter(s => activeProviderIds.has(s.providerId));
    if (active.length === 0) return { min: selectedProduct.minQuantity ?? 0, max: selectedProduct.maxQuantity ?? 999999999 };
    const mins = active.map(s => s.minQuantity ?? selectedProduct.minQuantity ?? 0);
    const maxs = active.map(s => s.maxQuantity ?? selectedProduct.maxQuantity ?? 999999999);
    return { min: Math.min(...mins), max: Math.max(...maxs) };
  }, [selectedProduct, activeProviderIds]);

  const handleSubmitReview = async () => {
    if (isGuest) { showAlert({ title: '로그인 필요', description: '로그인 후 이용 가능합니다.' }); return; }
    if (!myReviewContent.trim()) { showAlert({ title: '내용 입력', description: '리뷰 내용을 입력해주세요.' }); return; }
    setIsSubmittingReview(true);
    try {
      await insertSmmReview({
        userId: user.id,
        userNickname: user.nickname ?? '',
        productName: selectedProduct?.name ?? 'SMM 서비스',
        platform: myReviewPlatform,
        rating: myReviewRating,
        content: myReviewContent.trim(),
      });
      setMyReviewContent('');
      setMyReviewRating(5);
      setReviewSubmitted(true);
      const updated = await fetchSmmReviews();
      setSmmReviews(updated);
    } catch {
      showAlert({ title: '오류', description: '리뷰 등록 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddOption = () => {
    if (isGuest) {
      showConfirm({
        title: '로그인 필요',
        description: '로그인 후 이용 가능합니다. 로그인 페이지로 이동할까요?',
        confirmLabel: '이동',
        cancelLabel: '취소',
        danger: false,
        onConfirm: () => navigate('/login'),
      });
      return;
    }
    if (!selectedProductId || !link || quantity <= 0) return void showAlert({ description: '정보를 모두 입력하세요.' });
    if (!selectedProduct) return;

    // 커스텀 상품: 댓글 입력 필수, 수량을 줄 수로 자동 설정
    let finalQuantity = quantity;
    if (isCustomProduct) {
      if (!comments.trim()) return void showAlert({ description: '커스텀 댓글을 입력해주세요. (1줄에 댓글 1개)' });
      const lineCount = comments.trim().split('\n').filter(l => l.trim()).length;
      finalQuantity = lineCount;
    }

    const { min: minQ, max: maxQ } = effectiveQuantityRange;
    if (finalQuantity < minQ) return void showAlert({ description: `최소 주문량 ${minQ.toLocaleString()}개 이상 가능합니다. 현재 댓글 ${finalQuantity}개 입력됨.` });
    if (finalQuantity > maxQ) return void showAlert({ description: `최대 주문량 ${maxQ.toLocaleString()}개 이하로 입력해주세요. 현재 댓글 ${finalQuantity}개 입력됨.` });

    const newOption: SelectedOption = {
      id: Date.now().toString(),
      serviceId: selectedProduct.id,
      serviceName: selectedProduct.name,
      link: link,
      unitPrice: selectedProduct.sellingPrice || 0,
      quantity: finalQuantity,
      totalPrice: Math.floor(finalQuantity * (selectedProduct.sellingPrice || 0)),
      ...((isCommentProduct || isCustomProduct) && comments.trim() ? { comments: comments.trim() } : {}),
    };
    setSelectedOptions([...selectedOptions, newOption]);
    setLink('');
    setQuantity(0);
    setComments('');
  };

  const totalOrderAmount = selectedOptions.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const handleOrder = async () => {
    if (isGuest) return navigate('/login');
    if (selectedOptions.length === 0) return void showAlert({ description: '주문할 항목이 없습니다.' });
    if (totalOrderAmount > userPoints) return void showAlert({ description: '보유 크레딧이 부족합니다. 크레딧 구매 페이지에서 구매해주세요.' });
    
    showConfirm({
      title: '주문 확인',
      description: `총 ${(totalOrderAmount ?? 0).toLocaleString()}C를 사용하여 주문을 접수할까요?`,
      confirmLabel: '결제하기',
      cancelLabel: '취소',
      danger: false,
      onConfirm: () => doOrder(),
    });
  };

  const doOrder = async () => {
    setIsProcessing(true);
    try {
      // 주문 수량 검증: 합집합 기준 (소스 중 하나라도 커버 가능하면 허용)
      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product) continue;
        const active = (product.sources || []).filter(s => activeProviderIds.has(s.providerId));
        const minQ = active.length === 0 ? (product.minQuantity ?? 0) : Math.min(...active.map(s => s.minQuantity ?? product.minQuantity ?? 0));
        const maxQ = active.length === 0 ? (product.maxQuantity ?? 999999999) : Math.max(...active.map(s => s.maxQuantity ?? product.maxQuantity ?? 999999999));
        if (opt.quantity < minQ || opt.quantity > maxQ) {
          showAlert({ description: `"${product.name}" 주문 수량이 허용 범위(최소 ${minQ.toLocaleString()}~최대 ${maxQ.toLocaleString()}개)를 벗어났습니다.` });
          setIsProcessing(false);
          return;
        }
      }

      // 포인트 차감 처리 (전역 업데이트 요청)
      const nextPoints = userPoints - totalOrderAmount;
      window.dispatchEvent(new CustomEvent('site-user-update', {
        detail: { ...user, points: nextPoints },
      }));
      updateProfile(user.id, { points: nextPoints }).catch((e) => console.warn('SNS 주문 포인트 차감 DB 반영 실패:', e));

      let totalRefund = 0;
      for (const opt of selectedOptions) {
        const product = smmProducts.find(p => p.id === opt.serviceId);
        if (!product || !product.sources?.length) {
          console.warn(`[주문] 상품(${opt.serviceId}) 없음 또는 소스 없음 → 환불 처리`);
          totalRefund += opt.totalPrice;
          continue;
        }

        // 활성화된 공급처 AND 주문 수량이 해당 소스 min~max 범위 내인 것만 선택
        const validActiveSources = product.sources.filter(s => {
          if (!activeProviderIds.has(s.providerId)) return false;
          const srcMin = s.minQuantity ?? product.minQuantity ?? 0;
          const srcMax = s.maxQuantity ?? product.maxQuantity ?? 999999999;
          return opt.quantity >= srcMin && opt.quantity <= srcMax;
        });
        if (validActiveSources.length === 0) {
          console.warn(`[주문] 유효한 소스 없음 (product:${product.name}, qty:${opt.quantity}, activeProviders:[${[...activeProviderIds].join(',')}], sources:[${product.sources.map(s=>s.providerId+'/'+s.serviceId).join(',')}]) → 환불 처리`);
          totalRefund += opt.totalPrice;
          continue;
        }

        // 우선순위 순으로 정렬 (관리자 설정 priority → 가격 낮은 순 → 시간 빠른 순), 순서대로 모두 시도
        const sortedSources = [...validActiveSources].sort((a, b) => {
          const providerA = providers.find(p => p.id === a.providerId);
          const providerB = providers.find(p => p.id === b.providerId);
          const prioA = providerA?.priority ?? 99;
          const prioB = providerB?.priority ?? 99;
          if (prioA !== prioB) return prioA - prioB;
          const costA = a.costPrice ?? 0;
          const costB = b.costPrice ?? 0;
          if (costA !== costB) return costA - costB;
          return (a.estimatedMinutes ?? 999999) - (b.estimatedMinutes ?? 999999);
        });

        let orderPlaced = false;
        for (const source of sortedSources) {
          const provider = providers.find(p => p.id === source.providerId);
          if (!provider) continue;

          try {
            const resp = await fetch('/.netlify/functions/smm-api', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'submit',
                providerId: source.providerId,
                apiUrl: provider.apiUrl,
                serviceId: source.serviceId,
                link: opt.link,
                quantity: opt.quantity,
                ...(opt.comments ? { comments: opt.comments } : {})
              })
            });
            const result = await resp.json();
            console.log(`[주문시도] provider:${source.providerId} service:${source.serviceId} qty:${opt.quantity} → status:${result.status} orderId:${result.orderId || '-'} msg:${result.message || '-'}`);
            if (result.status === 'success' && result.orderId) {
              // 성공 통계 기록
              recordProviderAttemptAdmin(source.providerId, true).catch(e => console.warn('[stats]', e));
              const order: SMMOrder = {
                id: `ORD${Date.now()}${Math.floor(Math.random()*100)}`,
                userId: user.id,
                userNickname: user.nickname,
                orderTime: new Date().toISOString(),
                platform: product.platform,
                productName: product.name,
                link: opt.link,
                quantity: opt.quantity,
                initialCount: 0,
                remains: opt.quantity,
                providerName: provider.name,
                costPrice: source.costPrice || 0,
                sellingPrice: product.sellingPrice || 0,
                profit: Math.floor(opt.totalPrice - ((source.costPrice || 0) / 1000 * opt.quantity)),
                status: '진행중',
                externalOrderId: result.orderId
              };
              onOrderComplete(order);
              orderPlaced = true;
              break;
            } else {
              // 실패 통계 기록
              recordProviderAttemptAdmin(source.providerId, false).catch(e => console.warn('[stats]', e));
              console.error('[주문실패] serviceId:', source.serviceId, '|', result.message);
            }
          } catch (e) {
            // 네트워크 오류도 실패로 기록
            recordProviderAttemptAdmin(source.providerId, false).catch(err => console.warn('[stats]', err));
            console.error('[주문실패] 네트워크/파싱 오류 - serviceId:', source.serviceId, e);
          }
        }

        // 모든 소스 실패 → 주문취소 내역 저장 + 포인트 환불 예약 + 카카오 알림
        if (!orderPlaced) {
          const fallbackProvider = providers.find(p => p.id === sortedSources[0]?.providerId);
          const canceledOrder: SMMOrder = {
            id: `ORD${Date.now()}${Math.floor(Math.random()*100)}`,
            userId: user.id,
            userNickname: user.nickname,
            orderTime: new Date().toISOString(),
            platform: product.platform,
            productName: product.name,
            link: opt.link,
            quantity: opt.quantity,
            initialCount: 0,
            remains: 0,
            providerName: fallbackProvider?.name || '',
            costPrice: sortedSources[0]?.costPrice || 0,
            sellingPrice: product.sellingPrice || 0,
            profit: 0,
            status: '주문취소',
            externalOrderId: 'FAILED'
          };
          onOrderComplete(canceledOrder);
          totalRefund += opt.totalPrice;
          // 카카오 알림톡: 모든 공급처 실패 시 운영자에게 알림
          fetch('/.netlify/functions/kakao-notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order_all_failed',
              productName: product.name,
              platform: product.platform,
              quantity: opt.quantity,
              userId: user.id,
              userNickname: user.nickname,
              triedProviders: sortedSources.map(s => s.providerId).join(', '),
            }),
          }).catch(e => console.warn('[kakao] 알림 실패:', e));
        }
      }

      // 실패 항목 포인트 환불
      if (totalRefund > 0) {
        const refundedPoints = nextPoints + totalRefund;
        window.dispatchEvent(new CustomEvent('site-user-update', {
          detail: { ...user, points: refundedPoints },
        }));
        updateProfile(user.id, { points: refundedPoints }).catch(e => console.warn('환불 포인트 DB 반영 실패:', e));
      }

      window.dispatchEvent(new CustomEvent('user-new-order', { detail: { amount: totalOrderAmount - totalRefund } }));
      showAlert({ description: totalRefund > 0
        ? `일부 주문이 모든 공급처에서 실패하여 ${totalRefund.toLocaleString()}C가 환불되었습니다. 마이페이지에서 현황을 확인하세요.`
        : '성공적으로 주문되었습니다! 마이페이지에서 현황을 확인하세요.'
      });
      setSelectedOptions([]);
      navigate('/mypage');
    } catch (err) {
      showAlert({ description: '주문 처리 중 오류 발생' });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkLink = () => {
    if (!link.trim()) return void showAlert({ description: '게시물 링크를 입력해주세요.' });
    window.open(link.startsWith('http') ? link : `https://${link}`, '_blank');
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-4 sm:space-y-6 md:space-y-10 pb-24 sm:pb-24 md:pb-32 px-3 sm:px-4 md:px-8">
      <div className="relative overflow-hidden bg-[#050505] rounded-xl sm:rounded-2xl md:rounded-[32px] shadow-2xl min-h-[140px] sm:min-h-[200px] md:min-h-[220px] flex flex-col justify-center items-center border-2 md:border-4 border-white/10 group">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent top-[15%] animate-saber-run shadow-[0_0_30px_#00f2ff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#ff0095] to-transparent top-[45%] animate-saber-run-delay-1 shadow-[0_0_30px_#ff0095,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#004cff] to-transparent top-[80%] animate-saber-run-delay-2 shadow-[0_0_30px_#004cff,0_0_10px_#fff]"></div>
          <div className="saber-streak bg-gradient-to-r from-transparent via-[#bc00ff] to-transparent top-[30%] animate-saber-run-delay-3 shadow-[0_0_30px_#bc00ff,0_0_10px_#fff]"></div>
        </div>
        
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 md:top-4">
           <div className="px-4 py-1.5 md:px-6 md:py-2 bg-black/60 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-2 md:gap-2.5">
             <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_#ef4444]"></div>
             <span className="text-[9px] md:text-[11px] font-black italic tracking-[0.15em] md:tracking-[0.2em] uppercase text-white leading-none">24HR REAL-TIME SYSTEM</span>
           </div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center text-center px-3 pt-10 pb-6 sm:pt-12 sm:pb-8 md:pt-14 md:pb-10">
           <h1 key={`main-${mainIdx}`} className="text-2xl sm:text-5xl md:text-6xl font-black text-white italic tracking-tighter animate-punch-in leading-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
             {mainSequence[mainIdx]}
           </h1>
        </div>
      </div>

      {/* 업체 배너 광고: 히어로 바로 아래 */}
      {/* 모바일: 자유게시판과 동일한 높이 80 */}
      <BannerRotator cols={2} mode="sequential" location="sns" height={80} className="lg:hidden" />
      {/* 데스크톱: 기존 높이 유지 */}
      <BannerRotator cols={2} mode="sequential" location="sns" height={130} className="hidden lg:grid" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 md:gap-10">
        {/* 우측 사이드바 */}
        <div className="lg:col-span-4 order-1 lg:order-2">
          {/* 모바일에서만 상단에 My Wallet 노출 */}
          <div className="lg:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4">
            <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] tracking-widest px-1 mb-3">
              <span className="w-1 h-3 bg-blue-600 rounded-full"></span> My Wallet
            </h3>
            <div className="bg-[#111827] rounded-xl p-4 text-white relative overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
              <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase italic tracking-widest">Available Credits</p>
                  <p className="text-xl font-black italic tracking-tighter leading-none">{(userPoints ?? 0).toLocaleString()} <span className="text-xs text-gray-500 not-italic font-bold">C</span></p>
                </div>
                <button type="button" onClick={() => isGuest ? navigate('/login') : navigate('/credit/apply')} className="bg-blue-600 text-white py-2.5 px-4 rounded-xl text-[12px] font-black shrink-0">
                  크레딧 구매
                </button>
              </div>
            </div>
          </div>

          {/* 데스크톱: 공지사항 + 월렛 + 장바구니 + 쿠팡 광고 전체 고정 (sticky) */}
          <div className="hidden lg:flex flex-col gap-5 sticky top-24">
            {/* 공지사항 */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-gray-100 space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] sm:text-[12px] tracking-widest">
                   <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span> 공지사항
                </h3>
                <button type="button" onClick={() => navigate('/notices')} className="text-[9px] sm:text-[10px] font-black text-gray-400 hover:text-blue-600 transition-all uppercase italic">전체보기 +</button>
              </div>
              <div className="space-y-2.5">
                 {notices.filter(n => !n.isHidden).slice(0, 3).map(n => (
                   <div key={n.id} onClick={() => navigate('/notices')} className="p-3 bg-gray-50/50 rounded-xl hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-100 group">
                      <p className="text-[12px] font-black text-gray-800 break-words mb-0.5 group-hover:text-blue-600">{n.title}</p>
                      <span className="text-[9px] font-bold text-gray-300 uppercase italic">{n.date}</span>
                   </div>
                 ))}
              </div>
            </div>

            {/* My Wallet */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[32px] shadow-sm border border-gray-100 space-y-4 sm:space-y-6">
              <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] sm:text-[12px] tracking-widest px-1">
                <span className="w-1 h-3 sm:h-3.5 bg-blue-600 rounded-full"></span> My Wallet
              </h3>
              <div className="bg-[#111827] rounded-xl sm:rounded-[24px] p-4 sm:p-6 text-white relative overflow-hidden shadow-xl">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
                 <div className="relative z-10 space-y-3 sm:space-y-4">
                   <div className="flex justify-between items-center">
                     <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase italic tracking-widest">Available Credits</p>
                     <span className="text-[8px] sm:text-[9px] bg-white/10 px-1.5 sm:px-2 py-0.5 rounded font-bold text-white/40 uppercase">Real-time sync</span>
                   </div>
                   <h4 className="text-2xl sm:text-3xl font-black italic tracking-tighter leading-none break-all">{(userPoints ?? 0).toLocaleString()} <span className="text-xs sm:text-sm text-gray-500 not-italic uppercase ml-0.5 font-bold">C</span></h4>
                   <button type="button" onClick={() => isGuest ? navigate('/login') : navigate('/credit/apply')} className="w-full bg-blue-600 text-white py-3 sm:py-3.5 rounded-xl text-[12px] sm:text-[13px] font-black shadow-lg hover:bg-white hover:text-blue-600 transition-all uppercase italic tracking-wider">
                     크레딧 구매
                   </button>
                 </div>
              </div>
            </div>

            {/* 주문 장바구니 (사이드바 컴팩트) */}
            {selectedOptions.length > 0 && (
              <div className="bg-[#f2f8ff] border border-[#d0e5ff] rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-black text-blue-900 italic uppercase flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full shrink-0"></span>
                  주문 장바구니
                </h3>
                <div className="space-y-2">
                  {selectedOptions.map((opt, idx) => (
                    <div key={opt.id} className="bg-white rounded-xl p-3 flex justify-between items-start gap-2 border border-blue-50">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-black text-blue-500 uppercase italic">{idx + 1}. Package</span>
                        <p className="font-black text-gray-900 text-[12px] truncate">{opt.serviceName}</p>
                        <p className="text-[10px] font-bold text-gray-400 truncate italic">{opt.link}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-blue-600 italic">{(opt.totalPrice ?? 0).toLocaleString()}C</span>
                        <button type="button" onClick={() => setSelectedOptions(selectedOptions.filter(o => o.id !== opt.id))} className="text-red-200 hover:text-red-500 font-black text-sm" aria-label="삭제">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center px-1 pt-1 border-t border-blue-100">
                  <span className="text-[11px] font-black text-blue-900 italic">총 크레딧</span>
                  <span className="text-lg font-black text-blue-600 italic">{(totalOrderAmount ?? 0).toLocaleString()}C</span>
                </div>
                <button type="button" onClick={handleOrder} disabled={isProcessing} className={`w-full py-3 rounded-xl font-black text-sm uppercase italic tracking-widest transition-all ${isProcessing ? 'bg-gray-400 text-white' : 'bg-black text-white hover:bg-blue-600'}`}>
                  {isProcessing ? '🚀 요청 중...' : '🚀 주문하기'}
                </button>
              </div>
            )}

            {/* 쿠팡 세로형 광고 배너 */}
            <CoupangSidebarBanner />
          </div>

          {/* 모바일 공지사항 */}
          <div className="lg:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4 mt-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-gray-900 italic uppercase flex items-center gap-2.5 text-[11px] tracking-widest">
                 <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping"></span> 공지사항
              </h3>
              <button type="button" onClick={() => navigate('/notices')} className="text-[9px] font-black text-gray-400 hover:text-blue-600 transition-all uppercase italic">전체보기 +</button>
            </div>
            <div className="space-y-2.5">
               {notices.filter(n => !n.isHidden).slice(0, 3).map(n => (
                 <div key={n.id} onClick={() => navigate('/notices')} className="p-3 bg-gray-50/50 rounded-xl hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-gray-100 group">
                    <p className="text-[12px] font-black text-gray-800 break-words mb-0.5 group-hover:text-blue-600">{n.title}</p>
                    <span className="text-[9px] font-bold text-gray-300 uppercase italic">{n.date}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 md:space-y-10 order-2 lg:order-1">
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[56px] shadow-sm border border-gray-100 p-4 sm:p-5 sm:p-8 md:p-14 space-y-6 sm:space-y-8 md:space-y-14">
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-3 sm:gap-4 mb-4 sm:mb-10 text-gray-900 italic uppercase">
                <span className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm shadow-xl font-black italic shrink-0">01</span>
                플랫폼 선택
              </h2>
              <p className="text-xs text-gray-400 mb-2 md:hidden">← 오른쪽으로 밀어 더 많은 플랫폼 보기</p>
              {/* 모바일~태블릿: 가로 스크롤(로고 잘림 방지용 패딩) / md 이상: 그리드 */}
              <div className="w-full min-w-0 md:overflow-visible">
                <div
                  className="w-full max-w-full min-w-0 flex overflow-x-auto overflow-y-visible gap-2 py-3 px-2 -mx-1 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-3 lg:grid-cols-6 lg:gap-6 md:overflow-visible [&::-webkit-scrollbar]:hidden"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  } as React.CSSProperties}
                >
                  {SNS_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPlatform(p.name); setSelectedProductId(''); setSelectedCategory(''); }}
                      className="flex flex-col items-center gap-1.5 sm:gap-4 group shrink-0 w-12 sm:w-12 md:w-auto md:min-w-0 touch-manipulation select-none flex-shrink-0"
                    >
                    <div className={`w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-[36px] flex items-center justify-center transition-all border-2 sm:border-4 relative ${selectedPlatform === p.name ? 'border-blue-600 bg-blue-50 shadow-xl sm:shadow-2xl scale-105 sm:scale-110 md:ring-0 md:ring-offset-0 ring-2 ring-blue-600/30 ring-offset-2 ring-offset-white' : 'border-transparent bg-gray-50'}`}>
                      <img
                        src={p.icon}
                        alt={p.name}
                        className="w-6 h-6 sm:w-10 sm:h-10 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          const fallback = el.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden absolute inset-0 flex items-center justify-center text-lg sm:text-2xl font-black text-gray-400 pointer-events-none" aria-hidden>{p.name[0]}</span>
                    </div>
                    <span className={`text-[10px] sm:text-[13px] font-black italic leading-tight text-center break-normal ${selectedPlatform === p.name ? 'text-blue-600' : 'text-gray-400'}`}>{p.name}</span>
                  </button>
                ))}
                </div>
              </div>
            </div>

            {categoriesForPlatform.length > 0 && (
              <div>
                <h3 className="text-[10px] sm:text-[11px] font-black text-gray-300 uppercase italic tracking-[0.2em] px-1 sm:px-2 mb-4 sm:mb-6">카테고리</h3>
                {/* 모바일: 가로 스크롤 한 줄 */}
                <div className="flex sm:hidden overflow-x-auto gap-2 pb-1">
                  {categoriesForPlatform.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setSelectedProductId(''); }}
                      className={`shrink-0 py-2.5 px-4 rounded-2xl font-black text-[12px] italic uppercase tracking-wide whitespace-nowrap transition-all duration-200 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] scale-[1.03]' : 'bg-white text-gray-400 border border-gray-200 hover:border-blue-300 hover:text-blue-500 hover:shadow-sm'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {/* 데스크탑: 기존 그리드 */}
                <div className="hidden sm:grid gap-4" style={{ gridTemplateColumns: `repeat(${categoriesForPlatform.length}, 1fr)` }}>
                  {categoriesForPlatform.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setSelectedProductId(''); }}
                      className={`w-full py-3.5 rounded-2xl font-black text-[14px] italic uppercase tracking-wide transition-all duration-200 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] scale-[1.03]' : 'bg-white text-gray-400 border border-gray-200 hover:border-blue-300 hover:text-blue-500 hover:shadow-sm'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-8 sm:space-y-12 pt-8 sm:pt-12 border-t border-gray-50">
              {/* 커스텀 드롭다운 */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4">상품 선택</h3>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    className={`w-full p-4 sm:p-6 bg-gray-50 rounded-2xl sm:rounded-[32px] font-black text-left flex items-center justify-between gap-3 transition-all shadow-inner ${isDropdownOpen ? 'bg-white ring-2 ring-blue-100' : 'hover:bg-gray-100'}`}
                  >
                    <span className={`text-sm sm:text-base truncate ${selectedProductId ? 'text-gray-800' : 'text-gray-400'}`}>
                      {selectedProduct ? `${selectedProduct.name} (${(selectedProduct.sellingPrice ?? 0).toLocaleString()}C)` : '서비스를 선택하세요'}
                    </span>
                    <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl sm:rounded-[24px] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="max-h-72 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <div className="px-6 py-5 text-sm text-gray-400 font-bold text-center">등록된 상품이 없습니다.</div>
                        ) : filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedProductId(p.id); setIsDropdownOpen(false); setComments(''); }}
                            className={`w-full text-left px-5 sm:px-7 py-3.5 sm:py-4 text-[15px] sm:text-[17px] font-black transition-all flex items-center justify-between gap-4 ${selectedProductId === p.id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'}`}
                          >
                            <span>{p.name}</span>
                            <span className={`text-[14px] sm:text-[16px] font-black shrink-0 ${selectedProductId === p.id ? 'text-blue-200' : 'text-blue-500'}`}>{(p.sellingPrice ?? 0).toLocaleString()}C</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-8">
                <div className="md:col-span-8 space-y-3 sm:space-y-4">
                  <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4">작업 링크</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:relative">
                    <input type="text" placeholder="https://..." className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm sm:text-base pr-4 sm:pr-24" value={link} onChange={(e) => setLink(e.target.value)} />
                    <button type="button" onClick={checkLink} className="sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2 bg-black text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-[20px] font-black text-[11px] hover:bg-blue-600 transition-all shrink-0">확인 ↗</button>
                  </div>
                </div>
                <div className="md:col-span-4 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 px-1 sm:px-4">
                    <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic">수량</h3>
                    {selectedProduct && (
                      <span className="text-[10px] sm:text-[11px] font-bold text-blue-500 italic whitespace-nowrap">
                        최소 {effectiveQuantityRange.min.toLocaleString()} ~ 최대 {effectiveQuantityRange.max < 999999999 ? effectiveQuantityRange.max.toLocaleString() : '제한없음'}
                      </span>
                    )}
                  </div>
                  <input type="number" placeholder="0" min={effectiveQuantityRange.min} max={effectiveQuantityRange.max < 999999999 ? effectiveQuantityRange.max : undefined} className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm sm:text-base" value={quantity || ''} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>
              </div>
              {isCustomProduct && (
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-[12px] sm:text-[13px] font-black text-gray-400 uppercase italic px-1 sm:px-4">
                    Comments <span className="text-gray-300 font-bold normal-case not-italic">(1 per line)</span>
                  </h3>
                  <textarea
                    rows={5}
                    placeholder={"댓글을 한 줄에 하나씩 입력하세요\n예:\n좋은 게시물이네요!\n정말 멋진 사진이에요!\n계속 응원할게요!"}
                    className="w-full p-4 sm:p-6 bg-gray-50 border-none rounded-2xl sm:rounded-[32px] font-black text-gray-700 shadow-inner outline-none focus:bg-white text-sm sm:text-base resize-none leading-relaxed"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                  <p className="text-[10px] sm:text-[11px] font-bold text-blue-400 italic px-1 sm:px-4">
                    입력한 댓글 수가 주문 수량과 일치해야 합니다. 수량이 입력한 댓글 수로 자동 반영됩니다.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 bg-yellow-400 border-2 border-yellow-500 rounded-2xl px-4 py-3 shadow-sm">
                <span className="text-lg shrink-0">🚫</span>
                <p className="text-[11px] sm:text-[12px] font-black text-red-700 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
                  부적합한 업종(선거, 토토, 바카라, 19금 불법 유흥업소, 다단계 등)의 게시물 불법 작업 사용을 엄격히 제한합니다.
                </p>
              </div>
              <button type="button" onClick={handleAddOption} className="w-full py-5 sm:py-6 md:py-8 bg-blue-600 text-white rounded-2xl sm:rounded-[32px] font-black text-lg sm:text-xl md:text-2xl hover:bg-black shadow-xl sm:shadow-2xl transition-all italic uppercase tracking-widest active:scale-[0.98]">+ 장바구니 담기</button>
            </div>
          </div>
          {/* 모바일용 장바구니 (lg 미만에서만 표시) */}
          {selectedOptions.length > 0 && (
            <div className="lg:hidden bg-[#f2f8ff] border border-[#d0e5ff] rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-black text-blue-900 italic uppercase flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full shrink-0"></span>
                주문 장바구니
              </h3>
              <div className="space-y-2">
                {selectedOptions.map((opt, idx) => (
                  <div key={opt.id} className="bg-white rounded-xl p-3 flex justify-between items-start gap-2 border border-blue-50">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black text-blue-500 uppercase italic">{idx + 1}. Package</span>
                      <p className="font-black text-gray-900 text-[12px] truncate">{opt.serviceName}</p>
                      <p className="text-[10px] font-bold text-gray-400 truncate italic">{opt.link}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-blue-600 italic">{(opt.totalPrice ?? 0).toLocaleString()}C</span>
                      <button type="button" onClick={() => setSelectedOptions(selectedOptions.filter(o => o.id !== opt.id))} className="text-red-200 hover:text-red-500 font-black text-sm" aria-label="삭제">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-1 pt-1 border-t border-blue-100">
                <span className="text-[11px] font-black text-blue-900 italic">총 크레딧</span>
                <span className="text-lg font-black text-blue-600 italic">{(totalOrderAmount ?? 0).toLocaleString()}C</span>
              </div>
              <button type="button" onClick={handleOrder} disabled={isProcessing} className={`w-full py-3 rounded-xl font-black text-sm uppercase italic tracking-widest transition-all ${isProcessing ? 'bg-gray-400 text-white' : 'bg-black text-white hover:bg-blue-600'}`}>
                {isProcessing ? '🚀 요청 중...' : '🚀 주문하기'}
              </button>
            </div>
          )}

          {/* ── SMM 이용 후기 섹션 ── */}
          {(() => {
            const rawAvg = allReviewsForSlider.length > 0
              ? Math.round((allReviewsForSlider.reduce((sum, r) => sum + r.rating, 0) / allReviewsForSlider.length) * 10) / 10
              : 0;
            const avgRating = Math.max(rawAvg, 4.9);
            const renderStars = (rating: number, interactive = false, onSelect?: (n: number) => void) => (
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <span
                    key={n}
                    onClick={() => interactive && onSelect && onSelect(n)}
                    className={`text-lg sm:text-xl ${interactive ? 'cursor-pointer hover:scale-125 transition-transform' : ''} ${n <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
                  >★</span>
                ))}
              </div>
            );
            const getPlatformIcon = (platform: string) => {
              if (platform === '인스타그램') return (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="1" width="22" height="22" rx="6" fill="#E1306C"/>
                  <rect x="5" y="5" width="14" height="14" rx="3.5" fill="none" stroke="white" strokeWidth="1.5"/>
                  <circle cx="12" cy="12" r="3.5" fill="none" stroke="white" strokeWidth="1.5"/>
                  <circle cx="17.2" cy="6.8" r="1.2" fill="white"/>
                </svg>
              );
              if (platform === '유튜브') return (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="4" width="22" height="16" rx="5" fill="#FF0000"/>
                  <polygon points="10,8.5 10,15.5 17,12" fill="white"/>
                </svg>
              );
              if (platform === '틱톡') return (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="1" width="22" height="22" rx="5" fill="#000000"/>
                  <path d="M16 5.5c.5 1.5 1.8 2.5 3 2.5v2.5c-1 0-2-.3-2.8-.9V15a4.2 4.2 0 1 1-4.2-4.2c.2 0 .4 0 .6.1V13c-.2 0-.4-.1-.6-.1a1.7 1.7 0 0 0 0 3.4 1.7 1.7 0 0 0 1.7-1.7V5.5H16z" fill="white"/>
                </svg>
              );
              if (platform === '페이스북') return (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="1" width="22" height="22" rx="5" fill="#1877F2"/>
                  <path d="M13.5 20V13H16l.5-2.5H13.5V8.8c0-.8.4-1.3 1.3-1.3H16.5V5.1S15.5 5 14.2 5C11.8 5 10.5 6.2 10.5 8.5V10.5H8V13h2.5V20H13.5z" fill="white"/>
                </svg>
              );
              if (platform === '트위터') return (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="1" width="22" height="22" rx="5" fill="#000000"/>
                  <path d="M17.5 4.5h-2.8l-3 4.3-2.9-4.3H5.5L10 11 5.5 19.5H8.3l3.1-4.5 3 4.5H17.5L13 12z" fill="white"/>
                </svg>
              );
              return <span className="text-[10px] text-gray-400 shrink-0">{platform}</span>;
            };
            return (
              <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[56px] shadow-sm border border-gray-100 p-4 sm:p-8 md:p-14 space-y-6 sm:space-y-10">
                {/* 헤더 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-base sm:text-xl font-black text-gray-900 italic uppercase flex items-center gap-2 sm:gap-3">
                    <span className="w-1.5 h-4 sm:h-6 bg-yellow-400 rounded-full shrink-0"></span>
                    이용 후기
                    <span className="text-xs sm:text-sm font-black text-gray-300 normal-case italic">({allReviewsForSlider.length}개)</span>
                  </h3>
                  {allReviewsForSlider.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={`text-base sm:text-lg ${n <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-lg sm:text-2xl font-black text-yellow-500 italic">{avgRating}</span>
                      <span className="text-[10px] sm:text-xs font-black text-gray-300 italic">/5.0</span>
                    </div>
                  )}
                </div>

                {/* 리뷰 작성 폼 */}
                {!isGuest && (
                  <div className="bg-gray-50 rounded-2xl sm:rounded-[32px] p-4 sm:p-8 space-y-4">
                    <p className="text-[11px] sm:text-xs font-black text-gray-400 uppercase italic tracking-widest">내 후기 작성</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {renderStars(myReviewRating, true, setMyReviewRating)}
                      <span className="text-xs font-black text-gray-400 italic">{myReviewRating}점</span>
                      <select
                        value={myReviewPlatform}
                        onChange={(e) => setMyReviewPlatform(e.target.value)}
                        className="ml-auto border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-black text-gray-600 bg-white outline-none focus:border-blue-400 cursor-pointer"
                        style={{ maxHeight: '180px', overflowY: 'auto' }}
                      >
                        {SNS_PLATFORMS.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={myReviewContent}
                      onChange={(e) => setMyReviewContent(e.target.value)}
                      placeholder="SMM 서비스를 이용하신 후기를 남겨주세요. (최소 10자)"
                      className="w-full p-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 text-sm outline-none focus:border-blue-400 resize-none"
                      rows={3}
                      maxLength={300}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-300 italic">{myReviewContent.length}/300</span>
                      <button
                        type="button"
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview || myReviewContent.trim().length < 10}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm uppercase italic tracking-widest transition-all ${isSubmittingReview || myReviewContent.trim().length < 10 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-black shadow-lg'}`}
                      >
                        {reviewSubmitted ? '✓ 등록 완료' : isSubmittingReview ? '등록 중...' : '후기 등록'}
                      </button>
                    </div>
                  </div>
                )}
                {isGuest && (
                  <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 text-center text-[12px] sm:text-sm font-black text-gray-400 italic">
                    <button type="button" onClick={() => navigate('/login')} className="text-blue-500 hover:underline">로그인</button>
                    {' '}후 이용 후기를 남길 수 있습니다.
                  </div>
                )}

                {/* 리뷰 슬라이더 - 위로 올라가는 수직 슬라이드 */}
                <div
                  className="relative"
                  onMouseEnter={() => { reviewSliderPaused.current = true; }}
                  onMouseLeave={() => { reviewSliderPaused.current = false; }}
                >
                  {/* 슬라이드 트랙 */}
                  <div className="overflow-hidden rounded-2xl" style={{ height: '152px' }}>
                    <div
                      className="flex flex-col transition-transform duration-500 ease-in-out"
                      style={{ transform: `translateY(-${reviewSlideIdx * 152}px)` }}
                    >
                      {allReviewsForSlider.map((r) => (
                        <div
                          key={r.id}
                          className="w-full shrink-0 bg-gray-50 rounded-2xl p-4 sm:p-5 border border-transparent flex gap-3 sm:gap-4"
                          style={{ height: '152px' }}
                        >
                          {/* 아바타 */}
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 mt-0.5 ${r.id.startsWith('m') ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                            {(r.userNickname || '익명')[0]}
                          </div>
                          {/* 콘텐츠 */}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className="text-[12px] sm:text-sm font-black text-gray-800 truncate max-w-[120px] sm:max-w-[160px]">{r.userNickname || '익명'}</span>
                              {getPlatformIcon(r.platform)}
                              {renderStars(r.rating)}
                                            </div>
                            <p className="text-[12px] sm:text-sm font-bold text-gray-600 leading-relaxed break-words line-clamp-3">{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 도트 인디케이터 (최대 10개) */}
                  {allReviewsForSlider.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-4">
                      {allReviewsForSlider.slice(0, 10).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => goToReviewSlide(i)}
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
        </div>
      </div>
    </div>
  );
};

export default SNSActivation;
