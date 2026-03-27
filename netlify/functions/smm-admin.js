/**
 * smm-admin.js — SMM(SNS 활성화) 어드민 DB 관리 (서버사이드)
 *
 * service_role 키를 사용하므로 RLS를 우회하여 smm_orders / smm_products / smm_providers를
 * 조회·수정합니다. 일반 anon 클라이언트로는 접근이 제한된 데이터에 어드민이 접근할 수 있습니다.
 *
 * 인증: 요청 헤더 x-admin-key 가 VITE_ADMIN_PANEL_PASSWORD(또는 VITE_ADMIN_PASSWORD)와 일치해야 합니다.
 *
 * GET  /.netlify/functions/smm-admin?resource=orders     → 전체 주문 목록
 * GET  /.netlify/functions/smm-admin?resource=providers  → 전체 공급처 목록
 * GET  /.netlify/functions/smm-admin?resource=products   → 전체 상품 목록
 * POST /.netlify/functions/smm-admin  { action:'upsertOrder',    order }
 * POST /.netlify/functions/smm-admin  { action:'upsertOrders',   orders }
 * POST /.netlify/functions/smm-admin  { action:'upsertProviders',providers }
 * POST /.netlify/functions/smm-admin  { action:'upsertProducts', products }
 * POST /.netlify/functions/smm-admin  { action:'deleteProducts', ids }
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

      if (resource === 'orders') {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_orders?order=order_time.desc&select=*`,
          { headers: authHeaders }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, await res.json());
      }

      if (resource === 'providers') {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_providers?order=id.asc&select=*`,
          { headers: authHeaders }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, await res.json());
      }

      if (resource === 'products') {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_products?order=sort_order.asc&select=*`,
          { headers: authHeaders }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, await res.json());
      }

      return resp(400, { error: 'resource 파라미터가 필요합니다. (orders | providers | products)' });
    }

    // ── POST: 데이터 변경 ────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // 단일 주문 upsert (상태 동기화 등)
      if (body.action === 'upsertOrder') {
        const { order } = body;
        if (!order || !order.id) return resp(400, { error: 'order.id 가 필요합니다.' });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_orders`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(order),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      // 복수 주문 upsert (일괄 동기화)
      if (body.action === 'upsertOrders') {
        const { orders } = body;
        if (!Array.isArray(orders) || orders.length === 0) return resp(200, { success: true });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_orders`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(orders),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      // 공급처 upsert
      if (body.action === 'upsertProviders') {
        const { providers } = body;
        if (!Array.isArray(providers) || providers.length === 0) return resp(200, { success: true });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_providers`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(providers),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      // 상품 upsert
      if (body.action === 'upsertProducts') {
        const { products } = body;
        if (!Array.isArray(products) || products.length === 0) return resp(200, { success: true });
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_products`,
          {
            method: 'POST',
            headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(products),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        return resp(200, { success: true });
      }

      // 상품 삭제
      if (body.action === 'deleteProducts') {
        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) return resp(200, { success: true });
        const inClause = ids.map(id => encodeURIComponent(id)).join(',');
        const res = await fetch(
          `${supabaseUrl}/rest/v1/smm_products?id=in.(${inClause})`,
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
    console.error('[smm-admin]', e);
    return resp(500, { error: e.message || '서버 오류가 발생했습니다.' });
  }
};
