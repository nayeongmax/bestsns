import React, { useState, useEffect, useRef } from 'react';

/* ──────────────── 데이터 ──────────────── */
const SERVICES = [
  { id: 'cafe', icon: '☕', title: '카페 활성화', desc: '네이버 카페 게시글·댓글·멤버 활성화로 검색 노출 극대화', color: 'from-amber-400 to-orange-400', bg: 'bg-amber-50' },
  { id: 'blog-review', icon: '✍️', title: '블로그 체험단', desc: '실제 체험 기반 리뷰로 자연스러운 바이럴 마케팅 실현', color: 'from-emerald-400 to-teal-400', bg: 'bg-emerald-50' },
  { id: 'blog-agency', icon: '📝', title: '블로그 대행', desc: 'SEO 최적화 포스팅으로 검색 상위 노출 달성', color: 'from-blue-400 to-indigo-400', bg: 'bg-blue-50' },
  { id: 'youtube', icon: '🎬', title: '유튜브 대행 / 활성화', desc: '영상 기획·편집·업로드부터 구독자·조회수 활성화까지', color: 'from-red-400 to-pink-400', bg: 'bg-red-50' },
  { id: 'insta', icon: '📸', title: '인스타 대행 / 활성화', desc: '피드·릴스·스토리 대행 및 팔로워·좋아요 활성화', color: 'from-purple-400 to-fuchsia-400', bg: 'bg-purple-50' },
  { id: 'longform', icon: '🎞️', title: '롱폼 제작', desc: '브랜드 스토리텔링에 최적화된 고퀄리티 영상 제작', color: 'from-cyan-400 to-blue-400', bg: 'bg-cyan-50' },
  { id: 'shortform', icon: '⚡', title: '숏폼 제작', desc: '틱톡·릴스·쇼츠 맞춤 숏폼 콘텐츠 기획·제작', color: 'from-yellow-400 to-amber-400', bg: 'bg-yellow-50' },
  { id: 'website', icon: '🌐', title: '사이트 제작', desc: '반응형 웹사이트·랜딩페이지 기획부터 개발까지', color: 'from-slate-400 to-gray-500', bg: 'bg-slate-50' },
  { id: 'press', icon: '📰', title: '언론 홍보', desc: '주요 언론사 보도자료 배포 및 기사 송출 대행', color: 'from-rose-400 to-red-400', bg: 'bg-rose-50' },
];

const REVIEWS = [
  { id: 1, name: '김*영 대표', biz: '뷰티 브랜드', text: '카페 활성화 3개월 만에 월 매출 200% 성장! 정말 놀라운 결과였습니다.', rating: 5, service: '카페 활성화' },
  { id: 2, name: '이*호 원장', biz: '한의원', text: '블로그 체험단으로 지역 키워드 상위 노출 성공. 신규 환자 유입이 눈에 띄게 늘었어요.', rating: 5, service: '블로그 체험단' },
  { id: 3, name: '박*진 실장', biz: '인테리어', text: '인스타 릴스 대행 후 팔로워 5,000명 증가. 문의가 쏟아져요!', rating: 5, service: '인스타 활성화' },
  { id: 4, name: '최*수 대표', biz: '카페 프랜차이즈', text: '유튜브 채널 운영을 맡긴 후 6개월 만에 구독자 1만 돌파했습니다.', rating: 5, service: '유튜브 대행' },
  { id: 5, name: '정*아 팀장', biz: 'IT 스타트업', text: '숏폼 콘텐츠 퀄리티가 정말 좋아요. 앱 다운로드가 확 늘었습니다.', rating: 5, service: '숏폼 제작' },
  { id: 6, name: '한*미 사장', biz: '쇼핑몰', text: '사이트 리뉴얼 후 전환율 40% 향상! 디자인도 깔끔하고 만족합니다.', rating: 5, service: '사이트 제작' },
  { id: 7, name: '윤*석 대표', biz: '교육업', text: '언론 홍보 기사 덕분에 브랜드 신뢰도가 크게 올라갔어요.', rating: 5, service: '언론 홍보' },
  { id: 8, name: '강*현 원장', biz: '치과', text: '블로그 대행 맡긴 후 월 30건 이상 신규 환자가 유입되고 있습니다.', rating: 5, service: '블로그 대행' },
  { id: 9, name: '서*은 대표', biz: '음식점', text: '카페 활성화와 블로그 체험단 동시 진행했는데 시너지가 대단했어요!', rating: 5, service: '카페 활성화' },
  { id: 10, name: '오*준 이사', biz: '부동산', text: '롱폼 브랜드 영상 제작 후 투자 문의가 크게 늘었습니다.', rating: 5, service: '롱폼 제작' },
];

const STATS = [
  { label: '누적 광고주', value: '2,500+', suffix: '명' },
  { label: '월 평균 성과', value: '187%', suffix: '증가' },
  { label: '고객 만족도', value: '98.7', suffix: '%' },
  { label: '운영 경력', value: '7', suffix: '년+' },
];

const PROCESS = [
  { step: 1, title: '무료 상담', desc: '업종·예산에 맞는 마케팅 전략 무료 컨설팅', icon: '💬' },
  { step: 2, title: '맞춤 견적', desc: '상세 견적서와 예상 성과 분석 제공', icon: '📋' },
  { step: 3, title: '작업 진행', desc: '전문 마케터가 체계적으로 작업 수행', icon: '🚀' },
  { step: 4, title: '결과 보고', desc: '상세 보고서로 투명한 성과 공유', icon: '📊' },
];

/* ──────────────── 유틸 ──────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCountUp(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setValue(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, start]);
  return value;
}

/* ──────────────── 컴포넌트 ──────────────── */

/** 파티클 배경 */
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: `${Math.random() * 8 + 4}px`,
            height: `${Math.random() * 8 + 4}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `hsl(${30 + Math.random() * 30}, 80%, ${70 + Math.random() * 20}%)`,
            animation: `floatParticle ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 히어로 섹션 */
function HeroSection() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 100); return () => clearTimeout(t); }, []);

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-gradient-to-br from-[#FFFDF7] via-[#FFF8EC] to-[#FFF3E0]">
      <FloatingParticles />
      {/* 데코 원형 */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-amber-200/30 to-orange-200/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-amber-100/40 to-yellow-100/30 blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* 텍스트 */}
          <div className={`transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 text-amber-700 font-semibold text-sm mb-6 backdrop-blur-sm border border-amber-200/50">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              대한민국 NO.1 마케팅 파트너
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
              비즈니스 성장의<br />
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">확실한 파트너</span>
                <span className="absolute bottom-1 left-0 w-full h-3 bg-amber-200/60 rounded-full -z-0" />
              </span>
            </h1>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
              카페 활성화부터 유튜브, 인스타, 블로그, 사이트 제작까지.<br />
              <strong className="text-gray-800">더베스트마케팅</strong>이 당신의 브랜드를 성장시킵니다.
            </p>

            <div className="flex flex-wrap gap-4">
              <a href="/marketing/quote" className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">무료 견적 받기</span>
                <svg className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </a>
              <a href="/marketing/report" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-700 font-bold rounded-2xl border-2 border-gray-200 hover:border-amber-300 hover:text-amber-600 hover:-translate-y-0.5 transition-all duration-300 shadow-sm">
                📊 작업 보고서 보기
              </a>
            </div>
          </div>

          {/* 우측 카드 그리드 */}
          <div className={`relative transition-all duration-1000 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:max-w-none">
              {SERVICES.slice(0, 4).map((s, i) => (
                <div key={s.id} className="group bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 hover:border-amber-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: `${i * 150}ms` }}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}>
                    {s.icon}
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">{s.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc.slice(0, 20)}...</p>
                </div>
              ))}
            </div>
            {/* 떠다니는 배지 */}
            <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-lg px-4 py-3 border border-amber-100 animate-float-badge">
              <div className="text-xs text-gray-500">이번 달 신규 광고주</div>
              <div className="text-xl font-black text-amber-600">+127명</div>
            </div>
          </div>
        </div>

        {/* 통계 */}
        <div className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-1000 delay-700 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {STATS.map(s => (
            <StatCard key={s.label} label={s.label} value={s.value} suffix={s.suffix} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  const { ref, visible } = useInView();
  const num = parseInt(value.replace(/[^0-9]/g, ''));
  const counted = useCountUp(num, 2000, visible);
  const display = value.includes(',') ? counted.toLocaleString() : value.includes('%') ? counted : counted;

  return (
    <div ref={ref} className="text-center bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100">
      <div className="text-3xl font-black text-gray-900">
        {visible ? (value.includes('+') ? `${display}+` : value.includes('.') ? `${(counted / 10).toFixed(1)}` : display) : '0'}
        <span className="text-amber-500 text-lg ml-1">{suffix}</span>
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

/** 서비스 섹션 */
function ServicesSection() {
  const { ref, visible } = useInView();

  return (
    <section id="services" className="py-24 bg-white relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(251,191,36,0.05),transparent_60%)]" />
      <div ref={ref} className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-4">OUR SERVICES</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            비즈니스에 딱 맞는 <span className="text-amber-500">마케팅 솔루션</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            업종과 목표에 최적화된 마케팅 전략을 제안해 드립니다.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((s, i) => (
            <div
              key={s.id}
              className={`group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-amber-200 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                {s.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{s.desc}</p>
              <a href="/marketing/quote" className="inline-flex items-center text-sm font-semibold text-amber-600 hover:text-amber-700 group-hover:gap-2 gap-1 transition-all">
                견적 문의 <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              {/* 호버 글로우 */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${s.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 진행 프로세스 */
function ProcessSection() {
  const { ref, visible } = useInView();
  return (
    <section className="py-24 bg-gradient-to-b from-[#FFFDF7] to-white relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-amber-100/20 blur-3xl" />
      <div ref={ref} className="max-w-5xl mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-4">PROCESS</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            <span className="text-amber-500">4단계</span>로 완성되는 마케팅
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {PROCESS.map((p, i) => (
            <div
              key={p.step}
              className={`relative text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-3xl mb-4 shadow-lg shadow-amber-300/30">
                {p.icon}
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-amber-600 text-xs font-black flex items-center justify-center shadow border border-amber-100">
                  {p.step}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.desc}</p>
              {i < 3 && <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-amber-200" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 실시간 리뷰 섹션 */
function ReviewsSection() {
  const { ref, visible } = useInView();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame: number;
    const scroll = () => {
      if (!paused && el) {
        el.scrollLeft += 0.8;
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
      }
      frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const doubled = [...REVIEWS, ...REVIEWS];

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-4">REVIEWS</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            광고주님들의 <span className="text-amber-500">생생한 후기</span>
          </h2>
          <p className="text-gray-500">실제 광고주분들의 성과 후기를 확인하세요</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-hidden no-scrollbar px-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {doubled.map((r, i) => (
          <div
            key={`${r.id}-${i}`}
            className={`flex-shrink-0 w-[340px] bg-gradient-to-br from-white to-amber-50/30 rounded-2xl p-6 border border-gray-100 hover:border-amber-200 shadow-sm hover:shadow-lg transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                {r.name[0]}{r.name[2]}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{r.name}</div>
                <div className="text-xs text-gray-400">{r.biz}</div>
              </div>
              <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">{r.service}</span>
            </div>
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: r.rating }).map((_, j) => (
                <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">"{r.text}"</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** CTA 섹션 */
function CTASection() {
  const { ref, visible } = useInView();
  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>
      <div ref={ref} className={`relative z-10 max-w-4xl mx-auto px-6 text-center transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6">
          지금 바로 <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">성장</span>을 시작하세요
        </h2>
        <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
          무료 상담으로 업종에 맞는 마케팅 전략을 확인해 보세요.<br />
          더베스트마케팅이 확실한 결과로 보답하겠습니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/marketing/quote" className="group inline-flex items-center justify-center gap-2 px-10 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg">
            무료 견적 받기
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
          <a href="tel:010-0000-0000" className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-white/10 text-white font-bold rounded-2xl border border-white/20 hover:bg-white/20 transition-all text-lg backdrop-blur-sm">
            📞 전화 상담
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-6">* 상담은 100% 무료이며, 부담 없이 문의해 주세요.</p>
      </div>
    </section>
  );
}

/** 푸터 */
function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="text-2xl font-black text-white mb-3">
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">THE BEST</span>
              <span className="text-white ml-1">마케팅</span>
            </div>
            <p className="text-sm leading-relaxed">
              카페 활성화, 블로그, 유튜브, 인스타그램,<br />
              사이트 제작, 언론 홍보까지.<br />
              비즈니스 성장의 확실한 파트너.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">서비스</h4>
            <ul className="space-y-2 text-sm">
              {SERVICES.slice(0, 5).map(s => <li key={s.id}><a href="#services" className="hover:text-amber-400 transition-colors">{s.title}</a></li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-3">문의</h4>
            <ul className="space-y-2 text-sm">
              <li>📞 010-0000-0000</li>
              <li>✉️ contact@thebestmarketing.co.kr</li>
              <li>🕐 평일 09:00 ~ 18:00</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
          © 2026 더베스트마케팅. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/** 랜딩 헤더 */
function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/marketing" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-amber-400/20">B</div>
          <span className="font-black text-lg">
            <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">THE BEST</span>
            <span className={`ml-1 ${scrolled ? 'text-gray-900' : 'text-gray-800'}`}>마케팅</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="#services" className={`hover:text-amber-500 transition-colors ${scrolled ? 'text-gray-600' : 'text-gray-700'}`}>서비스</a>
          <a href="/marketing/quote" className={`hover:text-amber-500 transition-colors ${scrolled ? 'text-gray-600' : 'text-gray-700'}`}>견적서</a>
          <a href="/marketing/report" className={`hover:text-amber-500 transition-colors ${scrolled ? 'text-gray-600' : 'text-gray-700'}`}>작업 보고서</a>
          <a href="/marketing/quote" className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 transition-all text-sm">
            무료 상담
          </a>
        </nav>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="flex flex-col p-4 gap-3">
            <a href="#services" onClick={() => setMobileOpen(false)} className="px-4 py-3 rounded-xl hover:bg-amber-50 text-gray-700 font-medium">서비스</a>
            <a href="/marketing/quote" className="px-4 py-3 rounded-xl hover:bg-amber-50 text-gray-700 font-medium">견적서</a>
            <a href="/marketing/report" className="px-4 py-3 rounded-xl hover:bg-amber-50 text-gray-700 font-medium">작업 보고서</a>
            <a href="/marketing/quote" className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-center">무료 상담</a>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ──────────────── 메인 ──────────────── */
const MarketingLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <LandingHeader />
      <HeroSection />
      <ServicesSection />
      <ProcessSection />
      <ReviewsSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default MarketingLanding;
