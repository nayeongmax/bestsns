// 릴레이(Mobile API)로 네이버 카페 글을 수집합니다.
// 주의: menuId "0" 은 릴레이 Mobile API에서 404를 유발하므로 빈 문자열("")로 변환합니다.

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

  const cookie = process.env.NAVER_COOKIE || naverCookie || undefined;

  // "0"은 전체글을 의미하지만 릴레이 Mobile API에서 404를 유발 → 빈 문자열로 처리
  const rawMenuId = (menuId || '').trim();
  const relayMenuId = rawMenuId === '0' ? '' : rawMenuId;

  let relayRes;
  try {
    relayRes = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cafeId,
        menuId: relayMenuId,
        startPage: parseInt(startPage) || 1,
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

  return { statusCode: relayRes.status, headers: RESP_HEADERS, body: JSON.stringify(data) };
};
