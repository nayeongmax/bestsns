// Netlify Serverless Function: scrape-naver-cafe.js
// 네이버 카페 게시글 목록을 수집합니다.
// 방법 1: PC 웹 HTML 파싱 (articleList 페이지)
// 방법 2: 모바일 HTML 파싱 (m.cafe.naver.com)
// 방법 3: __NEXT_DATA__ JSON 파싱

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function makeNaverHeaders(cookie, mobile = false) {
  const ua = mobile
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://cafe.naver.com/',
    ...(cookie ? { Cookie: buildCookieStr(cookie) } : {}),
  };
}

function buildCookieStr(cookie) {
  if (!cookie) return '';
  // 이미 "키=값; 키=값" 형태인지 확인
  if (cookie.includes('=')) return cookie;
  return `NID_AUT=${cookie}`;
}

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .trim();
}

function parseDateStr(s) {
  if (!s) return null;
  // YYYY.MM.DD 또는 YYYY-MM-DD 또는 "06.19" (올해) 또는 "2025.06.19"
  let m = s.match(/^(\d{4})[.\-](\d{2})[.\-](\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
  // MM.DD → 올해로 간주
  m = s.match(/^(\d{2})\.(\d{2})$/);
  if (m) {
    const y = new Date().getFullYear();
    return new Date(`${y}-${m[1]}-${m[2]}T00:00:00+09:00`);
  }
  // "3일 전", "1시간 전" 등 상대 시간 → 현재로 간주
  if (/전$/.test(s)) return new Date();
  return null;
}

function fmtDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function todayKST() {
  return fmtDate(new Date());
}

// ── HTML 파싱: PC 카페 게시글 목록 ────────────────────────────────────────────
function parseArticleListHtml(html, cafeId) {
  const articles = [];

  // __NEXT_DATA__ 시도
  const nextMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const nd = JSON.parse(nextMatch[1]);
      const list = deepFind(nd, ['articleList', 'articles', 'items']);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          const articleId = item.articleId || item.id || item.article_id;
          const title = decodeHtml(item.subject || item.title || '');
          const writer = item.writerInfo?.nick || item.writer?.nick || item.nick || item.author || '';
          const dateStr = item.writeDate || item.writeDateText || item.date || '';
          const commentCount = parseInt(item.commentCount || item.replyCount || 0);
          const readCount = parseInt(item.readCount || item.viewCount || 0);
          if (articleId && title) {
            articles.push({ articleId, title, writer, dateStr, commentCount, readCount });
          }
        }
        if (articles.length > 0) return articles;
      }
    } catch {}
  }

  // PC HTML 파싱 — article-board-list 구조
  // 패턴: <tr class="..."><td class="..."><a href="/.../{id}" ...>{title}</a>...
  const rowPattern = /<tr[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowPattern.exec(html)) !== null) {
    const row = m[1];
    // 제목 링크
    const linkM = row.match(/href="[^"]*?\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const articleId = linkM[1];
    const title = decodeHtml(linkM[2].replace(/<[^>]+>/g, '').trim());
    if (!title) continue;

    // 작성자
    const writerM = row.match(/class="[^"]*writer[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i);
    const writer = writerM ? decodeHtml(writerM[1].replace(/<[^>]+>/g, '').trim()) : '';

    // 날짜
    const dateM = row.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i);
    const dateStr = dateM ? decodeHtml(dateM[1].replace(/<[^>]+>/g, '').trim()) : '';

    // 댓글수
    const cmtM = row.match(/\[(\d+)\]|\bclass="[^"]*comment[^"]*"[^>]*>(\d+)/i);
    const commentCount = cmtM ? parseInt(cmtM[1] || cmtM[2] || 0) : 0;

    articles.push({ articleId, title, writer, dateStr, commentCount, readCount: 0 });
  }

  // 링크 패턴 폴백 — 카페 글 URL에서 articleId 추출
  if (articles.length === 0) {
    const linkPat = /href="(?:https:\/\/cafe\.naver\.com)?\/[^/"]+\/(\d{4,})[^"]*"[^>]*>\s*(?:<[^>]+>)*\s*([^<]{2,100})/gi;
    const seen = new Set();
    while ((m = linkPat.exec(html)) !== null) {
      const articleId = m[1];
      if (seen.has(articleId)) continue;
      seen.add(articleId);
      const title = decodeHtml(m[2].trim());
      if (title.length < 2 || /^[\d\s]+$/.test(title)) continue;
      articles.push({ articleId, title, writer: '', dateStr: '', commentCount: 0, readCount: 0 });
    }
  }

  return articles;
}

// 모바일 HTML 파싱
function parseMobileHtml(html, cafeId) {
  const articles = [];
  // <li class="ArticleListItem..."> 또는 <a href="...articleId...">
  const itemPat = /<(?:li|div)[^>]+class="[^"]*(?:ArticleList|article-item|post-item)[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  let m;
  while ((m = itemPat.exec(html)) !== null) {
    const block = m[1];
    const idM = block.match(/\/(\d{4,})/);
    const titleM = block.match(/class="[^"]*(?:title|subject)[^"]*"[^>]*>([\s\S]*?)<\//i);
    if (!idM || !titleM) continue;
    const articleId = idM[1];
    const title = decodeHtml(titleM[1].replace(/<[^>]+>/g, '').trim());
    const dateM = block.match(/class="[^"]*(?:date|time)[^"]*"[^>]*>([\s\S]*?)<\//i);
    const dateStr = dateM ? decodeHtml(dateM[1].replace(/<[^>]+>/g, '').trim()) : '';
    const cmtM = block.match(/\[(\d+)\]/);
    const commentCount = cmtM ? parseInt(cmtM[1]) : 0;
    articles.push({ articleId, title, writer: '', dateStr, commentCount, readCount: 0 });
  }
  return articles;
}

function deepFind(obj, keys, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) { const v = deepFind(item, keys, depth+1); if (v != null) return v; }
    return null;
  }
  for (const k of keys) { if (k in obj && obj[k] != null) return obj[k]; }
  for (const val of Object.values(obj)) { const v = deepFind(val, keys, depth+1); if (v != null) return v; }
  return null;
}

// ── 페이지 HTML 가져오기 ─────────────────────────────────────────────────────
async function fetchHtml(url, cookie, mobile = false) {
  const res = await fetch(url, {
    headers: makeNaverHeaders(cookie, mobile),
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return await res.text();
}

// ── 카페 slug 조회 (cafeId → URL slug) ─────────────────────────────────────
async function getCafeSlug(cafeId, cookie) {
  try {
    const html = await fetchHtml(`https://cafe.naver.com/CafeExplore.nhn?clubid=${cafeId}`, cookie);
    const m = html.match(/cafe\.naver\.com\/([a-zA-Z0-9_\-]+)/);
    return m ? m[1] : null;
  } catch { return null; }
}

// ── 메인 핸들러 ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST만 지원합니다.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) }; }

  const {
    cafeId,
    cafeUrl = '',
    menuId = '',
    startPage = 1,
    startDate,
    endDate,
    maxArticles = 10,
    maxComments = 0,
    naverCookie = '',
  } = body;

  if (!cafeId && !cafeUrl) {
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId가 필요합니다.' }) };
  }

  const startDateObj = startDate ? parseDateStr(startDate) : null;
  const endDateObj   = endDate   ? parseDateStr(endDate)   : null;

  const articles = [];
  let page = parseInt(startPage) || 1;
  const MAX_PAGES = 20;
  let pagesScanned = 0;
  let lastError = '';

  // 카페 URL slug 파악 (HTML URL 빌드용)
  let slug = '';
  if (cafeUrl) {
    const m = cafeUrl.match(/cafe\.naver\.com\/([a-zA-Z0-9_\-]+)/);
    if (m) slug = m[1];
  }

  while (articles.length < maxArticles && pagesScanned < MAX_PAGES) {
    let rawItems = [];

    // ── 방법 1: PC HTML 파싱 (/ArticleList.nhn)
    try {
      const listUrl = menuId
        ? `https://cafe.naver.com/ArticleList.nhn?search.clubid=${cafeId}&search.boardType=L&search.menuid=${menuId}&userDisplay=50&search.page=${page}`
        : `https://cafe.naver.com/ArticleList.nhn?search.clubid=${cafeId}&search.boardType=L&userDisplay=50&search.page=${page}`;
      const html = await fetchHtml(listUrl, naverCookie, false);

      // 로그인 페이지로 리다이렉트 된 경우
      if (html.includes('nidlogin.login') || html.includes('로그인이 필요')) {
        lastError = '이 카페는 로그인이 필요합니다. 네이버 로그인 후 세션쿠키를 입력해주세요.';
        break;
      }

      rawItems = parseArticleListHtml(html, cafeId);
    } catch (e) { lastError = e.message; }

    // ── 방법 2: 모바일 HTML 파싱
    if (rawItems.length === 0 && slug) {
      try {
        const mUrl = menuId
          ? `https://m.cafe.naver.com/${slug}?boardType=L&menuId=${menuId}&page=${page}`
          : `https://m.cafe.naver.com/${slug}?boardType=L&page=${page}`;
        const html = await fetchHtml(mUrl, naverCookie, true);
        rawItems = parseMobileHtml(html, cafeId);
      } catch (e) { lastError = e.message; }
    }

    // 방법 3: 슬러그 기반 PC URL
    if (rawItems.length === 0 && slug) {
      try {
        const url = menuId
          ? `https://cafe.naver.com/${slug}?iframe_url=/ArticleList.nhn%3Fsearch.menuid%3D${menuId}%26search.boardType%3DL%26search.page%3D${page}`
          : `https://cafe.naver.com/${slug}`;
        const html = await fetchHtml(url, naverCookie, false);
        rawItems = parseArticleListHtml(html, cafeId);
      } catch (e) { lastError = e.message; }
    }

    if (rawItems.length === 0) break;

    let reachedStart = false;
    for (const item of rawItems) {
      if (articles.length >= maxArticles) break;

      const dateObj = parseDateStr(item.dateStr);
      if (endDateObj && dateObj && dateObj > endDateObj) continue;
      if (startDateObj && dateObj && dateObj < startDateObj) { reachedStart = true; break; }

      articles.push({
        no: articles.length + 1,
        articleId: item.articleId,
        title: item.title,
        writer: item.writer,
        date: dateObj ? fmtDate(dateObj) : item.dateStr,
        commentCount: item.commentCount || 0,
        readCount: item.readCount || 0,
        url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${item.articleId}`,
        comments: [],
      });
    }

    if (reachedStart) break;
    page++;
    pagesScanned++;
    await new Promise(r => setTimeout(r, 150));
  }

  if (articles.length === 0 && lastError) {
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: lastError }),
    };
  }

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ status: 'ok', articles, nextPage: page, totalCollected: articles.length }),
  };
};
