// 릴레이(Mobile API)와 브라우저(f-e API)의 페이지 번호 차이를 자동 보정합니다.
//
// 보정 원리:
//   1) 릴레이 page 1, maxArticles:1, startDate 포함 → 최신 게시글 ID(newestId) 획득
//   2) 릴레이 page N, maxArticles:1, startDate 포함 → 해당 페이지 게시글 ID(topId) 획득
//   3) 브라우저 페이지 = floor((newestId - topId) / 15) + 1
//   4) offset = 브라우저페이지 - 릴레이페이지N
//   5) 사용자가 입력한 브라우저페이지 P → 릴레이에는 (P - offset) 전송
//
// maxArticles:1 + 병렬 호출로 보정에 ~5s만 사용, 총 23s 이내.
// offset은 응답에 포함해 프론트에서 캐싱, 이후 배치는 재계산 없이 재사용.

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

async function relayCall(params, timeoutMs) {
  try {
    const res = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await res.json();
  } catch {
    return null;
  }
}

function extractId(articles) {
  if (!articles?.length) return 0;
  const ids = articles
    .map(a => parseInt(a.articleId ?? a.id ?? a.articleNo ?? a.article_id ?? 0) || 0)
    .filter(n => n > 0);
  return ids.length ? Math.max(...ids) : 0;
}

// startDate 포함 + maxArticles:1 → articleId 확실히 반환됨
async function computeOffset(cafeId, relayMenuId, refRelayPage, cookie) {
  const base = {
    cafeId,
    menuId: relayMenuId,
    maxArticles: 1,
    maxComments: 0,
    fetchComments: false,
    naverCookie: cookie,
    startDate: '2000.01.01',
  };

  // 두 호출 병렬 실행
  const [page1, refData] = await Promise.all([
    relayCall({ ...base, startPage: 1 }, 10000),
    relayCall({ ...base, startPage: refRelayPage }, 10000),
  ]);

  const newestId = extractId(page1?.articles);
  const topId    = extractId(refData?.articles);

  if (newestId <= 0 || topId <= 0 || topId >= newestId) {
    return { offset: null, debug: { newestId, topId, refRelayPage } };
  }

  const estimatedBrowserPage = Math.floor((newestId - topId) / 15) + 1;
  const offset = estimatedBrowserPage - refRelayPage;
  return { offset, debug: { newestId, topId, estimatedBrowserPage, refRelayPage } };
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
    menuId = '',
    startPage = 1,
    maxArticles = 15,
    maxComments = 0,
    fetchComments = false,
    naverCookie,
    _offset,
  } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  const cookie = process.env.NAVER_COOKIE || naverCookie || undefined;

  const rawMenuId = (menuId || '').trim();
  const relayMenuId = rawMenuId === '0' ? '' : rawMenuId;

  const browserPage = Math.max(1, parseInt(startPage) || 1);

  let offset;
  let calibDebug = null;

  if (typeof _offset === 'number') {
    offset = _offset;
  } else {
    const result = await computeOffset(cafeId, relayMenuId, browserPage, cookie);
    offset = result.offset;
    calibDebug = result.debug;
  }

  const relayPage = Math.max(1, browserPage - (offset ?? 0));

  let relayRes;
  try {
    relayRes = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeId,
        menuId: relayMenuId,
        startPage: relayPage,
        startDate: '2000.01.01',
        maxArticles: Math.min(15, parseInt(maxArticles) || 15),
        maxComments: parseInt(maxComments) || 0,
        fetchComments: fetchComments && parseInt(maxComments) > 0,
        naverCookie: cookie,
      }),
      signal: AbortSignal.timeout(18000),
    });
  } catch (e) {
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: `릴레이 서버 연결 실패: ${e.message}` }),
    };
  }

  let data;
  try { data = await relayRes.json(); }
  catch {
    return { statusCode: 502, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '릴레이 응답 파싱 오류' }) };
  }

  if (data.status !== 'ok')
    return { statusCode: relayRes.status, headers: RESP_HEADERS, body: JSON.stringify(data) };

  const rNext = data.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + (offset ?? 0) : null;

  const extra = {};
  if (offset !== null) extra._offset = offset;
  if (calibDebug)      extra._calibDebug = calibDebug;

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ ...data, nextPage: browserNextPage, ...extra }),
  };
};
