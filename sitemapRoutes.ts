import { KNOWLEDGE_ARTICLES } from './data/knowledgeArticles';

/**
 * 사이트맵에 포함할 공개 정적 라우트 목록.
 * 새 페이지를 추가할 때 이 배열에 경로를 추가하면 빌드 시 sitemap.xml에 자동 반영됩니다.
 * - 동적 경로 (/:id 등) 및 로그인 전용 페이지는 제외합니다.
 * - Knowledge 문서는 data/knowledgeArticles.ts에서 자동 반영됩니다.
 */
const STATIC_ROUTES: { path: string; priority?: number; changefreq?: string }[] = [
  { path: '/',                    priority: 1.0, changefreq: 'daily' },
  { path: '/sns',                 priority: 1.0, changefreq: 'daily' },
  { path: '/channels',            priority: 0.9, changefreq: 'weekly' },
  { path: '/ebooks',              priority: 0.9, changefreq: 'weekly' },
  { path: '/part-time',           priority: 0.9, changefreq: 'daily' },
  { path: '/board',               priority: 0.8, changefreq: 'daily' },
  { path: '/ai',                  priority: 0.8, changefreq: 'weekly' },
  { path: '/knowledge',          priority: 0.9, changefreq: 'monthly' },
  { path: '/notices',             priority: 0.7, changefreq: 'weekly' },
  { path: '/terms',               priority: 0.4, changefreq: 'monthly' },
  { path: '/privacy',             priority: 0.4, changefreq: 'monthly' },
  { path: '/marketing-consent',   priority: 0.3, changefreq: 'monthly' },
];

const ARTICLE_ROUTES: { path: string; priority?: number; changefreq?: string }[] =
  KNOWLEDGE_ARTICLES.map((article) => ({
    path: `/knowledge/${article.slug}`,
    priority: article.priority,
    changefreq: article.changefreq,
  }));

// 정적 경로와 문서 경로 간 중복 검증
const staticPathSet = new Set(STATIC_ROUTES.map((r) => r.path));
for (const route of ARTICLE_ROUTES) {
  if (staticPathSet.has(route.path)) {
    throw new Error(`[sitemapRoutes] 중복 경로 발생: "${route.path}" — STATIC_ROUTES와 ARTICLE_ROUTES에 동시에 존재합니다.`);
  }
}

export const SITEMAP_ROUTES: { path: string; priority?: number; changefreq?: string }[] = [
  ...STATIC_ROUTES,
  ...ARTICLE_ROUTES,
];
