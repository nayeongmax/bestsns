// 회원 탈퇴: profiles 삭제 + auth.users 삭제 (SDK 없이 fetch만 사용 — Netlify 502 방지)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=UTF-8',
};

function err(status, message) {
  return { statusCode: status, headers, body: JSON.stringify({ error: message }) };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return err(405, 'POST만 지원합니다.');
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return err(401, '로그인이 필요합니다.');
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return err(500, 'Netlify 환경 변수에 SUPABASE_URL과 SUPABASE_SERVICE_KEY를 넣어 주세요.');
    }

    // 1) JWT로 현재 사용자 조회 (GoTrue GET /auth/v1/user)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: serviceKey },
    });
    if (!userRes.ok) {
      return err(401, '세션이 만료되었거나 유효하지 않습니다.');
    }
    const userData = await userRes.json();
    const userId = userData && userData.id;
    if (!userId) {
      return err(401, '사용자 정보를 읽을 수 없습니다.');
    }

    // 2) Auth(Users) 삭제 — GoTrue Admin DELETE
    const deleteAuthRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ should_soft_delete: false }),
    });

    if (!deleteAuthRes.ok) {
      const errBody = await deleteAuthRes.text();
      let msg = errBody;
      try {
        const j = JSON.parse(errBody);
        msg = j.msg || j.message || j.error_description || errBody;
      } catch (_) {}
      return err(400, `Auth 삭제 실패: ${msg}`);
    }

    // 3) profiles 삭제 — PostgREST DELETE
    const profilesRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Prefer': 'return=minimal',
        },
      }
    );
    if (!profilesRes.ok) {
      console.warn('profiles 삭제 실패:', profilesRes.status);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    return err(500, (e && (e.message || String(e))) || '오류가 발생했습니다.');
  }
};
