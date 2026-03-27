/**
 * user-credit-applications.js — 사용자 본인의 크레딧 충전 신청 내역 조회
 *
 * service_role 키를 사용하므로 RLS를 우회합니다.
 *
 * GET /.netlify/functions/user-credit-applications?user_id=<userId>
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function resp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return resp(405, { error: 'Method not allowed' });
  }

  const userId = event.queryStringParameters?.user_id;
  if (!userId) {
    return resp(400, { error: 'user_id 가 필요합니다.' });
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  ).replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return resp(500, { error: 'Supabase 환경변수가 설정되지 않았습니다.' });
  }

  const authHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/credit_applications?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=*`,
      { headers: authHeaders }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return resp(200, data);
  } catch (e) {
    console.error('[user-credit-applications]', e);
    return resp(500, { error: e.message || '서버 오류가 발생했습니다.' });
  }
};
