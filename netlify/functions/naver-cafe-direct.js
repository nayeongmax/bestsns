// 브라우저 f-e API와 릴레이 Mobile API의 페이지 번호 차이 보정.
//
// 릴레이(Mobile API) 페이지 번호 = 브라우저 f-e 페이지 번호 - 1
// 예: 브라우저 995페이지 == 릴레이 994페이지 (같은 글)
//
// 그러므로:
//   relay 호출 시 startPage = browser_page - 1
//   relay가 반환한 nextPage +1 해서 저장 (browser page space로 유지)

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

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
  } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  // Netlify 환경변수 쿠키 우선, 그 다음 사용자 입력 쿠키
  const cookie = process.env.NAVER_COOKIE || naverCookie || undefined;
  const browserPage = Math.max(1, parseInt(startPage) || 1);

  // 브라우저 페이지 → 릴레이 페이지 (항상 -1)
  const relayPage = Math.max(1, browserPage - 1);

  let relayRes;
  try {
    relayRes = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeId,
        menuId: (menuId || '').trim(),
        startPage: relayPage,
        startDate: '2000.01.01',
        maxArticles: Math.min(15, parseInt(maxArticles) || 15),
        maxComments: parseInt(maxComments) || 0,
        fetchComments: fetchComments && parseInt(maxComments) > 0,
        naverCookie: cookie,
      }),
      signal: AbortSignal.timeout(24000),
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

  // 릴레이 nextPage(릴레이 페이지 공간) → 브라우저 페이지 공간으로 변환
  const rNext = data.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + 1 : null;

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ ...data, nextPage: browserNextPage }),
  };
};
