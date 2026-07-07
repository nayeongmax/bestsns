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
      headless: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox'],
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
  // 날짜+시간: "2026.02.02 14:30", "2026.02.02. 14:30" (마침표+공백 허용), "2026.02.02 14:30:00"
  let m = s.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})[.\s]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}+09:00`);
  // 날짜만: "2026.02.02"
  m = s.match(/^(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
  m = s.match(/^(\d{2})\.(\d{2})$/);
  if (m) return new Date(`${new Date().getFullYear()}-${m[1]}-${m[2]}T00:00:00+09:00`);
  if (/전$/.test(s)) return new Date();
  try { const d = new Date(s); if (!isNaN(d)) return d; } catch {}
  return null;
}

// Unix 타임스탬프를 밀리초 단위로 정규화 (초 단위 자동 감지)
function normTs(ts) {
  if (!ts) return null;
  const n = Number(ts);
  return isNaN(n) ? null : (n < 9999999999 ? n * 1000 : n);
}

function fmtDate(d) {
  if (!d) return '';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth()+1).padStart(2,'0')}.${String(kst.getUTCDate()).padStart(2,'0')}`;
}

function fmtDateTime(d) {
  if (!d) return '';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}.${String(kst.getUTCMonth()+1).padStart(2,'0')}.${String(kst.getUTCDate()).padStart(2,'0')} ${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`;
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
      ? fmtDate(new Date(normTs(item.writeDateTimestamp)))
      : (item.writeDate ?? item.writeDateText ?? ''),
    dateTimestamp: normTs(item.writeDateTimestamp),
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
    const rawTs = item.writeDateTimestamp ?? item.addDate ?? item.lastUpdateDate ?? null;
    const ts = normTs(rawTs);
    const dateStr = ts
      ? fmtDate(new Date(ts))
      : (item.writeDate ?? item.writeDateText ?? item.addDateText ?? '');
    return {
      articleId: item.articleId ?? item.id,
      title: decodeHtml(item.subject ?? item.title ?? ''),
      writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? '',
      dateStr,
      dateTimestamp: ts,
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
      // SPA가 내부적으로 호출하는 API 응답 가로채기
      let intercepted = null;
      page.on('response', async (response) => {
        if (intercepted) return;
        const url = response.url();
        if (url.includes('cafe-articleapi') && url.includes(`/articles/${articleId}`) && !url.includes('comment')) {
          try { intercepted = await response.json(); } catch {}
        }
      });
      // ArticleRead.nhn → 브라우저가 자동으로 올바른 URL로 처리
      const articleUrl = `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${articleId}`;
      console.log(`  [Playwright] 글 열기: ${articleUrl}`);
      await page.goto(articleUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // 로그인 페이지 감지
      const curUrl = page.url();
      console.log(`  [Playwright] 현재 URL: ${curUrl.slice(0, 100)}`);
      if (curUrl.includes('nidlogin') || curUrl.includes('/login')) {
        console.log(`  [Playwright] 로그인 페이지로 이동됨 — 쿠키 필요`);
        return { content: '', comments: [] };
      }

      // API 인터셉트 대기 (최대 8초)
      const deadline = Date.now() + 8000;
      while (!intercepted && Date.now() < deadline) await new Promise(r => setTimeout(r, 200));

      let content = '', comments = [];

      // API 인터셉트 성공 시 내용 추출
      if (intercepted) {
        const art = intercepted?.result?.article;
        const raw = art?.contentHtml || art?.content || art?.contentText || '';
        content = stripHtml(raw);
        const rawC = intercepted?.result?.comments?.items || [];
        comments = rawC.slice(0, maxComments).map(c => ({ content: (c.content || '').trim(), writer: c.writer?.nick || '', date: '' })).filter(c => c.content);
        console.log(`  [Playwright 인터셉트] content길이=${content.length} 댓글=${comments.length}`);
      }

      // DOM에서 직접 읽기 — 메인 페이지 + 모든 iframe 탐색 (Python과 동일)
      if (!content) {
        // SPA/iframe 렌더링 완료 대기
        await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2500));

        const DOM_SELECTORS = [
          'div.se-main-container',
          'div.article_viewer',
          'div#postContent',
          'div.ContentRenderer',
          'div#tbody',
          '.post-content-wrap',
          'div[class*="article_content"]',
          'div[class*="se-module-text"]',
        ];

        // 메인 프레임 + 모든 iframe 순서로 탐색
        const allFrames = page.frames();
        let contentFrame = null;
        for (const frame of allFrames) {
          if (content) break;
          try {
            const fUrl = frame.url();
            const result = await frame.evaluate((sels) => {
              for (const sel of sels) {
                const el = document.querySelector(sel);
                if (el) {
                  const t = (el.innerText || el.textContent || '').trim();
                  if (t.length > 10) return t;
                }
              }
              return '';
            }, DOM_SELECTORS);

            if (result) {
              content = result;
              contentFrame = frame;
              console.log(`  [Playwright DOM] 성공 (${fUrl.slice(0, 60)}), 길이=${content.length}`);
            }
          } catch (fe) { /* 무시 */ }
        }
        if (!content) console.log(`  [Playwright DOM] 모든 프레임에서 내용 없음`);

        // 댓글도 같은 프레임에서 DOM으로 읽기
        if (contentFrame && maxComments > 0 && comments.length === 0) {
          try {
            comments = await contentFrame.evaluate((maxC) => {
              const result = [];
              const COMMENT_SELS = [
                '.CommentBox .comment_item',
                '.comment_list .comment_item',
                'ul.CommentBox__list > li',
                '[class*="CommentItem"]',
                '.cafe_comment_list li',
                '.comment_area li',
                '[class*="comment-item"]',
              ];
              let items = [];
              for (const sel of COMMENT_SELS) {
                items = Array.from(document.querySelectorAll(sel));
                if (items.length > 0) break;
              }
              for (const item of items.slice(0, maxC)) {
                const contentEl = item.querySelector('[class*="comment_text"], [class*="text_comment"], .comment_body p, .text');
                const writerEl  = item.querySelector('[class*="nick"], [class*="writer_nick"], .comment_writer');
                const dateEl    = item.querySelector('[class*="date"], time');
                const text = (contentEl?.innerText || contentEl?.textContent || '').trim();
                if (text) result.push({
                  content: text,
                  writer: (writerEl?.innerText || writerEl?.textContent || '').trim(),
                  date:   (dateEl?.innerText   || dateEl?.textContent   || '').trim(),
                });
              }
              return result;
            }, maxComments);
            if (comments.length > 0) console.log(`  [Playwright DOM 댓글] ${comments.length}개`);
          } catch(ce) { /* 무시 */ }
        }
      }

      if (content) return { content, comments };
      console.log(`  [Playwright] 최종 실패 — 내용 없음`);
    } finally {
      await page.close();
      await context.close();
    }
  } catch(e) { console.log(`  [Playwright] 실패: ${e.message}`); }

  return { content: '', comments: [] };
}

// ── 방법 0: Playwright로 목록 페이지 직접 열기 (Python과 동일, 페이지 번호 정확) ─────
async function tryPlaywrightList(cafeId, menuId, page, cookie) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  if (cookie) {
    const cookies = [];
    for (const part of cookie.split(';').map(p => p.trim())) {
      const idx = part.indexOf('=');
      if (idx > 0) cookies.push({ name: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim(), domain: '.naver.com', path: '/' });
    }
    if (cookies.length > 0) await ctx.addCookies(cookies);
  }
  const pw = await ctx.newPage();
  try {
    let intercepted = null;

    // page.route()로 ca-fe 목록 API 가로채기 (response.on보다 안정적)
    await pw.route(url => {
      const href = url.href || url.toString();
      return href.includes('/ca-fe/cafes/') && /\/articles\?/.test(href);
    }, async (route) => {
      let response;
      try { response = await route.fetch(); } catch(e) { await route.continue(); return; }
      const body = await response.text().catch(() => '');
      console.log(`  [목록 라우트] ${route.request().url().slice(0, 100)}`);
      console.log(`  [목록 라우트] 앞80자: ${body.slice(0, 80)}`);
      try {
        const j = JSON.parse(body);
        const result = j?.message?.result ?? j?.result ?? j;
        const list = result?.articleList ?? result?.items ?? result?.articles ?? [];
        if (!intercepted && Array.isArray(list) && list.length > 0) {
          intercepted = { list, totalPage: result?.totalPage ?? result?.pageInfo?.totalPage ?? 0 };
          console.log(`  [목록 라우트] 성공! ${list.length}개`);
        }
      } catch(e) { console.log(`  [목록 라우트] JSON 파싱 실패: ${e.message}`); }
      await route.fulfill({ response });
    });

    // Python의 driver.get(list_url)과 동일: f-e SPA URL로 브라우저 열기
    // menus/0 = 전체글보기 (브라우저 URL과 동일하게 맞춰야 ca-fe API 페이지 번호 일치)
    const hasMenu = menuId && menuId !== '0';
    const listUrl = hasMenu
      ? `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/${menuId}?page=${page}&viewType=L`
      : `https://cafe.naver.com/f-e/cafes/${cafeId}/menus/0?page=${page}&viewType=L`;
    console.log(`[Playwright 목록] ${listUrl}`);
    await pw.goto(listUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500)); // route 핸들러 완료 대기

    if (intercepted) {
      const { list, totalPage } = intercepted;
      console.log(`[Playwright 목록] 성공: ${list.length}개, totalPage=${totalPage}`);
      return list.map(item => ({
        articleId: item.articleId ?? item.id,
        title: decodeHtml(item.subject ?? item.title ?? ''),
        writer: item.writerInfo?.nick ?? item.writer?.nick ?? item.nick ?? '',
        dateStr: item.writeDateTimestamp
          ? fmtDate(new Date(normTs(item.writeDateTimestamp)))
          : (item.writeDate ?? item.writeDateText ?? ''),
        dateTimestamp: normTs(item.writeDateTimestamp),
        commentCount: parseInt(item.commentCount ?? item.replyCount ?? 0),
        readCount: parseInt(item.readCount ?? item.viewCount ?? 0),
        totalPage,
      }));
    }
    throw new Error('ca-fe API 인터셉트 실패');
  } finally {
    await pw.close();
    await ctx.close();
  }
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
    dateTimestamp: normTs(item.writeDateTimestamp),
    commentCount: parseInt(item.commentCount ?? 0),
    readCount: parseInt(item.readCount ?? 0),
    totalPage: json?.result?.totalPage ?? 0,
  }));
}

async function handleScrape(body) {
  const { cafeId, menuId='', startPage=1, startDate, endDate, maxArticles=50, maxComments=3, naverCookie='' } = body;
  if (!cafeId) return { statusCode: 400, body: { status: 'error', message: 'cafeId가 필요합니다.' } };

  // "HH:MM" 형식이면 시각만 비교하는 모드 (날짜 무관)
  const isTimeOnly = startDate && /^\d{2}:\d{2}(:\d{2})?$/.test(startDate.trim());
  const startDateObj = !isTimeOnly && startDate ? parseDateStr(startDate) : null;
  const startTimeMinutes = isTimeOnly ? (() => {
    const p = startDate.trim().split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
  })() : null;
  const endDateObj   = endDate   ? parseDateStr(endDate)   : null;
  if (isTimeOnly) console.log(`[시각 필터] ${startDate} (${startTimeMinutes}분)`);

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

    // 방법 0: Playwright 브라우저로 목록 페이지 직접 열기 (Python과 동일, 페이지 번호 정확)
    try {
      rawItems = await tryPlaywrightList(cafeId, menuId, page, naverCookie);
      method = 'Playwright(브라우저)';
      apiSuccess = true;
    } catch (e) {
      lastError = e.message;
      console.log(`[방법0 실패] ${e.message}`);
    }

    // 방법 1: /ca-fe/ REST API (XHR 헤더)
    if (rawItems.length === 0) {
    try {
      rawItems = await tryCaFeApi(cafeId, menuId, page, naverCookie);
      method = 'ca-fe REST API';
      apiSuccess = true;
    } catch (e) {
      lastError = e.message;
      console.log(`[방법1 실패] ${e.message}`);
    }
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
    // Python과 동일: 페이지 아래(오래된 글)부터 수집
    const filteredItems = [];
    for (const item of [...rawItems].reverse()) {
      if (articles.length + filteredItems.length >= maxArticles) { pageAllFiltered = false; break; }
      // 타임스탬프 우선, 없으면 날짜 문자열로 비교 (시간 필터 정밀 지원)
      const dateObj = item.dateTimestamp ? new Date(item.dateTimestamp) : parseDateStr(item.dateStr);
      if (endDateObj && dateObj && dateObj > endDateObj) continue;
      if (startDateObj && dateObj && dateObj < startDateObj) continue;
      // HH:MM 시각만 입력한 경우: KST 시각 기준으로 비교
      if (startTimeMinutes !== null && dateObj) {
        const kst = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
        const artMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
        if (artMinutes < startTimeMinutes) continue;
      }
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
          // 타임스탬프 있으면 날짜+시간 표시, 없으면 날짜만
          date: item.dateTimestamp ? fmtDateTime(new Date(item.dateTimestamp)) : (dateObj ? fmtDate(dateObj) : item.dateStr),
          commentCount: item.commentCount || 0,
          readCount: item.readCount || 0,
          url: `https://cafe.naver.com/ArticleRead.nhn?clubid=${cafeId}&articleid=${item.articleId}`,
          comments,
        });
      }
    }

    if (pageAllFiltered && articles.length === 0) dateFilteredAll = true;
    if (reachedStart) break;
    // 이 페이지에서 매칭 글을 찾았으면 즉시 반환 — 다음 페이지는 FranchisePanel이 별도 배치로 요청
    // (계속 이동하면 페이지 중간에 걸쳐 수집돼 나머지 글이 누락됨)
    if (!pageAllFiltered) break;
    // 이 페이지 글이 전부 날짜/시각 필터됨 → 더 최신 페이지로 이동
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

  // 다음 수집 페이지: page - 1 (낮은 번호 = 더 오래된 글)
  const nextPageNum = articles.length > 0 && page > 1 ? page - 1 : 0;
  return {
    statusCode: 200,
    body: { status: 'ok', articles, nextPage: nextPageNum, totalCollected: articles.length, method },
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
