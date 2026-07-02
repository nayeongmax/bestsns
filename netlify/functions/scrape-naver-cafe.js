// Netlify Serverless Function: scrape-naver-cafe.js
// NCloud Seoul 릴레이 서버로 요청을 프록시합니다.

const RELAY_URL = process.env.RELAY_URL || 'http://223.130.163.229:3333';

const RESP_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESP_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: 'POST만 지원합니다.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: RESP_HEADERS, body: JSON.stringify({ status: 'error', message: '요청 형식 오류' }) }; }

  // 환경변수에 저장된 쿠키를 자동 주입 (프론트엔드에서 쿠키 입력 불필요)
  if (!body.naverCookie && process.env.NAVER_COOKIE) {
    body.naverCookie = process.env.NAVER_COOKIE;
  }

  try {
    const res = await fetch(`${RELAY_URL}/scrape-naver-cafe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
    const data = await res.json();
    return { statusCode: res.status, headers: RESP_HEADERS, body: JSON.stringify(data) };
  } catch (e) {
    return {
      statusCode: 502,
      headers: RESP_HEADERS,
      body: JSON.stringify({ status: 'error', message: `릴레이 서버 연결 실패: ${e.message}` }),
    };
  }
};
