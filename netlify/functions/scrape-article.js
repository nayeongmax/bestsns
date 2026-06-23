// Netlify Serverless Function: scrape-article.js
// 일반 웹 페이지에서 글 제목, 본문, 이미지를 수집합니다.

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
};

function getMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function resolveUrl(src, baseUrl) {
  if (!src) return null;
  if (src.startsWith('data:')) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function extractTitle(html) {
  const og = getMeta(html, 'og:title');
  if (og) return og.replace(/\s*[-|].*$/, '').trim();

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) {
    const t = stripHtml(titleM[1]).replace(/\s*[-|].*$/, '').trim();
    if (t) return t;
  }

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]).trim();

  return null;
}

function extractDescription(html) {
  // JSON-LD
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const obj = JSON.parse(inner);
        const desc = obj?.description || obj?.['@graph']?.[0]?.description || obj?.articleBody;
        if (desc && desc.length > 30) return desc.trim();
      } catch {}
    }
  }

  // OG description
  const ogDesc = getMeta(html, 'og:description');
  if (ogDesc && ogDesc.length > 20) return ogDesc;

  // meta description
  const metaDesc = getMeta(html, 'description');
  if (metaDesc && metaDesc.length > 20) return metaDesc;

  return null;
}

function extractBody(html) {
  // 주요 본문 영역 클래스 패턴
  const bodyPatterns = [
    /<article[^>]*>([\s\S]{200,}?)<\/article>/i,
    /<div[^>]+class="[^"]*(?:article|post|entry|content|body|main-content|post-content|article-content|se-main-container)[^"]*"[^>]*>([\s\S]{200,}?)<\/div>/i,
    /<section[^>]+class="[^"]*(?:article|post|entry|content|body)[^"]*"[^>]*>([\s\S]{200,}?)<\/section>/i,
    /<div[^>]+id=["'](?:article|post|entry|content|body|main)[^"']*["'][^>]*>([\s\S]{200,}?)<\/div>/i,
  ];

  for (const pattern of bodyPatterns) {
    const m = html.match(pattern);
    if (m) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 100) return text.slice(0, 5000);
    }
  }

  // 네이버 블로그 특화
  const naverMatch = html.match(/<div[^>]+class="[^"]*se-component[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
  if (naverMatch) {
    const combined = naverMatch.map(b => stripHtml(b)).join('\n').trim();
    if (combined.length > 100) return combined.slice(0, 5000);
  }

  return null;
}

function extractImages(html, baseUrl) {
  // OG image 우선
  const ogImage = getMeta(html, 'og:image');
  const thumbnail = ogImage ? resolveUrl(ogImage, baseUrl) : null;

  // 본문 이미지 수집
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images = [];
  let m;
  while ((m = imgPattern.exec(html)) !== null) {
    const src = resolveUrl(m[1], baseUrl);
    if (!src) continue;
    // 너무 작은 아이콘/트래킹 이미지 제외
    if (/\.(gif|ico)(\?|$)/i.test(src)) continue;
    if (/tracking|pixel|beacon|analytics|logo.*\d+x\d+/i.test(src)) continue;
    if (src !== thumbnail) images.push(src);
  }

  return { thumbnail: thumbnail || (images[0] ?? null), images: [...new Set(images)].slice(0, 12) };
}

function extractPublishedAt(html) {
  // JSON-LD datePublished
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const obj = JSON.parse(inner);
        const date = obj?.datePublished || obj?.['@graph']?.[0]?.datePublished;
        if (date) return date;
      } catch {}
    }
  }

  // meta article:published_time
  const pubTime = getMeta(html, 'article:published_time');
  if (pubTime) return pubTime;

  return null;
}

function extractAuthor(html) {
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const obj = JSON.parse(inner);
        const author = obj?.author?.name || obj?.['@graph']?.[0]?.author?.name;
        if (author) return author;
      } catch {}
    }
  }

  const metaAuthor = getMeta(html, 'author') || getMeta(html, 'article:author');
  if (metaAuthor) return metaAuthor;

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: 'POST 요청만 지원합니다.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: '요청 형식이 올바르지 않습니다.' }),
    };
  }

  const { url } = body;
  if (!url || typeof url !== 'string') {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: 'url 파라미터가 필요합니다.' }),
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid protocol');
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: '올바른 URL 형식이 아닙니다.' }),
    };
  }

  let html;
  try {
    const pageRes = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    if (!pageRes.ok) {
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({
          status: 'error',
          message: `페이지를 불러오지 못했습니다. (HTTP ${pageRes.status})`,
        }),
      };
    }
    html = await pageRes.text();
  } catch (e) {
    return {
      statusCode: 502,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: `페이지 요청 실패: ${e.message}` }),
    };
  }

  const title = extractTitle(html);
  const description = extractDescription(html);
  const body_text = extractBody(html) || description;
  const { thumbnail, images } = extractImages(html, url);
  const publishedAt = extractPublishedAt(html);
  const author = extractAuthor(html);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      status: 'ok',
      url,
      title: title || null,
      description: description || null,
      body: body_text || null,
      thumbnail: thumbnail || null,
      images,
      author: author || null,
      publishedAt: publishedAt || null,
    }),
  };
};
