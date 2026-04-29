/**
 * freelancer-admin.js — 프리랜서 수익통장 어드민 관리 (서버사이드)
 *
 * service_role 키를 사용하므로 RLS를 우회합니다.
 * 인증: 요청 헤더 x-admin-key 가 VITE_ADMIN_PANEL_PASSWORD 와 일치해야 합니다.
 *
 * POST { action:'pay',                applicants:[{userId,reward,taskTitle}] }
 * POST { action:'fetchWithdrawals',   status:'pending' }
 * POST { action:'completeWithdrawal', id, userId, amount, bankName, accountNo }
 * POST { action:'failWithdrawal',     id, userId, amount }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

const FREELANCER_FEE_RATE = 0.116; // 5% + 3.3% + 3.3%

function resp(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '{}' };
  }

  // ── 관리자 인증 ──────────────────────────────────────────────
  const adminKey = event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '';
  const expectedKey =
    process.env.VITE_ADMIN_PANEL_PASSWORD ||
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    '';

  if (!expectedKey || adminKey !== expectedKey) {
    return resp(401, { error: '관리자 인증 실패' });
  }

  // ── Supabase 환경변수 ─────────────────────────────────────────
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    return resp(500, { error: 'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.' });
  }

  const h = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  async function dbGet(path) {
    const res = await fetch(`${supabaseUrl}/rest/v1${path}`, { headers: h });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
    return res.json();
  }

  async function dbPost(path, body, prefer = 'return=minimal') {
    const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      method: 'POST',
      headers: { ...h, Prefer: prefer },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  async function dbPatch(path, body) {
    const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
      method: 'PATCH',
      headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
    return null;
  }

  async function getBalance(userId) {
    const rows = await dbGet(`/freelancer_balances?user_id=eq.${encodeURIComponent(userId)}&select=balance`);
    return rows.length > 0 ? Number(rows[0].balance) : 0;
  }

  async function upsertBalance(userId, balance) {
    const value = Math.max(0, Math.round(balance));
    await fetch(`${supabaseUrl}/rest/v1/freelancer_balances`, {
      method: 'POST',
      headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, balance: value, updated_at: new Date().toISOString() }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`upsertBalance → ${r.status} ${await r.text()}`);
    });
  }

  async function addEarning(userId, type, amount, label) {
    const id = `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await dbPost('/freelancer_earnings_history', { id, user_id: userId, type, amount, label: label || null });
  }

  // ── 액션 처리 ─────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return resp(400, { error: '잘못된 요청 형식' });
  }

  const { action } = body;

  try {
    // ── pay: 즉시지급 ─────────────────────────────────────────
    if (action === 'pay') {
      const { applicants } = body; // [{userId, reward, taskTitle}]
      if (!Array.isArray(applicants) || applicants.length === 0) {
        return resp(400, { error: 'applicants 배열이 필요합니다.' });
      }
      for (const a of applicants) {
        const netAmount = Math.round(a.reward * (1 - FREELANCER_FEE_RATE));
        const cur = await getBalance(a.userId);
        await upsertBalance(a.userId, cur + netAmount);
        await addEarning(a.userId, 'task', a.reward, a.taskTitle || '');
      }
      return resp(200, { ok: true, paid: applicants.length });
    }

    // ── fetchWithdrawals: 출금 신청 목록 조회 ──────────────────
    if (action === 'fetchWithdrawals') {
      const status = body.status || 'pending';
      const path = status === 'all'
        ? `/freelancer_withdraw_requests?order=requested_at.desc`
        : `/freelancer_withdraw_requests?status=eq.${encodeURIComponent(status)}&order=requested_at.desc`;
      const rows = await dbGet(path);
      return resp(200, { ok: true, data: rows });
    }

    // ── completeWithdrawal: 입금 완료 처리 ────────────────────
    if (action === 'completeWithdrawal') {
      const { id } = body;
      await dbPatch(
        `/freelancer_withdraw_requests?id=eq.${encodeURIComponent(id)}`,
        { status: 'completed', completed_at: new Date().toISOString() }
      );
      return resp(200, { ok: true });
    }

    // ── failWithdrawal: 입금 실패 + 잔액 환급 ─────────────────
    if (action === 'failWithdrawal') {
      const { id, userId, amount } = body;
      const cur = await getBalance(userId);
      await upsertBalance(userId, cur + Math.max(0, amount));
      const refundId = `refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await dbPost('/freelancer_earnings_history', {
        id: refundId,
        user_id: userId,
        type: 'task',
        amount: Math.max(0, amount),
        label: '출금 실패 환급',
      });
      await dbPatch(
        `/freelancer_withdraw_requests?id=eq.${encodeURIComponent(id)}`,
        { status: 'failed', completed_at: new Date().toISOString() }
      );
      return resp(200, { ok: true });
    }

    return resp(400, { error: `알 수 없는 action: ${action}` });

  } catch (err) {
    console.error('[freelancer-admin]', err);
    return resp(500, { error: err.message || '서버 오류' });
  }
};
