// 릴레이(Mobile API)와 브라우저(f-e API)의 페이지 번호 차이를 자동 보정합니다.
//
// 보정 원리:
//   1) 릴레이 page 1 → 최신 게시글 ID(newestId) 획득
//   2) 릴레이 page N → 해당 페이지 최상위 게시글 ID(topId) 획득
//   3) 브라우저 페이지 = floor((newestId - topId) / 15) + 1
//   4) offset = 브라우저페이지 - 릴레이페이지N
//   5) 사용자가 입력한 브라우저페이지 P → 릴레이에는 (P - offset) 전송
//
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

// 릴레이↔브라우저 페이지 오프셋 계산 (list-only 호출 = 빠름)
async function computeOffset(cafeId, relayMenuId, refRelayPage, cookie) {
  const base = {
    cafeId,
    menuId: relayMenuId,
    maxArticles: 15,
    maxComments: 0,
    fetchComments: false,
    naverCookie: cookie,
    // startDate 미전달 → 릴레이가 내용 미수집 = 빠른 목록만 반환
  };

  // 두 호출을 병렬로 실행 (순차 10s → 병렬 8s)
  const [page1, refData] = await Promise.all([
    relayCall({ ...base, startPage: 1 }, 8000),
    relayCall({ ...base, startPage: refRelayPage }, 8000),
  ]);

  if (!page1?.articles?.length || !refData?.articles?.length) return null;

  // 릴레이가 반환할 수 있는 여러 필드명 시도
  const getId = (a) => parseInt(a.articleId ?? a.id ?? a.articleNo ?? a.article_id ?? 0) || 0;

  const newestId = Math.max(...page1.articles.map(getId).filter(n => n > 0));
  if (newestId <= 0) return null;

  const topId = Math.max(...refData.articles.map(getId).filter(n => n > 0));
  if (topId <= 0 || topId >= newestId) return null;

  // 해당 게시글의 브라우저 페이지 추정
  const estimatedBrowserPage = Math.floor((newestId - topId) / 15) + 1;

  // offset = 브라우저페이지 - 릴레이페이지
  return estimatedBrowserPage - refRelayPage;
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
    _offset,       // 프론트에서 캐싱된 오프셋 (있으면 재계산 생략)
  } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  const cookie = process.env.NAVER_COOKIE || naverCookie || undefined;

  // menuId "0"은 릴레이 Mobile API에서 404 유발 → 빈 문자열로 처리
  const rawMenuId = (menuId || '').trim();
  const relayMenuId = rawMenuId === '0' ? '' : rawMenuId;

  const browserPage = Math.max(1, parseInt(startPage) || 1);

  // 오프셋 결정: 캐싱값 있으면 재사용, 없으면 계산 (최초 1회만)
  // null = 보정 실패 → 그대로 사용 (응답에 _offset 미포함, 프론트 재시도)
  let offset = (typeof _offset === 'number') ? _offset : await computeOffset(cafeId, relayMenuId, browserPage, cookie);

  // 보정된 릴레이 페이지 (offset null이면 보정 없이 그대로)
  const relayPage = Math.max(1, browserPage - (offset ?? 0));

  // 본 수집 (내용 포함)
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

  // relay.nextPage(릴레이 공간) → 브라우저 공간으로 변환
  const rNext = data.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + (offset ?? 0) : null;

  // offset null(보정 실패)이면 _offset 미포함 → 프론트가 캐시하지 않고 다음 요청에서 재시도
  const extra = offset !== null ? { _offset: offset } : {};

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ ...data, nextPage: browserNextPage, ...extra }),
  };
};
