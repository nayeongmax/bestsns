/**
 * store-seller.js — 판매자/어드민 상품 저장 (서버사이드 service_role, RLS 우회)
 *
 * 인증 방식 (둘 중 하나):
 *   1. Authorization: Bearer <Supabase JWT>  (일반 판매자)
 *   2. x-admin-key: <VITE_ADMIN_PANEL_PASSWORD>  (어드민)
 *
 * POST { action:'upsertProduct', product }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
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

  // ── 인증: 어드민 키 OR 사용자 JWT ──
  const adminKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';
  const expectedAdminKey =
    process.env.VITE_ADMIN_PANEL_PASSWORD ||
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    '';

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const userJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let authenticated = false;

  // 방법 1: 어드민 키
  if (expectedAdminKey && adminKey === expectedAdminKey) {
    authenticated = true;
  }

  // 방법 2: Supabase JWT 검증
  if (!authenticated && userJwt) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${userJwt}`, apikey: serviceKey },
      });
      if (userRes.ok) authenticated = true;
    } catch (_) { /* network error → authenticated remains false */ }
  }

  if (!authenticated) {
    return resp(401, { error: '로그인이 필요합니다. 다시 로그인해 주세요.' });
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
        let detail = errText;
        try { detail = JSON.parse(errText).message || errText; } catch (_) {}
        throw new Error(detail || `DB 저장 실패 (HTTP ${res.status})`);
      }
      return resp(200, { success: true });
    }

    return resp(400, { error: `알 수 없는 action: ${action}` });
  } catch (err) {
    console.error('[store-seller]', err.message);
    return resp(500, { error: err.message || '서버 오류가 발생했습니다.' });
  }
};
