// Netlify Serverless Function: scrape-naver-cafe.js
// 네이버 카페 게시글 목록을 수집합니다.

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

const NAVER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://cafe.naver.com/',
  'X-Requested-With': 'XMLHttpRequest',
};

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  // "2025.06.01" 형식 또는 ISO 형식
  const m = dateStr.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
}

function formatDate(dateObj) {
  if (!dateObj) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

async function fetchArticleList(cafeId, menuId, page, perPage) {
  // 네이버 카페 게시글 목록 API
  let url;
  if (menuId) {
    url = `https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json?cafeId=${cafeId}&menuId=${menuId}&page=${page}&perPage=${perPage}&requestFrom=A`;
  } else {
    url = `https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json?cafeId=${cafeId}&page=${page}&perPage=${perPage}&requestFrom=A`;
  }

  const res = await fetch(url, {
    headers: NAVER_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`네이버 API 응답 오류: HTTP ${res.status}`);

  const json = await res.json();
  return json;
}

async function fetchArticleComments(cafeId, articleId, maxComments) {
  if (!maxComments || maxComments <= 0) return [];
  try {
    const url = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}/comments?page=1&perPage=${maxComments}`;
    const res = await fetch(url, {
      headers: NAVER_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.result?.items || json?.message?.result?.items || [];
    return items.slice(0, maxComments).map(c => ({
      content: decodeHtmlEntities(c.content || c.text || ''),
      writer: c.writer?.nick || c.nick || '',
      date: c.writeDate || c.date || '',
    }));
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ status: 'error', message: 'POST만 지원합니다.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) }; }

  const {
    cafeId,
    menuId = '',
    startPage = 1,
    startDate,
    endDate,
    maxArticles = 10,
    maxComments = 0,
    fetchComments = false,
  } = body;

  if (!cafeId) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId가 필요합니다.' }) };
  }

  const startDateObj = startDate ? parseDateStr(startDate) : null;
  const endDateObj   = endDate   ? parseDateStr(endDate)   : null;

  const articles = [];
  let page = parseInt(startPage) || 1;
  let reachedStart = false;
  let totalFetched = 0;
  const perPage = 50;
  const MAX_PAGES = 20;
  let pagesScanned = 0;

  try {
    while (articles.length < maxArticles && pagesScanned < MAX_PAGES) {
      const data = await fetchArticleList(cafeId, menuId, page, perPage);

      // 다양한 API 응답 구조 처리
      const result = data?.message?.result || data?.result || data;
      const articleList = result?.articleList || result?.articles || result?.items || [];

      if (!articleList || articleList.length === 0) break;

      for (const item of articleList) {
        if (articles.length >= maxArticles) break;

        const writeDateStr = item.writeDate || item.lastUpdateDate || item.date || '';
        const writeDateObj = parseDateStr(writeDateStr) || (writeDateStr ? new Date(writeDateStr) : null);

        // 종료일 이후 글 → 건너뜀
        if (endDateObj && writeDateObj && writeDateObj > endDateObj) continue;

        // 시작일 이전 글 → 더 이상 없음
        if (startDateObj && writeDateObj && writeDateObj < startDateObj) {
          reachedStart = true;
          break;
        }

        const articleId = item.articleId || item.id;
        const title = decodeHtmlEntities(item.subject || item.title || '');
        const writer = item.writerInfo?.nick || item.writer || item.nick || '';
        const commentCount = parseInt(item.commentCount || item.replyCount || 0);
        const readCount = parseInt(item.readCount || 0);

        let comments = [];
        if (fetchComments && maxComments > 0 && articleId && commentCount > 0) {
          comments = await fetchArticleComments(cafeId, articleId, maxComments);
        }

        articles.push({
          no: articles.length + 1,
          articleId,
          title,
          writer,
          date: writeDateObj ? formatDate(writeDateObj) : writeDateStr,
          commentCount,
          readCount,
          url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`,
          comments,
        });

        totalFetched++;
      }

      if (reachedStart) break;

      const totalPage = result?.totalPage || result?.pageInfo?.totalPage || 0;
      if (totalPage && page >= totalPage) break;

      page++;
      pagesScanned++;

      // 요청 간격 (100ms)
      await new Promise(r => setTimeout(r, 100));
    }
  } catch (e) {
    if (articles.length === 0) {
      return {
        statusCode: 502,
        headers: HEADERS,
        body: JSON.stringify({ status: 'error', message: e.message }),
      };
    }
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      status: 'ok',
      articles,
      nextPage: page,
      totalCollected: articles.length,
    }),
  };
};
