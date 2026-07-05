// Two-strategy article fetcher:
//
// Strategy A (preferred): Naver f-e web API → same page numbering as browser.
//   Works when a valid naverCookie is supplied AND Naver's API is reachable.
//
// Strategy B (fallback): Relay server (Mobile API) with page-1 offset.
//   The relay's Mobile API page numbering is consistently 1 page BEHIND the
//   browser's f-e API.  Example: relay page 994 == browser page 995.
//   So we call relay with (startPage - 1) and return nextPage as (relay.nextPage + 1)
//   so that subsequent calls remain consistent in browser-page space.

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function safeFetchJson(url, headers, timeoutMs) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    const t = text.trim();
    if (t.startsWith('<') || t.startsWith('<!')) return null; // HTML → not authenticated
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ── Strategy A: Naver f-e web API ──────────────────────────────────────────
async function tryDirectApi(cafeId, effectiveMenuId, page, cookie, maxArticles, maxComments, fetchComments) {
  const listHeaders = {
    Cookie: cookie,
    'User-Agent': CHROME_UA,
    Referer: `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${effectiveMenuId}?page=${page}`,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'x-cafe-product-from': 'cafe',
  };

  const listUrl =
    `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/menus/${effectiveMenuId}/articles` +
    `?page=${page}&perPage=15`;

  const listData = await safeFetchJson(listUrl, listHeaders, 12000);
  if (!listData) return null; // API returned HTML → no auth; caller falls back to relay

  const result = listData.result || listData;
  const articleList = result.articleList || result.articles || [];
  if (articleList.length === 0) return { status: 'ok', articles: [], nextPage: null };

  const nextPage = articleList.length >= 15 ? page + 1 : null;
  const commentLimit = Math.max(0, parseInt(maxComments) || 0);
  const limit = Math.min(articleList.length, Math.max(1, parseInt(maxArticles) || 15));
  const slice = articleList.slice(0, limit);

  const fetchArticle = async (item) => {
    const articleId = item.articleId || item.id;
    const contentHeaders = {
      Cookie: cookie,
      'User-Agent': CHROME_UA,
      Referer: `https://cafe.naver.com/f-e/cafes/${cafeId}/articles/${articleId}`,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'x-cafe-product-from': 'cafe',
    };

    let content = '';
    let comments = [];

    const contentData = await safeFetchJson(
      `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/articles/${articleId}`,
      contentHeaders,
      8000,
    );
    if (contentData) {
      const art = contentData.result?.article || contentData.article || {};
      content = stripHtml(art.contentHtml || art.content || art.htmlContent || '');
    }

    if (fetchComments && commentLimit > 0) {
      const commentsData = await safeFetchJson(
        `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/articles/${articleId}/comments/pages/1?perPage=${commentLimit}`,
        contentHeaders,
        6000,
      );
      if (commentsData) {
        const cResult = commentsData.result || commentsData;
        comments = (cResult.commentList || cResult.comments || [])
          .slice(0, commentLimit)
          .map((c) => ({
            content: c.content || c.text || '',
            writer: c.writeNickname || c.writerId || '',
            date: (c.writeDatetime || c.date || '').replace(/\.$/, ''),
          }));
      }
    }

    return {
      articleId,
      title: item.subject || item.title || '',
      writer: item.writeNickname || item.writerId || item.writer || '',
      date: (item.writeDatetime || item.date || '').replace(/\.$/, ''),
      commentCount: item.commentCount || 0,
      readCount: item.readCount || 0,
      url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`,
      content,
      comments,
    };
  };

  const articles = await Promise.all(slice.map(fetchArticle));
  return { status: 'ok', articles, nextPage };
}

// ── Strategy B: Relay (Mobile API) with page-1 offset ─────────────────────
// Relay's Mobile API page N == browser f-e page N+1, so:
//   relay_call = browser_page - 1
//   browser_nextPage = relay.nextPage + 1
async function tryRelayWithOffset(cafeId, menuId, browserPage, cookie, maxArticles, maxComments, fetchComments) {
  const relayPage = Math.max(1, browserPage - 1);

  let relayRes;
  try {
    relayRes = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeId,
        menuId: (menuId || '').trim(),
        startPage: relayPage,
        startDate: '2000.01.01',
        maxArticles: Math.min(15, parseInt(maxArticles) || 15),
        maxComments: parseInt(maxComments) || 0,
        fetchComments: fetchComments && parseInt(maxComments) > 0,
        naverCookie: cookie || undefined,
      }),
      signal: AbortSignal.timeout(24000),
    });
  } catch (e) {
    throw new Error(`릴레이 연결 실패: ${e.message}`);
  }

  let relayData;
  try { relayData = await relayRes.json(); } catch { throw new Error('릴레이 응답 파싱 오류'); }
  if (relayData.status !== 'ok') throw new Error(relayData.message || '릴레이 수집 실패');

  // Convert relay page space → browser page space for nextPage
  const rNext = relayData.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + 1 : null;

  return { ...relayData, nextPage: browserNextPage };
}

// ── Main handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) };
  }

  const { cafeId, menuId = '', startPage = 1, maxArticles = 15, maxComments = 0, fetchComments = false, naverCookie } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  const cookie = naverCookie || process.env.NAVER_COOKIE || '';
  const effectiveMenuId = (menuId || '').trim() || '0';
  const page = Math.max(1, parseInt(startPage) || 1);

  // Try Strategy A first (only when cookie is present, so we don't waste time without auth)
  if (cookie) {
    try {
      const directResult = await tryDirectApi(cafeId, effectiveMenuId, page, cookie, maxArticles, maxComments, fetchComments);
      if (directResult) {
        return { statusCode: 200, headers: RESP_HEADERS, body: JSON.stringify(directResult) };
      }
      // null → API returned HTML, fall through to Strategy B
    } catch {
      // Unexpected error → fall through to Strategy B
    }
  }

  // Strategy B: relay with page-1 offset
  try {
    const relayResult = await tryRelayWithOffset(cafeId, menuId, page, cookie, maxArticles, maxComments, fetchComments);
    return { statusCode: 200, headers: RESP_HEADERS, body: JSON.stringify(relayResult) };
  } catch (e) {
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: e.message || '수집 실패' }),
    };
  }
};
