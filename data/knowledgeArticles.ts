// ─────────────────────────────────────────────────────────────────
// BESTSNS Knowledge Center — 문서 데이터
// 이 파일이 단일 진실 소스(Single Source of Truth)입니다.
// 문서를 추가하면 sitemap.xml이 자동으로 업데이트됩니다.
// canonical, @id 등 URL 파생 값은 slug에서 자동 생성하므로 여기에 넣지 않습니다.
// ─────────────────────────────────────────────────────────────────

export type KnowledgeCategory =
  | 'smm'
  | 'channel'
  | 'njobs'
  | 'parttime'
  | 'ai'
  | 'seo'
  | 'aeo'
  | 'geo'
  | 'guide';

export type KnowledgeContentBlock =
  | { type: 'heading2'; text: string }
  | { type: 'heading3'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unorderedList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'quote'; text: string };

export interface KnowledgeFAQ {
  question: string;
  answer: string;
}

export interface KnowledgeArticle {
  // 식별자
  slug: string;
  category: KnowledgeCategory;

  // 제목 및 메타
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  keywords: string[];

  // 날짜 및 작성자
  publishedAt: string;   // YYYY-MM-DD
  updatedAt: string;     // YYYY-MM-DD
  authorName: string;

  // 본문
  content: KnowledgeContentBlock[];

  // 연결
  relatedSlugs: string[];
  serviceUrl: string;

  // sitemap
  priority: number;       // 0.1 ~ 1.0
  changefreq: 'weekly' | 'monthly';

  // 선택
  image?: string;
  faq?: KnowledgeFAQ[];
  articleType?: 'Article' | 'TechArticle';
}

// ─────────────────────────────────────────────────────────────────
// 허용 serviceUrl 목록
// ─────────────────────────────────────────────────────────────────

const ALLOWED_SERVICE_URLS = new Set([
  'https://bestsns.com/sns',
  'https://bestsns.com/channels',
  'https://bestsns.com/ebooks',
  'https://bestsns.com/part-time',
  'https://bestsns.com/ai',
  'https://bestsns.com/knowledge',
]);

// ─────────────────────────────────────────────────────────────────
// 데이터 검증 함수
// ─────────────────────────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateKnowledgeArticles(articles: KnowledgeArticle[]): void {
  const errors: string[] = [];
  const slugSet = new Set<string>();

  for (const article of articles) {
    const id = `[${article.slug ?? '(slug 없음)'}]`;

    // 1. slug 중복 금지
    if (slugSet.has(article.slug)) {
      errors.push(`${id} slug가 중복되었습니다.`);
    } else {
      slugSet.add(article.slug);
    }

    // 2. slug 형식: 영문 소문자, 숫자, 하이픈만 허용
    if (!SLUG_PATTERN.test(article.slug)) {
      errors.push(`${id} slug는 영문 소문자, 숫자, 하이픈만 허용합니다. (현재: "${article.slug}")`);
    }

    // 3. 필수 문자열 필드 빈 값 금지
    const requiredStrings: Array<[string, string | undefined]> = [
      ['title', article.title],
      ['seoTitle', article.seoTitle],
      ['description', article.description],
      ['excerpt', article.excerpt],
    ];
    for (const [field, value] of requiredStrings) {
      if (!value || value.trim() === '') {
        errors.push(`${id} ${field}가 비어 있습니다.`);
      }
    }

    // 4. 날짜 형식 YYYY-MM-DD
    if (!DATE_PATTERN.test(article.publishedAt)) {
      errors.push(`${id} publishedAt 형식이 잘못되었습니다. (YYYY-MM-DD 필요, 현재: "${article.publishedAt}")`);
    }
    if (!DATE_PATTERN.test(article.updatedAt)) {
      errors.push(`${id} updatedAt 형식이 잘못되었습니다. (YYYY-MM-DD 필요, 현재: "${article.updatedAt}")`);
    }

    // 5. updatedAt이 publishedAt보다 이전이면 오류
    if (
      DATE_PATTERN.test(article.publishedAt) &&
      DATE_PATTERN.test(article.updatedAt) &&
      article.updatedAt < article.publishedAt
    ) {
      errors.push(`${id} updatedAt(${article.updatedAt})이 publishedAt(${article.publishedAt})보다 이전입니다.`);
    }

    // 6. relatedSlugs에 자기 자신 금지
    if (article.relatedSlugs.includes(article.slug)) {
      errors.push(`${id} relatedSlugs에 자기 자신(${article.slug})이 포함되어 있습니다.`);
    }

    // 8. FAQ question/answer 모두 있어야 함
    if (article.faq) {
      article.faq.forEach((item, i) => {
        if (!item.question || item.question.trim() === '') {
          errors.push(`${id} faq[${i}].question이 비어 있습니다.`);
        }
        if (!item.answer || item.answer.trim() === '') {
          errors.push(`${id} faq[${i}].answer가 비어 있습니다.`);
        }
      });
    }

    // 9. priority 범위
    if (article.priority < 0.1 || article.priority > 1.0) {
      errors.push(`${id} priority는 0.1 이상 1.0 이하여야 합니다. (현재: ${article.priority})`);
    }

    // 10. serviceUrl 허용 목록
    if (!ALLOWED_SERVICE_URLS.has(article.serviceUrl)) {
      errors.push(
        `${id} serviceUrl이 허용 목록에 없습니다. (현재: "${article.serviceUrl}")\n` +
        `  허용값: ${[...ALLOWED_SERVICE_URLS].join(', ')}`
      );
    }
  }

  // 7. relatedSlugs에 존재하지 않는 slug 금지 (전체 slug 확인 후 재검증)
  for (const article of articles) {
    const id = `[${article.slug}]`;
    for (const relSlug of article.relatedSlugs) {
      if (!slugSet.has(relSlug)) {
        errors.push(`${id} relatedSlugs에 존재하지 않는 slug "${relSlug}"가 포함되어 있습니다.`);
      }
    }
  }

  // 중복 경로 검증 (path 레벨)
  const pathSet = new Set<string>();
  for (const article of articles) {
    const path = `/knowledge/${article.slug}`;
    if (pathSet.has(path)) {
      errors.push(`[sitemap] 중복 경로 발생: ${path}`);
    } else {
      pathSet.add(path);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\n[knowledgeArticles] 데이터 검증 실패 (${errors.length}건):\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n') +
      '\n'
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// 초기 문서 데이터
// ─────────────────────────────────────────────────────────────────

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [

  // ────────────────────────────────────────────
  // 1. SMM 마케팅이란?
  // ────────────────────────────────────────────
  {
    slug: 'smm-marketing',
    category: 'smm',
    title: 'SMM 마케팅이란? 개념과 활용 방법',
    seoTitle: 'SMM 마케팅이란? | BESTSNS',
    description: 'SMM(소셜 미디어 마케팅)의 개념, 주요 유형, 이용 방법을 설명합니다. 인스타그램·유튜브·틱톡 등 SNS 플랫폼에서 팔로워와 조회수를 늘리는 마케팅 서비스의 기본 원리를 다룹니다.',
    excerpt: 'SMM은 소셜 미디어 플랫폼에서 계정의 노출과 신뢰도를 높이기 위해 팔로워·좋아요·조회수 등의 지표를 관리하는 마케팅 방식입니다. BESTSNS는 12개 SNS 플랫폼에서 SMM 서비스를 제공합니다.',
    keywords: ['SMM', '소셜 미디어 마케팅', 'Social Media Marketing', '인스타그램 팔로워', '유튜브 조회수', '틱톡 팔로워', 'SNS 마케팅'],
    publishedAt: '2026-07-21',
    updatedAt: '2026-07-21',
    authorName: '더베스트(THEBEST)',
    articleType: 'Article',
    serviceUrl: 'https://bestsns.com/sns',
    priority: 0.9,
    changefreq: 'monthly',
    relatedSlugs: ['instagram-followers', 'youtube-views'],
    content: [
      {
        type: 'heading2',
        text: 'SMM 마케팅이란 무엇인가?',
      },
      {
        type: 'paragraph',
        text: 'SMM은 Social Media Marketing의 약자로, 인스타그램·유튜브·틱톡·페이스북·네이버 등 소셜 미디어 플랫폼에서 계정의 팔로워 수, 좋아요 수, 조회수, 댓글 수 등의 지표를 늘려 계정의 노출과 신뢰도를 높이는 마케팅 방식을 말합니다.',
      },
      {
        type: 'paragraph',
        text: '소셜 미디어 플랫폼의 알고리즘은 팔로워 수나 좋아요 등 참여 지표가 높은 콘텐츠를 더 많은 사람에게 노출하는 경향이 있습니다. SMM 서비스는 이 지표를 일정 수준으로 끌어올려 자연 노출을 높이는 초기 발판으로 활용됩니다.',
      },
      {
        type: 'paragraph',
        text: 'SMM 서비스는 크리에이터, 소상공인, 마케팅 담당자 등 다양한 주체가 소셜 미디어 존재감을 빠르게 구축하기 위한 수단으로 이용합니다. 단, 플랫폼마다 이용 약관이 다르기 때문에 서비스 이용 전 각 플랫폼의 정책을 확인하는 것이 중요합니다.',
      },
      {
        type: 'heading2',
        text: 'SMM 서비스의 주요 유형',
      },
      {
        type: 'paragraph',
        text: 'SMM 서비스는 플랫폼과 지표 유형에 따라 다양하게 구분됩니다. 팔로워 증가, 좋아요 증가, 조회수 증가, 댓글 추가, 저장 수 증가 등이 대표적인 유형입니다. BESTSNS는 아래 12개 플랫폼의 SMM 서비스를 제공합니다.',
      },
      {
        type: 'unorderedList',
        items: [
          '인스타그램: 팔로워·좋아요·댓글·저장·릴스 조회수',
          '유튜브: 구독자·좋아요·조회수·댓글',
          '틱톡: 팔로워·좋아요·조회수',
          '페이스북: 좋아요·팔로워·조회수',
          '네이버: 블로그 방문·이웃 추가·카페 가입',
          '트위터(X): 팔로워·좋아요·리트윗',
          '쓰레드(Threads): 팔로워·좋아요',
          '핀터레스트: 팔로워·저장',
          '텀블러: 팔로워·리블로그',
          '당근: 매너온도·팔로워',
          '카카오톡: 채널 추가',
          '앱 다운로드: iOS/Android 앱 설치',
        ],
      },
      {
        type: 'heading2',
        text: 'SMM 서비스 이용 시 고려사항',
      },
      {
        type: 'paragraph',
        text: 'SMM 서비스를 이용할 때는 플랫폼 이용 약관을 사전에 확인해야 합니다. 각 소셜 미디어 플랫폼은 인위적인 지표 조작을 금지하는 조항을 두고 있는 경우가 있으며, 이를 위반할 경우 계정 제재로 이어질 수 있습니다.',
      },
      {
        type: 'paragraph',
        text: 'SMM 서비스는 초기 신뢰도 구축과 노출 확대를 위한 보조 수단으로 활용하는 것이 적절합니다. 양질의 콘텐츠 제작과 병행할 때 장기적인 계정 성장에 도움이 됩니다.',
      },
      {
        type: 'note',
        text: 'BESTSNS SMM 서비스 이용 전, 이용하려는 SNS 플랫폼의 최신 이용 약관을 직접 확인하시기 바랍니다. 플랫폼 정책은 수시로 변경될 수 있습니다.',
      },
    ],
    faq: [
      {
        question: 'SMM 서비스는 어떤 플랫폼에서 이용할 수 있나요?',
        answer: 'BESTSNS는 인스타그램·유튜브·틱톡·페이스북·네이버·트위터(X)·쓰레드·핀터레스트·텀블러·당근·카카오톡·앱 다운로드 등 12개 플랫폼의 SMM 서비스를 제공합니다.',
      },
      {
        question: 'SMM 서비스 주문 후 얼마나 걸리나요?',
        answer: '서비스 유형과 주문 수량에 따라 처리 시간이 다릅니다. 일반적으로 주문 접수 후 서비스 제공자가 작업을 시작하며, 자세한 예상 시간은 각 상품 상세 페이지에서 확인할 수 있습니다.',
      },
      {
        question: 'SMM 서비스 이용 시 계정 정보를 제공해야 하나요?',
        answer: '대부분의 팔로워·좋아요·조회수 서비스는 공개 계정 URL 또는 게시물 URL만 입력하면 됩니다. 비밀번호 등 민감한 계정 정보는 요구하지 않으며, 제공하지 않아도 됩니다.',
      },
    ],
  },

  // ────────────────────────────────────────────
  // 2. 인스타그램 팔로워
  // ────────────────────────────────────────────
  {
    slug: 'instagram-followers',
    category: 'smm',
    title: '인스타그램 팔로워를 늘리는 주요 방법',
    seoTitle: '인스타그램 팔로워 늘리는 방법 | BESTSNS',
    description: '인스타그램 팔로워를 늘리는 주요 방법과 고려사항을 설명합니다. 콘텐츠 전략, 해시태그 활용, SMM 서비스 이용 방법 등을 다룹니다.',
    excerpt: '인스타그램 팔로워를 늘리기 위해서는 일관된 콘텐츠 업로드, 해시태그 전략, 계정 최적화가 기본입니다. SMM 서비스는 초기 계정 신뢰도를 높이는 보조 수단으로 활용할 수 있습니다.',
    keywords: ['인스타그램 팔로워', '인스타그램 팔로워 늘리기', '인스타그램 마케팅', 'SMM', '소셜 미디어 마케팅', '인스타그램 계정 성장'],
    publishedAt: '2026-07-21',
    updatedAt: '2026-07-21',
    authorName: '더베스트(THEBEST)',
    articleType: 'Article',
    serviceUrl: 'https://bestsns.com/sns',
    priority: 0.9,
    changefreq: 'monthly',
    relatedSlugs: ['smm-marketing', 'youtube-views'],
    content: [
      {
        type: 'heading2',
        text: '인스타그램 팔로워 증가의 기본 원칙',
      },
      {
        type: 'paragraph',
        text: '인스타그램 팔로워를 늘리기 위해서는 계정의 정체성(니치)을 명확히 하고, 타겟 대상이 관심을 가질 만한 콘텐츠를 꾸준히 업로드하는 것이 가장 기본적인 접근 방식입니다.',
      },
      {
        type: 'paragraph',
        text: '인스타그램 알고리즘은 사용자 참여도(좋아요, 댓글, 저장, 공유)를 기반으로 콘텐츠를 더 넓은 사용자에게 노출합니다. 따라서 팔로워 수뿐만 아니라 게시물당 참여율도 함께 관리하는 것이 중요합니다.',
      },
      {
        type: 'heading2',
        text: '팔로워를 늘리는 주요 방법',
      },
      {
        type: 'paragraph',
        text: '인스타그램 팔로워를 늘리는 방법은 크게 콘텐츠 기반 성장, 해시태그 전략, 협업, SMM 서비스 활용으로 나눌 수 있습니다. 각 방법은 목적과 상황에 따라 조합하여 사용하는 것이 효과적입니다.',
      },
      {
        type: 'orderedList',
        items: [
          '프로필 최적화: 프로필 사진, 이름, 소개글에 핵심 키워드를 포함하여 검색 노출을 높입니다.',
          '일관된 업로드 주기: 팔로워가 콘텐츠를 기대하도록 일정한 주기로 게시물을 올립니다.',
          '릴스(Reels) 활용: 짧은 영상 형태의 릴스는 탐색 탭 노출 가능성이 높아 신규 팔로워 유입에 유리합니다.',
          '해시태그 전략: 대형 해시태그와 소형 해시태그를 혼합하여 노출 범위를 조절합니다.',
          '스토리와 인터랙션: 질문 스티커, 투표 등으로 기존 팔로워의 참여를 유도합니다.',
          '다른 계정과의 협업: 비슷한 분야의 계정과 맞팔·콜라보레이션을 통해 서로의 팔로워에게 노출됩니다.',
          'SMM 서비스 활용: 초기 팔로워 수를 빠르게 확보하여 신규 방문자의 신뢰도를 높이는 데 활용할 수 있습니다.',
        ],
      },
      {
        type: 'heading2',
        text: 'SMM 서비스 활용 시 고려사항',
      },
      {
        type: 'paragraph',
        text: 'SMM 서비스를 통한 팔로워 증가는 계정의 초기 신뢰도를 높이고 자연 팔로워 유입을 돕는 보조 수단으로 활용하는 것이 적절합니다. 고품질 콘텐츠 제작과 병행하지 않으면 참여율이 낮아질 수 있습니다.',
      },
      {
        type: 'paragraph',
        text: 'BESTSNS의 인스타그램 팔로워 서비스는 주문 시 공개 계정 URL만 입력하면 됩니다. 비밀번호 등 민감한 계정 정보는 요구하지 않습니다.',
      },
      {
        type: 'note',
        text: '인스타그램의 이용 약관은 수시로 변경됩니다. SMM 서비스 이용 전 인스타그램 커뮤니티 가이드라인을 직접 확인하시기 바랍니다.',
      },
      {
        type: 'paragraph',
        text: '팔로워 수가 증가하더라도 콘텐츠의 품질이 뒷받침되지 않으면 장기적인 계정 성장에 한계가 있습니다. SMM 서비스는 콘텐츠 전략의 초기 단계에서 유용하게 활용될 수 있습니다.',
      },
    ],
    faq: [
      {
        question: '인스타그램 팔로워 서비스 이용 시 계정 비밀번호를 제공해야 하나요?',
        answer: '아니요. BESTSNS의 팔로워 서비스는 공개 계정 URL만 입력하면 됩니다. 비밀번호나 로그인 정보를 요구하지 않습니다.',
      },
      {
        question: '팔로워가 감소할 수 있나요?',
        answer: '서비스 특성에 따라 일부 팔로워가 감소할 수 있습니다. 상품 상세 페이지에서 보장 기간 및 조건을 미리 확인하시기 바랍니다.',
      },
      {
        question: '인스타그램 비공개 계정에도 서비스 이용이 가능한가요?',
        answer: '대부분의 팔로워 서비스는 공개 계정을 대상으로 합니다. 비공개 계정에는 서비스 적용이 제한될 수 있으므로, 주문 전 공개 계정으로 전환 여부를 확인하시기 바랍니다.',
      },
    ],
  },

  // ────────────────────────────────────────────
  // 3. 유튜브 조회수
  // ────────────────────────────────────────────
  {
    slug: 'youtube-views',
    category: 'smm',
    title: '유튜브 조회수를 늘리는 주요 방법',
    seoTitle: '유튜브 조회수 늘리는 방법 | BESTSNS',
    description: '유튜브 조회수를 늘리기 위한 콘텐츠 전략, 검색 최적화, SMM 서비스 활용 방법을 설명합니다. 유튜브 알고리즘의 기본 원리와 조회수 증가에 영향을 주는 요소를 다룹니다.',
    excerpt: '유튜브 조회수는 제목과 썸네일 최적화, 검색 키워드 활용, 꾸준한 업로드 주기가 기본입니다. 초기 조회수 확보에는 SMM 서비스를 보조 수단으로 활용할 수 있습니다.',
    keywords: ['유튜브 조회수', '유튜브 조회수 늘리기', '유튜브 마케팅', 'SMM', '유튜브 알고리즘', '유튜브 구독자'],
    publishedAt: '2026-07-21',
    updatedAt: '2026-07-21',
    authorName: '더베스트(THEBEST)',
    articleType: 'Article',
    serviceUrl: 'https://bestsns.com/sns',
    priority: 0.9,
    changefreq: 'monthly',
    relatedSlugs: ['smm-marketing', 'instagram-followers'],
    content: [
      {
        type: 'heading2',
        text: '유튜브 알고리즘과 조회수의 관계',
      },
      {
        type: 'paragraph',
        text: '유튜브는 클릭률(CTR), 평균 시청 지속 시간, 좋아요·댓글·공유 등 참여 지표를 종합하여 영상을 추천합니다. 조회수 자체보다 시청자가 영상을 끝까지 시청하는 비율(시청 완료율)이 알고리즘에 더 큰 영향을 미치는 경향이 있습니다.',
      },
      {
        type: 'paragraph',
        text: '유튜브 홈 화면, 추천 영상 사이드바, 검색 결과 상위 노출은 채널의 조회수와 참여 지표가 높을수록 유리합니다. 초기 업로드 후 일정 시간 내에 조회수와 참여가 집중될수록 알고리즘에 의한 확산 속도가 빠릅니다.',
      },
      {
        type: 'heading2',
        text: '유튜브 조회수를 늘리는 주요 방법',
      },
      {
        type: 'paragraph',
        text: '유튜브 조회수를 늘리기 위한 방법은 크게 SEO 최적화, 콘텐츠 품질 개선, 외부 유입 활성화, SMM 서비스 활용으로 나눌 수 있습니다.',
      },
      {
        type: 'unorderedList',
        items: [
          '제목 최적화: 시청자가 검색할 법한 키워드를 제목 앞부분에 포함합니다.',
          '썸네일 디자인: 클릭률을 높이는 명확하고 시각적으로 흥미로운 썸네일을 제작합니다.',
          '설명란 작성: 영상 내용을 요약하고 관련 키워드를 자연스럽게 포함합니다.',
          '태그 활용: 영상과 관련된 검색 태그를 추가하여 검색 노출 가능성을 높입니다.',
          '업로드 주기 유지: 정기적인 업로드로 구독자의 기대감을 유지합니다.',
          '초반 시청 지속 시간 확보: 인트로를 간결하게 구성하여 이탈률을 낮춥니다.',
          'SMM 서비스 활용: 초기 조회수를 확보하여 알고리즘 노출을 촉진하는 보조 수단으로 사용합니다.',
        ],
      },
      {
        type: 'heading2',
        text: 'SMM 서비스 활용 시 고려사항',
      },
      {
        type: 'paragraph',
        text: 'BESTSNS의 유튜브 조회수 서비스는 영상 URL을 입력하는 방식으로 이용합니다. 채널 또는 계정 비밀번호는 요구하지 않습니다.',
      },
      {
        type: 'paragraph',
        text: '유튜브는 비정상적인 트래픽 패턴을 감지하는 시스템을 운영하고 있습니다. SMM 서비스 이용 시 유튜브 이용 약관을 사전에 확인하는 것이 중요합니다. 조회수 증가는 영상의 품질과 SEO 전략을 병행할 때 장기적으로 유효합니다.',
      },
      {
        type: 'paragraph',
        text: '초기 조회수 확보 외에도 구독자 증가, 좋아요 수 증가 서비스를 함께 활용하면 채널 성장에 복합적으로 작용할 수 있습니다.',
      },
      {
        type: 'note',
        text: '유튜브의 정책과 알고리즘은 수시로 변경됩니다. SMM 서비스 이용 전 유튜브 서비스 약관을 직접 확인하시기 바랍니다.',
      },
    ],
    faq: [
      {
        question: '유튜브 조회수 서비스 이용 시 채널 비밀번호가 필요한가요?',
        answer: '아니요. 영상 URL만 입력하면 됩니다. 채널 비밀번호나 이메일 정보를 제공할 필요가 없습니다.',
      },
      {
        question: '조회수가 유튜브 수익 창출에 영향을 미치나요?',
        answer: '유튜브 파트너 프로그램(YPP)은 구독자 수와 시청 시간을 기준으로 합니다. 조회수는 수익에 직접 영향을 주지만, 유튜브의 수익 창출 정책에 부합하는 시청 시간이어야 합니다.',
      },
      {
        question: '유튜브 구독자와 조회수 서비스를 함께 이용할 수 있나요?',
        answer: '네. BESTSNS에서는 구독자 증가와 조회수 증가 서비스를 각각 또는 함께 주문할 수 있습니다. 서비스 유형별 상품 목록을 확인하시기 바랍니다.',
      },
    ],
  },

  // ────────────────────────────────────────────
  // 4. 온라인 부업
  // ────────────────────────────────────────────
  {
    slug: 'online-side-job',
    category: 'parttime',
    title: '온라인 부업의 종류와 시작 전 확인사항',
    seoTitle: '온라인 부업 종류와 시작 방법 | BESTSNS',
    description: '재택에서 할 수 있는 온라인 부업의 주요 종류와 각 유형별 특징을 설명합니다. 부업 플랫폼 선택 기준과 시작 전 확인해야 할 사항을 함께 다룹니다.',
    excerpt: '온라인 부업은 SNS 마케팅 작업, 설문 참여, 데이터 라벨링, 번역, 블로그 체험단 등 다양한 유형이 있습니다. 각 유형의 특징과 수익 구조를 파악한 후 자신에게 맞는 방식을 선택하는 것이 중요합니다.',
    keywords: ['온라인 부업', '재택 부업', '부업 종류', '누구나알바', 'SNS 알바', '데이터 라벨링', '블로그 체험단'],
    publishedAt: '2026-07-21',
    updatedAt: '2026-07-21',
    authorName: '더베스트(THEBEST)',
    articleType: 'Article',
    serviceUrl: 'https://bestsns.com/part-time',
    priority: 0.9,
    changefreq: 'monthly',
    relatedSlugs: ['smm-marketing', 'aeo-guide'],
    content: [
      {
        type: 'heading2',
        text: '온라인 부업이란?',
      },
      {
        type: 'paragraph',
        text: '온라인 부업이란 인터넷 연결과 스마트폰 또는 컴퓨터만 있으면 장소에 구애받지 않고 참여할 수 있는 부가 수입 활동을 말합니다. 별도의 자격증이나 장비 없이 시작할 수 있는 유형부터 전문 기술이 필요한 유형까지 다양합니다.',
      },
      {
        type: 'paragraph',
        text: '온라인 부업은 크게 마이크로 태스크(소규모 반복 작업)와 스킬 기반 프리랜서 작업으로 나눌 수 있습니다. 마이크로 태스크는 SNS 참여, 설문 응답 등 비교적 간단한 작업이며, 프리랜서 작업은 번역, 디자인, 콘텐츠 작성 등 전문 기술이 필요합니다.',
      },
      {
        type: 'heading2',
        text: '주요 온라인 부업 종류',
      },
      {
        type: 'paragraph',
        text: 'BESTSNS 누구나알바 플랫폼에서는 아래와 같은 다양한 유형의 온라인 부업 태스크에 참여할 수 있습니다.',
      },
      {
        type: 'unorderedList',
        items: [
          '설문 참여: 기업이나 연구 기관의 설문에 응답하고 보상을 받는 방식',
          'SNS 태스크: 인스타그램 팔로우·좋아요, 유튜브 구독·조회, 네이버 블로그 방문 등',
          '네이버 카페 활동: 카페 가입, 게시글 조회 등',
          '리뷰 작성: 제품 또는 서비스 이용 후기를 작성하는 태스크',
          '데이터 검수: 데이터의 정확성을 검토하는 작업',
          '데이터 라벨링: AI 학습을 위한 이미지·텍스트 분류 및 표시 작업',
          '번역: 짧은 문장이나 문서를 다른 언어로 옮기는 작업',
          '블로그 체험단: 제품 또는 장소를 직접 체험하고 블로그에 후기를 작성',
          '블로그 기자단: 브랜드 관련 정보를 블로그에 기고하는 활동',
          '인스타그램 협찬: 브랜드 상품을 소개하는 인스타그램 게시물 작성',
          '유튜브 협찬: 브랜드 관련 영상 콘텐츠 제작',
          '웹사이트 방문: 특정 웹사이트를 방문하는 마케팅 지원 태스크',
          '영상 제공: 직접 촬영한 영상을 제공하는 태스크',
        ],
      },
      {
        type: 'heading2',
        text: '시작 전 확인사항',
      },
      {
        type: 'paragraph',
        text: '온라인 부업을 시작하기 전에 플랫폼의 정산 방식, 최소 출금 금액, 수수료 구조를 확인해야 합니다. BESTSNS 누구나알바의 경우 최소 출금 금액은 5,000원이며, 프리랜서 수수료와 원천징수세가 적용됩니다.',
      },
      {
        type: 'paragraph',
        text: '태스크별 단가와 소요 시간을 사전에 파악하면 시간 대비 수익을 예측하는 데 도움이 됩니다. 간단한 마이크로 태스크는 단가가 낮지만 다수를 빠르게 완료할 수 있고, 스킬 기반 태스크는 단가가 높지만 완료까지 더 많은 시간이 걸립니다.',
      },
      {
        type: 'paragraph',
        text: '플랫폼의 작업 증빙 방식도 확인해야 합니다. BESTSNS 누구나알바는 작업 완료 스크린샷 등 증빙 자료를 제출해야 하며, 운영자 검토 후 포인트가 적립됩니다.',
      },
      {
        type: 'note',
        text: '부업 수입이 일정 금액을 초과하면 종합소득세 신고 대상이 될 수 있습니다. 정확한 세금 처리는 관할 세무서 또는 세무사에 문의하시기 바랍니다.',
      },
    ],
    faq: [
      {
        question: 'BESTSNS 누구나알바 참여 자격이 있나요?',
        answer: 'BESTSNS 회원이라면 누구나 누구나알바 프리랜서로 참여할 수 있습니다. 별도의 자격 요건 없이 회원가입 후 바로 태스크를 확인하고 참여 신청을 할 수 있습니다.',
      },
      {
        question: '온라인 부업 수익은 어떻게 정산되나요?',
        answer: 'BESTSNS 누구나알바는 작업 완료 및 운영자 승인 후 포인트가 적립됩니다. 최소 5,000원 이상 적립 시 출금 신청이 가능하며, 프리랜서 수수료(5%)와 원천징수세(3.3%)를 제외한 금액이 등록 계좌로 입금됩니다.',
      },
      {
        question: '스마트폰만으로도 온라인 부업 참여가 가능한가요?',
        answer: '네. SNS 태스크, 설문, 리뷰 작성 등 대부분의 마이크로 태스크는 스마트폰으로 참여할 수 있습니다. 데이터 라벨링이나 번역 등 일부 태스크는 컴퓨터 환경이 더 편리할 수 있습니다.',
      },
    ],
  },

  // ────────────────────────────────────────────
  // 5. AEO 가이드
  // ────────────────────────────────────────────
  {
    slug: 'aeo-guide',
    category: 'aeo',
    title: 'AEO란? 답변 엔진 최적화의 개념',
    seoTitle: 'AEO란? 답변 엔진 최적화 개념 가이드 | BESTSNS',
    description: 'AEO(Answer Engine Optimization)의 개념과 SEO와의 차이점, AI 검색 시대에 AEO가 중요한 이유를 설명합니다. ChatGPT·Perplexity·Google AI Overview 등에서 답변으로 노출되는 원리를 다룹니다.',
    excerpt: 'AEO는 ChatGPT, Perplexity, Google AI Overview 등 AI 기반 답변 엔진에서 콘텐츠가 답변으로 선택되도록 최적화하는 전략입니다. 전통적인 SEO와 함께 적용할 때 AI 검색 시대의 노출 전략으로 효과적입니다.',
    keywords: ['AEO', '답변 엔진 최적화', 'Answer Engine Optimization', 'AI 검색', 'ChatGPT 최적화', 'Perplexity', 'Google AI Overview', 'SEO'],
    publishedAt: '2026-07-21',
    updatedAt: '2026-07-21',
    authorName: '더베스트(THEBEST)',
    articleType: 'TechArticle',
    serviceUrl: 'https://bestsns.com/ai',
    priority: 0.9,
    changefreq: 'monthly',
    relatedSlugs: ['smm-marketing', 'online-side-job'],
    content: [
      {
        type: 'heading2',
        text: 'AEO란 무엇인가?',
      },
      {
        type: 'paragraph',
        text: 'AEO(Answer Engine Optimization)는 ChatGPT·Perplexity·Google AI Overview·Claude 등 AI 기반 답변 엔진이 사용자 질문에 답변을 생성할 때, 특정 웹페이지나 브랜드의 콘텐츠가 답변의 근거로 선택되도록 최적화하는 전략입니다.',
      },
      {
        type: 'paragraph',
        text: '기존 검색 최적화(SEO)가 Google·Naver 검색 결과 목록의 상위 순위를 목표로 했다면, AEO는 AI 답변 엔진이 직접 답변을 생성할 때 해당 콘텐츠를 참조하도록 하는 것을 목표로 합니다. AI 검색 사용이 증가함에 따라 AEO의 중요성도 높아지고 있습니다.',
      },
      {
        type: 'heading2',
        text: 'AEO가 중요한 이유',
      },
      {
        type: 'paragraph',
        text: '2024년 이후 ChatGPT, Perplexity, Google AI Overview 등 AI 답변 도구의 사용이 빠르게 증가하면서, 검색 사용자들이 기존 링크 목록이 아닌 AI가 요약한 직접 답변을 통해 정보를 얻는 비율이 높아지고 있습니다.',
      },
      {
        type: 'paragraph',
        text: 'AI 답변 엔진이 특정 브랜드나 서비스를 언급하거나 해당 페이지를 출처로 인용하면, 링크를 클릭하지 않더라도 브랜드 인지도가 형성됩니다. 이는 기존 SEO 클릭 기반 노출과는 다른 방식의 인지 경로입니다.',
      },
      {
        type: 'heading2',
        text: 'AEO 최적화의 주요 원칙',
      },
      {
        type: 'paragraph',
        text: 'AEO를 위한 콘텐츠 최적화는 AI가 답변을 생성할 때 쉽게 인식하고 인용할 수 있도록 구조화하는 것에서 시작합니다.',
      },
      {
        type: 'unorderedList',
        items: [
          '질문형 구조 활용: 사용자가 실제로 검색할 법한 질문을 제목이나 소제목으로 구성하면 AI가 해당 섹션을 답변 후보로 인식하기 쉽습니다.',
          '간결하고 명확한 답변 작성: 각 질문에 대한 답변을 2~3문장의 명확한 단락으로 제공합니다.',
          'FAQ 섹션 포함: 명시적인 FAQ 구조는 AI가 질문-답변 쌍을 인식하는 데 유리합니다.',
          'JSON-LD 구조화 데이터: FAQPage, Article, Organization 등 Schema.org 스키마를 적용하면 AI 크롤러가 콘텐츠 유형을 빠르게 파악합니다.',
          '정확하고 검증된 정보: AI는 신뢰도가 높은 출처를 선호합니다. 사실에 기반한 정보를 제공하고, 출처를 명확히 합니다.',
          '엔티티 명확성: 브랜드명, 서비스명, 운영사 등 핵심 엔티티를 반복적으로 명확하게 언급하여 AI가 해당 엔티티와 콘텐츠를 연결하도록 합니다.',
        ],
      },
      {
        type: 'note',
        text: 'AEO 효과는 AI 엔진의 학습 데이터 업데이트 주기와 알고리즘에 따라 달라질 수 있습니다. SEO와 마찬가지로 장기적인 콘텐츠 전략의 일환으로 접근하는 것이 적절합니다.',
      },
    ],
    faq: [
      {
        question: 'AEO와 SEO는 무엇이 다른가요?',
        answer: 'SEO는 Google·Naver 등 전통적인 검색 엔진의 결과 목록에서 상위에 표시되도록 최적화하는 전략입니다. AEO는 ChatGPT·Perplexity 등 AI 답변 엔진이 사용자 질문에 답변을 생성할 때 해당 콘텐츠를 참조하도록 하는 전략입니다. 두 전략은 서로 보완 관계에 있습니다.',
      },
      {
        question: 'AEO를 위해 JSON-LD는 반드시 필요한가요?',
        answer: 'JSON-LD 구조화 데이터는 AI 크롤러가 콘텐츠의 유형과 의미를 빠르게 파악하는 데 도움을 줍니다. FAQPage, Article, Organization 스키마를 적용하면 AEO 적합성을 높일 수 있습니다. 반드시 필요한 것은 아니지만 적용 시 유리한 요소입니다.',
      },
      {
        question: 'BESTSNS AI 마케팅 컨설팅에서 AEO 전략을 받을 수 있나요?',
        answer: '네. BESTSNS AI 마케팅 컨설팅에서는 AEO 및 GEO(생성형 엔진 최적화) 전략 수립, 구조화 데이터 설계, 콘텐츠 최적화 방향 등에 대한 컨설팅을 채팅 형식으로 제공합니다.',
      },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────
// 모듈 로드 시 자동 검증 실행
// ─────────────────────────────────────────────────────────────────

validateKnowledgeArticles(KNOWLEDGE_ARTICLES);
