// Fetches article list from Naver's f-e web API (same page numbering as browser)
// and article content/comments via the same API.
// This gives correct page numbering — unlike the relay's Mobile API.

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
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('<!')) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) };
  }

  const {
    cafeId,
    menuId = '',
    startPage = 1,
    maxArticles = 15,
    maxComments = 0,
    fetchComments = false,
    naverCookie,
  } = body;

  if (!cafeId) {
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };
  }

  const cookie = naverCookie || process.env.NAVER_COOKIE || '';
  const effectiveMenuId = (menuId || '').trim() || '0';
  const page = Math.max(1, parseInt(startPage) || 1);

  const listHeaders = {
    Cookie: cookie,
    'User-Agent': CHROME_UA,
    Referer: `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${effectiveMenuId}?page=${page}`,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
  };

  // ── Step 1: Fetch article list (correct page numbering — same as browser) ──
  const listUrl =
    `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/menus/${effectiveMenuId}/articles` +
    `?page=${page}&perPage=15`;

  const listData = await safeFetchJson(listUrl, listHeaders, 12000);

  if (!listData) {
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({
        status: 'error',
        message:
          '글 목록 조회 실패 — 네이버 쿠키를 확인하세요 (NID_AUT, NID_SES 값을 직접 입력하세요)',
      }),
    };
  }

  const result = listData.result || listData;
  const articleList = result.articleList || result.articles || [];
  const nextPage = articleList.length >= 15 ? page + 1 : null;

  if (articleList.length === 0) {
    return {
      statusCode: 200,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'ok', articles: [], nextPage: null }),
    };
  }

  const limit = Math.min(articleList.length, Math.max(1, parseInt(maxArticles) || 15));
  const slice = articleList.slice(0, limit);
  const commentLimit = Math.max(0, parseInt(maxComments) || 0);

  // ── Step 2: Fetch content + comments for each article (parallel) ──
  const fetchArticle = async (item) => {
    const articleId = item.articleId || item.id;

    const contentHeaders = {
      Cookie: cookie,
      'User-Agent': CHROME_UA,
      Referer: `https://cafe.naver.com/f-e/cafes/${cafeId}/articles/${articleId}`,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    };

    let content = '';
    let comments = [];

    // Article content
    const contentUrl = `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/articles/${articleId}`;
    const contentData = await safeFetchJson(contentUrl, contentHeaders, 8000);
    if (contentData) {
      const art =
        contentData.result?.article ||
        contentData.article ||
        {};
      const rawHtml = art.contentHtml || art.content || art.htmlContent || '';
      content = stripHtml(rawHtml);
    }

    // Comments
    if (fetchComments && commentLimit > 0) {
      const commentsUrl =
        `https://cafe.naver.com/ca-fe/web-api/v1/cafes/${cafeId}/articles/${articleId}/comments/pages/1` +
        `?perPage=${commentLimit}`;
      const commentsData = await safeFetchJson(commentsUrl, contentHeaders, 6000);
      if (commentsData) {
        const cResult = commentsData.result || commentsData;
        const commentList = cResult.commentList || cResult.comments || [];
        comments = commentList.slice(0, commentLimit).map((c) => ({
          content: c.content || c.text || '',
          writer: c.writeNickname || c.writerId || '',
          date: (c.writeDatetime || c.date || '').replace(/\.$/, ''),
        }));
      }
    }

    const rawDate = (item.writeDatetime || item.date || '').replace(/\.$/, '');

    return {
      articleId,
      title: item.subject || item.title || '',
      writer: item.writeNickname || item.writerId || item.writer || '',
      date: rawDate,
      commentCount: item.commentCount || 0,
      readCount: item.readCount || 0,
      url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`,
      content,
      comments,
    };
  };

  const articles = await Promise.all(slice.map(fetchArticle));

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ status: 'ok', articles, nextPage }),
  };
};
