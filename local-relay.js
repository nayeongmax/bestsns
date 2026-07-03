#!/usr/bin/env node
/**
 * 네이버 카페 로컬 릴레이 서버
 * 사용법: node local-relay.js
 * 포트: 3333
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { chromium } = require('playwright-core');

let _browser = null;
async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox'],
    });
  }
  return _browser;
}

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
  // KST = UTC+9
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth()+1).padStart(2,'0')}.${String(kst.getUTCDate()).padStart(2,'0')}`;
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
    ? `https://cafe.naver.com/ca-fe/cafes/${cafeId}/menus/${menuId}/articles?page=${page}&perPage=15&orderBy=date`
    : `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles?page=${page}&perPage=15&orderBy=date&includeAllMenu=true`;

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
    'search.perPage': '15',
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

// ── 글 본문 + 댓글 가져오기 ───────────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
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

async function fetchArticleDetail(cafeId, articleId, cookie, maxComments) {
  // 방법 A: articleapi v2
  try {
    const url = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}`;
    const { status, body } = await httpsGet(url, {
      ...buildApiHeaders(cookie, `https://cafe.naver.com/`),
      'sec-fetch-site': 'cross-site',
    });
    console.log(`  [articleapi] articleId=${articleId} HTTP ${status}${status !== 200 ? ' body앞100자: ' + body.slice(0,100).replace(/\n/g,' ') : ''}`);
    if (status === 200) {
      const j = JSON.parse(body);
      const result = j?.result ?? j?.message?.result ?? j;
      const article = result?.article ?? result;
      const rawContent = article?.contentHtml ?? article?.content ?? article?.contentText ?? '';
      const content = stripHtml(rawContent);
      console.log(`  [상세] content길이=${content.length} 댓글=${(result?.comments?.items ?? result?.commentList ?? []).length}`);

      // 댓글
      let comments = [];
      const cList = result?.comments?.items ?? result?.commentList ?? [];
      for (const c of cList.slice(0, maxComments)) {
        comments.push({
          content: decodeHtml(c.content ?? c.text ?? c.message ?? ''),
          writer: c.writer?.nick ?? c.nick ?? c.userName ?? '',
          date: c.updateDate ?? c.writeDate ?? '',
        });
      }

      // 댓글이 없으면 별도 댓글 API 호출
      if (comments.length === 0 && maxComments > 0) {
        try {
          const cu = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${cafeId}/articles/${articleId}/comments/pages/1`;
          const { status: cs, body: cb } = await httpsGet(cu, {
            ...buildApiHeaders(cookie, `https://cafe.naver.com/`),
            'sec-fetch-site': 'cross-site',
          });
          if (cs === 200) {
            const cj = JSON.parse(cb);
            const cItems = cj?.result?.items ?? cj?.result?.commentList ?? cj?.message?.result?.items ?? [];
            for (const c of cItems.slice(0, maxComments)) {
              comments.push({
                content: decodeHtml(c.content ?? c.text ?? c.message ?? ''),
                writer: c.writer?.nick ?? c.nick ?? '',
                date: c.updateDate ?? c.writeDate ?? '',
              });
            }
          }
        } catch(e) { /* 무시 */ }
      }
      return { content, comments };
    }
  } catch(e) { console.log(`  [articleapi] articleId=${articleId} 실패: ${e.message}`); }

  // 방법 A2: ca-fe API로 글 상세
  try {
    const url2 = `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${articleId}`;
    const { status: s2, body: b2 } = await httpsGet(url2, buildApiHeaders(cookie, 'https://cafe.naver.com/'));
    console.log(`  [ca-fe detail] HTTP ${s2}, 앞80자: ${b2.slice(0,80).replace(/\n/g,' ')}`);
    if (s2 === 200 && b2.trim().startsWith('{')) {
      const j2 = JSON.parse(b2);
      const result2 = j2?.result ?? j2?.message?.result ?? j2;
      const article2 = result2?.article ?? result2;
      const rawContent2 = article2?.contentHtml ?? article2?.content ?? article2?.contentText ?? '';
      const content2 = stripHtml(rawContent2);
      if (content2) {
        const cList2 = result2?.comments?.items ?? result2?.commentList ?? [];
        const comments2 = cList2.slice(0, maxComments).map(c => ({
          content: decodeHtml(c.content ?? c.text ?? ''),
          writer: c.writer?.nick ?? c.nick ?? '',
          date: c.updateDate ?? c.writeDate ?? '',
        }));
        return { content: content2, comments: comments2 };
      }
    }
  } catch(e) { console.log(`  [ca-fe detail] 실패: ${e.message}`); }

  // 방법 B: HTML 파싱
  try {
    const url = `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`;
    const { status, body: html } = await httpsGet(url, buildNaverHeaders(cookie, 'https://cafe.naver.com/'));
    console.log(`  [HTML detail] HTTP ${status}, 앞80자: ${html.slice(0,80).replace(/\n/g,' ')}`);
    if (status === 200) {
      // __NEXT_DATA__에서 본문 추출
      const ndm = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
      if (ndm) {
        const nd = JSON.parse(ndm[1]);
        const articleData = deepFind(nd, ['article', 'articleDetail', 'content', 'contentHtml']);
        if (articleData && typeof articleData === 'string') {
          console.log(`  [HTML detail] __NEXT_DATA__ 파싱 성공, 길이=${articleData.length}`);
          return { content: stripHtml(articleData), comments: [] };
        }
      }
      // 본문 div 패턴
      const bodyM = html.match(/<div[^>]+class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                 ?? html.match(/<div[^>]+id="tbody"[^>]*>([\s\S]*?)<\/div>/i);
      if (bodyM) return { content: stripHtml(bodyM[1]), comments: [] };
      console.log(`  [HTML detail] 파싱 실패`);
    }
  } catch(e) { console.log(`  [HTML detail] 실패: ${e.message}`); }

  // 방법 C: Playwright 헤드리스 브라우저
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    if (cookie) {
      const cookies = [];
      for (const part of cookie.split(';').map(p => p.trim())) {
        const idx = part.indexOf('=');
        if (idx > 0) cookies.push({ name: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim(), domain: '.naver.com', path: '/' });
      }
      if (cookies.length > 0) await context.addCookies(cookies);
    }
    const page = await context.newPage();
    try {
      // SPA가 내부적으로 호출하는 API 응답 가로채기 (빠름)
      let intercepted = null;
      page.on('response', async (response) => {
        if (intercepted) return;
        const url = response.url();
        if (url.includes('cafe-articleapi') && url.includes(`/articles/${articleId}`) && !url.includes('comment')) {
          try { intercepted = await response.json(); } catch {}
        }
      });
      await page.goto(`https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // API 호출 대기 (최대 8초)
      const deadline = Date.now() + 8000;
      while (!intercepted && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));
      let content = '', comments = [];
      if (intercepted) {
        const art = intercepted?.result?.article;
        const raw = art?.contentHtml || art?.content || art?.contentText || '';
        content = stripHtml(raw);
        const rawC = intercepted?.result?.comments?.items || [];
        comments = rawC.slice(0, maxComments).map(c => ({ content: (c.content || '').trim(), writer: c.writer?.nick || '', date: '' })).filter(c => c.content);
        console.log(`  [Playwright 인터셉트] content길이=${content.length} 댓글=${comments.length}`);
        if (content) return { content, comments };
      }
      console.log(`  [Playwright] 인터셉트 실패, 결과 없음`);
    } finally {
      await page.close();
      await context.close();
    }
  } catch(e) { console.log(`  [Playwright] 실패: ${e.message}`); }

  return { content: '', comments: [] };
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
  const { cafeId, menuId='', startPage=1, startDate, endDate, maxArticles=50, maxComments=3, naverCookie='' } = body;
  if (!cafeId) return { statusCode: 400, body: { status: 'error', message: 'cafeId가 필요합니다.' } };

  const startDateObj = startDate ? parseDateStr(startDate) : null;
  const endDateObj   = endDate   ? parseDateStr(endDate)   : null;

  const articles = [];
  // perPage=15 으로 요청하면 카페 페이지 번호 = API 페이지 번호 (1:1 대응)
  const cafePageNum = parseInt(startPage) || 1;
  let page = Math.max(1, cafePageNum);
  const MAX_PAGES = 60;
  let pagesScanned = 0;
  let lastError = '';
  let method = '';
  let apiSuccess = false;   // API 자체가 성공했는지
  let dateFilteredAll = false; // 날짜 필터로만 0개가 된 경우

  while (articles.length < maxArticles && pagesScanned < MAX_PAGES) {
    let rawItems = [];

    // 방법 1: /ca-fe/ REST API (XHR 헤더)
    try {
      rawItems = await tryCaFeApi(cafeId, menuId, page, naverCookie);
      method = 'ca-fe REST API';
      apiSuccess = true;
    } catch (e) {
      lastError = e.message;
      console.log(`[방법1 실패] ${e.message}`);
    }

    // 방법 2: apis.naver.com
    if (rawItems.length === 0) {
      try {
        rawItems = await tryApisNaver(cafeId, menuId, page, naverCookie);
        method = 'apis.naver.com';
        apiSuccess = true;
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
        apiSuccess = true;
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
        apiSuccess = true;
      } catch (e) {
        lastError = e.message;
        console.log(`[방법4 실패] ${e.message}`);
      }
    }

    if (rawItems.length === 0) break;

    let reachedStart = false;
    let pageAllFiltered = true;
    console.log(`  페이지 ${page} → ${rawItems.length}개 아이템, 날짜 샘플: ${rawItems.slice(0,3).map(i=>`"${i.dateStr}"`).join(', ')}`);
    // 페이지 내 아이템은 최신→오래된 순으로 오므로, 역순 처리해서 오래된→최신 순으로 push
    const filteredItems = [];
    for (const item of [...rawItems].reverse()) {
      if (articles.length + filteredItems.length >= maxArticles) { pageAllFiltered = false; break; }
      const dateObj = parseDateStr(item.dateStr);
      if (endDateObj && dateObj && dateObj > endDateObj) continue;
      if (startDateObj && dateObj && dateObj < startDateObj) continue;
      pageAllFiltered = false;
      filteredItems.push({ item, dateObj });
    }
    // 3개씩 병렬로 상세 수집
    const BATCH = 3;
    for (let i = 0; i < filteredItems.length; i += BATCH) {
      const batch = filteredItems.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(({ item }) =>
        item.articleId
          ? fetchArticleDetail(cafeId, item.articleId, naverCookie, maxComments).catch(e => { console.log(`  [상세] 실패: ${e.message}`); return { content: '', comments: [] }; })
          : Promise.resolve({ content: '', comments: [] })
      ));
      for (let j = 0; j < batch.length; j++) {
        const { item, dateObj } = batch[j];
        const { content, comments } = results[j];
        articles.push({
          no: articles.length + 1,
          articleId: item.articleId,
          title: item.title,
          content,
          writer: item.writer,
          date: dateObj ? fmtDate(dateObj) : item.dateStr,
          commentCount: item.commentCount || 0,
          readCount: item.readCount || 0,
          url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${item.articleId}`,
          comments,
        });
      }
    }

    if (pageAllFiltered && articles.length === 0) dateFilteredAll = true;
    if (reachedStart) break;
    page--;
    if (page < 1) break;
    pagesScanned++;
    await new Promise(r => setTimeout(r, 300));
  }

  if (articles.length === 0) {
    if (dateFilteredAll && apiSuccess && startDateObj) {
      const fmt = fmtDate(startDateObj);
      return {
        statusCode: 200,
        body: {
          status: 'ok',
          articles: [],
          totalCollected: 0,
          method,
          message: `페이지 ${cafePageNum}의 글이 모두 시작일(${fmt}) 이후입니다. 더 과거 페이지(높은 번호)를 선택해주세요.`,
        },
      };
    }
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

  articles.forEach((a, i) => { a.no = i + 1; });

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

    console.log(`\n수집 요청: cafeId=${body.cafeId} menuId=${body.menuId||''} page=${body.startPage||1} cookie=${body.naverCookie ? '있음('+body.naverCookie.length+'자)' : '없음'}`);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ 네이버 카페 릴레이 서버 실행 중`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   웹앱에서 수집 시 이 창을 열어두세요.`);
  console.log(`   종료: Ctrl+C\n`);
});
