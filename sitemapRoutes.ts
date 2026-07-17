/**
 * 사이트맵에 포함할 공개 정적 라우트 목록.
 * 새 페이지를 추가할 때 이 배열에 경로를 추가하면 빌드 시 sitemap.xml에 자동 반영됩니다.
 * - 동적 경로 (/:id 등) 및 로그인 전용 페이지는 제외합니다.
 */
export const SITEMAP_ROUTES: { path: string; priority?: number; changefreq?: string }[] = [
  { path: '/',                    priority: 1.0, changefreq: 'daily' },
  { path: '/sns',                 priority: 1.0, changefreq: 'daily' },
  { path: '/channels',            priority: 0.9, changefreq: 'weekly' },
  { path: '/ebooks',              priority: 0.9, changefreq: 'weekly' },
  { path: '/part-time',           priority: 0.9, changefreq: 'daily' },
  { path: '/board',               priority: 0.8, changefreq: 'daily' },
  { path: '/ai',                  priority: 0.8, changefreq: 'weekly' },
  { path: '/notices',             priority: 0.7, changefreq: 'weekly' },
  { path: '/terms',               priority: 0.4, changefreq: 'monthly' },
  { path: '/privacy',             priority: 0.4, changefreq: 'monthly' },
  { path: '/marketing-consent',   priority: 0.3, changefreq: 'monthly' },
];
