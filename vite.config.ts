import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { SITEMAP_ROUTES } from './sitemapRoutes'
import { KNOWLEDGE_ARTICLES, validateKnowledgeArticles } from './data/knowledgeArticles'
import type { KnowledgeArticle, KnowledgeContentBlock, KnowledgeCategory } from './data/knowledgeArticles'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

// Netlify 빌드 시 ../../types resolve 오류 방지
function resolveTypesPlugin() {
  const typesPath = path.resolve(root, 'types.ts')
  return {
    name: 'resolve-project-types',
    enforce: 'pre',
    resolveId(source, importer) {
      const isTypesImport = source === '../../types' || source === '../types' || source === '@/types'
      if (!isTypesImport) return null
      if (importer && importer.includes('node_modules')) return null
      return typesPath
    },
  }
}

// Netlify 빌드 시 profileUtils resolve 오류 방지
function resolveProfileUtilsPlugin() {
  const profileUtilsPath = path.resolve(root, 'profileUtils.ts')
  return {
    name: 'resolve-profile-utils',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== './profileUtils' && source !== './profileUtils.ts') return null
      if (importer && !importer.includes('App.tsx')) return null
      return profileUtilsPath
    },
  }
}

// 빌드 시 dist/sitemap.xml 자동 생성 — sitemapRoutes.ts를 수정하면 자동 반영
function sitemapPlugin(baseUrl: string) {
  return {
    name: 'vite-plugin-sitemap',
    closeBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = SITEMAP_ROUTES.map(({ path: routePath, priority = 0.8, changefreq = 'weekly' }) => {
        const loc = routePath === '/' ? baseUrl : `${baseUrl}${routePath}`;
        return [
          '  <url>',
          `    <loc>${loc}</loc>`,
          `    <lastmod>${today}</lastmod>`,
          `    <changefreq>${changefreq}</changefreq>`,
          `    <priority>${priority.toFixed(1)}</priority>`,
          '  </url>',
        ].join('\n');
      }).join('\n');

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls,
        '</urlset>',
      ].join('\n');

      const outPath = path.resolve(__dirname, 'dist/sitemap.xml');
      fs.writeFileSync(outPath, xml, 'utf-8');
      console.log(`[sitemap] dist/sitemap.xml 생성 완료 (${SITEMAP_ROUTES.length}개 URL)`);
    },
  };
}

// ── Knowledge 정적 HTML 생성 플러그인 ────────────────────────────────────────

const KNOWLEDGE_PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.7;font-size:16px}
a{color:#60a5fa;text-decoration:none}a:hover{text-decoration:underline}
header{background:#1e293b;border-bottom:1px solid #334155;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem}
header a.logo{font-size:1.25rem;font-weight:700;color:#fff}
header nav{margin-left:auto;display:flex;gap:1rem;font-size:.875rem}
header nav a{color:#94a3b8}
.container{max-width:800px;margin:0 auto;padding:2rem 1.5rem}
.breadcrumb{font-size:.8rem;color:#94a3b8;margin-bottom:1.5rem}
.breadcrumb a{color:#94a3b8}.breadcrumb span{margin:0 .4rem}
h1{font-size:1.75rem;font-weight:700;color:#f1f5f9;margin-bottom:.75rem;line-height:1.3}
.meta{font-size:.8rem;color:#64748b;margin-bottom:2rem}
.excerpt{font-size:1.05rem;color:#94a3b8;border-left:3px solid #3b82f6;padding-left:1rem;margin-bottom:2.5rem}
h2{font-size:1.3rem;font-weight:600;color:#f1f5f9;margin:2.5rem 0 .75rem;padding-bottom:.4rem;border-bottom:1px solid #1e293b}
h3{font-size:1.1rem;font-weight:600;color:#e2e8f0;margin:1.75rem 0 .5rem}
p{margin-bottom:1rem;color:#cbd5e1}
ul,ol{margin:0 0 1rem 1.5rem;color:#cbd5e1}
li{margin-bottom:.35rem}
aside.note{background:#1e3a5f;border-left:4px solid #3b82f6;padding:.75rem 1rem;border-radius:4px;margin:1.25rem 0;font-size:.9rem;color:#93c5fd}
blockquote{background:#1e293b;border-left:4px solid #475569;padding:.75rem 1rem;border-radius:4px;margin:1.25rem 0;color:#94a3b8;font-style:italic}
.faq-section{margin-top:3rem}
.faq-section h2{border-bottom:none;margin-bottom:1rem}
details{background:#1e293b;border:1px solid #334155;border-radius:8px;margin-bottom:.75rem;overflow:hidden}
details[open]{border-color:#3b82f6}
summary.faq-q{padding:.9rem 1.1rem;cursor:pointer;font-weight:600;color:#e2e8f0;list-style:none;display:flex;justify-content:space-between;align-items:center;user-select:none}
summary.faq-q::after{content:'+';font-size:1.2rem;color:#60a5fa;flex-shrink:0}
details[open] summary.faq-q::after{content:'−'}
.faq-a{padding:.75rem 1.1rem 1rem;color:#94a3b8;border-top:1px solid #334155}
.related{margin-top:3rem}
.related h2{border-bottom:none;margin-bottom:1rem}
.related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.75rem}
.related-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:1rem;color:#e2e8f0;transition:border-color .2s}
.related-card:hover{border-color:#3b82f6;text-decoration:none;color:#f1f5f9}
.related-card .cat{font-size:.7rem;color:#60a5fa;text-transform:uppercase;margin-bottom:.35rem}
.related-card .ttl{font-size:.9rem;font-weight:600;line-height:1.4}
.cta{margin-top:3rem;background:linear-gradient(135deg,#1e40af,#1e3a8a);border-radius:12px;padding:2rem;text-align:center}
.cta p{color:#93c5fd;margin-bottom:1.25rem}
.cta a{display:inline-block;background:#3b82f6;color:#fff;padding:.75rem 2rem;border-radius:8px;font-weight:600;font-size:1rem}
.cta a:hover{background:#2563eb;text-decoration:none}
footer{margin-top:4rem;border-top:1px solid #1e293b;padding:1.5rem;text-align:center;font-size:.8rem;color:#475569}
@media(max-width:600px){h1{font-size:1.4rem}.container{padding:1.5rem 1rem}}
`.trim();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\//g, '<\\/');
}

function getCategoryLabel(cat: KnowledgeCategory): string {
  const MAP: Record<KnowledgeCategory, string> = {
    smm: 'SMM 마케팅',
    channel: '채널 거래',
    njobs: '디지털상품',
    parttime: '온라인 부업',
    ai: 'AI 서비스',
    seo: 'SEO',
    aeo: 'AEO',
    geo: 'GEO',
    guide: '이용 가이드',
  };
  return MAP[cat];
}

function getCtaLabel(cat: KnowledgeCategory): string {
  const MAP: Record<KnowledgeCategory, string> = {
    smm: 'SMM 마케팅 서비스 이용하기',
    channel: '채널 거래소 바로가기',
    njobs: 'N잡스토어 바로가기',
    parttime: '온라인 부업 시작하기',
    ai: 'AI 컨설팅 상담받기',
    seo: 'SEO 마케팅 서비스 보기',
    aeo: 'AI 검색 최적화 서비스 보기',
    geo: 'GEO 최적화 서비스 보기',
    guide: 'BESTSNS 서비스 살펴보기',
  };
  return MAP[cat];
}

function renderBlock(block: KnowledgeContentBlock): string {
  switch (block.type) {
    case 'heading2':
      return `<h2>${escapeHtml(block.text)}</h2>`;
    case 'heading3':
      return `<h3>${escapeHtml(block.text)}</h3>`;
    case 'paragraph':
      return `<p>${escapeHtml(block.text)}</p>`;
    case 'unorderedList':
      return `<ul>${block.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${block.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ol>`;
    case 'note':
      return `<aside class="note">${escapeHtml(block.text)}</aside>`;
    case 'quote':
      return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
    default: {
      const _exhaustive: never = block;
      throw new Error(`[knowledgeStaticPlugin] 알 수 없는 블록 타입: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function buildArticleHtml(article: KnowledgeArticle, allArticles: KnowledgeArticle[], baseUrl: string): string {
  const canonicalUrl = `${baseUrl}/knowledge/${article.slug}`;
  const articleId = `${canonicalUrl}#article`;
  const webpageId = `${canonicalUrl}#webpage`;
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const orgId = `${baseUrl}#organization`;
  const websiteId = `${baseUrl}/#website`;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': orgId,
    name: 'BESTSNS',
    url: baseUrl,
    logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
    sameAs: ['https://www.instagram.com/bestsns_official', 'https://www.youtube.com/@bestsns'],
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    name: 'BESTSNS',
    url: baseUrl,
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/#/sns?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };

  const articleType = article.articleType ?? 'Article';
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': articleType,
    '@id': articleId,
    headline: article.seoTitle,
    description: article.description,
    url: canonicalUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Organization', '@id': orgId, name: article.authorName },
    publisher: { '@id': orgId },
    isPartOf: { '@id': websiteId },
    keywords: article.keywords.join(', '),
    ...(article.image ? { image: { '@type': 'ImageObject', url: article.image.startsWith('http') ? article.image : `${baseUrl}${article.image}` } } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': webpageId },
  };

  const webpageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': webpageId,
    url: canonicalUrl,
    name: article.seoTitle,
    description: article.description,
    isPartOf: { '@id': websiteId },
    about: { '@id': articleId },
    breadcrumb: { '@id': breadcrumbId },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'BESTSNS', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Knowledge', item: `${baseUrl}/knowledge` },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl },
    ],
  };

  const schemas: string[] = [
    `<script type="application/ld+json">${safeJsonLd(organizationSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(websiteSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(articleSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(webpageSchema)}</script>`,
    `<script type="application/ld+json">${safeJsonLd(breadcrumbSchema)}</script>`,
  ];

  if (article.faq && article.faq.length > 0) {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    };
    schemas.push(`<script type="application/ld+json">${safeJsonLd(faqSchema)}</script>`);
  }

  const contentHtml = article.content.map(renderBlock).join('\n');

  const faqHtml = article.faq && article.faq.length > 0
    ? `<section class="faq-section">
<h2>자주 묻는 질문</h2>
${article.faq.map(({ question, answer }) => `<details open>
<summary class="faq-q">${escapeHtml(question)}</summary>
<div class="faq-a">${escapeHtml(answer)}</div>
</details>`).join('\n')}
</section>`
    : '';

  const relatedArticles = article.relatedSlugs
    .map(slug => allArticles.find(a => a.slug === slug))
    .filter((a): a is KnowledgeArticle => !!a);

  const relatedHtml = relatedArticles.length > 0
    ? `<section class="related">
<h2>관련 문서</h2>
<div class="related-grid">
${relatedArticles.map(rel => `<a href="${baseUrl}/knowledge/${rel.slug}" class="related-card">
<div class="cat">${escapeHtml(getCategoryLabel(rel.category))}</div>
<div class="ttl">${escapeHtml(rel.title)}</div>
</a>`).join('\n')}
</div>
</section>`
    : '';

  const ctaServiceUrl = article.serviceUrl.startsWith('http')
    ? article.serviceUrl
    : `${baseUrl}/${article.serviceUrl.replace(/^\//, '')}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(article.seoTitle)}</title>
<meta name="description" content="${escapeHtml(article.description)}">
<meta name="keywords" content="${escapeHtml(article.keywords.join(', '))}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(article.seoTitle)}">
<meta property="og:description" content="${escapeHtml(article.description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="BESTSNS">
${article.image ? `<meta property="og:image" content="${article.image.startsWith('http') ? article.image : `${baseUrl}${article.image}`}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(article.seoTitle)}">
<meta name="twitter:description" content="${escapeHtml(article.description)}">
${schemas.join('\n')}
<style>${KNOWLEDGE_PAGE_CSS}</style>
</head>
<body>
<header>
<a href="${baseUrl}" class="logo">BESTSNS</a>
<nav>
<a href="${baseUrl}/sns">SMM</a>
<a href="${baseUrl}/channels">채널</a>
<a href="${baseUrl}/knowledge">Knowledge</a>
</nav>
</header>
<div class="container">
<nav class="breadcrumb" aria-label="breadcrumb">
<a href="${baseUrl}">홈</a><span>›</span><a href="${baseUrl}/knowledge">Knowledge</a><span>›</span><span>${escapeHtml(getCategoryLabel(article.category))}</span>
</nav>
<h1>${escapeHtml(article.title)}</h1>
<p class="meta">${escapeHtml(article.authorName)} · ${article.publishedAt}${article.updatedAt !== article.publishedAt ? ` (업데이트: ${article.updatedAt})` : ''} · ${escapeHtml(getCategoryLabel(article.category))}</p>
<p class="excerpt">${escapeHtml(article.excerpt)}</p>
${contentHtml}
${faqHtml}
${relatedHtml}
<div class="cta">
<p>${escapeHtml(article.title)} 관련 전문 서비스를 BESTSNS에서 경험해보세요.</p>
<a href="${ctaServiceUrl}">${escapeHtml(getCtaLabel(article.category))}</a>
</div>
</div>
<footer>
<p>© 2024 BESTSNS. All rights reserved. | <a href="${baseUrl}/terms">이용약관</a> · <a href="${baseUrl}/privacy">개인정보처리방침</a></p>
</footer>
</body>
</html>`;
}

function validateGeneratedHtml(html: string, article: KnowledgeArticle, baseUrl: string): void {
  const slug = article.slug;
  const canonicalUrl = `${baseUrl}/knowledge/${slug}`;

  const checks: [boolean, string][] = [
    [html.includes(`<title>${escapeHtml(article.seoTitle)}</title>`), 'title 태그 누락'],
    [html.includes(`content="${escapeHtml(article.description)}"`), 'meta description 누락'],
    [html.includes(`href="${canonicalUrl}"`), 'canonical URL 누락'],
    [html.includes(`<h1>${escapeHtml(article.title)}</h1>`), 'H1 태그 누락'],
    [html.split('<h1').length === 2, 'H1이 2개 이상 (중복)'],
    [(html.match(/"@type"\s*:\s*"Article"/) !== null) || (html.match(/"@type"\s*:\s*"TechArticle"/) !== null), 'Article/TechArticle 스키마 누락'],
    [html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'), 'BreadcrumbList 스키마 누락'],
    ...(article.faq && article.faq.length > 0
      ? [[html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), 'FAQPage 스키마 누락'] as [boolean, string]]
      : []),
    [html.includes(article.serviceUrl) || html.includes(ctaUrlFor(article, baseUrl)), 'serviceUrl CTA 링크 누락'],
    ...article.relatedSlugs.map(rs => [html.includes(`/knowledge/${rs}`), `related slug 링크 누락: ${rs}`] as [boolean, string]),
  ];

  const failed = checks.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (failed.length > 0) {
    throw new Error(`[knowledgeStaticPlugin] ${slug}.html 검증 실패:\n  ${failed.join('\n  ')}`);
  }
}

function ctaUrlFor(article: KnowledgeArticle, baseUrl: string): string {
  return article.serviceUrl.startsWith('http')
    ? article.serviceUrl
    : `${baseUrl}/${article.serviceUrl.replace(/^\//, '')}`;
}

function knowledgeStaticPlugin(baseUrl: string) {
  return {
    name: 'vite-plugin-knowledge-static',
    closeBundle() {
      validateKnowledgeArticles(KNOWLEDGE_ARTICLES);

      const outDir = path.resolve(__dirname, 'dist/knowledge');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      let count = 0;
      for (const article of KNOWLEDGE_ARTICLES) {
        const html = buildArticleHtml(article, KNOWLEDGE_ARTICLES, baseUrl);
        validateGeneratedHtml(html, article, baseUrl);
        const outPath = path.resolve(outDir, `${article.slug}.html`);
        fs.writeFileSync(outPath, html, 'utf-8');
        count++;
      }

      console.log(`[knowledge] dist/knowledge/*.html 생성 완료 (${count}개 문서)`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // 이 부분을 추가해서 경로를 명확하게 잡아줍니다.
  plugins: [resolveTypesPlugin(), resolveProfileUtilsPlugin(), react(), sitemapPlugin('https://bestsns.com'), knowledgeStaticPlugin('https://bestsns.com')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/types': path.resolve(__dirname, 'types.ts'),
      '@/profileUtils': path.resolve(__dirname, 'profileUtils.ts'),
      './components/Header': path.resolve(__dirname, 'components/Header.tsx'),
      './components/LiveNotification': path.resolve(__dirname, 'components/LiveNotification.tsx'),
      './pages': path.resolve(__dirname, 'pages'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
})
