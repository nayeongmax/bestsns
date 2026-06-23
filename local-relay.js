#!/usr/bin/env node
/**
 * 네이버 카페 로컬 릴레이 서버
 *
 * 사용법:
 *   node local-relay.js
 *
 * 포트: 3333 (변경: PORT=4000 node local-relay.js)
 *
 * 이 스크립트는 웹앱의 요청을 네이버 카페 API로 중계합니다.
 * Netlify 서버는 미국에 있어 네이버가 차단하지만,
 * 이 스크립트는 내 PC(한국 IP)에서 실행되므로 차단되지 않습니다.
 */

const http = require('http');
const https = require('https');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3333;

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function buildNaverHeaders(cookie) {
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

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      timeout: 15000,
    };
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function tryRestApi(cafeId, menuId, page, perPage, cookie) {
  const url = menuId
    ? `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&perPage=${perPage}&orderBy=date&includeAllMenu=false`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles?page=${page}&perPage=${perPage}&orderBy=date&includeAllMenu=true`;

  console.log(`[REST] ${url}`);
  const { status, body } = await httpsGet(url, buildNaverHeaders(cookie));
  console.log(`[REST] 응답 HTTP ${status}, 본문 앞 200자: ${body.slice(0,200)}`);
  if (status !== 200) throw new Error(`REST API HTTP ${status}`);
  const json = JSON.parse(body);

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

function deepFind(obj, keys, depth=0) {
  if (depth>8||!obj||typeof obj!=='object') return null;
  if (Array.isArray(obj)) { for(const i of obj){const v=deepFind(i,keys,depth+1);if(v!=null)return v;} return null; }
  for(const k of keys){if(k in obj&&obj[k]!=null)return obj[k];}
  for(const v of Object.values(obj)){const r=deepFind(v,keys,depth+1);if(r!=null)return r;}
  return null;
}

async function tryIframeApi(cafeId, menuId, page, cookie) {
  const iframeUrl = encodeURIComponent(
    menuId
      ? `/ArticleList.nhn?search.menuid=${menuId}&search.boardType=L&userDisplay=50&search.page=${page}`
      : `/ArticleList.nhn?search.boardType=L&userDisplay=50&search.page=${page}`
  );
  const url = `https://cafe.naver.com/CafeExplore.nhn?clubid=${cafeId}&iframe_url=${iframeUrl}`;

  console.log(`[iframe] ${url}`);
  const { status, body: html } = await httpsGet(url, {
    ...buildNaverHeaders(cookie),
    Accept: 'text/html,application/xhtml+xml,*/*',
  });
  console.log(`[iframe] 응답 HTTP ${status}, 본문 앞 200자: ${html.slice(0,200)}`);
  if (status !== 200) throw new Error(`iframe HTTP ${status}`);

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

async function handleScrape(body) {
  const { cafeId, menuId='', startPage=1, startDate, endDate, maxArticles=10, naverCookie='' } = body;
  if (!cafeId) return { statusCode: 400, body: { status: 'error', message: 'cafeId가 필요합니다.' } };

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

    try {
      rawItems = await tryRestApi(cafeId, menuId, page, 50, naverCookie);
      method = 'REST API';
    } catch (e) { lastError = e.message; }

    if (rawItems.length === 0) {
      try {
        rawItems = await tryIframeApi(cafeId, menuId, page, naverCookie);
        method = 'iframe HTML';
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
    const totalPage = rawItems[0]?.totalPage || 0;
    if (totalPage && page >= totalPage) break;
    page++;
    pagesScanned++;
    await new Promise(r => setTimeout(r, 300));
  }

  if (articles.length === 0) {
    const isLoginError = /401|403|login|로그인/.test(lastError);
    return {
      statusCode: isLoginError ? 401 : 502,
      body: {
        status: 'error',
        message: isLoginError
          ? '로그인이 필요합니다. NID_AUT와 NID_SES 쿠키를 입력해주세요.'
          : `수집 실패: ${lastError}`,
      },
    };
  }

  return {
    statusCode: 200,
    body: { status: 'ok', articles, nextPage: page, totalCollected: articles.length, method },
  };
}

const server = http.createServer((req, res) => {
  const sendJson = (code, obj) => {
    const json = JSON.stringify(obj);
    res.writeHead(code, RESP_HEADERS);
    res.end(json);
  };

  if (req.method === 'OPTIONS') { res.writeHead(200, RESP_HEADERS); res.end(); return; }

  if (req.url === '/ping') { sendJson(200, { ok: true }); return; }

  if (req.url !== '/scrape-naver-cafe' || req.method !== 'POST') {
    sendJson(404, { status: 'error', message: 'not found' }); return;
  }

  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', async () => {
    let body;
    try { body = JSON.parse(raw || '{}'); }
    catch { sendJson(400, { status: 'error', message: '요청 형식 오류' }); return; }

    try {
      const result = await handleScrape(body);
      sendJson(result.statusCode, result.body);
    } catch (e) {
      sendJson(500, { status: 'error', message: e.message });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ 네이버 카페 릴레이 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   웹앱에서 수집 시 이 창을 열어두세요.`);
  console.log(`   종료: Ctrl+C\n`);
});
