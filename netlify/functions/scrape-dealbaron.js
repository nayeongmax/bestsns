// Netlify Serverless Function: scrape-dealbaron.js
// 딜바론(dealbaron.com) 매물 페이지를 스크래핑하여 채널 정보를 추출합니다.
// 이미지는 Supabase Storage에 업로드하여 CDN URL로 변환합니다.
// SUPABASE_SERVICE_ROLE_KEY 환경변수가 없으면 base64 fallback으로 반환합니다.

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

// ─── HTML 파싱 유틸 ─────────────────────────────────────────────────────────

/** 메타 태그 content 추출 (property / name 둘 다 시도) */
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

/** HTML 엔티티 디코딩 */
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

/** HTML 태그 제거 및 텍스트 추출 */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
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

/** URL이 절대경로가 아닌 경우 baseUrl 기준으로 변환 */
function resolveUrl(src, baseUrl) {
  if (!src) return null;
  if (src.startsWith('data:')) return null; // base64 이미지 스킵
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

/** 한국어 숫자 단위 포함 파싱 (예: "1.2만" → 12000, "3K" → 3000) */
function parseKoreanNumber(str) {
  if (!str) return null;
  const s = str.replace(/,/g, '').trim();
  const manMatch = s.match(/^([\d.]+)\s*만/);
  if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
  const kMatch = s.match(/^([\d.]+)\s*[kK]/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const num = parseFloat(s);
  return isNaN(num) ? null : Math.round(num);
}

// ─── 데이터 추출 함수들 ──────────────────────────────────────────────────────

/** 제목 추출 */
function extractTitle(html) {
  // 1. OG title
  const og = getMeta(html, 'og:title');
  if (og) return og.replace(/\s*[-|].*$/, '').trim();

  // 2. <title> 태그
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) {
    const t = stripHtml(titleM[1]).replace(/\s*[-|].*$/, '').trim();
    if (t) return t;
  }

  // 3. h1
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]).trim();

  return null;
}

/** 본문 설명 추출 */
function extractDescription(html) {
  // 1. JSON-LD에서 description
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const obj = JSON.parse(inner);
        const desc = obj?.description || obj?.['@graph']?.[0]?.description;
        if (desc && desc.length > 30) return desc.trim();
      } catch {}
    }
  }

  // 2. OG description
  const ogDesc = getMeta(html, 'og:description');
  if (ogDesc && ogDesc.length > 30) return ogDesc;

  // 3. meta description
  const metaDesc = getMeta(html, 'description');
  if (metaDesc && metaDesc.length > 30) return metaDesc;

  // 4. 딜바론 특화: 본문 텍스트 영역 탐색
  const descPatterns = [
    /<div[^>]+class="[^"]*(?:desc|detail|content|body|product-info|item-info|channel-info)[^"]*"[^>]*>([\s\S]{100,2000}?)<\/div>/i,
    /<section[^>]+class="[^"]*(?:desc|detail|content|body)[^"]*"[^>]*>([\s\S]{100,2000}?)<\/section>/i,
    /<p[^>]+class="[^"]*(?:desc|detail|content)[^"]*"[^>]*>([\s\S]{100,1000}?)<\/p>/i,
  ];
  for (const p of descPatterns) {
    const m = html.match(p);
    if (m) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 50) return text;
    }
  }

  // 5. Next.js __NEXT_DATA__ 파싱
  const nextData = extractNextData(html);
  if (nextData) {
    const desc = deepFind(nextData, ['description', 'desc', 'content', 'body']);
    if (desc && typeof desc === 'string' && desc.length > 30) return desc;
  }

  return ogDesc || null;
}

/** 이미지 URL 목록 추출 (딜바론 전용) */
function extractImages(html, baseUrl) {
  // ── 1. 썸네일: .group-image 안의 <img> (딜바론 매물 대표 이미지)
  let thumbnail = null;
  const groupImgMatch = html.match(/class="group-image"[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (groupImgMatch) {
    thumbnail = resolveUrl(groupImgMatch[1], baseUrl);
  }
  // 없으면 OG image fallback
  if (!thumbnail) {
    const ogImage = getMeta(html, 'og:image');
    if (ogImage) thumbnail = resolveUrl(ogImage, baseUrl);
  }

  // ── 2. 첨부 이미지: <div class="screen" data-path="..."> 의 data-path 속성
  //    딜바론은 첨부 이미지를 <img>가 아닌 background-image CSS로 렌더링함
  const screenPattern = /<div[^>]+class="screen"[^>]+data-path=["']([^"']+)["'][^>]*>/gi;
  const detailImages = [];
  let m;
  while ((m = screenPattern.exec(html)) !== null) {
    const resolved = resolveUrl(m[1], baseUrl);
    if (resolved && resolved !== thumbnail) detailImages.push(resolved);
  }

  // ── 3. data-path 없는 경우 background-image: url(...) 에서 /screens/ 경로 수집
  if (detailImages.length === 0) {
    const bgPattern = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
    while ((m = bgPattern.exec(html)) !== null) {
      if (!/\/screens\//i.test(m[1])) continue; // /screens/ 경로만 허용
      const resolved = resolveUrl(m[1], baseUrl);
      if (resolved && resolved !== thumbnail) detailImages.push(resolved);
    }
  }

  return {
    thumbnail: thumbnail || null,
    detail: [...new Set(detailImages)].slice(0, 20),
  };
}

/** 채널 통계 수치 추출 (구독자, 조회수 등) */
function extractStats(html) {
  const stats = { subscribers: null, views: null, income: null, expense: null };

  // Next.js __NEXT_DATA__에서 먼저 탐색
  const nextData = extractNextData(html);
  if (nextData) {
    const sub = deepFind(nextData, ['subscribers', 'subscriberCount', 'subscriber_count', 'subs']);
    if (sub != null) stats.subscribers = parseKoreanNumber(String(sub));
    const views = deepFind(nextData, ['views', 'viewCount', 'view_count', 'totalViews']);
    if (views != null) stats.views = parseKoreanNumber(String(views));
    const income = deepFind(nextData, ['income', 'monthlyIncome', 'monthly_income', 'revenue']);
    if (income != null) stats.income = parseKoreanNumber(String(income));
    const expense = deepFind(nextData, ['expense', 'monthlyExpense', 'monthly_expense', 'cost']);
    if (expense != null) stats.expense = parseKoreanNumber(String(expense));
  }

  // HTML에서 숫자 패턴 탐색 (딜바론 구체 패턴)
  const numberPatterns = [
    // "구독자 12,345명" 패턴
    { key: 'subscribers', regex: /구독자\s*[:：]?\s*([\d,.]+\s*(?:만|K|k)?)/i },
    // "조회수 1,234,567" 패턴
    { key: 'views', regex: /(?:총\s*)?조회\s*수\s*[:：]?\s*([\d,.]+\s*(?:만|K|k)?)/i },
    // "월 수입 $123" 패턴
    { key: 'income', regex: /월\s*(?:평균\s*)?수\s*입\s*[:：]?\s*\$?([\d,.]+)/i },
    // "월 지출 $123" 패턴
    { key: 'expense', regex: /월\s*(?:평균\s*)?지\s*출\s*[:：]?\s*\$?([\d,.]+)/i },
  ];

  for (const { key, regex } of numberPatterns) {
    if (stats[key] == null) {
      const m = html.match(regex);
      if (m) stats[key] = parseKoreanNumber(m[1]);
    }
  }

  return stats;
}

/** Next.js __NEXT_DATA__ 스크립트 블록 파싱 */
function extractNextData(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** 중첩 객체에서 키로 값 탐색 */
function deepFind(obj, keys, depth = 0) {
  if (depth > 8 || obj == null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const v = deepFind(item, keys, depth + 1);
      if (v != null) return v;
    }
    return null;
  }
  for (const key of keys) {
    if (key in obj && obj[key] != null && obj[key] !== '') return obj[key];
  }
  for (const val of Object.values(obj)) {
    const found = deepFind(val, keys, depth + 1);
    if (found != null) return found;
  }
  return null;
}

/** 중첩 객체에서 키로 모든 값 수집 */
function deepFindAll(obj, keys, depth = 0, results = []) {
  if (depth > 6 || obj == null || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    for (const item of obj) deepFindAll(item, keys, depth + 1, results);
    return results;
  }
  for (const key of keys) {
    if (key in obj) {
      const v = obj[key];
      if (typeof v === 'string') results.push(v);
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') results.push(item);
          else if (typeof item === 'object' && item?.url) results.push(item.url);
          else if (typeof item === 'object' && item?.src) results.push(item.src);
        }
      }
    }
  }
  for (const val of Object.values(obj)) {
    deepFindAll(val, keys, depth + 1, results);
  }
  return results;
}

// ─── 이미지 처리 (다운로드 → Supabase Storage 업로드) ───────────────────────

/** 이미지를 다운로드하고 Supabase Storage에 업로드하거나 base64로 반환 */
async function processImage(imageUrl, supabaseUrl, serviceKey) {
  if (!imageUrl) return null;
  try {
    const imgRes = await fetch(imageUrl, {
      headers: {
        ...FETCH_HEADERS,
        Referer: 'https://dealbaron.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await imgRes.arrayBuffer();
    if (buffer.byteLength < 1024) return null; // 너무 작은 파일 스킵 (1KB 미만)

    // Supabase Storage 업로드 시도
    if (supabaseUrl && serviceKey) {
      const ext = contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
        ? 'gif'
        : 'jpg';
      const filename = `dealbaron/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

      try {
        const uploadRes = await fetch(
          `${supabaseUrl}/storage/v1/object/channel-images/${filename}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': contentType,
              'x-upsert': 'true',
            },
            body: buffer,
            signal: AbortSignal.timeout(15000),
          }
        );
        if (uploadRes.ok) {
          return `${supabaseUrl}/storage/v1/object/public/channel-images/${filename}`;
        }
        console.warn('Supabase Storage 업로드 실패:', await uploadRes.text().catch(() => ''));
      } catch (e) {
        console.warn('Supabase Storage 업로드 에러:', e.message);
      }
    }

    // Fallback: base64 반환
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.warn('이미지 처리 실패:', imageUrl, e.message);
    return null;
  }
}

// ─── 핸들러 ─────────────────────────────────────────────────────────────────

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

  // URL 유효성 검사 — dealbaron.com 도메인만 허용
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: '올바른 URL 형식이 아닙니다.' }),
    };
  }

  if (!parsedUrl.hostname.includes('dealbaron')) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ status: 'error', message: '딜바론(dealbaron.com) URL만 지원합니다.' }),
    };
  }

  // 페이지 HTML 가져오기
  let html;
  try {
    const pageRes = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({
          status: 'error',
          message: `딜바론 페이지를 불러오지 못했습니다. (HTTP ${pageRes.status})`,
        }),
      };
    }
    html = await pageRes.text();
  } catch (e) {
    return {
      statusCode: 502,
      headers: HEADERS,
      body: JSON.stringify({
        status: 'error',
        message: `딜바론 페이지 요청 실패: ${e.message}`,
      }),
    };
  }

  // 환경변수 (Supabase Storage 업로드용)
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // 데이터 추출
  const title = extractTitle(html);
  const description = extractDescription(html);
  const stats = extractStats(html);
  const { thumbnail: rawThumb, detail: rawDetailImgs } = extractImages(html, url);

  // 이미지 처리 (다운로드 + Supabase Storage 업로드)
  const [thumbnailUrl, ...processedDetails] = await Promise.all([
    rawThumb ? processImage(rawThumb, supabaseUrl, serviceKey) : Promise.resolve(null),
    ...rawDetailImgs.slice(0, 10).map(imgUrl => processImage(imgUrl, supabaseUrl, serviceKey)),
  ]);

  const images = processedDetails.filter(Boolean);

  const usingStorage = Boolean(supabaseUrl && serviceKey);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      status: 'ok',
      title: title || null,
      description: description || null,
      thumbnail: thumbnailUrl || null,
      images,
      subscribers: stats.subscribers,
      views: stats.views,
      income: stats.income,
      expense: stats.expense,
      storageUsed: usingStorage,
      message: usingStorage
        ? 'Supabase Storage에 이미지를 저장했습니다.'
        : 'SUPABASE_SERVICE_ROLE_KEY 미설정: 이미지를 base64로 반환합니다.',
    }),
  };
};
