/**
 * store-seller.js — 판매자 상품 저장 (서버사이드 service_role, RLS 우회)
 *
 * 인증: Authorization: Bearer <Supabase JWT>
 * POST { action:'upsertProduct', product }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function resp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '{}' };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return resp(500, { error: 'Supabase 환경변수가 없습니다. (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' });
  }

  // 사용자 JWT 검증
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const userJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!userJwt) {
    return resp(401, { error: '로그인이 필요합니다.' });
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userJwt}`, apikey: serviceKey },
  });

  if (!userRes.ok) {
    return resp(401, { error: '유효하지 않은 로그인 정보입니다. 다시 로그인해 주세요.' });
  }

  const h = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action } = body;

    if (action === 'upsertProduct') {
      const { product } = body;
      if (!product || !product.id) {
        return resp(400, { error: 'product.id가 필요합니다.' });
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/store_products`, {
        method: 'POST',
        headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      return resp(200, { success: true });
    }

    return resp(400, { error: `알 수 없는 action: ${action}` });
  } catch (err) {
    console.error('[store-seller]', err);
    return resp(500, { error: err.message || '서버 오류' });
  }
};
