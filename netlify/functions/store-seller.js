const { authorized } = require('../lib/admin-auth.cjs');
/**
 * store-seller.js — 판매자/어드민 상품 저장 (서버사이드 service_role, RLS 우회)
 *
 * 인증 방식 (둘 중 하나):
 *   1. Authorization: Bearer <Supabase JWT>  (일반 판매자)
 *   2. 서버 검증 관리자 세션  (어드민)
 *
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

  // ── 인증: 어드민 키 OR 사용자 JWT ──
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const userJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const isAdmin = await authorized(event);
  let authenticated = isAdmin;
  let ownerId = null;

  // 방법 1: 어드민 키
  if (isAdmin) {
    authenticated = true;
  }

  // 방법 2: Supabase JWT 검증
  if (!authenticated && userJwt) {
    try {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${userJwt}`, apikey: serviceKey },
      });
      if (userRes.ok) { const account = await userRes.json(); ownerId = account.id; authenticated = typeof ownerId === 'string'; }
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

    if (action === 'deleteProduct') {
      if (typeof body.id !== 'string' || !body.id) return resp(400, {error:'Invalid product ID'});
      const path = supabaseUrl + '/rest/v1/store_products?id=eq.' + encodeURIComponent(body.id);
      const ownerRes = await fetch(path + '&select=author_id&limit=1', {headers:h});
      if (!ownerRes.ok) return resp(503,{error:'상품 소유권 확인 실패'});
      const rows = await ownerRes.json();
      if (!isAdmin && (!rows[0] || rows[0].author_id !== ownerId)) return resp(403,{error:'본인 상품만 삭제할 수 있습니다.'});
      const result = await fetch(path, {method:'DELETE', headers:h});
      return resp(result.ok?200:503, result.ok?{success:true}:{error:'상품 삭제 실패'});
    }
    if (action === 'upsertProduct') {
      const { product } = body;
      if (!product || !product.id) {
        return resp(400, { error: 'product.id가 필요합니다.' });
      }
      if (!isAdmin) {
        const existingRes = await fetch(supabaseUrl + '/rest/v1/store_products?id=eq.' + encodeURIComponent(product.id) + '&select=author_id&limit=1', { headers: h });
        if (!existingRes.ok) return resp(503, { error: '상품 소유권 확인 실패' });
        const existing = await existingRes.json();
        if (product.author_id !== ownerId || (existing[0] && existing[0].author_id !== ownerId)) return resp(403, { error: '본인 상품만 저장할 수 있습니다.' });
        product.status = 'pending';
        product.is_secret = false;
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
