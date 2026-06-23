// Netlify Serverless Function: scrape-naver-cafe.js
// 네이버 카페 REST API (cafe.naver.com/ca-fe) + 로그인 쿠키 인증 방식
// 쿠키 없이는 비공개 카페 불가. 공개 카페는 쿠키 없이 일부 수집 가능.

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function buildHeaders(cookie) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': 'https://cafe.naver.com/',
    'Origin': 'https://cafe.naver.com',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };
}

function decodeHtml(s) {
  if (!s) return '';
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
          .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).trim();
}

function parseDateStr(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
  m = s.match(/^(\d{2})\.(\d{2})$/);
  if (m) return new Date(`${new Date().getFullYear()}-${m[1]}-${m[2]}T00:00:00+09:00`);
  if (/전$/.test(s)) return new Date();
  try { const d = new Date(s); if (!isNaN(d)) return d; } catch {}
  return null;
}

function fmtDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function todayKST() { return fmtDate(new Date()); }

// ── 방법 1: cafe.naver.com REST API (가장 안정적) ──────────────────────────
async function tryRestApi(cafeId, menuId, page, perPage, cookie) {
  const url = menuId
    ? `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&perPage=${perPage}&orderBy=date&includeAllMenu=false`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles?page=${page}&perPage=${perPage}&orderBy=date&includeAllMenu=true`;

  const res = await fetch(url, { headers: buildHeaders(cookie), signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`REST API HTTP ${res.status}`);
  const json = await res.json();

  // 응답 구조: { message: { result: { articleList: [...] } } } 또는 { result: { ... } }
  const result = json?.message?.result ?? json?.result ?? json;
  const list = result?.articleList ?? result?.items ?? result?.articles ?? [];

  if (!Array.isArray(list)) throw new Error('articleList 없음');

  return list.map(item => ({
    articleId: item.articleId ?? item.id,
    title: decodeHtml(item.subject ?? item.title ?? ''),
    writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? item.author ?? '',
    dateStr: item.writeDateTimestamp
      ? fmtDate(new Date(item.writeDateTimestamp))
      : (item.writeDate ?? item.writeDateText ?? ''),
    commentCount: parseInt(item.commentCount ?? item.replyCount ?? 0),
    readCount: parseInt(item.readCount ?? item.viewCount ?? 0),
    totalPage: result?.totalPage ?? result?.pageInfo?.totalPage ?? 0,
  }));
}

// ── 방법 2: ArticleList.nhn iframe URL + __NEXT_DATA__ 파싱 ────────────────
async function tryIframeApi(cafeId, menuId, page, cookie) {
  const iframeUrl = encodeURIComponent(
    menuId
      ? `/ArticleList.nhn?search.menuid=${menuId}&search.boardType=L&userDisplay=50&search.page=${page}`
      : `/ArticleList.nhn?search.boardType=L&userDisplay=50&search.page=${page}`
  );
  const url = `https://cafe.naver.com/CafeExplore.nhn?clubid=${cafeId}&iframe_url=${iframeUrl}`;

  const res = await fetch(url, {
    headers: { ...buildHeaders(cookie), Accept: 'text/html,application/xhtml+xml,*/*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`iframe HTTP ${res.status}`);
  const html = await res.text();

  // __NEXT_DATA__ 파싱
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const nd = JSON.parse(m[1]);
      const list = deepFind(nd, ['articleList','articles','items']);
      if (Array.isArray(list) && list.length > 0) {
        return list.map(item => ({
          articleId: item.articleId ?? item.id,
          title: decodeHtml(item.subject ?? item.title ?? ''),
          writer: item.writerInfo?.nick ?? item.nick ?? '',
          dateStr: item.writeDate ?? item.writeDateText ?? '',
          commentCount: parseInt(item.commentCount ?? 0),
          readCount: parseInt(item.readCount ?? 0),
          totalPage: 0,
        }));
      }
    } catch {}
  }

  // HTML table 파싱 폴백
  const rows = [];
  const rowPat = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowPat.exec(html)) !== null) {
    const row = rm[1];
    const linkM = row.match(/articleid=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
                ?? row.match(/\/(\d{5,})[^"]*"[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const articleId = linkM[1];
    const title = decodeHtml(linkM[2].replace(/<[^>]+>/g, '').trim());
    if (!title || title.length < 2) continue;
    const dateM = row.match(/(\d{4}\.\d{2}\.\d{2}|\d{2}\.\d{2})/);
    rows.push({ articleId, title, writer: '', dateStr: dateM?.[1] ?? '', commentCount: 0, readCount: 0, totalPage: 0 });
  }
  if (rows.length) return rows;

  throw new Error('iframe 파싱 실패 — 로그인 필요 또는 비공개 카페');
}

function deepFind(obj, keys, depth=0) {
  if (depth>8||!obj||typeof obj!=='object') return null;
  if (Array.isArray(obj)) { for(const i of obj){const v=deepFind(i,keys,depth+1);if(v!=null)return v;} return null; }
  for(const k of keys){if(k in obj&&obj[k]!=null)return obj[k];}
  for(const v of Object.values(obj)){const r=deepFind(v,keys,depth+1);if(r!=null)return r;}
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST만 지원합니다.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) }; }

  const { cafeId, menuId='', startPage=1, startDate, endDate, maxArticles=10, naverCookie='' } = body;

  if (!cafeId) return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId가 필요합니다.' }) };

  const startDateObj = startDate ? parseDateStr(startDate) : null;
  const endDateObj   = endDate   ? parseDateStr(endDate)   : null;

  const articles = [];
  let page = parseInt(startPage) || 1;
  const MAX_PAGES = 30;
  let pagesScanned = 0;
  let lastError = '';
  let method = '';

  while (articles.length < maxArticles && pagesScanned < MAX_PAGES) {
    let rawItems = [];

    // REST API 시도
    try {
      rawItems = await tryRestApi(cafeId, menuId, page, 50, naverCookie);
      method = 'REST API';
    } catch (e) {
      lastError = e.message;
    }

    // iframe 시도
    if (rawItems.length === 0) {
      try {
        rawItems = await tryIframeApi(cafeId, menuId, page, naverCookie);
        method = 'iframe HTML';
      } catch (e) {
        lastError = e.message;
      }
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
    const totalPage = rawItems[0]?.totalPage || 0;
    if (totalPage && page >= totalPage) break;

    page++;
    pagesScanned++;
    await new Promise(r => setTimeout(r, 200));
  }

  if (articles.length === 0) {
    const isLoginError = /401|403|login|로그인/.test(lastError);
    return {
      statusCode: isLoginError ? 401 : 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({
        status: 'error',
        message: isLoginError
          ? '로그인이 필요합니다. 네이버에 로그인 후 NID_AUT와 NID_SES 쿠키를 입력해주세요.'
          : `수집 실패: ${lastError}`,
        hint: '쿠키 복사 방법: 네이버 카페 접속 → F12 → Application → Cookies → cafe.naver.com → NID_AUT, NID_SES 값 복사',
      }),
    };
  }

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ status: 'ok', articles, nextPage: page, totalCollected: articles.length, method }),
  };
};
