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

    // 2) profiles 먼저 삭제 (Auth 삭제 시 FK/트리거 이슈·락 감소, 연속 탈퇴 시에도 안정)
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
    if (!profilesRes.ok && profilesRes.status !== 404) {
      console.warn('profiles 삭제 실패:', profilesRes.status, await profilesRes.text());
    }

    // 3) Auth(Users) 삭제 — GoTrue Admin DELETE
    const deleteAuthRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ should_soft_delete: false }),
    });

    // 이미 삭제된 사용자(404)면 성공으로 처리 (중복 요청·재시도 시 안정)
    if (deleteAuthRes.status === 404) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }
    if (!deleteAuthRes.ok) {
      const errBody = await deleteAuthRes.text();
      let msg = errBody;
      try {
        const j = JSON.parse(errBody);
        msg = j.msg || j.message || j.error_description || errBody;
      } catch (_) {}
      return err(400, `Auth 삭제 실패: ${msg}`);
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
