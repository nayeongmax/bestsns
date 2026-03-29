/**
 * store-admin.js — N잡스토어 어드민 DB 관리 (서버사이드)
 *
 * service_role 키를 사용하므로 RLS를 우회하여 store_products를
 * 조회·수정합니다. 비밀 상품(is_secret=true) 포함 전체 상품에 접근합니다.
 *
 * 인증: 요청 헤더 x-admin-key 가 VITE_ADMIN_PANEL_PASSWORD(또는 VITE_ADMIN_PASSWORD)와 일치해야 합니다.
 *
 * GET  /.netlify/functions/store-admin?resource=products  → 전체 상품 목록 (비밀 상품 포함)
 * POST /.netlify/functions/store-admin  { action:'upsertProducts', products }
 * POST /.netlify/functions/store-admin  { action:'upsertProduct',  product }
 * POST /.netlify/functions/store-admin  { action:'deleteProduct',  id }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function resp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // ── 관리자 인증 ──────────────────────────────────────────────
  const adminKey =
    event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';
  const expectedKey =
    process.env.VITE_ADMIN_PANEL_PASSWORD ||
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    '';

  if (!expectedKey || adminKey !== expectedKey) {
    return resp(401, { error: '관리자 인증 실패' });
  }

  // ── Supabase 환경변수 ─────────────────────────────────────────
  const supabaseUrl = (
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  ).replace(/\/$/, '');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return resp(500, {
      error: 'Netlify 환경변수에 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 를 설정해 주세요.',
    });
  }

  const authHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  try {
    // ── GET: 목록 조회 ───────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const resource = (event.queryStringParameters || {}).resource;

      if (resource === 'products') {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/store_products?order=created_at.desc&select=*`,
          { headers: authHeaders }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, await res.json());
      }

      return resp(400, { error: 'resource 파라미터가 필요합니다. (products)' });
    }

    // ── POST: 데이터 변경 ────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // 단일 상품 upsert
      if (body.action === 'upsertProduct') {
        const { product } = body;
        if (!product || !product.id) return resp(400, { error: 'product.id 가 필요합니다.' });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/store_products`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(product),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      // 복수 상품 upsert (일괄)
      if (body.action === 'upsertProducts') {
        const { products } = body;
        if (!Array.isArray(products) || products.length === 0) return resp(200, { success: true });
        // payload 크기 제한 방지: 개별 전송
        for (const product of products) {
          const res = await fetch(
            `${supabaseUrl}/rest/v1/store_products`,
            {
              method: 'POST',
              headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify(product),
            }
          );
          if (!res.ok) throw new Error(await res.text());
        }
        return resp(200, { success: true });
      }

      // 상품 삭제
      if (body.action === 'deleteProduct') {
        const { id } = body;
        if (!id) return resp(400, { error: 'id 가 필요합니다.' });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/store_products?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
            headers: { ...authHeaders, Prefer: 'return=minimal' },
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      return resp(400, { error: '알 수 없는 action 입니다.' });
    }

    return resp(405, { error: 'Method not allowed' });
  } catch (e) {
    console.error('[store-admin]', e);
    return resp(500, { error: e.message || '서버 오류가 발생했습니다.' });
  }
};
