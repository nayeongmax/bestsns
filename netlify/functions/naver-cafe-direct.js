// 네이버 카페 글 수집
//
// 전략 (Python 크롤러와 동일 원리):
//   1단계: ca-fe REST API 직접 호출 → 정확한 페이지 번호, 빠름 (3~5s)
//   2단계: 글 목록만 가져온 뒤, 글마다 cafe-articleapi 직접 호출로 내용 수집
//   폴백: 직접 호출 실패(IP 차단 등)시 VPS 릴레이 사용

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function buildApiHeaders(cookie) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://cafe.naver.com/',
    'Origin': 'https://cafe.naver.com',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-cafe-product': 'pc',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };
}

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

function fmtDate(ts) {
  const d = new Date(typeof ts === 'number' && ts < 9999999999 ? ts * 1000 : ts);
  if (isNaN(d)) return '';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth()+1).padStart(2,'0')}.${String(kst.getUTCDate()).padStart(2,'0')}`;
}

// ── 1단계: ca-fe REST API로 글 목록 직접 조회 ────────────────────────────────
// Python의 driver.get(list_url)과 동일: 정확한 브라우저 페이지 번호 사용
async function fetchListDirect(cafeId, menuId, page, cookie) {
  const url = menuId
    ? `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&perPage=15&orderBy=date`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles?page=${page}&perPage=15&orderBy=date&includeAllMenu=true`;

  const res = await fetch(url, {
    headers: buildApiHeaders(cookie),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ca-fe API HTTP ${res.status}`);

  const text = await res.text();
  let j;
  try { j = JSON.parse(text); }
  catch { throw new Error('ca-fe API: JSON 파싱 실패'); }

  const result = j?.message?.result ?? j?.result ?? j;
  const list = result?.articleList ?? result?.items ?? result?.articles ?? [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('ca-fe API: 목록 없음');

  const totalPage = result?.totalPage ?? result?.pageInfo?.totalPage ?? 0;
  return {
    articles: list.map(item => {
      const id = item.articleId ?? item.id;
      const ts = item.writeDateTimestamp ?? item.addDate ?? null;
      const dateStr = ts ? fmtDate(ts) : (item.writeDate ?? item.writeDateText ?? '');
      return {
        articleId: id,
        title: (item.subject ?? item.title ?? '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'),
        writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? '',
        date: dateStr,
        commentCount: parseInt(item.commentCount ?? item.replyCount ?? 0),
        readCount: parseInt(item.readCount ?? item.viewCount ?? 0),
        url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${id}`,
        content: '',
        comments: [],
      };
    }),
    nextPage: page - 1 > 0 ? page - 1 : null,
    totalPage,
    _method: 'ca-fe 직접',
    status: 'ok',
  };
}

// ── 2단계: 글마다 내용 직접 조회 ─────────────────────────────────────────────
// Python의 get_post_content(driver, link)과 동일 원리
async function fetchContentDirect(cafeId, articleId, cookie, maxComments) {
  if (!articleId) return { content: '', comments: [] };

  // 방법 A: cafe-articleapi v2 (가장 상세)
  try {
    const res = await fetch(
      `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}`,
      {
        headers: { ...buildApiHeaders(cookie), 'sec-fetch-site': 'cross-site' },
        signal: AbortSignal.timeout(7000),
      },
    );
    if (res.ok) {
      const j = await res.json();
      const result = j?.result ?? j?.message?.result ?? j;
      const art = result?.article ?? result;
      const raw = art?.contentHtml ?? art?.content ?? art?.contentText ?? '';
      const content = stripHtml(raw);
      if (content) {
        const cItems = result?.comments?.items ?? result?.commentList ?? [];
        const comments = cItems.slice(0, maxComments).map(c => ({
          content: (c.content ?? c.text ?? '').trim(),
          writer: c.writer?.nick ?? c.nick ?? '',
          date: c.updateDate ?? c.writeDate ?? '',
        })).filter(c => c.content);
        return { content, comments };
      }
    }
  } catch { /* 무시 */ }

  // 방법 B: ca-fe 글 상세
  try {
    const res = await fetch(
      `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`,
      {
        headers: buildApiHeaders(cookie),
        signal: AbortSignal.timeout(7000),
      },
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

// ── 릴레이 폴백 (직접 호출 실패 시) ─────────────────────────────────────────
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
    _offset,
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
  const batchSize   = Math.min(15, parseInt(maxArticles) || 15);

  // ── 1단계: 글 목록 수집 ────────────────────────────────────────────────────
  let listResult = null;
  let usedDirect = false;

  // ca-fe API 직접 호출 (빠름, 정확한 페이지 번호)
  try {
    listResult = await fetchListDirect(cafeId, relayMenuId, browserPage, cookie);
    usedDirect = true;
  } catch (directErr) {
    // 직접 호출 실패 → 릴레이 폴백
    console.log(`직접 호출 실패: ${directErr.message} → 릴레이 사용`);
  }

  // 릴레이 폴백
  if (!listResult) {
    const relayParams = {
      cafeId,
      menuId: relayMenuId,
      startPage: relayPage,
      startDate: '2000.01.01',
      maxArticles: Math.min(5, batchSize),  // 릴레이: 최대 5개로 제한
      maxComments: Math.max(1, userMaxComments),
      fetchComments: true,
      naverCookie: cookie,
    };
    const relayData = await safeRelayFetch(relayParams, 22000);

    if (!relayData || relayData.status !== 'ok') {
      const msg = relayData?.message || '릴레이 서버 오류';
      return { statusCode: 502, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: msg }) };
    }

    // 릴레이 nextPage → 브라우저 페이지 공간으로 변환
    const rNext = relayData.nextPage;
    listResult = {
      ...relayData,
      nextPage: (rNext && typeof rNext === 'number') ? rNext + offset : null,
      _method: relayData.method || '릴레이',
      _relayPage: relayPage,
    };

    // 릴레이 응답 내용 필드 정규화
    for (const article of (listResult.articles || [])) {
      if (!article.content?.trim()) {
        const plain = article.body || article.text || article.articleContent || article.bodyText || article.contentText;
        const html  = article.contentHtml || article.bodyHtml;
        article.content = (plain?.trim()) || (html ? stripHtml(html) : '');
      }
    }
  }

  // ── 2단계: 내용이 없는 글 → 직접 내용 수집 ───────────────────────────────
  const articles = (listResult.articles || []).slice(0, batchSize);
  const emptyIdxs = articles.reduce((acc, a, i) => { if (!a.content?.trim()) acc.push(i); return acc; }, []);

  if (emptyIdxs.length > 0) {
    // 병렬 호출 (Python의 for each article: get_post_content와 동일)
    const results = await Promise.all(
      emptyIdxs.map(i => {
        const id = articles[i].articleId ?? articles[i].id;
        return fetchContentDirect(cafeId, id, cookie, userMaxComments)
          .catch(() => ({ content: '', comments: [] }));
      }),
    );
    emptyIdxs.forEach((artIdx, resIdx) => {
      const { content, comments } = results[resIdx];
      if (content) {
        articles[artIdx].content  = content;
        if (comments.length > 0 && (!articles[artIdx].comments || articles[artIdx].comments.length === 0)) {
          articles[artIdx].comments = comments;
        }
      }
    });
  }

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({
      status: 'ok',
      articles,
      nextPage: listResult.nextPage,
      totalPage: listResult.totalPage ?? 0,
      _method: listResult._method || '',
      _relayPage: listResult._relayPage ?? browserPage,
      _usedDirect: usedDirect,
    }),
  };
};
