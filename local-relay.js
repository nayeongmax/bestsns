#!/usr/bin/env node
/**
 * 네이버 카페 로컬 릴레이 서버
 * 사용법: node local-relay.js
 * 포트: 3333
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3333;

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function buildNaverHeaders(cookie, referer) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer || 'https://cafe.naver.com/',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'upgrade-insecure-requests': '1',
    ...(cookie ? { 'Cookie': cookie } : {}),
  };
}

function buildApiHeaders(cookie, referer) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': referer || 'https://cafe.naver.com/',
    'Origin': 'https://cafe.naver.com',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-cafe-product': 'pc',
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

function httpsGet(url, headers, depth=0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) { reject(new Error('리다이렉트 너무 많음')); return; }
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { ...headers, 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: 15000,
    };
    const req = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : `https://${parsed.hostname}${loc}`;
        console.log(`  → 리다이렉트: ${next}`);
        res.resume();
        return httpsGet(next, headers, depth+1).then(resolve).catch(reject);
      }
      const enc = res.headers['content-encoding'] || '';
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const decompress = enc.includes('gzip') ? zlib.gunzipSync
          : enc.includes('deflate') ? zlib.inflateSync
          : enc.includes('br') ? zlib.brotliDecompressSync
          : null;
        try {
          const body = decompress ? decompress(buf).toString('utf8') : buf.toString('utf8');
          resolve({ status: res.statusCode, body });
        } catch(e) {
          // 압축 해제 실패 시 raw
          resolve({ status: res.statusCode, body: buf.toString('utf8') });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function deepFind(obj, keys, depth=0) {
  if (depth>8||!obj||typeof obj!=='object') return null;
  if (Array.isArray(obj)) { for(const i of obj){const v=deepFind(i,keys,depth+1);if(v!=null)return v;} return null; }
  for(const k of keys){if(k in obj&&obj[k]!=null)return obj[k];}
  for(const v of Object.values(obj)){const r=deepFind(v,keys,depth+1);if(r!=null)return r;}
  return null;
}

// ── 방법 1: ArticleList.nhn 직접 HTML 파싱 ──────────────────────────────────
async function tryArticleListHtml(cafeId, menuId, page, cookie) {
  const qs = new URLSearchParams({
    'search.clubid': cafeId,
    'search.boardType': 'L',
    'userDisplay': '50',
    'search.page': String(page),
  });
  if (menuId) qs.set('search.menuid', menuId);
  const url = `https://cafe.naver.com/ArticleList.nhn?${qs}`;

  console.log(`[ArticleList] ${url}`);
  const { status, body: html } = await httpsGet(url, buildNaverHeaders(cookie, `https://cafe.naver.com/`));
  console.log(`  → HTTP ${status}, 본문길이 ${html.length}, 앞50자: ${html.slice(0,50).replace(/\n/g,' ')}`);

  if (status !== 200) throw new Error(`ArticleList HTTP ${status}`);
  if (html.includes('서비스에 접속할 수 없습니다') || html.includes('로그인이 필요')) {
    throw new Error('로그인 필요 또는 서비스 접근 불가');
  }

  // __NEXT_DATA__ 시도
  const ndm = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ndm) {
    try {
      const nd = JSON.parse(ndm[1]);
      const list = deepFind(nd, ['articleList','articles','items']);
      if (Array.isArray(list) && list.length > 0) {
        console.log(`  → __NEXT_DATA__ 파싱 성공, ${list.length}개`);
        const totalPage = deepFind(nd, ['totalPage', 'pageCount']) || 0;
        return list.map(item => ({
          articleId: item.articleId ?? item.id,
          title: decodeHtml(item.subject ?? item.title ?? ''),
          writer: item.writerInfo?.nick ?? item.nick ?? '',
          dateStr: item.writeDate ?? item.writeDateText ?? '',
          commentCount: parseInt(item.commentCount ?? 0),
          readCount: parseInt(item.readCount ?? 0),
          totalPage,
        }));
      }
    } catch(e) { console.log(`  → __NEXT_DATA__ 파싱 실패: ${e.message}`); }
  }

  // HTML 테이블 파싱
  const rows = [];
  // 방법 A: articleid 파라미터
  const patA = /articleid=(\d+)[^"]*"[^>]*>\s*<\/a>\s*<a[^>]*>([\s\S]*?)<\/a>/gi;
  // 방법 B: 제목 링크에서 articleid 추출
  const patB = /href="[^"]*articleid=(\d+)[^"]*"[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  // 방법 C: 간단한 링크 패턴
  const patC = /<a[^>]+href="[^"]*articleid=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const seen = new Set();
  for (const pat of [patA, patB, patC]) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(html)) !== null) {
      const articleId = m[1];
      if (seen.has(articleId)) continue;
      const rawTitle = m[2].replace(/<[^>]+>/g, '').trim();
      const title = decodeHtml(rawTitle);
      if (!title || title.length < 2) continue;
      seen.add(articleId);

      // 주변에서 날짜 찾기
      const context = html.slice(Math.max(0, m.index - 500), m.index + 500);
      const dateM = context.match(/(\d{4}\.\d{2}\.\d{2})/);
      const dateM2 = context.match(/(\d{2}\.\d{2})/);
      const dateStr = dateM?.[1] ?? dateM2?.[1] ?? '';

      // 댓글 수 패턴
      const cmtM = context.match(/commentCount['":\s]+(\d+)/i) ?? context.match(/\[(\d+)\]/);
      rows.push({
        articleId,
        title,
        writer: '',
        dateStr,
        commentCount: cmtM ? parseInt(cmtM[1]) : 0,
        readCount: 0,
        totalPage: 0,
      });
    }
    if (rows.length > 0) break;
  }

  if (rows.length > 0) {
    console.log(`  → HTML 파싱 성공, ${rows.length}개`);
    return rows;
  }

  // 마지막: 페이지 소스에서 totalPage 확인
  const tpM = html.match(/totalPage['":\s]+(\d+)/i) ?? html.match(/lastPage['":\s]+(\d+)/i);
  if (tpM) console.log(`  → totalPage: ${tpM[1]}`);

  console.log(`  → 파싱 실패. HTML 500자: ${html.slice(0,500).replace(/\n/g,' ')}`);
  throw new Error('ArticleList 파싱 실패 — 로그인 필요하거나 비공개 카페');
}

// ── 방법 2: /ca-fe/ REST API (XHR 헤더 포함) ─────────────────────────────────
async function tryCaFeApi(cafeId, menuId, page, cookie) {
  const url = menuId
    ? `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&perPage=50&orderBy=date`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles?page=${page}&perPage=50&orderBy=date&includeAllMenu=true`;

  console.log(`[ca-fe API] ${url}`);
  const { status, body } = await httpsGet(url, buildApiHeaders(cookie, 'https://cafe.naver.com/'));
  console.log(`  → HTTP ${status}, 앞150자: ${body.slice(0,150).replace(/\n/g,' ')}`);

  if (status !== 200) throw new Error(`ca-fe API HTTP ${status}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error('ca-fe API: JSON 파싱 실패 (HTML 반환)'); }

  const result = json?.message?.result ?? json?.result ?? json;
  const list = result?.articleList ?? result?.items ?? result?.articles ?? [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('ca-fe API: 목록 없음');

  return list.map(item => ({
    articleId: item.articleId ?? item.id,
    title: decodeHtml(item.subject ?? item.title ?? ''),
    writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? '',
    dateStr: item.writeDateTimestamp
      ? fmtDate(new Date(item.writeDateTimestamp))
      : (item.writeDate ?? item.writeDateText ?? ''),
    commentCount: parseInt(item.commentCount ?? item.replyCount ?? 0),
    readCount: parseInt(item.readCount ?? item.viewCount ?? 0),
    totalPage: result?.totalPage ?? result?.pageInfo?.totalPage ?? 0,
  }));
}

// ── 방법 3: apis.naver.com ────────────────────────────────────────────────────
async function tryApisNaver(cafeId, menuId, page, cookie) {
  const qs = new URLSearchParams({
    'search.clubid': cafeId,
    'search.page': String(page),
    'search.perPage': '50',
    'search.boardType': 'L',
  });
  if (menuId) qs.set('search.menuid', menuId);
  const url = `https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json?${qs}`;

  console.log(`[apis.naver] ${url}`);
  const headers = {
    ...buildApiHeaders(cookie, 'https://cafe.naver.com/'),
    'sec-fetch-site': 'cross-site',
    'Origin': 'https://cafe.naver.com',
  };
  const { status, body } = await httpsGet(url, headers);
  console.log(`  → HTTP ${status}, 앞150자: ${body.slice(0,150).replace(/\n/g,' ')}`);

  if (status !== 200) throw new Error(`apis.naver HTTP ${status}`);
  let json;
  try { json = JSON.parse(body); } catch { throw new Error('apis.naver: JSON 파싱 실패'); }

  const result = json?.message?.result ?? json?.result ?? json;
  const list = result?.articleList ?? result?.items ?? [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('apis.naver: 목록 없음');
  if (list[0]) console.log(`  [apis.naver] 첫번째 아이템 키: ${Object.keys(list[0]).join(', ')}`);
  if (list[0]) console.log(`  [apis.naver] 날짜관련 필드: writeDateTimestamp=${list[0].writeDateTimestamp} writeDate=${list[0].writeDate} addDate=${list[0].addDate}`);

  return list.map(item => {
    const ts = item.writeDateTimestamp ?? item.addDate ?? item.lastUpdateDate ?? null;
    const dateStr = ts
      ? fmtDate(new Date(typeof ts === 'number' && ts < 9999999999 ? ts * 1000 : ts))
      : (item.writeDate ?? item.writeDateText ?? item.addDateText ?? '');
    return {
      articleId: item.articleId ?? item.id,
      title: decodeHtml(item.subject ?? item.title ?? ''),
      writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? '',
      dateStr,
      commentCount: parseInt(item.commentCount ?? 0),
      readCount: parseInt(item.readCount ?? 0),
      totalPage: result?.totalPage ?? 0,
    };
  });
}

// ── 방법 4: 모바일 API ────────────────────────────────────────────────────────
async function tryMobileApi(cafeId, menuId, page, cookie) {
  const qs = new URLSearchParams({
    cafeId,
    menuId: menuId || '',
    page: String(page),
    perPage: '50',
    orderBy: 'date',
  });
  const url = `https://m.cafe.naver.com/api/v1/cafes/${cafeId}/${menuId ? `menus/${menuId}/` : ''}articles?${qs}`;
  console.log(`[Mobile] ${url}`);

  const headers = {
    ...buildNaverHeaders(cookie, `https://m.cafe.naver.com/`),
    'Accept': 'application/json',
  };
  const { status, body } = await httpsGet(url, headers);
  console.log(`  → HTTP ${status}, 앞100자: ${body.slice(0,100).replace(/\n/g,' ')}`);

  if (status !== 200) throw new Error(`Mobile API HTTP ${status}`);
  const json = JSON.parse(body);
  const list = json?.result?.articleList ?? json?.articleList ?? json?.articles ?? json?.items ?? [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('모바일 API: 목록 없음');

  return list.map(item => ({
    articleId: item.articleId ?? item.id,
    title: decodeHtml(item.subject ?? item.title ?? ''),
    writer: item.writerInfo?.nick ?? item.nick ?? '',
    dateStr: item.writeDate ?? item.writeDateText ?? '',
    commentCount: parseInt(item.commentCount ?? 0),
    readCount: parseInt(item.readCount ?? 0),
    totalPage: json?.result?.totalPage ?? 0,
  }));
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

    // 방법 1: /ca-fe/ REST API (XHR 헤더)
    try {
      rawItems = await tryCaFeApi(cafeId, menuId, page, naverCookie);
      method = 'ca-fe REST API';
    } catch (e) {
      lastError = e.message;
      console.log(`[방법1 실패] ${e.message}`);
    }

    // 방법 2: apis.naver.com
    if (rawItems.length === 0) {
      try {
        rawItems = await tryApisNaver(cafeId, menuId, page, naverCookie);
        method = 'apis.naver.com';
      } catch (e) {
        lastError = e.message;
        console.log(`[방법2 실패] ${e.message}`);
      }
    }

    // 방법 3: ArticleList.nhn HTML
    if (rawItems.length === 0) {
      try {
        rawItems = await tryArticleListHtml(cafeId, menuId, page, naverCookie);
        method = 'ArticleList HTML';
      } catch (e) {
        lastError = e.message;
        console.log(`[방법3 실패] ${e.message}`);
      }
    }

    // 방법 4: 모바일 API
    if (rawItems.length === 0) {
      try {
        rawItems = await tryMobileApi(cafeId, menuId, page, naverCookie);
        method = '모바일 API';
      } catch (e) {
        lastError = e.message;
        console.log(`[방법2 실패] ${e.message}`);
      }
    }

    if (rawItems.length === 0) break;

    let reachedStart = false;
    console.log(`  페이지 ${page} → ${rawItems.length}개 아이템, 날짜 샘플: ${rawItems.slice(0,3).map(i=>`"${i.dateStr}"`).join(', ')}`);
    for (const item of rawItems) {
      if (articles.length >= maxArticles) break;
      const dateObj = parseDateStr(item.dateStr);
      console.log(`  article ${item.articleId}: dateStr="${item.dateStr}" → parsed=${dateObj ? fmtDate(dateObj) : 'null'}`);
      if (endDateObj && dateObj && dateObj > endDateObj) { console.log(`    skip (too new)`); continue; }
      if (startDateObj && dateObj && dateObj < startDateObj) { console.log(`    stop (too old)`); reachedStart = true; break; }
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
    res.writeHead(code, RESP_HEADERS);
    res.end(JSON.stringify(obj));
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

    console.log(`\n수집 요청: cafeId=${body.cafeId} menuId=${body.menuId||''} page=${body.startPage||1}`);
    try {
      const result = await handleScrape(body);
      console.log(`결과: ${result.body.status} — ${result.body.totalCollected||0}개`);
      sendJson(result.statusCode, result.body);
    } catch (e) {
      console.log(`오류: ${e.message}`);
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
