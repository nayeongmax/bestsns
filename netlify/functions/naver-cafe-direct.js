// 릴레이(Mobile API)와 브라우저(f-e API)의 페이지 번호 보정
//
// 보정 전략:
//   - 별도 calibration 호출 없음 (Netlify 26s 제한 초과 방지)
//   - 첫 요청(_offset 없음): page 1 프로브를 수집과 병렬 실행 → newestId 획득
//   - 이후 요청(_offset 제공): 수집만 실행 (프로브 없음)
//   - 프론트엔드가 newestId + 수집 articleId로 실제 페이지를 역산해 오프셋 보정

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function extractMaxId(articles) {
  if (!Array.isArray(articles) || !articles.length) return 0;
  const ids = articles.map(a => {
    // 필드명 순서대로 시도
    const direct = parseInt(a.articleId ?? a.id ?? a.articleNo ?? a.article_id ?? 0) || 0;
    if (direct > 0) return direct;
    // URL에서 숫자 추출 (articleid=NNN 또는 /articles/NNN)
    const url = String(a.url || a.articleUrl || '');
    const m = url.match(/articleid=(\d+)/i)
           || url.match(/\/articles?\/(\d+)/i)
           || url.match(/[/?&](\d{4,})/);
    return m ? (parseInt(m[1]) || 0) : 0;
  }).filter(n => n > 0);
  return ids.length ? Math.max(...ids) : 0;
}

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
    menuId    = '',
    startPage = 1,
    maxArticles  = 15,
    maxComments  = 0,
    fetchComments = false,
    naverCookie,
    _offset,      // 프론트 캐싱 오프셋 (있으면 프로브 생략)
  } = body;

  if (!cafeId)
    return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'cafeId 필요' }) };

  const cookie     = process.env.NAVER_COOKIE || naverCookie || undefined;
  const rawMenuId  = (menuId || '').trim();
  const relayMenuId = rawMenuId === '0' ? '' : rawMenuId;
  const browserPage = Math.max(1, parseInt(startPage) || 1);
  const hasOffset   = typeof _offset === 'number';
  const offset      = hasOffset ? _offset : 0;
  const relayPage   = Math.max(1, browserPage - offset);

  const mainParams = {
    cafeId,
    menuId: relayMenuId,
    startPage: relayPage,
    startDate: '2000.01.01',
    maxArticles: Math.min(15, parseInt(maxArticles) || 15),
    maxComments: parseInt(maxComments) || 0,
    fetchComments: fetchComments && parseInt(maxComments) > 0,
    naverCookie: cookie,
  };

  let mainData, newestId = 0;

  if (!hasOffset) {
    // 첫 요청: 수집 + page 1 프로브를 병렬로 실행
    // 병렬이므로 총 시간 = max(수집시간, 프로브시간) ≈ 20s < 26s
    const probeParams = {
      cafeId,
      menuId: relayMenuId,
      startPage: 1,
      startDate: '2000.01.01',
      maxArticles: 1,
      maxComments: 0,
      fetchComments: false,
      naverCookie: cookie,
    };

    const [main, probe] = await Promise.all([
      safeRelayFetch(mainParams, 20000),
      safeRelayFetch(probeParams, 8000),
    ]);

    mainData = main;
    newestId = extractMaxId(probe?.articles);
  } else {
    // 이후 요청: 수집만 (더 많은 시간 할당)
    mainData = await safeRelayFetch(mainParams, 22000);
  }

  if (!mainData || mainData.status !== 'ok') {
    const msg = mainData?.message || '릴레이 서버 오류';
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: msg }),
    };
  }

  // relay.nextPage → 브라우저 페이지 공간으로 변환
  const rNext = mainData.nextPage;
  const browserNextPage = (rNext && typeof rNext === 'number') ? rNext + offset : null;

  const extra = { _relayPage: relayPage };
  if (newestId > 0) extra._newestId = newestId;

  return {
    statusCode: 200,
    headers: RESP_HEADERS,
    body: JSON.stringify({ ...mainData, nextPage: browserNextPage, ...extra }),
  };
};
