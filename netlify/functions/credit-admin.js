/**
 * credit-admin.js — 크레딧 충전 신청 관리 (서버사이드)
 *
 * service_role 키를 사용하므로 RLS를 우회하여 credit_applications 를 조회/수정하고
 * 승인 시 profiles.points 를 증가시킵니다.
 *
 * 인증: 요청 헤더 x-admin-key 가 VITE_ADMIN_PASSWORD(또는 ADMIN_PASSWORD) 와 일치해야 합니다.
 *
 * GET  /.netlify/functions/credit-admin          → 전체 신청 목록 (created_at ASC)
 * POST /.netlify/functions/credit-admin  { action:'approve', id, userId, amount }
 * POST /.netlify/functions/credit-admin  { action:'reject',  id, note? }
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
      error:
        'Netlify 환경변수에 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 설정해 주세요.',
    });
  }

  const authHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  try {
    // ── GET: 전체 신청 목록 ──────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/credit_applications?order=created_at.asc&select=*`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return resp(200, data);
    }

    // ── POST: 승인 / 거절 ────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // 승인
      if (body.action === 'approve') {
        const { id, userId, amount } = body;
        if (!id || !userId || !amount) {
          return resp(400, { error: 'id, userId, amount 가 필요합니다.' });
        }

        // 1) credit_applications 상태 변경
        const appRes = await fetch(
          `${supabaseUrl}/rest/v1/credit_applications?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              status: 'approved',
              approved_at: new Date().toISOString(),
            }),
          }
        );
        if (!appRes.ok) throw new Error(await appRes.text());

        // 2) 현재 포인트 조회
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=points`,
          { headers: authHeaders }
        );
        if (!profileRes.ok) throw new Error(await profileRes.text());
        const profiles = await profileRes.json();
        const currentPoints = profiles[0]?.points || 0;

        // 3) 포인트 적립
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'PATCH',
            headers: { ...authHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify({
              points: currentPoints + Number(amount),
              updated_at: new Date().toISOString(),
            }),
          }
        );
        if (!updateRes.ok) throw new Error(await updateRes.text());

        return resp(200, {
          success: true,
          newPoints: currentPoints + Number(amount),
        });
      }

      // 거절
      if (body.action === 'reject') {
        const { id, note } = body;
        if (!id) return resp(400, { error: 'id 가 필요합니다.' });

        const res = await fetch(
          `${supabaseUrl}/rest/v1/credit_applications?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              status: 'rejected',
              note: note || '',
            }),
          }
        );
        if (!res.ok) throw new Error(await res.text());

        return resp(200, { success: true });
      }

      return resp(400, { error: '알 수 없는 action 입니다.' });
    }

    return resp(405, { error: 'Method not allowed' });
  } catch (e) {
    console.error('[credit-admin]', e);
    return resp(500, { error: e.message || '서버 오류가 발생했습니다.' });
  }
};
