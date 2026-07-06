// 네이버 카페 글 수집 - 릴레이 + Naver API 직접 내용 보완
//
// 흐름:
//   1) 릴레이(VPS)에서 글 목록 + 기본 내용 수집 (타임아웃 18s)
//   2) 내용이 빈 글은 Naver cafe-articleapi v2 직접 호출로 보완 (6s 병렬)
//   3) 그래도 빈 글은 HTML 파싱 시도
//   이 방식은 Python 크롤러가 글마다 브라우저 방문해 내용 읽는 것과 같은 원리

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

// HTML 태그 제거 + 개행 정리
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

// 릴레이 응답에서 내용 추출 — 가능한 모든 필드명 시도
function extractContent(article) {
  // 평문 필드 우선
  const plain = article.content || article.body || article.text
    || article.articleContent || article.bodyText || article.contentText;
  if (plain && plain.trim()) return plain.trim();

  // HTML 필드 → 태그 제거
  const html = article.contentHtml || article.bodyHtml || article.htmlContent;
  if (html && html.trim()) return stripHtml(html);

  return '';
}

// Naver 글 상세 API 직접 호출 (Python의 get_post_content와 동일 목적)
async function fetchContentDirect(cafeId, articleId, cookie) {
  if (!articleId) return { content: '', comments: [] };

  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': 'https://cafe.naver.com/',
    'Origin': 'https://cafe.naver.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };

  // 방법 A: cafe-articleapi v2 (가장 상세한 응답)
  try {
    const res = await fetch(
      `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}`,
      { headers, signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const j = await res.json();
      const result = j?.result ?? j?.message?.result ?? j;
      const art = result?.article ?? result;
      const raw = art?.contentHtml ?? art?.content ?? art?.contentText ?? '';
      const content = stripHtml(raw);
      if (content) {
        const cItems = result?.comments?.items ?? result?.commentList ?? [];
        const comments = cItems.slice(0, 5).map(c => ({
          content: (c.content ?? c.text ?? '').trim(),
          writer: c.writer?.nick ?? c.nick ?? '',
          date: c.updateDate ?? c.writeDate ?? '',
        })).filter(c => c.content);
        return { content, comments };
      }
    }
  } catch { /* 무시 */ }

  // 방법 B: ca-fe REST API
  try {
    const res = await fetch(
      `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`,
      { headers: { ...headers, 'sec-fetch-site': 'same-origin' }, signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const text = await res.text();
      if (text.trim().startsWith('{')) {
        const j = JSON.parse(text);
        const result = j?.result ?? j?.message?.result ?? j;
        const art = result?.article ?? result;
        const raw = art?.contentHtml ?? art?.content ?? art?.contentText ?? '';
        const content = stripHtml(raw);
        if (content) return { content, comments: [] };
      }
    }
  } catch { /* 무시 */ }

  return { content: '', comments: [] };
}

async function safeRelayFetch(params, timeoutMs) {
  try {
    const res = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { status: 'error', message: `릴레이 비JSON 응답 (${res.status}): ${text.slice(0, 120)}` }; }
  } catch (e) {
    return { status: 'error', message: `릴레이 연결 실패: ${e.message}` };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) };
  }

  const {
    cafeId,
    menuId       = '',
    startPage    = 1,
    maxArticles  = 15,
    maxComments  = 0,
    naverCookie,
    _offset,           // 릴레이 페이지 보정값 (round(page/60) 공식)
  } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  const cookie      = process.env.NAVER_COOKIE || naverCookie || undefined;
  const rawMenuId   = (menuId || '').trim();
  const relayMenuId = rawMenuId === '0' ? '' : rawMenuId;
  const browserPage = Math.max(1, parseInt(startPage) || 1);
  const offset      = typeof _offset === 'number' ? _offset : 0;
  const relayPage   = Math.max(1, browserPage - offset);

  const userMaxComments = parseInt(maxComments) || 0;

  // 배치당 5개: 릴레이 글 상세 호출(3개 병렬 × 2배치) + 직접 API 보완 시간 확보
  const batchSize = Math.min(5, parseInt(maxArticles) || 5);

  const mainParams = {
    cafeId,
    menuId: relayMenuId,
    startPage: relayPage,
    startDate: '2000.01.01',
    maxArticles: batchSize,
    // maxComments ≥ 1: 릴레이가 글 상세 API 호출하여 본문도 함께 획득
    maxComments: Math.max(1, userMaxComments),
    fetchComments: true,
    naverCookie: cookie,
  };

  // 릴레이 호출 — 18초 타임아웃으로 직접 API 보완 시간 6초 확보
  const mainData = await safeRelayFetch(mainParams, 18000);

  if (!mainData || mainData.status !== 'ok') {
    const msg = mainData?.message || '릴레이 서버 오류';
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: msg }),
    };
  }

  // ── 내용 보완: 릴레이 응답 정규화 + 빈 글은 Naver API 직접 호출 ──────────────
  if (Array.isArray(mainData.articles) && mainData.articles.length > 0) {
    // 1단계: 릴레이 응답에서 내용 정규화 (여러 필드명 시도)
    for (const article of mainData.articles) {
      if (!article.content || !article.content.trim()) {
        article.content = extractContent(article);
      }
    }

    // 2단계: 아직 내용이 빈 글 → Naver API 직접 호출 (Python처럼 글마다 개별 접근)
    const emptyArticles = mainData.articles.filter(a => !a.content || !a.content.trim());
    if (emptyArticles.length > 0) {
      const results = await Promise.all(
        emptyArticles.map(article => {
          const id = article.articleId ?? article.id;
          return fetchContentDirect(cafeId, id, cookie)
            .catch(() => ({ content: '', comments: [] }));
        }),
      );
      emptyArticles.forEach((article, i) => {
        const { content, comments } = results[i];
        if (content) {
          article.content = content;
          // 댓글도 없으면 함께 보완
          if (comments.length > 0 && (!article.comments || article.comments.length === 0)) {
            article.comments = comments;
          }
        }
      });
    }
  }

  // relay.nextPage → 브라우저 페이지 공간으로 변환
  const rNext = mainData.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + offset : null;

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({
      ...mainData,
      nextPage: browserNextPage,
      _relayPage: relayPage,
      _method: mainData.method || '',
    }),
  };
};
