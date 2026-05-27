/**
 * auto-post-board.js
 * schedule: */5 * * * *  (5분마다 실행)
 *
 * - 별도 DB 테이블 불필요: site_posts에만 의존
 * - KST 09:00 ~ 21:00 사이, 하루 4~6건 자동 게시
 * - 마지막 자동 게시 후 최소 2시간 간격 유지
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const KST = 9 * 60 * 60 * 1000;
const AUTO_AUTHOR_ID = 'auto_bot';
const MAX_POSTS_PER_DAY = 5;
const MIN_INTERVAL_MS   = 2 * 60 * 60 * 1000; // 2시간

/* ─── 게시글 풀 ────────────────────────────────────────────── */
const AUTHORS = [
  '스마트수익러', '디지털노마드킴', '마케터박씨', '유튜버준비생',
  '블로그수익왕', '온라인부업러', 'SNS고수이씨', '수익화마스터',
  '인플루언서최씨', '돈버는직장인', '부업왕최씨', '콘텐츠크리에이터',
  '알고리즘박사', '네이버블로거정씨', '카카오마케터',
];

const POST_POOL = [
  // ── 수익화 ─────────────────────────────────────────────────
  { category: '수익화', title: '스마트스토어 월 100만원 달성한 현실 후기', content: '직장 다니면서 부업으로 스마트스토어 시작한 지 8개월 만에 월 100만원을 넘겼습니다.\n처음에는 무재고 방식으로 시작했고, 지금은 일부 사입도 병행하고 있어요.\n상위 노출 키워드 찾는 게 핵심이었고 꾸준한 리뷰 관리가 중요했습니다.\n질문 있으시면 댓글로 남겨주세요!' },
  { category: '수익화', title: '블로그 애드센스 첫 지급 후기 공유합니다', content: '드디어 구글 애드센스 첫 지급을 받았습니다! 100달러 넘기는 데 약 5개월이 걸렸어요.\n일상 블로그보다는 정보성 글로 방향을 바꾼 게 주효했습니다.\n하루 평균 방문자 800명 정도 되니까 그때부터 수익이 나기 시작했어요.\n포기하지 말고 꾸준히 하세요!' },
  { category: '수익화', title: '쿠팡파트너스 6개월 솔직 후기', content: '쿠팡파트너스로 6개월간 꾸준히 활동한 결과를 공유합니다.\n처음 3개월은 월 2만원도 안 됐는데 블로그 트래픽이 늘면서 지금은 월 30~50만원 수준입니다.\n리뷰 글이 검색에 잘 노출될수록 클릭률이 올라가는 구조입니다.\n장기전으로 보시면 충분히 가능한 수익원이에요.' },
  { category: '수익화', title: '전자책 만들어서 판매해봤습니다', content: '제가 알고 있는 SNS 마케팅 노하우를 전자책으로 정리해서 판매해봤습니다.\n크몽이랑 탈잉에 올렸는데 두 달에 50만원 정도 수익이 났어요.\n핵심은 내가 실제로 경험한 내용을 쓰는 것, 독자가 바로 적용할 수 있게 구체적으로 쓰는 것이었습니다.' },
  { category: '수익화', title: '이번 달 수익 공개합니다 (블로그+유튜브)', content: '이번 달 온라인 수익 결산입니다.\n- 네이버 블로그 애드포스트: 18만원\n- 구글 애드센스: 9만원\n- 유튜브 광고: 23만원\n- 협찬/제휴: 35만원\n합계 약 85만원입니다.\n투잡으로 시작해서 이제 본업 급여의 절반에 가까워졌습니다!' },
  { category: '수익화', title: '네이버 블로그로 수익 내는 현실적인 방법', content: '블로그 수익화에 대해 현실적으로 이야기해볼게요.\n애드포스트만으로는 한계가 있고, 체험단+원고료+제휴마케팅을 함께 해야 의미 있는 수익이 됩니다.\n일 방문자 1000명 이상이면 월 10만원 이상은 충분히 가능합니다.' },
  { category: '수익화', title: '온라인 강의 만들어 파는 방법 총정리', content: '클래스101, 탈잉, 크몽 등 플랫폼에서 강의를 판매해봤습니다.\n제 경험상 1강 30분짜리 5강 구성의 미니 강의가 초보자한테 가장 적합합니다.\n가격은 3~5만원 선이 전환율이 가장 좋았어요.\n주제는 내가 3년 이상 해온 것으로 정하세요.' },
  { category: '수익화', title: '인스타그램으로 돈 버는 현실 이야기', content: '팔로워 5000명으로도 월 30만원 이상 벌 수 있습니다.\n팔로워 수보다 참여율(ER)이 중요하고, 니치(특정 분야)에 집중할수록 단가가 올라가요.\n협찬 메일이 오기 시작하는 건 팔로워 2000명부터였어요.' },

  // ── 마케팅 ─────────────────────────────────────────────────
  { category: '마케팅', title: 'SNS 마케팅 처음 시작할 때 꼭 알아야 할 것들', content: 'SNS 마케팅을 시작하기 전에 타겟 고객이 누구인지부터 명확히 정해야 합니다.\n타겟이 주로 사용하는 플랫폼 하나에 집중하는 것이 분산 전략보다 효과적이에요.\n처음 3개월은 팔로워 숫자보다 콘텐츠 퀄리티에 집중하세요.' },
  { category: '마케팅', title: '인플루언서 협업 시 꼭 확인해야 할 것들', content: '인플루언서와 협업할 때는 팔로워 수보다 참여율(Engagement Rate)을 먼저 보세요.\n팔로워 1만 명이지만 댓글·좋아요가 활발한 마이크로 인플루언서가 더 효과적인 경우가 많습니다.\n또한 팔로워 demographics도 꼭 확인하세요!' },
  { category: '마케팅', title: '카페 마케팅으로 신규 회원 모으는 법', content: '네이버 카페 회원을 늘리기 위해서는 회원들이 실제로 도움받을 수 있는 정보성 게시글이 핵심입니다.\n오픈채팅 연동, 정기 이벤트, 우수 회원 시스템을 함께 운영하면 자연스럽게 추천과 공유로 이어집니다.' },
  { category: '마케팅', title: '리뷰 마케팅이 왜 이렇게 중요한가', content: '온라인 쇼핑에서 구매 결정의 80% 이상이 리뷰에 의해 이루어집니다.\n진정성 있는 리뷰를 모으고 적극적으로 활용하면 전환율을 크게 높일 수 있어요.\n체험단을 활용하되, 과장 없는 솔직한 리뷰를 요청하는 게 장기적으로 브랜드에 좋습니다.' },
  { category: '마케팅', title: '2025-2026 디지털 마케팅 트렌드 정리', content: '올해 디지털 마케팅의 핵심 트렌드를 정리해봤습니다.\n1. 숏폼 콘텐츠 (릴스·쇼츠) 중심으로 이동\n2. AI 도구 활용한 콘텐츠 생산성 향상\n3. 커뮤니티 기반 마케팅 강화\n4. 1인 미디어 협업 증가\n빠르게 대응하는 분들이 선점하고 있습니다.' },
  { category: '마케팅', title: '검색 광고 vs SNS 광고, 어떻게 선택할까?', content: '둘 다 좋지만 목적이 다릅니다.\n검색 광고: 이미 구매 의사가 있는 고객 잡기 → 전환율 높음\nSNS 광고: 브랜드 인지도 올리기 → 잠재 고객 확보에 유리\n예산이 적다면 검색 광고 먼저, 여유가 생기면 SNS 광고로 확장하는 걸 추천합니다.' },
  { category: '마케팅', title: '스마트스토어 마케팅 실전 전략', content: '스마트스토어에서 판매량을 높이려면:\n1. 키워드 최적화된 상품명 작성\n2. 고화질 대표 이미지 (흰 배경)\n3. 상세페이지에 구매자 Q&A 미리 답변\n4. 체험단으로 초기 리뷰 확보\n5. 네이버 쇼핑 광고 소액 테스트\n이 순서대로 하면 3개월 안에 매출이 오릅니다.' },

  // ── 유튜브 ─────────────────────────────────────────────────
  { category: '유튜브', title: '유튜브 알고리즘 완벽 이해하기 2025버전', content: '유튜브 알고리즘은 시청 시간(Watch Time)과 클릭률(CTR)을 가장 중요하게 봅니다.\n썸네일과 제목을 매력적으로 만들고, 영상 초반 30초 안에 핵심 내용을 담아야 이탈률이 줄어요.\n2025년에는 쇼츠와 일반 영상 교차 업로드 전략이 특히 유효합니다.' },
  { category: '유튜브', title: '구독자 1만 달성 후 달라진 것들', content: '구독자 1만 명을 달성하고 달라진 점을 솔직하게 공유합니다.\n- 협찬 제안 메일이 주 2~3건 오기 시작\n- 유튜브 쇼핑 기능 활성화\n- 슈퍼챗 수익 증가\n- 커뮤니티 탭 적극 활용 가능\n무엇보다 광고 수익이 의미 있게 느껴지기 시작한 게 가장 큰 변화였어요!' },
  { category: '유튜브', title: '영상 편집 초보가 쓰기 좋은 툴 추천', content: '편집 초보자에게 추천하는 툴입니다.\n1. CapCut - 무료, 자막 자동 생성, 직관적 UI\n2. 다빈치 리졸브 - 무료 전문가 툴, 배우는 데 시간 필요\n3. 프리미어 프로 - 유료이지만 가장 범용적\n처음엔 CapCut으로 시작해서 영상 감을 익힌 후 다빈치로 넘어가는 분들이 많아요.' },
  { category: '유튜브', title: '쇼츠로 구독자 늘리는 전략 공유', content: '쇼츠(Shorts) 전략으로 3개월에 구독자 3000명을 늘렸습니다.\n- 업로드 주기: 매일 1개\n- 길이: 45~55초가 완주율 가장 높음\n- 첫 3초에 훅(Hook) 필수\n- 해시태그: 3~5개 정도\n쇼츠는 일반 영상보다 바이럴 가능성이 훨씬 높습니다!' },
  { category: '유튜브', title: '유튜브 수익화 조건 맞추는 현실적인 방법', content: '수익화 조건: 구독자 1000명 + 연간 4000시간 시청.\n현실적인 전략:\n1. 쇼츠+일반 영상 병행 (쇼츠는 시청 시간 불포함이지만 구독자 유입에 효과적)\n2. 틈새 주제 선택 (경쟁 적은 분야)\n3. 업로드 최소 주 2회 유지\n보통 6~12개월이면 조건 달성 가능합니다.' },
  { category: '유튜브', title: 'RPM이 높은 유튜브 카테고리는?', content: 'RPM(1000회 재생당 수익)이 높은 카테고리를 공유합니다.\n1위: 금융·투자 (RPM 5~15달러)\n2위: 법률·비즈니스\n3위: 기술·테크\n4위: 디지털 마케팅\n일상·브이로그는 RPM이 낮지만 팬덤 형성에 유리해요.\n수익 극대화를 원하면 고 RPM 카테고리가 유리합니다.' },
  { category: '유튜브', title: '저작권 걱정 없이 BGM 쓰는 방법', content: '유튜브 영상에 음악을 안전하게 사용하는 방법입니다.\n1. 유튜브 오디오 라이브러리 - 무료, 저작권 없음\n2. Pixabay Music - 무료 상업적 사용 가능\n3. Epidemic Sound - 유료이지만 고음질 다양\n4. NCS (No Copyright Sounds) - 유튜브 채널 있음\n음악 때문에 수익화 차단되는 경우가 많으니 꼭 확인하세요!' },
  { category: '유튜브', title: '유튜브 썸네일 클릭률 높이는 원칙', content: '썸네일 CTR을 높이는 핵심 원칙입니다.\n1. 밝고 대비되는 색상 사용\n2. 얼굴 클로즈업 + 표정 강조\n3. 텍스트 3단어 이내\n4. 호기심을 자극하는 요소 포함\n5. A/B 테스트 습관화\nCTR이 5% 이상이면 좋은 썸네일입니다. 10% 넘으면 대박!' },

  // ── 자유 ─────────────────────────────────────────────────
  { category: '자유', title: '온라인으로 부업 시작하고 싶은 분들에게', content: '온라인 부업을 시작하려는 분들에게 솔직한 이야기를 드리고 싶습니다.\n처음 3~6개월은 수익이 거의 없을 수 있어요. 이 기간을 버티는 게 핵심입니다.\n블로그, 유튜브, SNS 중 자신이 꾸준히 할 수 있는 것을 선택하세요.\n6개월 이상 꾸준히 하면 반드시 결과가 나옵니다.' },
  { category: '자유', title: '직장 다니면서 투잡 하는 현실 이야기', content: '본업+투잡 병행 9개월 차입니다.\n솔직히 쉽지 않습니다. 퇴근 후 2~3시간을 꾸준히 내는 게 제일 힘들어요.\n하지만 6개월 차부터 월 50만원이 넘어가기 시작했고, 지금은 100만원 넘겼습니다.\n단, 본업에 지장이 없도록 체력 관리가 필수입니다.' },
  { category: '자유', title: 'AI 도구 쓰면서 콘텐츠 생산성이 3배 올랐습니다', content: 'ChatGPT, Claude, 미드저니 등 AI 도구를 콘텐츠 제작에 활용하기 시작했습니다.\n글 초안 잡기, 썸네일 아이디어, 키워드 리서치 등에서 시간이 확 줄었어요.\n하루 2시간 걸리던 블로그 글이 지금은 45분이면 완성됩니다.\n도구는 도구일 뿐 방향성은 사람이 잡아야 합니다.' },
  { category: '자유', title: '콘텐츠 마케팅 1년 해보고 느낀 점', content: '1년간 콘텐츠 마케팅에 집중하면서 느낀 점입니다.\n- 꾸준함이 실력보다 중요함\n- 조회수/팔로워보다 전환율이 중요\n- 글 하나보다 글 100개의 누적 효과가 더 큼\n- 포기하고 싶은 순간을 이기면 성장이 옴\n지금 시작이 가장 빠른 때입니다!' },
  { category: '자유', title: '프리랜서로 독립 준비하는 분들께', content: '직장을 그만두고 프리랜서로 독립을 준비 중인 분들에게 드리는 조언입니다.\n최소 6개월치 생활비는 모아두고 시작하세요.\n프리랜서 플랫폼(크몽, 숨고, 프리모아)에서 포트폴리오부터 쌓으세요.\n처음엔 저단가로 시작해도 괜찮습니다. 리뷰가 쌓이면 단가를 올릴 수 있습니다.' },
  { category: '자유', title: '온라인 수익화 실패했던 경험 공유', content: '솔직하게 실패 경험을 공유합니다.\n드롭쉬핑: 3개월 하다 포기 (배송 이슈로 환불만 잔뜩)\n주식 자동매매: 2개월 만에 -30% (백테스트만 믿으면 안 됨)\n그래도 이 경험들 덕분에 지금의 SNS 마케팅으로 방향을 잡게 됐습니다.\n실패도 재산이에요!' },
  { category: '자유', title: '소셜미디어 계정 운영하면서 배운 것들', content: '인스타, 블로그, 유튜브를 동시에 운영하면서 배운 것들입니다.\n1. 플랫폼마다 최적 콘텐츠 형식이 다름\n2. 한 곳에서 잘 되면 다른 곳으로 확장 가능\n3. 댓글 관리는 알고리즘에도 영향을 줌\n4. 정기적 업로드가 불규칙 고퀄보다 나은 경우도 많음\n5. 내 이야기를 담은 콘텐츠가 반응이 더 좋음' },
  { category: '자유', title: '베스트SNS 이용하면서 달라진 점', content: '여기서 알바 작업도 해보고 마케팅도 써봤는데, 생각보다 효율이 좋았습니다.\n특히 SNS 팔로워 늘리기 서비스가 초반 세팅에 도움이 됐어요.\n처음 채널 런칭할 때 숫자가 하나도 없으면 신뢰도가 낮게 보이거든요.\n콘텐츠 자신 있는 분들은 활용해보시길 추천드립니다!' },
];

/* ─── 헬퍼 ────────────────────────────────────────────────── */
async function supaFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function todayKstPrefix() {
  const kst = new Date(Date.now() + KST);
  return kst.toISOString().slice(0, 10); // "2026-05-24"
}

function kstDateStr(nowUtc) {
  const kst = new Date(nowUtc + KST);
  return kst.toISOString().replace('T', ' ').slice(0, 19);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ─── 메인 핸들러 ────────────────────────────────────────── */
exports.handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: 'Missing SUPABASE_URL or SERVICE_KEY env vars' };
  }

  const nowMs  = Date.now();
  const kstNow = new Date(nowMs + KST);
  const kstHour = kstNow.getUTCHours(); // KST 시간 (UTC+9 오프셋 더했으므로 getUTCHours = KST시)

  // 게시 허용 시간: KST 09:00 ~ 21:00
  if (kstHour < 9 || kstHour >= 21) {
    return { statusCode: 200, body: `Outside posting hours (KST ${kstHour}:xx)` };
  }

  try {
    const todayPrefix = todayKstPrefix();

    // 오늘 자동 게시된 글 조회
    const todayPosts = await supaFetch(
      `/site_posts?author_id=eq.${AUTO_AUTHOR_ID}&date=gte.${todayPrefix}%2000%3A00%3A00&select=date&order=date.desc`
    );

    const todayCount = todayPosts ? todayPosts.length : 0;

    // 오늘 목표 건수 초과 시 종료
    if (todayCount >= MAX_POSTS_PER_DAY) {
      return { statusCode: 200, body: `Already posted ${todayCount} times today (max ${MAX_POSTS_PER_DAY})` };
    }

    // 마지막 게시 후 최소 간격 확인
    if (todayPosts && todayPosts.length > 0) {
      const lastPostMs = new Date(todayPosts[0].date.replace(' ', 'T') + '+09:00').getTime();
      const elapsed = nowMs - lastPostMs;
      if (elapsed < MIN_INTERVAL_MS) {
        const waitMin = Math.ceil((MIN_INTERVAL_MS - elapsed) / 60000);
        return { statusCode: 200, body: `Too soon — wait ${waitMin} more min` };
      }
    }

    // 오늘 이미 게시된 제목 목록 (중복 방지)
    const usedTitles = new Set();
    if (todayPosts) {
      const detailed = await supaFetch(
        `/site_posts?author_id=eq.${AUTO_AUTHOR_ID}&date=gte.${todayPrefix}%2000%3A00%3A00&select=title`
      ).catch(() => []);
      if (detailed) detailed.forEach(p => usedTitles.add(p.title));
    }

    // 미사용 게시글 중 랜덤 선택
    const available = POST_POOL.filter(p => !usedTitles.has(p.title));
    const post = available.length > 0 ? pickRandom(available) : pickRandom(POST_POOL);
    const author = pickRandom(AUTHORS);

    const newPost = {
      id: `auto_${nowMs}`,
      category: post.category,
      title: post.title,
      content: post.content,
      author,
      author_id: AUTO_AUTHOR_ID,
      author_image: null,
      date: kstDateStr(nowMs),
      views: Math.floor(Math.random() * 400) + 80,
      likes_count: Math.floor(Math.random() * 40) + 3,
      images: [],
      attachments: [],
      is_deleted: false,
    };

    await supaFetch('/site_posts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(newPost),
    });

    console.log(`[auto-post] "${post.title}" by ${author} (오늘 ${todayCount + 1}/${MAX_POSTS_PER_DAY}건)`);
    return { statusCode: 200, body: `Posted: ${post.title}` };

  } catch (e) {
    console.error('[auto-post] Error:', e);
    return { statusCode: 500, body: String(e) };
  }
};
